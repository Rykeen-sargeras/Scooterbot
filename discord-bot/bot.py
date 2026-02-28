import discord
from discord.ext import commands, tasks
import uuid
import io
import os
import re
import json
import aiohttp
from threading import Thread
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

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
MOD_CHANNEL_ID = int(os.getenv('MOD_CHANNEL_ID', 0))
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY', '')
ANNOUNCEMENT_CHANNEL_ID = int(os.getenv('ANNOUNCEMENT_CHANNEL_ID', 0))

# Scooter's YouTube Channel ID
YOUTUBE_CHANNEL_ID = 'UCxxxxxxxxxxxxxxxxxxxxxxxx'

# Track state
already_announced_stream_id = None
ticket_counter = 0  # Will be loaded/saved
dm_sessions = {}    # Tracks ongoing DM report conversations

# File to persist ticket counter
TICKET_COUNTER_FILE = '/tmp/ticket_counter.json'

def load_ticket_counter():
    global ticket_counter
    try:
        with open(TICKET_COUNTER_FILE, 'r') as f:
            data = json.load(f)
            ticket_counter = data.get('counter', 0)
    except (FileNotFoundError, json.JSONDecodeError):
        ticket_counter = 0

def save_ticket_counter():
    with open(TICKET_COUNTER_FILE, 'w') as f:
        json.dump({'counter': ticket_counter}, f)

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
# ADDRESS DETECTION (strict — requires multiple
# address components to avoid false positives)
# ==========================================

# Words that look like street suffixes but aren't addresses
FALSE_POSITIVE_PHRASES = [
    'hard drive', 'flash drive', 'thumb drive', 'pen drive', 'usb drive',
    'google drive', 'disk drive', 'solid state drive', 'ssd drive',
    'test drive', 'drive through', 'drive thru', 'sex drive',
    'main street journal', 'wall street', 'sesame street',
    'road trip', 'road map', 'roadmap', 'road test', 'road block',
    'trail mix', 'trail run', 'paper trail', 'hiking trail',
    'round trip', 'place holder', 'placeholder', 'first place',
    'second place', 'third place', 'market place', 'marketplace',
    'take place', 'work place', 'workplace',
    'court case', 'court order', 'court date', 'basketball court',
    'tennis court', 'food court', 'court martial',
    'lane change', 'fast lane', 'bowling lane', 'swim lane',
    'circuit board', 'short circuit',
    'avenue q',
    'terra byte drive', 'terabyte drive', 'byte drive', 'media station',
]

STREET_SUFFIXES = (
    r'(?:street|avenue|boulevard|blvd|drive|lane|road|'
    r'court|circle|place|terrace|trail|'
    r'parkway|pkwy|highway|hwy|loop|pike|alley)'
)

STREET_ABBREVS = r'(?:st\.?|ave\.?|dr\.?|ln\.?|rd\.?|ct\.?|cir\.?|pl\.?|ter\.?|trl\.?|aly\.?)'

US_STATES_ABBREV = (
    r'(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|'
    r'MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|'
    r'TN|TX|UT|VT|VA|WA|WV|WI|WY)'
)

US_STATES_FULL = (
    r'(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|'
    r'Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|'
    r'Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|'
    r'Mississippi|Missouri|Montana|Nebraska|Nevada|New\s?Hampshire|'
    r'New\s?Jersey|New\s?Mexico|New\s?York|North\s?Carolina|North\s?Dakota|'
    r'Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s?Island|South\s?Carolina|'
    r'South\s?Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|'
    r'West\s?Virginia|Wisconsin|Wyoming)'
)


def has_false_positive(text):
    lower = text.lower()
    return any(phrase in lower for phrase in FALSE_POSITIVE_PHRASES)


def looks_like_address(text):
    check = text.strip()

    if has_false_positive(check):
        return None

    full_address = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?[,.\s]+(?:' + US_STATES_ABBREV + r'|' + US_STATES_FULL + r')'
        r'(?:\s+\d{5}(?:-\d{4})?)?\b',
        re.IGNORECASE
    )

    match = full_address.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    street_plus_zip = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*\d{5}(?:-\d{4})?\b',
        re.IGNORECASE
    )

    match = street_plus_zip.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    street_plus_unit = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*(?:apt|apartment|unit|suite|ste|#)\s*\w{1,6}\b',
        re.IGNORECASE
    )

    match = street_plus_unit.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    po_box = re.compile(
        r'\bP\.?\s*O\.?\s*Box\s+\d+[,.\s]+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?[,.\s]+(?:' + US_STATES_ABBREV + r'|' + US_STATES_FULL + r')'
        r'(?:\s+\d{5}(?:-\d{4})?)?\b',
        re.IGNORECASE
    )

    match = po_box.search(check)
    if match:
        return match.group()

    return None


# ==========================================
# YOUTUBE LIVE STREAM CHECKER
# ==========================================
async def get_youtube_channel_id():
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
    global YOUTUBE_CHANNEL_ID

    if not YOUTUBE_API_KEY:
        return None

    if YOUTUBE_CHANNEL_ID.startswith('UCx'):
        resolved = await get_youtube_channel_id()
        if resolved:
            YOUTUBE_CHANNEL_ID = resolved
        else:
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
    global already_announced_stream_id

    now = datetime.now(timezone.utc)
    if now.minute != 5:
        return

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
    load_ticket_counter()
    print(f'Logged in as {bot.user.name} and ready to accept reports!')
    print(f'Current ticket counter: {ticket_counter}')
    if not live_stream_checker.is_running():
        live_stream_checker.start()
    print("YouTube live stream checker started (checks every hour at :05)")


@bot.event
async def on_message(message):
    global ticket_counter

    if message.author.bot:
        return

    # ---- ADDRESS DETECTION (only in guild channels) ----
    if message.guild and message.content:
        is_staff = message.author.id == SCOOTER_ID or any(
            role.id in (MOD_ROLE_ID, ADMIN_ROLE_ID) for role in message.author.roles
        )

        if not is_staff:
            detected = looks_like_address(message.content)
            if detected:
                author = message.author
                channel = message.channel
                content = message.content

                try:
                    await message.delete()
                except discord.Forbidden:
                    pass

                try:
                    await author.timeout(
                        timedelta(hours=12),
                        reason="Posted what appears to be a real address"
                    )
                except discord.Forbidden:
                    pass

                mod_channel = bot.get_channel(MOD_CHANNEL_ID)
                if mod_channel:
                    embed = discord.Embed(
                        title="🚨 Address Detected & Removed",
                        color=discord.Color.red(),
                        timestamp=datetime.now(timezone.utc)
                    )
                    embed.add_field(name="User", value=f"{author.mention} ({author.name})", inline=True)
                    embed.add_field(name="Channel", value=f"#{channel.name}", inline=True)
                    embed.add_field(name="Action Taken", value="Message deleted + 12hr timeout", inline=True)
                    embed.add_field(name="Detected Pattern", value=f"||{detected}||", inline=False)
                    embed.add_field(name="Full Message", value=f"||{content[:500]}||", inline=False)
                    embed.set_footer(text="Address content hidden in spoiler tags for safety")

                    await mod_channel.send(embed=embed)

                return

    # ---- DM REPORT SYSTEM (guided flow) ----
    if isinstance(message.channel, discord.DMChannel):
        guild = bot.get_guild(GUILD_ID)
        if guild is None:
            return

        member = guild.get_member(message.author.id)
        if member is None:
            await message.channel.send("You must be in the server to open a report.")
            return

        user_id = message.author.id

        # Check if user has an active DM session
        if user_id in dm_sessions:
            session = dm_sessions[user_id]
            step = session['step']

            # Cancel at any time
            if message.content.lower() == 'cancel':
                del dm_sessions[user_id]
                await message.channel.send("❌ Report cancelled. Send any message to start a new one.")
                return

            if step == 'awaiting_username':
                session['reported_user'] = message.content
                session['step'] = 'awaiting_offense'
                await message.add_reaction('✅')
                await message.channel.send(
                    "✅ Got it.\n\n"
                    "**Step 2/3 — What did they do?**\n"
                    "Describe the offense or rule they broke."
                )

            elif step == 'awaiting_offense':
                session['offense'] = message.content
                session['step'] = 'awaiting_proof'
                await message.add_reaction('✅')
                await message.channel.send(
                    "✅ Got it.\n\n"
                    "**Step 3/3 — Do you have proof?**\n"
                    "Send a screenshot, link, or description.\n"
                    "Type `none` if you don't have any."
                )

            elif step == 'awaiting_proof':
                # Collect proof (text and/or attachments)
                proof_text = message.content if message.content.lower() != 'none' else 'No proof provided'
                proof_images = [att.url for att in message.attachments] if message.attachments else []
                session['proof'] = proof_text
                session['proof_images'] = proof_images

                await message.add_reaction('✅')
                await message.channel.send("✅ All info received. **Creating ticket now...**")

                # --- CREATE THE TICKET ---
                ticket_counter += 1
                save_ticket_counter()

                ticket_number = f"{ticket_counter:04d}"
                channel_name = f"ticket-{ticket_number}"

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
                    reason=f"Report ticket by {message.author.name}"
                )

                # Build the report embed
                embed = discord.Embed(
                    title=f"📋 Ticket-{ticket_number}",
                    color=discord.Color.blue(),
                    timestamp=datetime.now(timezone.utc)
                )
                embed.set_author(
                    name=f"Report by {member.display_name}",
                    icon_url=member.avatar.url if member.avatar else member.default_avatar.url
                )
                embed.add_field(
                    name="👤 Reported User",
                    value=session['reported_user'],
                    inline=True
                )
                embed.add_field(
                    name="📌 Status",
                    value="🟡 Open",
                    inline=True
                )
                embed.add_field(
                    name="⚠️ Offense",
                    value=session['offense'],
                    inline=False
                )
                embed.add_field(
                    name="🔗 Proof",
                    value=proof_text,
                    inline=False
                )
                embed.set_footer(text=f"Ticket opened by {member.name} • ID: {member.id}")

                await ticket_channel.send(embed=embed)

                # Send proof images if any
                if proof_images:
                    for img_url in proof_images:
                        await ticket_channel.send(f"📎 **Attached proof:** {img_url}")

                # Notify the reporter
                await message.channel.send(
                    f"🎫 **Ticket-{ticket_number}** has been created!\n"
                    f"You can follow up in {ticket_channel.mention}\n"
                    f"A moderator will review your report shortly."
                )

                # Clean up the session
                del dm_sessions[user_id]

            return  # Don't process commands during DM flow

        else:
            # No active session — start a new one
            dm_sessions[user_id] = {
                'step': 'awaiting_username',
                'reported_user': None,
                'offense': None,
                'proof': None,
                'proof_images': [],
            }

            await message.channel.send(
                "📨 **ScooterBot Report System**\n\n"
                "I'll walk you through filing a report.\n"
                "You can type `cancel` at any time to stop.\n\n"
                "**Step 1/3 — Who are you reporting?**\n"
                "Enter the username or display name of the user."
            )

            # Check if they typed "cancel"
            return

    await bot.process_commands(message)


# ==========================================
# COMMANDS
# ==========================================
@bot.command()
async def close(ctx):
    if ctx.channel.name.startswith("ticket-"):
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
        await ctx.send("This command can only be used inside a ticket channel.")


@bot.command()
async def checklive(ctx):
    await ctx.send("Checking YouTube...")
    stream = await check_live_stream()
    if stream:
        await ctx.send(f"🔴 **Scooter is LIVE!**\n{stream['title']}\n{stream['url']}")
    else:
        await ctx.send("Scooter is not live right now.")


@bot.command()
async def offline(ctx):
    if not is_authorized(ctx):
        await ctx.send("You don't have permission to use this command.")
        return

    await bot.change_presence(status=discord.Status.invisible)
    await ctx.send("Bot is now in **offline** mode. (Powering down any issues contact Admin/Mods)")


@bot.command()
async def online(ctx):
    if not is_authorized(ctx):
        await ctx.send("You don't have permission to use this command.")
        return

    await bot.change_presence(status=discord.Status.online)
    await ctx.send("Bot is back **online**! ✅")


bot.run(BOT_TOKEN)
