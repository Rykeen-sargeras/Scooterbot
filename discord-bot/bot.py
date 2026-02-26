import discord
from discord.ext import commands, tasks
import uuid
import io
import os
import aiohttp
from threading import Thread
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

# ========================================
# KEEP-ALIVE WEB SERVER (for Render Free)
# ========================================
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Bot is running")
    def log_message(self, format, *args):
        pass

def run_server():
    HTTPServer(("0.0.0.0", 10000), Handler).serve_forever()

Thread(target=run_server, daemon=True).start()

# ==========================================
# CONFIGURATION - Set these in Render's
# Environment Variables dashboard
# ==========================================
BOT_TOKEN = os.getenv('BOT_TOKEN')
GUILD_ID = int(os.getenv('GUILD_ID', 0))
MOD_ROLE_ID = int(os.getenv('MOD_ROLE_ID', 0))
ADMIN_ROLE_ID = int(os.getenv('ADMIN_ROLE_ID', 0))
SCOOTER_ID = int(os.getenv('SCOOTER_ID', 0))
LOG_CHANNEL_ID = int(os.getenv('LOG_CHANNEL_ID', 0))
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY', '')
ANNOUNCEMENT_CHANNEL_ID = int(os.getenv('ANNOUNCEMENT_CHANNEL_ID', 0))

# Scooter's YouTube Channel ID (from https://www.youtube.com/@Scooter-13)
YOUTUBE_CHANNEL_ID = 'UCxxxxxxxxxxxxxxxxxxxxxxxx'  # Will be resolved automatically

# Track whether we already announced the current stream
already_announced_stream_id = None

# Setup intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


# ==========================================
# HELPER: Check if user is authorized
# ==========================================
def is_authorized(ctx):
    """Check if the user is a Mod, Admin, or Scooter."""
    if ctx.author.id == SCOOTER_ID:
        return True
    if any(role.id in (MOD_ROLE_ID, ADMIN_ROLE_ID) for role in ctx.author.roles):
        return True
    return False


# ==========================================
# YOUTUBE LIVE STREAM CHECKER
# ==========================================
async def get_youtube_channel_id():
    """Resolve the @Scooter-13 handle to a YouTube Channel ID."""
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        'part': 'snippet',
        'q': 'Scooter-13',
        'type': 'channel',
        'key': YOUTUBE_API_KEY
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get('items'):
                    return data['items'][0]['snippet']['channelId']
    return None


async def check_live_stream():
    """Check if Scooter is currently live on YouTube."""
    global YOUTUBE_CHANNEL_ID

    if not YOUTUBE_API_KEY:
        print("No YouTube API key set, skipping live check.")
        return None

    # Resolve channel ID on first run
    if YOUTUBE_CHANNEL_ID.startswith('UCx'):
        resolved = await get_youtube_channel_id()
        if resolved:
            YOUTUBE_CHANNEL_ID = resolved
            print(f"Resolved YouTube Channel ID: {YOUTUBE_CHANNEL_ID}")
        else:
            print("Could not resolve YouTube channel ID.")
            return None

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        'part': 'snippet',
        'channelId': YOUTUBE_CHANNEL_ID,
        'eventType': 'live',
        'type': 'video',
        'key': YOUTUBE_API_KEY
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get('items'):
                    video = data['items'][0]
                    return {
                        'video_id': video['id']['videoId'],
                        'title': video['snippet']['title'],
                        'url': f"https://www.youtube.com/watch?v={video['id']['videoId']}"
                    }
    return None


@tasks.loop(minutes=1)
async def live_stream_checker():
    """Runs every minute but only acts at :05 past the hour."""
    global already_announced_stream_id

    now = datetime.now(timezone.utc)
    if now.minute != 5:
        return

    print(f"[{now.strftime('%H:%M')}] Checking for live stream...")

    stream = await check_live_stream()

    if stream and stream['video_id'] != already_announced_stream_id:
        already_announced_stream_id = stream['video_id']

        channel = bot.get_channel(ANNOUNCEMENT_CHANNEL_ID)
        if channel:
            await channel.send(
                f"@everyone 🔴 **Scooter is LIVE!**\n\n"
                f"**{stream['title']}**\n"
                f"{stream['url']}"
            )
            print(f"Announced live stream: {stream['title']}")
        else:
            print("Error: Could not find announcement channel.")
    elif not stream:
        already_announced_stream_id = None


@live_stream_checker.before_loop
async def before_live_check():
    await bot.wait_until_ready()


# ==========================================
# BOT EVENTS
# ==========================================
@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name} and ready to accept reports!')
    if not live_stream_checker.is_running():
        live_stream_checker.start()
    print("YouTube live stream checker started (checks every hour at :05)")


@bot.event
async def on_message(message):
    if message.author.bot:
        return

    if isinstance(message.channel, discord.DMChannel):
        guild = bot.get_guild(GUILD_ID)
        if guild is None:
            print("Error: Bot cannot find the specified server. Check GUILD_ID.")
            return

        member = guild.get_member(message.author.id)
        if member is None:
            await message.channel.send("You must be in the server to open a report.")
            return

        report_id = str(uuid.uuid4())[:6]
        channel_name = f"report-{report_id}"

        mod_role = guild.get_role(MOD_ROLE_ID)
        admin_role = guild.get_role(ADMIN_ROLE_ID)
        scooter = guild.get_member(SCOOTER_ID)

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            member: discord.PermissionOverwrite(read_messages=True, send_messages=True),
        }

        if mod_role:
            overwrites[mod_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
        if admin_role:
            overwrites[admin_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
        if scooter:
            overwrites[scooter] = discord.PermissionOverwrite(read_messages=True, send_messages=True)

        ticket_channel = await guild.create_text_channel(
            name=channel_name,
            overwrites=overwrites,
            reason=f"Report created by {message.author.name}"
        )

        await ticket_channel.send(f"**New Report** from {member.mention}\n**Reason:** {message.content}")
        await message.channel.send(f"Your report has been received! A private ticket has been opened in the server: {ticket_channel.mention}")

    await bot.process_commands(message)


# ==========================================
# COMMANDS
# ==========================================
@bot.command()
async def close(ctx):
    if ctx.channel.name.startswith("report-"):
        await ctx.send("Archiving ticket and closing channel...")

        transcript = f"--- Transcript for {ctx.channel.name} ---\n\n"
        async for msg in ctx.channel.history(limit=None, oldest_first=True):
            time_formatted = msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
            transcript += f"[{time_formatted}] {msg.author.name}: {msg.content}\n"

        transcript_file = discord.File(io.StringIO(transcript), filename=f"{ctx.channel.name}-archive.txt")

        log_channel = bot.get_channel(LOG_CHANNEL_ID)
        if log_channel:
            await log_channel.send(
                f"Ticket closed by {ctx.author.name}. Here is the archive for `{ctx.channel.name}`:",
                file=transcript_file
            )

        await ctx.channel.delete(reason=f"Ticket closed by {ctx.author.name}")
    else:
        await ctx.send("This command can only be used inside a report ticket channel.")


@bot.command()
async def checklive(ctx):
    """Manually check if Scooter is live right now."""
    await ctx.send("Checking YouTube...")
    stream = await check_live_stream()
    if stream:
        await ctx.send(f"🔴 **Scooter is LIVE!**\n{stream['title']}\n{stream['url']}")
    else:
        await ctx.send("Scooter is not live right now.")


@bot.command()
async def offline(ctx):
    """Set the bot to invisible (appear offline). Restricted to Mods/Admins/Scooter."""
    if not is_authorized(ctx):
        await ctx.send("You don't have permission to use this command.")
        return

    await bot.change_presence(status=discord.Status.invisible)
    await ctx.send("Bot is now in **offline** mode. (Still running, just invisible)")


@bot.command()
async def online(ctx):
    """Set the bot back to online. Restricted to Mods/Admins/Scooter."""
    if not is_authorized(ctx):
        await ctx.send("You don't have permission to use this command.")
        return

    await bot.change_presence(status=discord.Status.online)
    await ctx.send("Bot is back **online**! ✅")


bot.run(BOT_TOKEN)
