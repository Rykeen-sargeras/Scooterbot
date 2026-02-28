import discord
from discord.ext import commands, tasks
import io
import os
import re
import json
import aiohttp
from threading import Thread
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

# EST timezone (UTC-5)
EST = timezone(timedelta(hours=-5))
# Central timezone (UTC-6)
CST = timezone(timedelta(hours=-6))
# CST timezone (UTC-6)
CST = timezone(timedelta(hours=-6))

# ========================================
# KEEP-ALIVE WEB SERVER
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
# CONFIGURATION
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
MAIN_CHAT_CHANNEL_ID = int(os.getenv('MAIN_CHAT_CHANNEL_ID', 0))

YOUTUBE_CHANNEL_ID = 'UCxxxxxxxxxxxxxxxxxxxxxxxx'
already_announced_stream_id = None

# Ticket tracking
ticket_counter = 0
TICKET_COUNTER_FILE = '/tmp/ticket_counter.json'

# Active DM sessions: user_id -> {step, reported_user, offense, proof, proof_images}
dm_sessions = {}

def load_ticket_counter():
    global ticket_counter
    try:
        with open(TICKET_COUNTER_FILE, 'r') as f:
            ticket_counter = json.load(f).get('counter', 0)
    except (FileNotFoundError, json.JSONDecodeError):
        ticket_counter = 0

def save_ticket_counter():
    with open(TICKET_COUNTER_FILE, 'w') as f:
        json.dump({'counter': ticket_counter}, f)

# ==========================================
# BOT SETUP
# ==========================================
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


# ==========================================
# HELPERS
# ==========================================
def is_authorized(ctx):
    if ctx.author.id == SCOOTER_ID:
        return True
    if any(role.id in (MOD_ROLE_ID, ADMIN_ROLE_ID) for role in ctx.author.roles):
        return True
    return False


def is_staff_member(member):
    if member.id == SCOOTER_ID:
        return True
    if any(role.id in (MOD_ROLE_ID, ADMIN_ROLE_ID) for role in member.roles):
        return True
    return False


# ==========================================
# ADDRESS DETECTION
# ==========================================
FALSE_POSITIVE_PHRASES = [
    'hard drive', 'flash drive', 'thumb drive', 'pen drive', 'usb drive',
    'google drive', 'disk drive', 'solid state drive', 'ssd drive',
    'test drive', 'drive through', 'drive thru', 'sex drive',
    'terra byte drive', 'terabyte drive', 'byte drive',
    'main street journal', 'wall street', 'sesame street',
    'road trip', 'road map', 'roadmap', 'road test', 'road block', 'roadblock',
    'trail mix', 'trail run', 'paper trail', 'hiking trail',
    'round trip', 'place holder', 'placeholder', 'first place',
    'second place', 'third place', 'market place', 'marketplace',
    'take place', 'work place', 'workplace', 'taking place',
    'court case', 'court order', 'court date', 'basketball court',
    'tennis court', 'food court', 'court martial',
    'lane change', 'fast lane', 'bowling lane', 'swim lane',
    'circuit board', 'short circuit',
    'avenue q', 'media station',
    'drive media', 'drive bay', 'drive space', 'drive capacity',
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

    # Full address: number + street + city + state (+ optional zip)
    full_address = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?[,.\s]+(?:' + US_STATES_ABBREV + r'|' + US_STATES_FULL + r')'
        r'(?:\s+\d{5}(?:-\d{4})?)?\b',
        re.IGNORECASE
    )
    match = full_address.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Street + zip code
    street_plus_zip = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*\d{5}(?:-\d{4})?\b',
        re.IGNORECASE
    )
    match = street_plus_zip.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Street + apartment/unit
    street_plus_unit = re.compile(
        r'\b\d{1,6}\s+[A-Za-z\s]{2,25}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*(?:apt|apartment|unit|suite|ste|#)\s*\w{1,6}\b',
        re.IGNORECASE
    )
    match = street_plus_unit.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # PO Box + city/state
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
    params = {'part': 'snippet', 'q': 'Scooter-13', 'type': 'channel', 'key': YOUTUBE_API_KEY}
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
        'part': 'snippet', 'channelId': YOUTUBE_CHANNEL_ID,
        'eventType': 'live', 'type': 'video', 'key': YOUTUBE_API_KEY
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


async def check_upcoming_stream():
    """Check if Scooter has a scheduled upcoming live stream."""
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
        'part': 'snippet', 'channelId': YOUTUBE_CHANNEL_ID,
        'eventType': 'upcoming', 'type': 'video', 'key': YOUTUBE_API_KEY
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get('items'):
                    video = data['items'][0]
                    video_id = video['id']['videoId']

                    details_url = "https://www.googleapis.com/youtube/v3/videos"
                    details_params = {
                        'part': 'liveStreamingDetails,snippet',
                        'id': video_id,
                        'key': YOUTUBE_API_KEY
                    }
                    async with session.get(details_url, params=details_params) as details_resp:
                        if details_resp.status == 200:
                            details_data = await details_resp.json()
                            if details_data.get('items'):
                                item = details_data['items'][0]
                                scheduled_time = item.get('liveStreamingDetails', {}).get('scheduledStartTime', 'Unknown')
                                return {
                                    'video_id': video_id,
                                    'title': video['snippet']['title'],
                                    'url': f"https://www.youtube.com/watch?v={video_id}",
                                    'scheduled_time': scheduled_time
                                }
    return None


@tasks.loop(minutes=1)
async def live_stream_checker():
    global already_announced_stream_id

    now = datetime.now(timezone.utc)

    # Check for LIVE streams every hour at :05
    if now.minute == 5:
        stream = await check_live_stream()
        if stream and stream['video_id'] != already_announced_stream_id:
            already_announced_stream_id = stream['video_id']
            # LIVE NOW goes to ANNOUNCEMENT channel with @everyone
            channel = bot.get_channel(ANNOUNCEMENT_CHANNEL_ID)
            if channel:
                live_msg = await channel.send(
                    f"@everyone 🔴 **Scooter is LIVE NOW!**\n\n"
                    f"**{stream['title']}**\n{stream['url']}"
                )
                # Publish to followers
                try:
                    await live_msg.publish()
                except Exception:
                    pass
        elif not stream:
            already_announced_stream_id = None

    # Check for UPCOMING streams every minute (announces at 2hr, 1.5hr, 1hr, 30min, 5min)
    upcoming = await check_upcoming_stream()
    if upcoming and upcoming.get('scheduled_time'):
        try:
            scheduled_dt = datetime.fromisoformat(upcoming['scheduled_time'].replace('Z', '+00:00'))
            diff = scheduled_dt - now
            minutes_until = diff.total_seconds() / 60

            # Only care about streams within 2 hours
            if 0 < minutes_until <= 121:
                # Announce at these minute marks (with a 1-min window to catch it)
                announce_at = [120, 90, 60, 30, 5]
                for mark in announce_at:
                    if mark - 1 <= minutes_until <= mark + 1:
                        # Build a unique key so we don't double-announce the same mark
                        announce_key = f"{upcoming['video_id']}-{mark}"
                        if announce_key == getattr(live_stream_checker, '_last_announce', None):
                            break  # Already announced this one

                        live_stream_checker._last_announce = announce_key

                        # 2hr notice goes to ANNOUNCEMENT channel, rest go to MAIN CHAT
                        if mark == 120:
                            channel = bot.get_channel(ANNOUNCEMENT_CHANNEL_ID)
                        else:
                            channel = bot.get_channel(MAIN_CHAT_CHANNEL_ID)

                        if channel:
                            if mark >= 60:
                                time_label = f"{mark // 60} hour{'s' if mark >= 120 else ''}"
                            else:
                                time_label = f"{mark} minutes"

                            if mark == 5:
                                hype = "⏰🔥"
                            elif mark == 30:
                                hype = "⏰"
                            elif mark == 60:
                                hype = "📢"
                            else:
                                hype = "📅"

                            embed = discord.Embed(
                                title=f"{hype} Scooter goes LIVE in {time_label}!",
                                color=discord.Color.gold(),
                                timestamp=now
                            )
                            embed.add_field(name="Stream", value=upcoming['title'], inline=False)
                            embed.add_field(
                                name="Starts At",
                                value=f"{scheduled_dt.astimezone(EST).strftime('%I:%M %p')} EST / {scheduled_dt.astimezone(CST).strftime('%I:%M %p')} CT",
                                inline=True
                            )
                            embed.add_field(name="Link", value=upcoming['url'], inline=False)

                            sent_msg = await channel.send(embed=embed)

                            # Publish the 2hr notice to followers
                            if mark == 120:
                                try:
                                    await sent_msg.publish()
                                except Exception:
                                    pass
                        break
        except (ValueError, TypeError):
            pass


@live_stream_checker.before_loop
async def before_live_check():
    await bot.wait_until_ready()


# ==========================================
# BOT EVENTS
# ==========================================
@bot.event
async def on_ready():
    load_ticket_counter()
    print(f'Logged in as {bot.user.name} and ready!')
    print(f'Ticket counter: {ticket_counter}')
    if not live_stream_checker.is_running():
        live_stream_checker.start()
    print("All systems go.")


@bot.event
async def on_message(message):
    global ticket_counter

    if message.author.bot:
        return

    # ==============================
    # ADDRESS DETECTION (guild only)
    # ==============================
    if message.guild and message.content:
        if not is_staff_member(message.author):
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
                    await author.timeout(timedelta(hours=12), reason="Posted what appears to be a real address")
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

    # ==============================
    # DM REPORT SYSTEM
    # ==============================
    if isinstance(message.channel, discord.DMChannel):
        guild = bot.get_guild(GUILD_ID)
        if guild is None:
            print("Error: Cannot find guild.")
            return

        member = guild.get_member(message.author.id)
        if member is None:
            await message.channel.send("You must be in the server to open a report.")
            return

        user_id = message.author.id

        # --- ACTIVE SESSION: user is in the middle of a report ---
        if user_id in dm_sessions:
            session = dm_sessions[user_id]
            step = session['step']

            # Cancel at any time
            if message.content.strip().lower() == 'cancel':
                del dm_sessions[user_id]
                await message.channel.send("❌ Report cancelled. DM me again anytime to start a new one.")
                return

            # STEP 1: Who are you reporting?
            if step == 'awaiting_username':
                session['reported_user'] = message.content.strip()
                session['step'] = 'awaiting_offense'
                await message.add_reaction('✅')
                await message.channel.send(
                    "✅ Got it.\n\n"
                    "**Step 2/3 — What did they do?**\n"
                    "Describe the offense or rule they broke."
                )
                return

            # STEP 2: What did they do?
            elif step == 'awaiting_offense':
                session['offense'] = message.content.strip()
                session['step'] = 'awaiting_proof'
                await message.add_reaction('✅')
                await message.channel.send(
                    "✅ Got it.\n\n"
                    "**Step 3/3 — Do you have proof?**\n"
                    "Send a screenshot, image, link, or description.\n"
                    "Type `none` if you don't have any."
                )
                return

            # STEP 3: Proof
            elif step == 'awaiting_proof':
                proof_text = message.content.strip() if message.content.strip().lower() != 'none' else 'No proof provided'
                proof_images = [att.url for att in message.attachments] if message.attachments else []
                session['proof'] = proof_text
                session['proof_images'] = proof_images

                await message.add_reaction('✅')
                await message.channel.send("✅ All info received. **Creating ticket now...**")

                # --- CREATE TICKET CHANNEL ---
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

                # --- BUILD REPORT EMBED ---
                embed = discord.Embed(
                    title=f"📋 Ticket-{ticket_number}",
                    color=discord.Color.red(),
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
                embed.set_footer(text=f"Reported by {member.name} • ID: {member.id}")

                await ticket_channel.send(embed=embed)

                # Send proof images if attached
                if proof_images:
                    for img_url in proof_images:
                        await ticket_channel.send(f"📎 **Attached proof:** {img_url}")

                # Notify reporter
                await message.channel.send(
                    f"🎫 **Ticket-{ticket_number}** has been created!\n"
                    f"You can follow up in {ticket_channel.mention}\n"
                    f"A moderator will review your report shortly."
                )

                # Clean up session
                del dm_sessions[user_id]
                return

        # --- NO ACTIVE SESSION: start a new report ---
        else:
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
            return

    # Let commands still work
    await bot.process_commands(message)


# ==========================================
# COMMANDS
# ==========================================
@bot.command()
async def close(ctx):
    """Close a ticket channel. Archives transcript to log channel."""
    if ctx.channel.name.startswith("ticket-") or ctx.channel.name.startswith("report-"):
        await ctx.send("📁 Archiving ticket and closing channel...")

        # Build transcript
        transcript = f"--- Transcript for {ctx.channel.name} ---\n"
        transcript += f"--- Closed by {ctx.author.name} at {datetime.now(EST).strftime('%Y-%m-%d %H:%M:%S')} EST / {datetime.now(CST).strftime('%H:%M:%S')} CT ---\n\n"
        async for msg in ctx.channel.history(limit=None, oldest_first=True):
            est_time = msg.created_at.replace(tzinfo=timezone.utc).astimezone(EST).strftime("%Y-%m-%d %H:%M:%S")
            cst_time = msg.created_at.replace(tzinfo=timezone.utc).astimezone(CST).strftime("%H:%M:%S")
            time_formatted = f"{est_time} EST / {cst_time} CT"
            content = msg.content if msg.content else "[embed or attachment]"
            transcript += f"[{time_formatted}] {msg.author.name}: {content}\n"

        transcript_file = discord.File(io.StringIO(transcript), filename=f"{ctx.channel.name}-archive.txt")

        # Send archive to log channel
        log_channel = bot.get_channel(LOG_CHANNEL_ID)
        if log_channel:
            archive_embed = discord.Embed(
                title=f"🔒 {ctx.channel.name} — Closed",
                color=discord.Color.dark_grey(),
                timestamp=datetime.now(timezone.utc)
            )
            archive_embed.add_field(name="Closed By", value=ctx.author.mention, inline=True)
            archive_embed.add_field(name="Channel", value=ctx.channel.name, inline=True)
            archive_embed.set_footer(text="Transcript attached below")
            await log_channel.send(embed=archive_embed, file=transcript_file)

        # Delete the channel
        await ctx.channel.delete(reason=f"Ticket closed by {ctx.author.name}")
    else:
        await ctx.send("⚠️ This command can only be used inside a ticket channel.")


@bot.command()
async def checklive(ctx):
    """Check if Scooter is currently live or has a scheduled stream."""
    await ctx.send("🔍 Checking YouTube...")

    # Check if currently live
    stream = await check_live_stream()
    if stream:
        await ctx.send(f"🔴 **Scooter is LIVE right now!**\n{stream['title']}\n{stream['url']}")
        return

    # Check for scheduled upcoming streams
    upcoming = await check_upcoming_stream()
    if upcoming:
        # Format the scheduled time nicely
        try:
            scheduled_dt = datetime.fromisoformat(upcoming['scheduled_time'].replace('Z', '+00:00'))
            time_str = f"{scheduled_dt.astimezone(EST).strftime('%B %d, %Y at %I:%M %p')} EST / {scheduled_dt.astimezone(CST).strftime('%I:%M %p')} CT"
            # Calculate how long until the stream
            now = datetime.now(timezone.utc)
            diff = scheduled_dt - now
            if diff.total_seconds() > 0:
                hours = int(diff.total_seconds() // 3600)
                minutes = int((diff.total_seconds() % 3600) // 60)
                countdown = f"⏰ Starting in **{hours}h {minutes}m**"
            else:
                countdown = "⏰ Should be starting any moment!"
        except (ValueError, TypeError):
            time_str = upcoming['scheduled_time']
            countdown = ""

        embed = discord.Embed(
            title="📅 Upcoming Live Stream Scheduled!",
            color=discord.Color.gold(),
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Title", value=upcoming['title'], inline=False)
        embed.add_field(name="Scheduled For", value=time_str, inline=True)
        if countdown:
            embed.add_field(name="Countdown", value=countdown, inline=True)
        embed.add_field(name="Link", value=upcoming['url'], inline=False)
        await ctx.send(embed=embed)
    else:
        await ctx.send("Scooter is not live and has no upcoming streams scheduled.")


@bot.command()
async def offline(ctx):
    """Set the bot to invisible. Mods/Admins/Scooter only."""
    if not is_authorized(ctx):
        await ctx.send("⛔ You don't have permission to use this command.")
        return
    await bot.change_presence(status=discord.Status.invisible)
    await ctx.send("Bot is now in **offline** mode. (Powering down any issues contact Admin/Mods)")


@bot.command()
async def online(ctx):
    """Set the bot back to online. Mods/Admins/Scooter only."""
    if not is_authorized(ctx):
        await ctx.send("⛔ You don't have permission to use this command.")
        return
    await bot.change_presence(status=discord.Status.online)
    await ctx.send("Bot is back **online**! ✅")


# ==========================================
# RUN
# ==========================================
bot.run(BOT_TOKEN)
