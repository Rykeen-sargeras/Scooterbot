# Troubleshooting Checklist ✅

Use this checklist to diagnose and fix common issues.

---

## 🔴 Bot Shows Offline in Discord

### Check Discord Developer Portal
- [ ] Go to https://discord.com/developers/applications
- [ ] Select your application
- [ ] Go to "Bot" tab
- [ ] Verify these intents are enabled:
  - [ ] ✅ Presence Intent
  - [ ] ✅ Server Members Intent  
  - [ ] ✅ Message Content Intent
- [ ] Click "Save Changes" if you made any changes

### Check Railway Deployment
- [ ] Go to https://railway.app
- [ ] Open your project
- [ ] Click on your service
- [ ] Check deployment status (should show "Active")
- [ ] Click "Deployments" tab
- [ ] Look at latest deployment logs
- [ ] Look for error messages in red

### Check Environment Variables
- [ ] In Railway, click "Variables" tab
- [ ] Verify `DISCORD_TOKEN` exists
- [ ] Click the eye icon to reveal the token
- [ ] Compare with token from Discord Developer Portal
- [ ] If they don't match, update and redeploy

### Still Not Working?
- [ ] Go to Discord Developer Portal → Bot tab
- [ ] Click "Reset Token"
- [ ] Copy the NEW token
- [ ] Update `DISCORD_TOKEN` in Railway Variables
- [ ] Wait for automatic redeployment (~1-2 min)

---

## 🔴 Bot Won't Respond to DMs

### Verify You're DMing Correctly
- [ ] Find bot in your server member list
- [ ] Right-click the bot
- [ ] Select "Message"
- [ ] Type `!help` in the DM window (NOT in a server channel)

### Check Message Content Intent
- [ ] Discord Developer Portal → Bot tab
- [ ] Scroll to "Privileged Gateway Intents"
- [ ] **Message Content Intent** must be ON (blue toggle)
- [ ] Click "Save Changes"
- [ ] Restart bot (redeploy on Railway)

### Check Bot Logs
- [ ] Railway dashboard → Deployments tab
- [ ] Look for: `✅ Bot logged in as YourBotName#1234`
- [ ] If you see this, bot is running correctly
- [ ] If not, check for error messages

---

## 🔴 "Missing Permissions" or "Missing Access" Error

### Check Role Hierarchy
- [ ] Go to your Discord server
- [ ] Server Settings → Roles
- [ ] Find your bot's role (same name as your bot)
- [ ] Make sure it's ABOVE all roles you want to manage
- [ ] Drag it higher if needed
- [ ] Save changes

### Check Role Permissions
- [ ] Click on the bot's role in Server Settings → Roles
- [ ] Verify these permissions are checked:
  - [ ] ✅ Manage Roles
  - [ ] ✅ View Channels
  - [ ] ✅ Send Messages
  - [ ] ✅ Read Message History
- [ ] Save changes

### Try Again
- [ ] DM the bot: `!role`
- [ ] Select a role that's BELOW the bot's role
- [ ] If it works, role hierarchy was the issue

---

## 🔴 Dashboard Not Generating / No File Received

### Check Railway Logs
- [ ] Railway dashboard → click your service
- [ ] Click "Deployments"
- [ ] Click latest deployment
- [ ] Look for errors when you try `!dashboard`

### Try the Command Again
- [ ] DM the bot: `!dashboard`
- [ ] Wait 5-10 seconds
- [ ] Bot should send an HTML file as attachment
- [ ] Click to download it

### Verify Bot Can Read Channels
- [ ] Server Settings → Roles → Bot's role
- [ ] Make sure "View Channels" is enabled
- [ ] The bot needs to see channels to generate the dashboard

---

## 🔴 Railway Deployment Failed

### Check Build Logs
- [ ] Railway dashboard → Deployments
- [ ] Click the failed deployment (red X)
- [ ] Read the error message
- [ ] Common issues below:

### Missing Files
- [ ] Go to your GitHub repository
- [ ] Verify these files exist:
  - [ ] `discord_bot.js`
  - [ ] `package.json`
- [ ] If missing, upload them

### Invalid package.json
- [ ] Open `package.json` on GitHub
- [ ] Check for syntax errors (missing commas, brackets)
- [ ] Use a JSON validator: https://jsonlint.com
- [ ] Fix errors and commit

### No DISCORD_TOKEN
- [ ] Railway → Variables tab
- [ ] Add new variable: `DISCORD_TOKEN`
- [ ] Paste your bot token
- [ ] Redeploy

---

## 🔴 Bot Crashed / Stopped Working

### Check Railway Status
- [ ] Railway dashboard
- [ ] Service should show "Active" status
- [ ] If "Crashed" or "Failed", check logs

### Restart the Bot
- [ ] Railway → Settings tab
- [ ] Scroll to bottom
- [ ] Click "Restart"
- [ ] Wait for it to come back online

### Check Runtime Hours
- [ ] Railway free tier: 500 hours/month
- [ ] Railway dashboard → click your account name
- [ ] Check "Usage" section
- [ ] If you've exceeded, upgrade or wait for reset

---

## 🔴 Can't Modify Certain Permissions

### Administrator Permission Special Case
- [ ] The bot MUST have Administrator permission to grant it to others
- [ ] OR: Manually grant it through Discord UI instead of bot

### Bot Can't Modify Its Own Role
- [ ] This is a Discord security feature
- [ ] The bot cannot change its own permissions
- [ ] Manually adjust the bot's role in Server Settings

### Permission Not Available
- [ ] Some permissions require specific channel types
- [ ] Voice permissions only work in voice channels
- [ ] Text permissions only work in text channels

---

## 🔴 Multiple Servers Issue

### Bot Defaults to First Server
- [ ] If bot is in multiple servers, it uses the first one
- [ ] To fix: Remove bot from servers you don't want to manage
- [ ] Or: Modify code to let you select server (advanced)

### Invite to Correct Server
- [ ] Discord Developer Portal → OAuth2 → URL Generator
- [ ] Generate new invite URL
- [ ] Use it to add bot to correct server

---

## 🔴 Token Exposed / Compromised

### IMMEDIATE ACTION REQUIRED
- [ ] Discord Developer Portal → Bot tab
- [ ] Click "Reset Token"
- [ ] Copy the NEW token
- [ ] Update Railway Variables immediately
- [ ] Change any other places you stored it

### Review GitHub Repository
- [ ] Check if token was committed to GitHub
- [ ] If YES:
  - [ ] Delete the commit (or make repo private)
  - [ ] Reset token (as above)
  - [ ] Never commit tokens again

### Prevent Future Exposure
- [ ] Always use `.gitignore`
- [ ] Store tokens in environment variables only
- [ ] Never screenshot or share logs with tokens

---

## 🔴 Bot Responding Slowly

### Railway Free Tier Limitations
- [ ] Free tier has limited resources
- [ ] Commands may take 2-5 seconds
- [ ] This is normal

### Upgrade if Needed
- [ ] Railway Pro offers faster performance
- [ ] $5/month starter plan available

---

## 🔴 HTML Dashboard Won't Open

### Download the File
- [ ] Make sure you downloaded the file from Discord
- [ ] Save it to your computer
- [ ] Don't try to open it directly from Discord

### Open in Browser
- [ ] Right-click the downloaded HTML file
- [ ] "Open with" → your web browser
- [ ] Chrome, Firefox, Safari all work

### File Appears Blank
- [ ] Check browser console (F12)
- [ ] Look for JavaScript errors
- [ ] Try a different browser

---

## 🟢 Everything Works! Maintenance Checklist

### Weekly
- [ ] Test `!help` command
- [ ] Generate a dashboard to verify
- [ ] Check Railway usage/hours remaining

### Monthly
- [ ] Review role permissions for accuracy
- [ ] Update bot code if new features available
- [ ] Check Railway billing (if on paid plan)

### When Making Changes
- [ ] Test in DMs before announcing
- [ ] Generate dashboard to verify changes
- [ ] Document what you changed

---

## Quick Diagnostic Commands

Run these in order when troubleshooting:

```
1. !help
   → Tests if bot responds at all

2. !role  
   → Tests if bot can read server roles

3. !permission
   → Tests if bot can manage permissions

4. !dashboard
   → Tests if bot can generate files
```

If ALL FOUR work, your bot is fully functional! 🎉

---

## Getting More Help

### Check Logs First
Railway logs contain detailed error messages:
1. Railway → Deployments → Latest deployment
2. Look for red error messages
3. Google the error message

### Documentation
- README.md → Basic setup
- USAGE_GUIDE.md → How to use commands
- DEPLOYMENT_GUIDE.md → Detailed deployment steps

### Community Support
- Railway Discord: https://discord.gg/railway
- Discord.js Discord: https://discord.gg/djs

### Create GitHub Issue
If you think it's a bug in the bot code:
1. Go to your GitHub repository
2. Issues tab → New Issue
3. Describe the problem
4. Include error messages from Railway logs

---

## Emergency Reset Procedure

If everything is broken and you want to start fresh:

### 1. Discord Bot
- [ ] Discord Dev Portal → Bot tab
- [ ] Reset Token
- [ ] Copy new token

### 2. Railway
- [ ] Delete the current deployment
- [ ] Create new project
- [ ] Link GitHub repo again
- [ ] Add DISCORD_TOKEN variable (new token)
- [ ] Deploy

### 3. Test
- [ ] Wait for deployment to complete
- [ ] DM bot: `!help`
- [ ] If it responds, you're back in business!

---

**Most issues can be solved by checking logs and verifying environment variables!**
