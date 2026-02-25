# Discord Report Bot

A Discord bot that lets users open private report tickets via DM.

## Setup on Render (Free Tier)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python bot.py`
5. Add these **Environment Variables** in the Render dashboard:

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Your Discord bot token |
| `GUILD_ID` | Your Discord server ID |
| `MOD_ROLE_ID` | Moderator role ID |
| `ADMIN_ROLE_ID` | Admin role ID |
| `SCOOTER_ID` | Scooter's user ID |
| `LOG_CHANNEL_ID` | Channel ID for archived transcripts |

6. Deploy!

## Keeping the bot alive

Render's free tier spins down after 15 min of no traffic. Set up a free monitor on [UptimeRobot](https://uptimerobot.com) to ping your Render URL every 14 minutes.
