# New Features: Birthdays, Roasts & Vibe Check!

## 🎂 Birthday System

### How It Works
- Anyone can register their birthday with `!birthday`
- Bot announces birthdays at **8am AND 8pm** on the day
- Posts to announcement channel
- Mentions all birthday people if multiple on same day

### Commands

**Register birthday:**
```
!birthday 12/25
```

**Check your birthday:**
```
!birthday
```

**Remove birthday:**
```
!birthday remove
```

### What Gets Posted

**Single birthday:**
```
@User

┌────────────────────────────┐
│ 🎂 Happy Birthday! 🎉      │
│                            │
│ Today's the special day for:│
│ @User                      │
│                            │
│ Wishing you an amazing     │
│ birthday! 🎈🎊            │
│                            │
│ Birthday on 12/25          │
└────────────────────────────┘
```

**Multiple birthdays:**
```
@User1, @User2, @User3

┌────────────────────────────┐
│ 🎂 Happy Birthday! 🎉      │
│                            │
│ Today's the special day for:│
│ @User1, @User2, @User3     │
│                            │
│ Wishing you an amazing     │
│ birthday! 🎈🎊            │
│                            │
│ Birthdays on 3/15          │
└────────────────────────────┘
```

### Technical Details
- Runs every minute
- Only posts at exactly 8:00am and 8:00pm
- Uses announcement channel
- Stored in memory (resets on bot restart)
- No limit on registrations

---

## 🔥 Roast Generator

### How It Works
- **250 random roasts** loaded
- Post to main chat
- Target anyone by user ID
- Web dashboard only (not Discord command)

### From Web Dashboard

1. Go to **🎮 Fun Features** tab
2. Scroll to **🔥 Roast Generator**
3. Enter user ID
4. Click **🔥 Roast Them!**

### What Gets Posted

```
🔥 You Just Got Roasted!

@User

"I'd agree with you, but then we'd both be wrong."

Roasted from Web Dashboard
Today at 4:20 PM
```

### Sample Roasts

```
- "I'd agree with you, but then we'd both be wrong."
- "You're not stupid; you just have bad luck thinking."
- "I'm jealous of people who haven't met you."
- "You're the reason the gene pool needs a lifeguard."
- "If I had a dollar for every brain cell you had, I'd have one dollar."
- "You're like a cloud. When you disappear, it's a beautiful day."
- ...and 244 more!
```

### Categories
- Classic insults
- Intellectual burns
- Existence roasts
- Comparison burns
- Modern meme roasts
- Self-aware roasts

### Use Cases
- Friendly banter
- Roast battles
- Birthday roasts
- Just for fun
- Content creation

**Note:** Use responsibly! These are jokes - don't actually bully people!

---

## ✨ Vibe Check

### How It Works
- Analyzes chat sentiment
- Tracks last **1 hour, 12 hours, 24 hours**
- Shows positive/negative/energy percentages
- Anyone can use it

### Command

```
!vibecheck
```

### What It Shows

```
✨ Vibe Check
Current chat atmosphere analysis

🕐 Last Hour
🔥 HYPED
Positive: 75%
Negative: 15%
Energy: 80%
Messages: 247

🕛 Last 12 Hours
😊 POSITIVE
Positive: 65%
Negative: 20%
Energy: 55%
Messages: 1,523

📅 Last 24 Hours
😐 NEUTRAL
Positive: 50%
Negative: 30%
Energy: 45%
Messages: 3,891

Vibe analysis based on message content and energy
```

### Vibe Types

**🔥 HYPED**
- Positive: >60%
- Energy: >50%
- Chat is excited!

**😊 POSITIVE**
- Positive: >60%
- Energy: any
- Chat is happy

**😤 SALTY**
- Negative: >60%
- Chat is upset/arguing

**⚡ ENERGETIC**
- Energy: >70%
- Chat is active/loud

**😴 CHILL**
- Energy: <30%
- Chat is calm/slow

**😐 NEUTRAL**
- Everything balanced
- Normal chat

### How Sentiment Works

**Positive words detected:**
- lol, lmao, haha
- gg, good, great, awesome
- love, thanks, nice
- poggers, pog
- 😂, 🤣, ❤️, 💯, 🔥
- yes, yeah, yay

**Negative words detected:**
- bad, hate, stupid, dumb
- wtf, bruh, cringe
- rip, oof, sad
- 😢, 😭, 💀
- no, nah, ugh

**Energy measured by:**
- CAPS (each caps letter = energy)
- !!! (exclamation marks)
- Message frequency

### Use Cases
- Check if chat is happy/sad
- See if drama happened
- Gauge server mood
- Content for streams
- Moderate based on vibe

---

## 🎯 Combined Usage Examples

### Birthday + Roast Combo
```
User: !birthday 3/15
Bot: 🎂 Birthday saved!

[On 3/15 at 8am]
Bot: @User Happy Birthday! 🎉

[From web dashboard]
Staff: [Roasts birthday person]
Bot: 🔥 You Just Got Roasted!
@User "You're living proof that birth control can fail."
```

### Vibe Check After Drama
```
[Drama happens in chat]

User: !vibecheck
Bot: ✨ Vibe Check
Last Hour: 😤 SALTY
Positive: 20%
Negative: 75%
Energy: 90%

Mod: "Okay everyone chill out"
```

### Full Feature Loop
```
1. Morning birthday announcement (8am)
2. Someone checks vibe: !vibecheck
3. Chat is hyped for birthday
4. Staff roasts birthday person (friendly)
5. Everyone laughs
6. Evening birthday announcement (8pm)
7. Vibe check shows: 🔥 HYPED
```

---

## 📊 Stats

### Birthdays
- **Storage:** In-memory (Map)
- **Check frequency:** Every minute
- **Post times:** 8:00am, 8:00pm exactly
- **Format:** MM/DD (1-12/1-31)
- **Limit:** None

### Roasts
- **Total roasts:** 250
- **Selection:** Random
- **Location:** Main chat channel
- **Access:** Web dashboard only
- **Format:** Embed with mention

### Vibe Check
- **Message tracking:** Last 1000 messages
- **Time windows:** 1h, 12h, 24h
- **Metrics:** Positive %, Negative %, Energy %
- **Access:** Anyone with `!vibecheck`
- **Updates:** Real-time

---

## ⚙️ Configuration

### Birthday System
No configuration needed! Just needs:
- `ANNOUNCEMENT_CHANNEL_ID` set

### Roast System
Needs:
- `MAIN_CHAT_CHANNEL_ID` set
- Web dashboard password

### Vibe Check
Needs:
- `MAIN_CHAT_CHANNEL_ID` set (for tracking)
- No other config

---

## 🐛 Troubleshooting

### Birthday not announced

**Check:**
1. Is `ANNOUNCEMENT_CHANNEL_ID` set?
2. Did they register correctly? (`!birthday` to verify)
3. Is it exactly 8:00am or 8:00pm?
4. Check bot permissions in announcement channel

**Fix:**
```
!birthday remove
!birthday 3/15
```

### Roast not working

**Check:**
1. Is user ID correct?
2. Is `MAIN_CHAT_CHANNEL_ID` set?
3. Does bot have permission to post embeds?
4. Check web dashboard password

**Debug:**
- Try with your own user ID first
- Check Railway logs for errors

### Vibe check showing 0 messages

**Issue:** No messages tracked yet

**Fix:**
- Wait for people to chat
- Bot tracks from startup
- Needs messages in `MAIN_CHAT_CHANNEL_ID`

---

## 💡 Pro Tips

### Birthdays
- Announce the feature to your server
- Remind people to register
- Make birthday role (given for the day)
- Host birthday events

### Roasts
- Use for friendly banter only
- Get permission before roasting
- Perfect for birthday roasts
- Don't overuse (loses fun)
- Know your audience

### Vibe Check
- Use to moderate discussions
- Check before making announcements
- Track vibe trends
- Post results for laughs
- Use as content

---

## 🎨 Customization

### Add More Roasts

Edit `roasts` array in `discord_bot.js`:
```javascript
const roasts = [
    "Your custom roast here",
    "Another roast",
    // Add as many as you want!
];
```

### Change Birthday Times

Edit `checkBirthdays()` function:
```javascript
if ((currentHour === 8 || currentHour === 20) && currentMinute === 0) {
    // Change 8 and 20 to different hours
    // 0 = midnight, 12 = noon, 23 = 11pm
}
```

### Adjust Vibe Sensitivity

Edit positive/negative word lists:
```javascript
const positive = ['lol', 'lmao', ...]; // Add more
const negative = ['bad', 'hate', ...]; // Add more
```

---

## 📈 Feature Impact

**Before these features:**
- No birthday celebrations
- No automated roasting
- No mood tracking

**After:**
- Automated birthday wishes (2x per day)
- 250 roast variations
- Real-time sentiment analysis
- More engagement
- More fun!

---

## 🚀 What's Next?

Potential enhancements:

**Birthdays:**
- Birthday role (auto-assign for the day)
- Birthday month calendar
- Age tracking (optional)
- Custom birthday messages

**Roasts:**
- Roast battles (2 users, vote winner)
- Category selection (light/medium/brutal)
- User-submitted roasts
- Roast of the day

**Vibe Check:**
- Hourly vibe tracking graph
- Vibe alerts (if too salty)
- Per-channel vibe check
- Historical vibe data

---

**Updated:** March 2026
**New Commands:** !birthday, !vibecheck
**New Web Feature:** Roast Generator
**Total Roasts:** 250
