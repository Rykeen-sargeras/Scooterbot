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
BOT_TOKEN               = os.getenv('BOT_TOKEN')
GUILD_ID                = int(os.getenv('GUILD_ID', 0))
MOD_ROLE_ID             = int(os.getenv('MOD_ROLE_ID', 0))
ADMIN_ROLE_ID           = int(os.getenv('ADMIN_ROLE_ID', 0))
SCOOTER_ID              = int(os.getenv('SCOOTER_ID', 0))
LOG_CHANNEL_ID          = int(os.getenv('LOG_CHANNEL_ID', 0))
MOD_CHANNEL_ID          = int(os.getenv('MOD_CHANNEL_ID', 0))
YOUTUBE_API_KEY         = os.getenv('YOUTUBE_API_KEY', '')
ANNOUNCEMENT_CHANNEL_ID = int(os.getenv('ANNOUNCEMENT_CHANNEL_ID', 0))
MAIN_CHAT_CHANNEL_ID    = int(os.getenv('MAIN_CHAT_CHANNEL_ID', 0))

# Scooter's YouTube channel ID
YOUTUBE_CHANNEL_ID = os.getenv('YOUTUBE_CHANNEL_ID', 'UCJ0WxEUGSebWwgff9QbbzJA')

# Stream announcement tracking
already_announced_live_id = None        # track the current live stream we announced
announced_upcoming_keys   = set()       # track which upcoming milestone keys we've announced

# Ticket tracking
ticket_counter = 0
TICKET_COUNTER_FILE = '/tmp/ticket_counter.json'

# Active DM sessions
# user_id -> { 'type': 'report'|'tech', 'step': ..., ... }
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
    r'(?:street|avenue|boulevard|blvd|drive|lane|road|way|'
    r'court|circle|place|terrace|trail|close|crescent|grove|'
    r'gardens|gate|hill|mews|rise|row|square|view|walk|wharf|'
    r'parkway|pkwy|highway|hwy|loop|pike|alley|rue|via|calle)'
)
STREET_ABBREVS = r'(?:st\.?|ave\.?|dr\.?|ln\.?|rd\.?|ct\.?|cir\.?|pl\.?|ter\.?|trl\.?|aly\.?|wy\.?|blvd\.?|cres\.?)'

# International postal code patterns
POSTAL_CODE = (
    r'(?:'
    r'\d{5}(?:-\d{4})?|'                    # US: 12345 or 12345-6789
    r'[A-Z]\d[A-Z]\s?\d[A-Z]\d|'            # Canada: A1A 1A1
    r'[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|'  # UK: SW1A 1AA, M1 1AE, W1A 1HQ
    r'\d{4}|'                                # Australia/NZ/many others: 1234
    r'\d{5}-\d{3}'                           # Brazil: 12345-678
    r')'
)

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

    # Pattern 1: number (or alphanumeric like 221B) + street + city + region
    # Catches US, UK, AU, fake addresses etc.
    full_address = re.compile(
        r'\b\d{1,6}[A-Za-z]?\s+[A-Za-z\s]{2,30}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]+[A-Za-z][A-Za-z\s]{1,25}[,.\s]+[A-Za-z][A-Za-z\s]{1,25}'
        r'(?:[,.\s]+' + POSTAL_CODE + r')?\b',
        re.IGNORECASE
    )
    match = full_address.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Pattern 2: number + street + city + postcode
    # e.g. 221B Baker Street, London SW1A 1AA
    street_city_postal = re.compile(
        r'\b\d{1,6}[A-Za-z]?\s+[A-Za-z\s]{2,30}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]+[A-Za-z][A-Za-z\s]{1,25}[,.\s]*' + POSTAL_CODE + r'\b',
        re.IGNORECASE
    )
    match = street_city_postal.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Pattern 3: number + street + postal code directly (no city)
    # e.g. 456 Oak Ave 90210
    street_plus_postal = re.compile(
        r'\b\d{1,6}[A-Za-z]?\s+[A-Za-z\s]{2,30}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*' + POSTAL_CODE + r'\b',
        re.IGNORECASE
    )
    match = street_plus_postal.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Pattern 3: number + street + apt/unit/flat
    street_plus_unit = re.compile(
        r'\b\d{1,6}[A-Za-z]?\s+[A-Za-z\s]{2,30}\b(?:' + STREET_SUFFIXES + r'|' + STREET_ABBREVS + r')'
        r'\b[,.\s]*(?:apt|apartment|unit|suite|ste|flat|#)\s*\w{1,6}\b',
        re.IGNORECASE
    )
    match = street_plus_unit.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Pattern 4: prefix-style streets (Rue, Via, Calle) + name + city + region
    # e.g. 15 Rue de Rivoli, Paris, France
    prefix_street = re.compile(
        r'\b\d{1,6}[A-Za-z]?\s+(?:rue|via|calle|corso|viale|rua|avenida)\s+[A-Za-z\s]{2,30}'
        r'[,.\s]+[A-Za-z][A-Za-z\s]{1,25}[,.\s]+[A-Za-z][A-Za-z\s]{1,25}'
        r'(?:[,.\s]+' + POSTAL_CODE + r')?\b',
        re.IGNORECASE
    )
    match = prefix_street.search(check)
    if match and not has_false_positive(match.group()):
        return match.group()

    # Pattern 5: PO Box
    po_box = re.compile(
        r'\bP\.?\s*O\.?\s*Box\s+\d+[,.\s]+[A-Za-z][A-Za-z\s]{1,25}[,.\s]+[A-Za-z][A-Za-z\s]{1,25}'
        r'(?:[,.\s]+' + POSTAL_CODE + r')?\b',
        re.IGNORECASE
    )
    match = po_box.search(check)
    if match:
        return match.group()

    return None


# ==========================================
# YOUTUBE HELPERS
# ==========================================
async def check_live_stream():
    """Returns stream info dict if currently live, else None."""
    if not YOUTUBE_API_KEY:
        return None
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            'part': 'snippet',
            'channelId': YOUTUBE_CHANNEL_ID,
            'eventType': 'live',
            'type': 'video',
            'key': YOUTUBE_API_KEY
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get('items'):
                        video = data['items'][0]
                        return {
                            'video_id': video['id']['videoId'],
                            'title': video['snippet']['title'],
                            'url': f"https://www.youtube.com/watch?v={video['id']['videoId']}"
                        }
    except Exception as e:
        print(f"[ERROR] check_live_stream: {e}")
    return None


async def check_upcoming_stream():
    """
    Returns the next scheduled stream info dict, or None.
    Uses the channel uploads playlist + liveStreamingDetails for reliability.
    """
    if not YOUTUBE_API_KEY:
        return None

    try:
        uploads_playlist_id = 'UU' + YOUTUBE_CHANNEL_ID[2:]
        timeout = aiohttp.ClientTimeout(total=10)

        async with aiohttp.ClientSession() as session:
            playlist_params = {
                'part': 'snippet',
                'playlistId': uploads_playlist_id,
                'maxResults': 10,
                'key': YOUTUBE_API_KEY
            }
            async with session.get(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params=playlist_params,
                timeout=timeout
            ) as resp:
                if resp.status != 200:
                    print(f"[ERROR] check_upcoming_stream playlist status: {resp.status}")
                    return None
                playlist_data = await resp.json()
                items = playlist_data.get('items', [])
                if not items:
                    return None
                video_ids = [item['snippet']['resourceId']['videoId'] for item in items]

            details_params = {
                'part': 'liveStreamingDetails,snippet',
                'id': ','.join(video_ids),
                'key': YOUTUBE_API_KEY
            }
            async with session.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params=details_params,
                timeout=timeout
            ) as resp:
                if resp.status != 200:
                    print(f"[ERROR] check_upcoming_stream videos status: {resp.status}")
                    return None
                details_data = await resp.json()
                now = datetime.now(timezone.utc)

                for item in details_data.get('items', []):
                    live_details = item.get('liveStreamingDetails', {})
                    scheduled_time = live_details.get('scheduledStartTime')
                    actual_end     = live_details.get('actualEndTime')
                    actual_start   = live_details.get('actualStartTime')

                    if scheduled_time and not actual_end and not actual_start:
                        try:
                            scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
                            if scheduled_dt > now:
                                return {
                                    'video_id': item['id'],
                                    'title': item['snippet']['title'],
                                    'url': f"https://www.youtube.com/watch?v={item['id']}",
                                    'scheduled_time': scheduled_time
                                }
                        except (ValueError, TypeError):
                            continue
    except Exception as e:
        print(f"[ERROR] check_upcoming_stream: {e}")
    return None


# ==========================================
# HOURLY STREAM CHECKER TASK
# ==========================================
@tasks.loop(minutes=1)
async def live_stream_checker():
    try:
        global already_announced_live_id, announced_upcoming_keys

        now = datetime.now(timezone.utc)

        # --- CHECK IF LIVE (on the hour) ---
        if now.minute == 0:
            try:
                stream = await check_live_stream()
                if stream and stream['video_id'] != already_announced_live_id:
                    already_announced_live_id = stream['video_id']
                    channel = bot.get_channel(ANNOUNCEMENT_CHANNEL_ID)
                    if channel:
                        live_msg = await channel.send(
                            f"@everyone 🔴 **Scooter is LIVE NOW!**\n\n"
                            f"**{stream['title']}**\n{stream['url']}"
                        )
                        try:
                            await live_msg.publish()
                        except Exception:
                            pass
                elif not stream:
                    already_announced_live_id = None
            except Exception as e:
                print(f"[ERROR] Live stream check failed: {e}")

        # --- CHECK UPCOMING STREAM ---
        try:
            upcoming = await check_upcoming_stream()
        except Exception as e:
            print(f"[ERROR] Upcoming stream check failed: {e}")
            return

        if not upcoming or not upcoming.get('scheduled_time'):
            return

        try:
            scheduled_dt  = datetime.fromisoformat(upcoming['scheduled_time'].replace('Z', '+00:00'))
            diff          = scheduled_dt - now
            minutes_until = diff.total_seconds() / 60
        except (ValueError, TypeError):
            return

        announce_marks = [120, 60, 30, 5]

        for mark in announce_marks:
            if mark - 2 <= minutes_until <= mark + 1:
                announce_key = f"{upcoming['video_id']}-{mark}"
                if announce_key in announced_upcoming_keys:
                    break

                announced_upcoming_keys.add(announce_key)
                channel = bot.get_channel(MAIN_CHAT_CHANNEL_ID)
                if not channel:
                    break

                if mark >= 60:
                    time_label = f"{mark // 60} hour{'s' if mark > 60 else ''}"
                else:
                    time_label = f"{mark} minutes"

                emoji = "📅" if mark == 120 else "📢" if mark == 60 else "⏰" if mark == 30 else "⏰🔥"

                embed = discord.Embed(
                    title=f"{emoji} Scooter goes LIVE in {time_label}!",
                    color=discord.Color.gold(),
                    timestamp=now
                )
                embed.add_field(name="Stream", value=upcoming['title'], inline=False)
                embed.add_field(
                    name="Starts At",
                    value=(
                        f"{scheduled_dt.astimezone(EST).strftime('%I:%M %p')} EST / "
                        f"{scheduled_dt.astimezone(CST).strftime('%I:%M %p')} CT"
                    ),
                    inline=True
                )
                embed.add_field(name="Link", value=upcoming['url'], inline=False)

                try:
                    await channel.send(embed=embed)
                except Exception as e:
                    print(f"[ERROR] Sending upcoming announcement failed: {e}")
                break

    except Exception as e:
        print(f"[ERROR] live_stream_checker crashed: {e}")


@live_stream_checker.before_loop
async def before_live_check():
    await bot.wait_until_ready()


# ==========================================
# TICKET CHANNEL HELPER
# ==========================================
async def create_ticket_channel(guild, member, ticket_type, session):
    global ticket_counter
    ticket_counter += 1
    save_ticket_counter()
    ticket_number  = f"{ticket_counter:04d}"
    prefix         = "tech" if ticket_type == "tech" else "report"
    channel_name   = f"{prefix}-{ticket_number}"

    mod_role   = guild.get_role(MOD_ROLE_ID)
    admin_role = guild.get_role(ADMIN_ROLE_ID)
    scooter    = guild.get_member(SCOOTER_ID)

    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        member: discord.PermissionOverwrite(read_messages=True, send_messages=True),
    }
    if mod_role:
        overwrites[mod_role]   = discord.PermissionOverwrite(read_messages=True, send_messages=True)
    if admin_role:
        overwrites[admin_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
    if scooter:
        overwrites[scooter]    = discord.PermissionOverwrite(read_messages=True, send_messages=True)

    ticket_channel = await guild.create_text_channel(
        name=channel_name,
        overwrites=overwrites,
        reason=f"{'Tech support' if ticket_type == 'tech' else 'Report'} ticket by {member.name}"
    )

    if ticket_type == "tech":
        embed = discord.Embed(
            title=f"🔧 Tech Ticket-{ticket_number}",
            color=discord.Color.blue(),
            timestamp=datetime.now(timezone.utc)
        )
        embed.set_author(
            name=f"Tech Request by {member.display_name}",
            icon_url=member.avatar.url if member.avatar else member.default_avatar.url
        )
        embed.add_field(name="📋 Issue Description", value=session['issue'], inline=False)
        embed.add_field(name="📌 Status", value="🟡 Open", inline=True)
        embed.set_footer(text=f"Submitted by {member.name} • ID: {member.id}")
    else:
        proof_text = session.get('proof') or 'No proof provided'
        embed = discord.Embed(
            title=f"📋 Report Ticket-{ticket_number}",
            color=discord.Color.red(),
            timestamp=datetime.now(timezone.utc)
        )
        embed.set_author(
            name=f"Report by {member.display_name}",
            icon_url=member.avatar.url if member.avatar else member.default_avatar.url
        )
        embed.add_field(name="👤 Reported User",  value=session['reported_user'], inline=True)
        embed.add_field(name="📌 Status",          value="🟡 Open",               inline=True)
        embed.add_field(name="⚠️ Offense",         value=session['offense'],      inline=False)
        embed.add_field(name="🔗 Proof",           value=proof_text,              inline=False)
        embed.set_footer(text=f"Reported by {member.name} • ID: {member.id}")

    await ticket_channel.send(embed=embed)

    # Attach proof images for reports
    if ticket_type == "report" and session.get('proof_images'):
        for img_url in session['proof_images']:
            await ticket_channel.send(f"📎 **Attached proof:** {img_url}")

    return ticket_channel, ticket_number


# ==========================================
# BOT EVENTS
# ==========================================
@bot.event
async def on_ready():
    load_ticket_counter()
    print(f'Logged in as {bot.user.name} and ready!')
    print(f'Ticket counter: {ticket_counter}')
    print(f'Guilds: {[g.name for g in bot.guilds]}')
    if not live_stream_checker.is_running():
        live_stream_checker.start()
    print("All systems go.")


@bot.event
async def on_message(message):
    print(f"[RAW] on_message fired: author={message.author} guild={message.guild} content={repr(message.content[:80])}")
    if message.author.bot:
        return

    # ==============================
    # ADDRESS DETECTION (guild only)
    # ==============================
    if message.guild and message.content:
        print(f"[MSG] {message.author.name} in #{message.channel.name}: {message.content[:100]}")
        if not is_staff_member(message.author):
            detected = looks_like_address(message.content)
            print(f"[ADDR] is_staff={is_staff_member(message.author)} detected={detected}")
            if detected:
                author  = message.author
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
                    embed.add_field(name="User",          value=f"{author.mention} ({author.name})", inline=True)
                    embed.add_field(name="Channel",       value=f"#{channel.name}",                  inline=True)
                    embed.add_field(name="Action Taken",  value="Message deleted + 12hr timeout",    inline=True)
                    embed.add_field(name="Detected Pattern", value=f"||{detected}||",               inline=False)
                    embed.add_field(name="Full Message",  value=f"||{content[:500]}||",              inline=False)
                    embed.set_footer(text="Address content hidden in spoiler tags for safety")
                    await mod_channel.send(embed=embed)
                return

    # ==============================
    # DM TICKET SYSTEM
    # ==============================
    if isinstance(message.channel, discord.DMChannel):
        guild = bot.get_guild(GUILD_ID)
        if guild is None:
            return

        member = guild.get_member(message.author.id)
        if member is None:
            await message.channel.send("You must be in the server to open a ticket.")
            return

        user_id = message.author.id
        text    = message.content.strip()

        # Cancel anytime
        if text.lower() == 'cancel' and user_id in dm_sessions:
            del dm_sessions[user_id]
            await message.channel.send("❌ Ticket cancelled. DM me again anytime to start a new one.")
            return

        # ---- ACTIVE SESSION ----
        if user_id in dm_sessions:
            session = dm_sessions[user_id]
            ticket_type = session['type']
            step        = session['step']

            # ===== TECH TICKET FLOW =====
            if ticket_type == 'tech':
                if step == 'awaiting_issue':
                    session['issue'] = text
                    await message.add_reaction('✅')
                    await message.channel.send("✅ Got it. **Creating your tech ticket now...**")

                    ticket_channel, ticket_number = await create_ticket_channel(guild, member, 'tech', session)
                    await message.channel.send(
                        f"🔧 **Tech Ticket-{ticket_number}** has been created!\n"
                        f"You can follow up in {ticket_channel.mention}\n"
                        f"A staff member will assist you shortly."
                    )
                    del dm_sessions[user_id]
                    return

            # ===== REPORT TICKET FLOW =====
            elif ticket_type == 'report':
                if step == 'awaiting_username':
                    session['reported_user'] = text
                    session['step']          = 'awaiting_offense'
                    await message.add_reaction('✅')
                    await message.channel.send(
                        "✅ Got it.\n\n"
                        "**Step 2/3 — What did they do?**\n"
                        "Describe the offense or rule they broke."
                    )
                    return

                elif step == 'awaiting_offense':
                    session['offense'] = text
                    session['step']    = 'awaiting_proof'
                    await message.add_reaction('✅')
                    await message.channel.send(
                        "✅ Got it.\n\n"
                        "**Step 3/3 — Do you have proof?**\n"
                        "Send a screenshot, image, link, or description.\n"
                        "Type `none` if you don't have any."
                    )
                    return

                elif step == 'awaiting_proof':
                    proof_text          = text if text.lower() != 'none' else 'No proof provided'
                    proof_images        = [att.url for att in message.attachments] if message.attachments else []
                    session['proof']        = proof_text
                    session['proof_images'] = proof_images

                    await message.add_reaction('✅')
                    await message.channel.send("✅ All info received. **Creating report ticket now...**")

                    ticket_channel, ticket_number = await create_ticket_channel(guild, member, 'report', session)
                    await message.channel.send(
                        f"🎫 **Report Ticket-{ticket_number}** has been created!\n"
                        f"You can follow up in {ticket_channel.mention}\n"
                        f"A moderator will review your report shortly."
                    )
                    del dm_sessions[user_id]
                    return

        # ---- NO ACTIVE SESSION: show ticket type menu ----
        else:
            dm_sessions[user_id] = {'type': None, 'step': 'awaiting_type'}
            await message.channel.send(
                "👋 **Welcome to ScooterBot Support!**\n\n"
                "Please choose what kind of ticket you'd like to open:\n\n"
                "🔧 Type **`tech`** — for technical issues or help\n"
                "🚨 Type **`report`** — to report a member\n\n"
                "You can type `cancel` at any time to stop."
            )
            return

        # ---- Handle ticket type selection ----
        if dm_sessions.get(user_id, {}).get('step') == 'awaiting_type':
            if text.lower() == 'tech':
                dm_sessions[user_id] = {
                    'type': 'tech',
                    'step': 'awaiting_issue',
                    'issue': None
                }
                await message.channel.send(
                    "🔧 **Tech Support Ticket**\n\n"
                    "Please describe your technical issue in as much detail as possible.\n"
                    "_(You can type `cancel` to stop at any time.)_"
                )
            elif text.lower() == 'report':
                dm_sessions[user_id] = {
                    'type': 'report',
                    'step': 'awaiting_username',
                    'reported_user': None,
                    'offense': None,
                    'proof': None,
                    'proof_images': []
                }
                await message.channel.send(
                    "🚨 **Member Report Ticket**\n\n"
                    "I'll walk you through filing a report.\n"
                    "_(You can type `cancel` to stop at any time.)_\n\n"
                    "**Step 1/3 — Who are you reporting?**\n"
                    "Enter the username or display name of the user."
                )
            else:
                await message.channel.send(
                    "Please type **`tech`** for a tech ticket or **`report`** to report a member."
                )
            return

    await bot.process_commands(message)


# ==========================================
# COMMANDS
# ==========================================
@bot.command()
async def close(ctx):
    """Close a ticket channel and archive transcript to log channel."""
    if ctx.channel.name.startswith("ticket-") or ctx.channel.name.startswith("report-") or ctx.channel.name.startswith("tech-"):
        await ctx.send("📁 Archiving ticket and closing channel...")

        transcript  = f"--- Transcript for {ctx.channel.name} ---\n"
        transcript += f"--- Closed by {ctx.author.name} at {datetime.now(EST).strftime('%Y-%m-%d %H:%M:%S')} EST / {datetime.now(CST).strftime('%H:%M:%S')} CT ---\n\n"
        async for msg in ctx.channel.history(limit=None, oldest_first=True):
            est_time       = msg.created_at.replace(tzinfo=timezone.utc).astimezone(EST).strftime("%Y-%m-%d %H:%M:%S")
            cst_time       = msg.created_at.replace(tzinfo=timezone.utc).astimezone(CST).strftime("%H:%M:%S")
            time_formatted = f"{est_time} EST / {cst_time} CT"
            content        = msg.content if msg.content else "[embed or attachment]"
            transcript    += f"[{time_formatted}] {msg.author.name}: {content}\n"

        transcript_file = discord.File(io.StringIO(transcript), filename=f"{ctx.channel.name}-archive.txt")

        log_channel = bot.get_channel(LOG_CHANNEL_ID)
        if log_channel:
            archive_embed = discord.Embed(
                title=f"🔒 {ctx.channel.name} — Closed",
                color=discord.Color.dark_grey(),
                timestamp=datetime.now(timezone.utc)
            )
            archive_embed.add_field(name="Closed By", value=ctx.author.mention, inline=True)
            archive_embed.add_field(name="Channel",   value=ctx.channel.name,   inline=True)
            archive_embed.set_footer(text="Transcript attached below")
            await log_channel.send(embed=archive_embed, file=transcript_file)

        await ctx.channel.delete(reason=f"Ticket closed by {ctx.author.name}")
    else:
        await ctx.send("⚠️ This command can only be used inside a ticket channel.")


@bot.command()
async def debugyt(ctx):
    """Debug YouTube API. Mods/Admins/Scooter only."""
    if not is_authorized(ctx):
        await ctx.send("⛔ You don't have permission to use this command.")
        return

    await ctx.send(
        f"🔧 **YouTube Debug Info**\n"
        f"Channel ID: `{YOUTUBE_CHANNEL_ID}`\n"
        f"API Key set: `{'✅ Yes' if YOUTUBE_API_KEY else '❌ NO — THIS IS THE PROBLEM'}`"
    )
    if not YOUTUBE_API_KEY:
        return

    uploads_playlist_id = 'UU' + YOUTUBE_CHANNEL_ID[2:]
    await ctx.send(f"Uploads Playlist ID: `{uploads_playlist_id}`\nFetching last 10 videos...")

    async with aiohttp.ClientSession() as session:
        # Step 1: playlist items
        async with session.get(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            params={'part': 'snippet', 'playlistId': uploads_playlist_id, 'maxResults': 10, 'key': YOUTUBE_API_KEY}
        ) as resp:
            data = await resp.json()
            if resp.status != 200:
                await ctx.send(f"❌ Playlist API error `{resp.status}`:\n```{str(data)[:500]}```")
                return
            items = data.get('items', [])
            await ctx.send(f"✅ Got {len(items)} videos from playlist.")
            if not items:
                await ctx.send("❌ No items in playlist — the channel ID or playlist ID may be wrong.")
                return

            video_ids = [item['snippet']['resourceId']['videoId'] for item in items]
            await ctx.send(f"Video IDs: `{', '.join(video_ids)}`")

        # Step 2: video details
        async with session.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={'part': 'liveStreamingDetails,snippet', 'id': ','.join(video_ids), 'key': YOUTUBE_API_KEY}
        ) as resp:
            details_data = await resp.json()
            if resp.status != 200:
                await ctx.send(f"❌ Videos API error `{resp.status}`:\n```{str(details_data)[:500]}```")
                return

            found_any = False
            for item in details_data.get('items', []):
                live = item.get('liveStreamingDetails')
                if live:
                    found_any = True
                    await ctx.send(
                        f"📺 **{item['snippet']['title']}**\n"
                        f"ID: `{item['id']}`\n"
                        f"Scheduled Start: `{live.get('scheduledStartTime', 'N/A')}`\n"
                        f"Actual Start:    `{live.get('actualStartTime', 'N/A')}`\n"
                        f"Actual End:      `{live.get('actualEndTime', 'N/A')}`"
                    )
            if not found_any:
                await ctx.send(
                    "⚠️ No `liveStreamingDetails` found on any of the last 10 videos.\n"
                    "This means the scheduled stream is either not in the last 10 uploads, "
                    "or the YouTube API isn't returning it. Try `!debugvideo <video_id>` with the exact ID."
                )

@bot.command()
async def debugvideo(ctx, video_id: str):
    """Check liveStreamingDetails for a specific video ID. Mods/Admins/Scooter only."""
    if not is_authorized(ctx):
        await ctx.send("⛔ You don't have permission to use this command.")
        return

    await ctx.send(f"🔍 Looking up video `{video_id}`...")
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={'part': 'liveStreamingDetails,snippet', 'id': video_id, 'key': YOUTUBE_API_KEY}
        ) as resp:
            data = await resp.json()
            if resp.status != 200:
                await ctx.send(f"❌ API error `{resp.status}`:\n```{str(data)[:500]}```")
                return
            items = data.get('items', [])
            if not items:
                await ctx.send(f"❌ No video found with ID `{video_id}`. Check the ID is correct.")
                return
            item = items[0]
            live = item.get('liveStreamingDetails', {})
            await ctx.send(
                f"✅ **{item['snippet']['title']}**\n"
                f"Scheduled Start: `{live.get('scheduledStartTime', 'N/A')}`\n"
                f"Actual Start:    `{live.get('actualStartTime', 'N/A')}`\n"
                f"Actual End:      `{live.get('actualEndTime', 'N/A')}`\n"
                f"Live Chat ID:    `{live.get('activeLiveChatId', 'N/A')}`"
            )


@bot.command()
async def checklive(ctx):
    """Check if Scooter is currently live or has a scheduled stream."""
    await ctx.send("🔍 Checking YouTube...")

    stream = await check_live_stream()
    if stream:
        await ctx.send(f"🔴 **Scooter is LIVE right now!**\n{stream['title']}\n{stream['url']}")
        return

    upcoming = await check_upcoming_stream()
    if upcoming:
        try:
            scheduled_dt = datetime.fromisoformat(upcoming['scheduled_time'].replace('Z', '+00:00'))
            time_str     = (
                f"{scheduled_dt.astimezone(EST).strftime('%B %d, %Y at %I:%M %p')} EST / "
                f"{scheduled_dt.astimezone(CST).strftime('%I:%M %p')} CT"
            )
            now  = datetime.now(timezone.utc)
            diff = scheduled_dt - now
            if diff.total_seconds() > 0:
                hours     = int(diff.total_seconds() // 3600)
                minutes   = int((diff.total_seconds() % 3600) // 60)
                countdown = f"⏰ Starting in **{hours}h {minutes}m**"
            else:
                countdown = "⏰ Should be starting any moment!"
        except (ValueError, TypeError):
            time_str  = upcoming['scheduled_time']
            countdown = ""

        embed = discord.Embed(
            title="📅 Upcoming Live Stream Scheduled!",
            color=discord.Color.gold(),
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Title",         value=upcoming['title'], inline=False)
        embed.add_field(name="Scheduled For", value=time_str,          inline=True)
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
    await ctx.send("Bot is now in **offline** mode. (Powering down — any issues contact Admin/Mods)")


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
