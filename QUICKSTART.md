# PopQuiz Network Players - Quick Start

Get your network players up and running in 5 minutes!

## Prerequisites

- PopQuiz running on a computer
- Players on the same WiFi network with a web browser

## Step 1: Install & Build (First Time Only)

```bash
# In the PopQuiz root directory
npm install
npm run build:player
```

**Takes ~2-3 minutes on first build**

## Step 2: Start PopQuiz

```bash
npm run dev
```

**Watch for this in the console:**
```
Backend listening on all interfaces on port 4310
Host can access player app at: http://192.168.1.100:4310
Advertised as popquiz.local on port 4310
```

**Copy that IP address!** You'll need it for players.

## Step 3: Players Connect

On each player's device (phone, tablet, laptop):

1. Open web browser
2. Enter one of these URLs:
   - **Option A (if it works)**: `http://popquiz.local`
   - **Option B (most reliable)**: `http://192.168.1.100:4310` (use your IP from Step 2)

3. You'll see the PopQuiz player screen
4. Enter team name, click "Join Game"
5. ✅ Team appears in host's LeftSidebar automatically!

## Done! 🎉

Players are now:
- Registered in the host's team list
- Visible in LeftSidebar with 📱 emoji
- Receiving real-time questions
- Can submit answers
- See live timers and reveals

## Common Issues

### "Can't connect to server"
- Check IP address is correct
- Try: `http://192.168.1.100:4310` (replace with your IP)
- Make sure host computer is on same WiFi

### "popquiz.local doesn't work"
- Use the IP address method instead: `http://192.168.1.100:4310`
- Some networks don't support mDNS

### "Players don't appear in teams"
- Check if player app built successfully: `npm run build:player`
- Refresh host page
- Check browser console for errors (F12)

## Pro Tips

💡 **Screenshot the IP**: Take a screenshot of the console with the IP address  
💡 **Share the URL**: Send players the full URL (e.g., http://192.168.1.100:4310)  
💡 **Test First**: Open player app on another window on your host computer first  
💡 **Mobile Keyboard**: Players can quickly tap the input field to type team names  

## What Works Right Now

✅ Multiple players joining  
✅ Team registration  
✅ Real-time question delivery  
✅ Multiple choice answers  
✅ Buzz-in support  
✅ Timer synchronization  
✅ Answer reveal  
✅ Score tracking  
✅ Manual team management (delete, rename, etc.)  

## Next Steps

- Read `NETWORK_SETUP.md` for detailed configuration
- Check `INTEGRATION_SUMMARY.md` for technical details
- Review `src-player/README.md` for player app info

## Troubleshooting Command

If something breaks, try:
```bash
# Clean rebuild
npm install
npm run build:player
npm run dev
```

Then have players refresh their browsers (F5 or Cmd+R).

---

**Questions?** Check the troubleshooting section in `NETWORK_SETUP.md`
