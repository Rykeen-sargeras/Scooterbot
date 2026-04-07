# Discord Role Manager Bot 🤖

A powerful Discord bot that allows you to view and manage role permissions through an interactive HTML dashboard and DM commands.

## Features ✨

- 📊 **HTML Dashboard** - Beautiful, interactive dashboard showing all role permissions
- 🔐 **Permission Management** - Modify role permissions via DM commands
- 👁️ **Channel Visibility** - See which roles can access which channels
- 💬 **Interactive Commands** - Easy-to-use menu-driven interface
- 🎨 **Modern UI** - Sleek, cyberpunk-inspired dashboard design

## Prerequisites 📋

- Node.js 16.9.0 or higher
- A Discord account
- A Discord server where you have admin permissions

## Setup Instructions 🚀

### Step 1: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Click "Reset Token" and copy your bot token (keep this secret!)

### Step 2: Invite Bot to Your Server

1. Go to the "OAuth2" > "URL Generator" tab
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Manage Roles
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Read Message History
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### Step 3: Install and Run

1. Install dependencies:
```bash
npm install
```

2. Set your bot token as an environment variable:

**Linux/Mac:**
```bash
export DISCORD_TOKEN="your_bot_token_here"
```

**Windows (Command Prompt):**
```cmd
set DISCORD_TOKEN=your_bot_token_here
```

**Windows (PowerShell):**
```powershell
$env:DISCORD_TOKEN="your_bot_token_here"
```

**Or edit the bot file directly:**
Open `discord_bot.js` and replace `YOUR_BOT_TOKEN_HERE` with your actual token.

3. Start the bot:
```bash
npm start
```

You should see:
```
✅ Bot logged in as YourBotName#1234
📊 Dashboard available at: http://localhost:3000
```

## How to Use 📖

### Commands (via DM with the bot)

1. **!help** - Display all available commands

2. **!dashboard** - Generate an HTML dashboard file
   - Bot will send you an HTML file
   - Download and open it in your browser
   - View all roles, permissions, and channel access

3. **!role** - Start role selection
   - Bot displays numbered list of roles
   - Type the number to select a role

4. **!permission** - Modify permissions (after selecting a role)
   - Bot shows current permissions for the selected role
   - Type the number of the permission to modify
   - Type `enable` or `disable` to change it

### Example Workflow

```
You: !role
Bot: 📋 Available Roles:
     1. Admin (5 members)
     2. Moderator (12 members)
     3. Member (150 members)
     Type the number of the role you want to manage:

You: 2
Bot: ✅ Selected role: Moderator
     Now use !permission to modify permissions.

You: !permission
Bot: 🔐 Permissions for Moderator:
     1. ✅ Administrator
     2. ❌ Manage Server
     3. ✅ Kick Members
     ...
     Type the number of the permission to modify:

You: 2
Bot: Permission: Manage Server
     Current Status: disabled
     Type enable or disable to change it:

You: enable
Bot: ✅ Successfully enabled Manage Server for role Moderator!
```

## Dashboard Features 🎨

The HTML dashboard includes:

- **Server Overview** - Server name and icon
- **Role Cards** - Each role displayed with:
  - Role color badge
  - Member count
  - Position in hierarchy
  - All general permissions
  - Channel-specific permissions
- **Search Filter** - Quickly find specific roles
- **Responsive Design** - Works on desktop and mobile
- **Modern Aesthetics** - Cyberpunk-inspired with smooth animations

## Permissions the Bot Needs 🔒

The bot requires these permissions to function:

- **Manage Roles** - To modify role permissions
- **View Channels** - To see all channels
- **Send Messages** - To respond to DMs
- **Read Message History** - To read your commands

⚠️ **Important:** The bot can only modify roles that are below its own highest role in the hierarchy!

## Troubleshooting 🔧

### Bot not responding to DMs
- Make sure you've enabled "Message Content Intent" in the Discord Developer Portal
- Ensure the bot is online (check the console for "Bot logged in as...")

### "Missing Permissions" error
- The bot's role must be higher than the roles you want to modify
- Drag the bot's role higher in Server Settings > Roles

### Dashboard not generating
- Check that the bot has permission to read channels
- Ensure the `/mnt/user-data/outputs` directory exists and is writable

### Can't modify certain permissions
- Some permissions require the bot to have "Administrator" permission
- The bot cannot grant permissions it doesn't have itself

## Security Notes 🔐

- **Never share your bot token** - Anyone with your token can control your bot
- **Be careful with Administrator permission** - Only grant to trusted roles
- The bot logs all permission changes to the console
- Generated HTML files are static and safe to share

## Tech Stack 💻

- **discord.js** v14 - Discord API wrapper
- **Node.js** - JavaScript runtime
- **Vanilla JavaScript** - Dashboard interactivity
- **CSS3** - Modern styling with animations

## File Structure 📁

```
discord-role-manager-bot/
├── discord_bot.js      # Main bot code
├── package.json        # Dependencies
└── README.md          # This file
```

## Customization 🎨

You can customize the dashboard appearance by editing the CSS in the `generateHTML()` function:

- **Colors**: Edit CSS variables in `:root`
- **Fonts**: Change the Google Fonts imports
- **Layout**: Modify grid columns and spacing
- **Animations**: Adjust keyframes and transitions

## Contributing 🤝

Feel free to fork this project and submit pull requests with improvements!

## License 📄

MIT License - Feel free to use this bot for any purpose!

## Support 💬

If you encounter any issues:
1. Check the console for error messages
2. Ensure all prerequisites are met
3. Verify bot permissions in your Discord server
4. Make sure your Discord.js version is up to date

---

**Made with ❤️ for Discord server admins**
