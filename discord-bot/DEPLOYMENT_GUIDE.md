# Complete Deployment Guide: GitHub + Railway

This guide will walk you through deploying your Discord Role Manager Bot from scratch.

---

## Part 1: Setting Up Your Discord Bot 🤖

### Step 1: Create a Discord Application

1. **Go to Discord Developer Portal**
   - Visit: https://discord.com/developers/applications
   - Log in with your Discord account

2. **Create New Application**
   - Click the blue "New Application" button (top right)
   - Name it something like "Role Manager Bot"
   - Click "Create"

3. **Navigate to Bot Settings**
   - On the left sidebar, click "Bot"
   - Click "Add Bot" button
   - Click "Yes, do it!" to confirm

4. **Get Your Bot Token** ⚠️ IMPORTANT
   - Under the bot's username, click "Reset Token"
   - Click "Yes, do it!" to confirm
   - **COPY THIS TOKEN IMMEDIATELY** - you won't see it again!
   - Paste it somewhere safe temporarily (we'll use it later)
   - **NEVER share this token publicly or commit it to GitHub!**

5. **Enable Required Intents**
   Scroll down to "Privileged Gateway Intents" and enable ALL THREE:
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
   
   Click "Save Changes" at the bottom!

### Step 2: Invite Bot to Your Server

1. **Go to OAuth2 Settings**
   - Click "OAuth2" in the left sidebar
   - Click "URL Generator"

2. **Select Scopes**
   Under "SCOPES", check:
   - ✅ `bot`

3. **Select Bot Permissions**
   Under "BOT PERMISSIONS", check:
   - ✅ **Manage Roles** (REQUIRED)
   - ✅ **View Channels** (REQUIRED)
   - ✅ **Send Messages** (REQUIRED)
   - ✅ **Read Message History** (REQUIRED)

4. **Copy and Use Invite URL**
   - Scroll to the bottom
   - Copy the "GENERATED URL"
   - Paste it in your browser
   - Select your Discord server
   - Click "Authorize"
   - Complete the CAPTCHA

5. **Verify Bot is in Server**
   - Go to your Discord server
   - Check the member list - you should see your bot (offline for now)

---

## Part 2: Uploading to GitHub 📁

### Step 1: Create a GitHub Account (if needed)
- Go to https://github.com
- Click "Sign up" and follow the steps

### Step 2: Create a New Repository

1. **Create Repository**
   - Go to https://github.com/new
   - Repository name: `discord-role-manager-bot` (or whatever you prefer)
   - Description: "Discord bot for managing role permissions"
   - Make it **Private** (recommended to keep your code private)
   - ✅ Check "Add a README file"
   - Click "Create repository"

### Step 3: Upload Your Bot Files

**Option A: Using GitHub Web Interface (Easiest)**

1. **Upload Files**
   - In your new repository, click "Add file" → "Upload files"
   - Drag and drop ALL these files:
     - `discord_bot.js`
     - `package.json`
     - `README.md`
     - `USAGE_GUIDE.md`
     - `.env.example`
     - `start.sh`
   - Write a commit message: "Initial bot upload"
   - Click "Commit changes"

**Option B: Using Git Command Line**

```bash
# Open terminal/command prompt in your bot folder

# Initialize git
git init

# Add all files
git add .

# Commit files
git commit -m "Initial bot upload"

# Connect to GitHub (replace USERNAME and REPO-NAME)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Add .gitignore (IMPORTANT!)

1. **Create .gitignore file**
   - In your GitHub repository, click "Add file" → "Create new file"
   - Name it: `.gitignore`
   - Paste this content:

```
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env

# Output files
outputs/
*.html

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Editor directories
.vscode/
.idea/
```

2. Click "Commit new file"

---

## Part 3: Deploying to Railway 🚂

Railway is a free hosting platform that will keep your bot online 24/7.

### Step 1: Create Railway Account

1. **Sign Up for Railway**
   - Go to https://railway.app
   - Click "Login" (top right)
   - Choose "Login with GitHub"
   - Authorize Railway to access your GitHub

### Step 2: Create New Project

1. **Start New Project**
   - Click "New Project" on Railway dashboard
   - Select "Deploy from GitHub repo"

2. **Connect Your Repository**
   - You'll see a list of your GitHub repositories
   - Find and click on `discord-role-manager-bot` (or whatever you named it)
   - Railway will start analyzing your repository

3. **Configure the Project**
   - Railway will automatically detect it's a Node.js project
   - It will use your `package.json` to install dependencies

### Step 3: Add Environment Variables

This is where you add your secret bot token!

1. **Open Variables Section**
   - In your Railway project, click on the service (should show your repo name)
   - Click the "Variables" tab

2. **Add Discord Token**
   - Click "New Variable"
   - Variable name: `DISCORD_TOKEN`
   - Variable value: Paste your bot token (from Part 1, Step 4)
   - Press Enter or click elsewhere to save

3. **Verify Variable is Saved**
   - You should see `DISCORD_TOKEN` in the list
   - The value should be hidden/masked

### Step 4: Configure Deployment Settings

1. **Set Start Command (if needed)**
   - Usually Railway auto-detects from `package.json`
   - If you need to manually set it:
     - Go to "Settings" tab
     - Find "Start Command"
     - Enter: `node discord_bot.js`

2. **Configure Build Settings**
   - Build command should be: `npm install`
   - This should be automatic

### Step 5: Deploy!

1. **Deploy Your Bot**
   - Railway will automatically deploy after you add variables
   - Or click "Deploy" if it hasn't started
   - Watch the deployment logs in real-time

2. **Monitor Deployment**
   - You'll see logs like:
     ```
     Installing dependencies...
     npm install
     added 15 packages...
     Starting application...
     ✅ Bot logged in as YourBotName#1234
     📊 Dashboard available at: http://localhost:3000
     ```

3. **Verify Bot is Online**
   - Go to your Discord server
   - Your bot should now show as "Online" (green circle)
   - If it's still offline, check the deployment logs for errors

### Step 6: Test Your Bot

1. **Send a DM to Your Bot**
   - Find your bot in your server's member list
   - Right-click → Message
   - Type: `!help`

2. **You Should See:**
   ```
   🤖 Discord Role Manager Bot
   Manage your Discord server roles and permissions via DM!
   
   !dashboard - Generate HTML dashboard
   !role - Select a role to manage
   !permission - Choose a permission to modify
   !help - Show this help message
   ```

3. **Test Dashboard Generation**
   - Type: `!dashboard`
   - Bot should send you an HTML file
   - Download and open it in your browser

---

## Part 4: Important Notes ⚠️

### File Storage Limitation on Railway

The bot generates HTML files and tries to save them to `/mnt/user-data/outputs`. On Railway, this directory won't exist, so we need to modify the code slightly.

**Quick Fix:**

1. **Edit discord_bot.js on GitHub**
   - Go to your repository on GitHub
   - Click on `discord_bot.js`
   - Click the pencil icon (Edit)
   - Find line ~183: `const filepath = path.join('/mnt/user-data/outputs', filename);`
   - Change it to: `const filepath = path.join(__dirname, filename);`
   - Click "Commit changes"

2. **Railway will auto-redeploy**
   - Railway watches your GitHub repo
   - It will automatically redeploy with the fix
   - Files will now save in the bot's directory

### Keep Your Bot Online

Railway free tier includes:
- 500 hours per month of runtime (enough for 24/7 if you have one project)
- $5 free credit each month

To keep it running:
- Don't create too many projects on Railway
- Monitor your usage in Railway dashboard

---

## Part 5: Troubleshooting 🔧

### Bot Shows Offline

**Check Railway Logs:**
1. Go to Railway project
2. Click "Deployments" tab
3. Click latest deployment
4. Read error messages

**Common Issues:**
- ❌ Missing `DISCORD_TOKEN` → Add it in Variables tab
- ❌ Wrong token → Double-check token from Discord Developer Portal
- ❌ Intents not enabled → Enable all 3 intents in Discord Developer Portal

### Bot Doesn't Respond to Commands

**Check:**
1. Message Content Intent is enabled (Discord Developer Portal → Bot → Privileged Gateway Intents)
2. You're sending DMs to the bot (not posting in server channels)
3. Bot is online in your server

### "Missing Access" or "Missing Permissions" Error

**Fix:**
1. Go to Discord Server Settings → Roles
2. Find your bot's role
3. Drag it HIGHER in the list (above roles you want to manage)
4. Make sure it has "Manage Roles" permission

### Dashboard Not Generating

**Fix:**
1. Apply the file path fix from Part 4
2. Check Railway logs for error messages
3. Try using `!help` first to verify bot is responding

### Railway Deployment Failed

**Check:**
1. `package.json` is in your repository
2. Syntax is correct (no typos in JSON)
3. Logs for specific error messages

---

## Part 6: Keeping Your Bot Updated 🔄

### Making Changes to Your Bot

1. **Edit Code on GitHub**
   - Click on the file you want to edit
   - Click the pencil icon
   - Make your changes
   - Commit changes

2. **Automatic Deployment**
   - Railway automatically deploys when you push to GitHub
   - Watch the deployment in Railway dashboard
   - New version will be live in ~1-2 minutes

### Monitoring Your Bot

**Railway Dashboard:**
- Deployment logs
- CPU/Memory usage
- Runtime hours remaining

**Discord:**
- Bot online/offline status
- Test commands regularly

---

## Part 7: Security Best Practices 🔒

### Protecting Your Bot Token

✅ **DO:**
- Store token in Railway environment variables
- Use `.gitignore` to exclude `.env` files
- Regenerate token if accidentally exposed

❌ **DON'T:**
- Commit tokens to GitHub
- Share tokens in Discord or public forums
- Hardcode tokens in source files

### If Your Token is Compromised

1. Go to Discord Developer Portal
2. Bot tab
3. Click "Regenerate Token"
4. Copy new token
5. Update in Railway Variables
6. Railway will auto-redeploy

---

## Part 8: Advanced Configuration (Optional) ⚙️

### Custom Domain (Railway Pro)

Railway Pro users can add custom domains:
1. Settings → Domains
2. Add your domain
3. Configure DNS

### Multiple Servers

If your bot is in multiple servers, modify `getGuild()` function to:
- Let users select which server
- Or create separate bot instances per server

### Database Integration

For advanced features, add a database:
1. Railway dashboard → New → Database
2. Add PostgreSQL or MongoDB
3. Connect using environment variables

---

## Complete Checklist ✅

Before going live, verify:

- [ ] Discord bot created in Developer Portal
- [ ] All 3 privileged intents enabled
- [ ] Bot invited to your Discord server
- [ ] Repository created on GitHub
- [ ] All bot files uploaded to GitHub
- [ ] `.gitignore` file added
- [ ] Railway account created
- [ ] GitHub connected to Railway
- [ ] Project deployed on Railway
- [ ] `DISCORD_TOKEN` environment variable added
- [ ] Bot shows online in Discord
- [ ] `!help` command responds
- [ ] `!dashboard` generates file
- [ ] Bot's role is positioned correctly in server

---

## Quick Reference Commands

### Testing Your Bot
```
!help           - Shows available commands
!dashboard      - Generates HTML file
!role          - Lists all roles
!permission    - Shows permissions (after selecting role)
```

### Railway CLI (Advanced)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs

# Open project
railway open
```

---

## Need Help? 💬

**Discord Developer Portal Issues:**
- Discord Developer Documentation: https://discord.com/developers/docs

**GitHub Issues:**
- GitHub Help: https://docs.github.com

**Railway Issues:**
- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

**Bot-Specific Issues:**
- Check Railway deployment logs first
- Verify all intents are enabled
- Test in DMs, not server channels

---

**You're all set! Your bot should now be running 24/7 on Railway!** 🎉
