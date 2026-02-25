import discord
from discord.ext import commands
import uuid
import io
import os
import time
import threading
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

# ========================================
# KEEP-ALIVE WEB SERVER + PING PARTNER
# ========================================
KEEPALIVE_URL = os.getenv('KEEPALIVE_URL')  # The other Render service URL

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Bot is running")
    def log_message(self, format, *args):
        pass

def run_server():
    HTTPServer(("0.0.0.0", 10000), Handler).serve_forever()

def ping_partner():
    while True:
        try:
            urllib.request.urlopen(KEEPALIVE_URL)
            print(f"Pinged keep-alive at {KEEPALIVE_URL}")
        except:
            print("Ping to keep-alive failed")
        time.sleep(300)  # every 5 minutes

threading.Thread(target=run_server, daemon=True).start()
threading.Thread(target=ping_partner, daemon=True).start()

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

# Setup intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name} and ready to accept reports!')


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


bot.run(BOT_TOKEN)
