# PopQuiz Network Player Setup Guide

This guide explains how to use the new network player functionality in PopQuiz, which allows players on the same WiFi network to join the game from their mobile devices.

## What's New

PopQuiz now supports multiple local network players who can:
- Join games using their team names
- See questions in real-time on their devices
- Submit answers that sync with the host
- See live timers and answer reveals
- Receive instant feedback on their submissions

## Architecture Overview

### Components Added

1. **Player App** (`src-player/`)
   - Standalone React app for players to access via web browser
   - Automatically served from the host computer
   - Responsive design for mobile and desktop

2. **Network Backend Updates**
   - Express server now listens on all network interfaces (`0.0.0.0`)
   - mDNS support for `.local` domain access
   - WebSocket handlers for player registration and messaging

3. **Host Integration**
   - Automatic detection of network player registrations
   - Network players appear in the LeftSidebar teams list
   - Real-time score and status synchronization

## Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages for both the host and player app.

### Step 2: Build the Player App

```bash
npm run build:player
```

This builds the player app and outputs it to `dist-player/`. The host server will automatically serve this during runtime.

### Step 3: Start the Host

```bash
npm run dev
```

This starts the main application. The backend server will:
- Start on port 4310 (configurable)
- Listen on all network interfaces
- Advertise as "popquiz" via mDNS
- Serve the player app at the root URL

## Using Network Players

### For Host (Quiz Master)

1. Start the application using `npm run dev`
2. The host backend will log something like:
   ```
   Backend listening on all interfaces on port 4310
   Host can access player app at: http://192.168.1.100:4310
   Advertised as popquiz.local on port 4310
   ```

3. Network players will automatically appear in the LeftSidebar when they join
4. They can be managed just like regular teams (delete, score, etc.)

### For Players

1. **On the same WiFi network as the host**, open a web browser on your mobile device or computer
2. Navigate to one of these URLs:
   - **By IP address**: `http://<host-ip>:4310` (e.g., `http://192.168.1.100:4310`)
   - **By mDNS**: `http://popquiz.local` (works on macOS/Linux/modern browsers)

3. You'll see the PopQuiz player interface with a team name input field
4. Enter your team name and click "Join Game"
5. You'll see a confirmation message and join the host's team list
6. Wait for the host to start the quiz - questions will appear automatically
7. Answer questions on your device
8. See instant feedback when answers are revealed

## Network Requirements

- All devices (host + players) must be on the same WiFi network
- Host computer must be running PopQuiz
- Players need a web browser (Chrome, Safari, Firefox, Edge, etc.)
- No special network configuration or firewall rules needed for local network

## Finding the Host IP Address

If mDNS doesn't work on your network, you need the host's IP address:

### Windows
1. On the host computer, open Command Prompt
2. Run: `ipconfig`
3. Look for "IPv4 Address" under your WiFi adapter (usually starts with 192.168 or 10.0)

### macOS/Linux
1. Open Terminal
2. Run: `ifconfig` or `hostname -I`
3. Look for inet address on your WiFi interface

### Example
If the host IP is `192.168.1.100`, enter: `http://192.168.1.100:4310`

## Troubleshooting

### Players Can't Connect

1. **Check Network Connection**: Ensure all devices are on the same WiFi network
2. **Check Firewall**: 
   - Windows: Allow Node.js through Windows Defender Firewall
   - macOS: Run app once, grant network access when prompted
3. **Check Port**: Ensure port 4310 isn't blocked by firewall
4. **Try IP Address**: If mDNS doesn't work, use the host IP address directly

### Players Can't See Host

1. **Verify Host is Running**: Check that PopQuiz is running on the host computer
2. **Check Host Network**: On host, verify the backend shows connection message in console
3. **Try Localhost First**: Test with `http://localhost:4310` on the host computer
4. **Check Network Settings**: Ensure no network isolation or guest network blocking

### Players Get Disconnected

1. **Check WiFi Signal**: Ensure stable WiFi connection
2. **Check Network Activity**: High network traffic might cause disconnections
3. **Refresh Browser**: Players can refresh to reconnect
4. **Restart App**: Close PopQuiz and restart on the host computer

## Customization

### Change Backend Port

In `electron/main/main.js`, look for:
```javascript
const backend = await startBackend({ port: 4310 });
```

Change `4310` to your desired port number.

### Custom mDNS Name

In `electron/backend/server.js`, modify the Bonjour publication:
```javascript
bonjour.publish({
  name: 'PopQuiz',  // Change this
  // ...
});
```

## Architecture Details

### WebSocket Protocol

Players and host communicate over WebSocket at `/events`:

**Player → Host Messages**
```json
{
  "type": "PLAYER_JOIN",
  "playerId": "player-abc123",
  "teamName": "Team Alpha",
  "timestamp": 1234567890
}
```

```json
{
  "type": "PLAYER_ANSWER",
  "playerId": "player-abc123",
  "teamName": "Team Alpha",
  "answer": "Paris",
  "timestamp": 1234567890
}
```

**Host → Player Messages**
```json
{
  "type": "QUESTION",
  "data": {
    "text": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris"],
    "type": "multi"
  },
  "timestamp": 1234567890
}
```

### File Structure

```
src-player/                 # Player app (separate build)
├── src/
│   ├── components/
│   │   ├── TeamNameEntry.tsx
│   │   ├── WaitingScreen.tsx
│   │   └── QuestionDisplay.tsx
│   ├── hooks/
│   │   └── useNetworkConnection.ts
│   ├── context/
│   │   └── NetworkContext.tsx
│   ���── types/
│   │   └── network.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── ui/
│   │   ├── button.tsx
│   │   └── input.tsx
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts

electron/backend/
├── server.js              # Updated to serve player app
└── ...

src/network/
├── wsHost.ts              # Network host management (updated)
└── types.ts               # Network types (new)
```

## Development Workflow

### Making Changes to Player App

1. Edit files in `src-player/src/`
2. Run `npm run dev:player` for live reload during development
3. Run `npm run build:player` before building the executable

### Making Changes to Host

1. Edit files in `src/` as usual
2. Changes sync automatically in dev mode
3. Host will restart automatically

### Testing Both Together

```bash
# Terminal 1: Start host dev server
npm run dev

# Terminal 2 (optional): Start player app dev server
npm run dev:player

# Open browser to http://localhost:3000 for host
# Open another browser/device to http://localhost:3001 for player
```

## Future Enhancements

Potential features for future versions:
- Answer submission timestamps for score ranking
- Live score display on player devices
- Team leader assignment
- Player device management interface
- Custom branding/theme support
- Session persistence across reconnects
- Analytics and performance tracking

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs on both host and player
3. Check that all dependencies are installed: `npm install`
4. Rebuild the player app: `npm run build:player`
5. Clear browser cache and try again

## Technical Notes

- Player app is built with React 18.3.1 and Vite 6.3.5
- Tailwind CSS is used for styling
- WebSocket protocol (ws/wss) for real-time communication
- Automatic reconnection logic with 3-second retry interval
- mDNS advertising using bonjour-service package
- All network data timestamped for synchronization
