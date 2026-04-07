# Patrol Channel System - 16 Hour Cooldown & Link Filter

## 🚨 Overview

A dedicated patrol system for self-promotion channel with:
- **16 hour cooldown** between posts
- **Link filtering** (YouTube, Twitch, Kick.com only)
- **Automatic enforcement** (deletes violations)
- **Staff exemption** (staff can post anytime)

---

## ⚙️ Configuration

**Channel ID:** `1486376733413347358` (hardcoded)

**Cooldown:** 16 hours (57,600 seconds)

**Allowed links:**
- ✅ YouTube (youtube.com, youtu.be)
- ✅ Twitch (twitch.tv)
- ✅ Kick (kick.com)
- ❌ Everything else

**Exempt:** Staff roles (from `STAFF_ROLE_IDS`)

---

## 🔒 How It Works

### Cooldown System

1. User posts in patrol channel
2. Bot records timestamp
3. If they try to post again within 16 hours → **DELETED**
4. Shows time remaining
5. After 16 hours → can post again

### Link Filtering

1. Bot checks all URLs in message
2. Compares against allowed domains
3. If invalid link found → **DELETED**
4. Only YouTube/Twitch/Kick allowed

### Staff Bypass

- Staff roles can post unlimited times
- Staff can post any links
- No restrictions for moderators

---

## 📋 User Experience

### First Post (Allowed)
```
User posts: "Check out my stream! https://twitch.tv/username"

Bot: [Allows post]
Bot records: User posted at 2:00 PM
```

### Second Post Too Soon (Blocked)
```
User posts: "New video! https://youtube.com/watch?v=abc"
[Only 2 hours since last post]

Bot: [Deletes message]
Bot posts:
"@User ⚠️ Cooldown Active!

You can only post once every 16 hours in this channel.
Time remaining: 14h 0m

*Your message has been removed.*"

[Warning auto-deletes after 10 seconds]
```

### Invalid Link (Blocked)
```
User posts: "Follow me on Twitter! https://twitter.com/username"

Bot: [Deletes message]
Bot posts:
"@User ⚠️ Invalid Link!

Only YouTube, Twitch, and Kick.com links are allowed in this channel.

*Your message has been removed.*"

[Warning auto-deletes after 10 seconds]
```

### After Cooldown Expires
```
[16 hours pass]

User posts: "Live now! https://kick.com/username"

Bot: [Allows post]
Bot updates: New timestamp recorded
```

---

## 🎯 Valid Examples

**YouTube links:**
```
✅ https://youtube.com/watch?v=abc123
✅ https://www.youtube.com/channel/UCxxx
✅ https://youtu.be/abc123
✅ youtube.com/shorts/abc123
```

**Twitch links:**
```
✅ https://twitch.tv/username
✅ https://www.twitch.tv/username
✅ twitch.tv/videos/123456
```

**Kick links:**
```
✅ https://kick.com/username
✅ https://www.kick.com/username
✅ kick.com/username
```

**With text:**
```
✅ "Live streaming now! https://twitch.tv/user Come watch!"
✅ "New video uploaded: https://youtube.com/watch?v=abc"
✅ "Going live on https://kick.com/user in 10 mins!"
```

---

## ❌ Invalid Examples

**Wrong platforms:**
```
❌ https://twitter.com/username
❌ https://instagram.com/username
❌ https://facebook.com/username
❌ https://tiktok.com/@username
❌ https://discord.gg/invite
```

**Personal sites:**
```
❌ https://mywebsite.com
❌ https://linktree.com/username
```

**Multiple links (one invalid):**
```
❌ "Stream: https://twitch.tv/user AND https://twitter.com/user"
[Twitter link makes entire message invalid]
```

**Cooldown violation:**
```
❌ Posting twice within 16 hours (even with valid links)
```

---

## 🛡️ Staff Powers

Staff can:
- ✅ Post unlimited times (no cooldown)
- ✅ Post any links (not restricted)
- ✅ Moderate the channel
- ✅ Help users understand rules

**Who counts as staff?**
- Anyone with roles listed in `STAFF_ROLE_IDS`
- Set in Railway environment variables

---

## 📊 Enforcement Details

### Message Deletion
- Instant (before anyone sees it properly)
- Applies to cooldown AND invalid links
- No exceptions (except staff)

### Warning Messages
- Posted publicly in channel
- Mentions the user
- Explains what they did wrong
- Shows time remaining (for cooldown)
- Auto-deletes after 10 seconds

### Audit Logging
All patrol actions logged:
- `Patrol Post` - Allowed posts
- `Patrol Violation` - Cooldown violations
- `Patrol Violation` - Invalid link violations

View in dashboard → Audit Log

---

## ⏰ Cooldown Calculation

**Duration:** 16 hours = 57,600 seconds

**Example timeline:**
```
Monday 2:00 PM - User posts
Monday 3:00 PM - 15h remaining ❌
Monday 8:00 PM - 10h remaining ❌
Tuesday 2:00 AM - 4h remaining ❌
Tuesday 6:00 AM - Cooldown expired ✅
```

**Cooldown resets:**
- After each allowed post
- Timer starts from last successful post
- Not affected by deleted posts

---

## 🔧 Customization

### Change Cooldown Duration

Edit in `discord_bot.js`:
```javascript
const PATROL_COOLDOWN = 16 * 60 * 60 * 1000; // 16 hours

// Examples:
const PATROL_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
const PATROL_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours
const PATROL_COOLDOWN = 8 * 60 * 60 * 1000;  // 8 hours
```

### Add More Allowed Domains

Edit in `enforcePatrolRules()` function:
```javascript
const allowedDomains = [
    'youtube.com',
    'youtu.be',
    'twitch.tv',
    'kick.com',
    // Add more:
    'instagram.com',
    'tiktok.com',
];
```

### Change Channel

Edit in configuration:
```javascript
PATROL_CHANNEL_ID: '1486376733413347358', // Change this ID
```

### Adjust Warning Duration

Edit timeout in `enforcePatrolRules()`:
```javascript
setTimeout(() => {
    warningMsg.delete().catch(() => {});
}, 10000); // 10 seconds

// Examples:
}, 5000);  // 5 seconds
}, 15000); // 15 seconds
}, 30000); // 30 seconds
```

---

## 🐛 Troubleshooting

### User says they're still on cooldown after 16 hours

**Check:**
1. Is it EXACTLY 16 hours? (16h 0m 0s)
2. Did they post something that got deleted? (doesn't reset timer)
3. Are they counting from their LAST ALLOWED post?

**Fix:**
- Wait full 16 hours from last successful post
- Check audit log for exact timestamp

### Valid link getting blocked

**Issue:** Link format not recognized

**Common causes:**
- Using mobile links (m.youtube.com)
- Using shortened links (bit.ly)
- Extra parameters confusing detection

**Fix:**
- Use standard desktop links
- Add domain to allowed list if needed

### Staff still getting cooldown

**Issue:** Staff role not configured

**Fix:**
1. Check `STAFF_ROLE_IDS` in Railway
2. Verify role ID is correct
3. Ensure role is assigned to staff

---

## 📈 Statistics

From audit log you can track:
- Total posts in patrol channel
- Cooldown violations
- Invalid link violations
- Most active users
- Peak posting times

**Example audit entries:**
```
[INFO] Patrol Post - @User - Post allowed
[WARNING] Patrol Violation - @User - Cooldown: 12h 30m remaining
[WARNING] Patrol Violation - @User - Invalid link posted
```

---

## 💡 Pro Tips

### For Users
- **Wait the full 16 hours** before posting again
- **Only post YouTube/Twitch/Kick links**
- **Check the time** since your last post
- **Keep it to one post** per cooldown period

### For Moderators
- **Monitor audit log** for repeat offenders
- **Educate users** about rules
- **Adjust cooldown** if too strict/lenient
- **Add domains** as needed

### For Server Owners
- **Pin a rules message** in the channel
- **Explain cooldown clearly**
- **List allowed platforms**
- **Consider a role** for verified streamers (add to STAFF_ROLE_IDS)

---

## 📝 Suggested Channel Rules Message

Pin this in the channel:

```
📢 SELF-PROMOTION RULES

✅ ALLOWED:
• YouTube links only
• Twitch links only
• Kick.com links only

⏰ COOLDOWN:
• ONE post every 16 HOURS
• Timer starts after each post
• Violations = instant delete

❌ NOT ALLOWED:
• Twitter/X, Instagram, TikTok, etc.
• Personal websites
• Posting multiple times within 16 hours

💡 TIPS:
• Wait 16 full hours between posts
• Make your post count!
• Staff can post anytime

Breaking rules = message deleted + warning
```

---

## 🎯 Use Cases

**Perfect for:**
- Self-promotion channels
- Content creator sharing
- Stream announcements
- Video uploads
- Preventing spam

**Not recommended for:**
- General chat
- Discussion channels
- Support channels
- Staff channels

---

## 🔄 Future Enhancements

Potential additions:

- [ ] Role-based cooldown times (verified = 8h, normal = 16h)
- [ ] Cooldown bypass tokens (earn by activity)
- [ ] Link preview embeds for allowed links
- [ ] Weekly statistics per user
- [ ] Leaderboard of most shared content
- [ ] Analytics on which platform used most

Want these? Let me know!

---

**Channel ID:** 1486376733413347358  
**Cooldown:** 16 hours  
**Allowed Platforms:** YouTube, Twitch, Kick.com  
**Status:** Active & Enforcing
