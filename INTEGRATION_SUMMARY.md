# Network Integration Summary

This document details the changes made to add network player functionality to PopQuiz.

## Files Created

### Player App Structure (`src-player/`)
```
src-player/
├── src/
│   ├── components/
│   │   ├── TeamNameEntry.tsx     - Team registration screen
│   │   ├── WaitingScreen.tsx      - Waiting for quiz start
│   │   └── QuestionDisplay.tsx    - Question display with answers
│   ├── hooks/
│   │   └── useNetworkConnection.ts - WebSocket connection management
│   ├── context/
│   │   └── NetworkContext.tsx     - Shared network context
│   ├── types/
│   │   └── network.ts             - TypeScript interfaces
│   ├── lib/
│   │   └── utils.ts               - Utility functions (cn)
│   ├── ui/
│   │   ├── button.tsx             - Button component
│   │   └── input.tsx              - Input component
│   ├── App.tsx                    - Main app component
│   ├── main.tsx                   - Entry point
│   └── index.css                  - Global styles
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.cjs
├── .gitignore
└── README.md
```

### Network Types (`src/network/types.ts`)
New file containing TypeScript interfaces for network communication:
- `PlayerMessageType` - Types of messages from players
- `HostMessageType` - Types of messages from host
- `PlayerMessage` - Message structure for player events
- `HostMessage` - Message structure for host events
- `NetworkPlayer` - Player registration data

## Files Modified

### 1. `electron/backend/server.js`
**Changes:**
- Added imports: `path`, `os`, `bonjour-service`
- Updated to listen on `0.0.0.0` instead of `127.0.0.1`
- Added static file serving for player app from `dist-player/`
- Added WebSocket message handlers for `PLAYER_JOIN` events
- Added mDNS advertisement via Bonjour
- Added local IP address detection and logging
- Improved logging to show network access URLs

**Key Functions:**
- `getLocalIPAddress()` - Finds local IP for network access
- WebSocket connection handler for player events
- Express middleware to serve player app SPA

### 2. `src/network/wsHost.ts`
**Changes:**
- Added `PLAYER_JOIN` and `PLAYER_DISCONNECT` to `NetworkMessageType`
- Added `networkPlayers` Map to `HostNetwork` class
- Added player registration methods to `HostNetwork`
- Exported new functions for player management

**New Methods:**
```typescript
registerNetworkPlayer(playerId: string, teamName: string)
unregisterNetworkPlayer(playerId: string)
getNetworkPlayers()
isPlayerRegistered(playerId: string): boolean
```

**New Exports:**
```typescript
registerNetworkPlayer()
unregisterNetworkPlayer()
getNetworkPlayers()
isPlayerRegistered()
```

### 3. `src/components/QuizHost.tsx`
**Changes:**
- Added import for network player functions
- Added `useEffect` hook to listen for `PLAYER_JOIN` events
- Automatically adds network players to `quizzes` state
- Network players get a 📱 emoji icon by default
- Network players start with 0 score
- Preserves existing team management functionality

**New Logic:**
```typescript
useEffect(() => {
  const handleNetworkPlayerJoin = (data: any) => {
    const { playerId, teamName } = data;
    
    // Check if player already registered
    if (!quizzes.find(q => q.id === playerId)) {
      const newTeam: Quiz = {
        id: playerId,
        name: teamName,
        type: 'test',
        score: 0,
        icon: '📱',
      };
      
      setQuizzes(prev => {
        const updated = [...prev, newTeam];
        return updated.sort((a, b) => (b.score || 0) - (a.score || 0));
      });
    }
  };
  
  onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);
}, [quizzes]);
```

### 4. `package.json` (root)
**Changes:**
- Added new scripts:
  - `dev:player` - Start player app dev server
  - `build:player` - Build player app for production
- Updated `build:exe` to include player app build
- Updated `watch:exe` to watch player app files
- Added `bonjour-service` dependency for mDNS
- Updated build files to include `dist-player/**/*`

**New Scripts:**
```json
"dev:player": "cd src-player && npm run dev",
"build:player": "cd src-player && npm run build",
```

## Network Communication Flow

### Player Registration Flow
```
Player App (Browser)
    ↓ (WebSocket)
    → Backend Server (4310)
    → Broadcast PLAYER_JOIN
    ↓
    → QuizHost Component
    ↓ (useEffect listener)
    → Updates quizzes state
    ↓
    → LeftSidebar displays new team
```

### Question Delivery Flow
```
QuizHost Component
    ↓ (sendQuestionToPlayers)
    �� HostNetwork broadcast
    ↓ (WebSocket)
    → All connected players
    ↓
    → Player App message handler
    ↓
    → Update currentQuestion state
    ↓
    → QuestionDisplay component renders
```

### Answer Submission Flow
```
Player App (QuestionDisplay)
    ↓ (onAnswerSubmit)
    → Send PLAYER_ANSWER via WebSocket
    ↓
    → Backend Server
    ↓ (can be logged/broadcast to other players)
    → Ready for host to process
```

## Integration Points

### Where Network Players Connect
1. Backend starts on `0.0.0.0:4310` instead of `127.0.0.1`
2. Player app is served at root path `/`
3. WebSocket events available at `/events`
4. Players register via `PLAYER_JOIN` message
5. QuizHost listens for `PLAYER_JOIN` events via `onNetworkMessage`

### How Teams Are Added
1. Network player sends `PLAYER_JOIN` message with playerId + teamName
2. Backend broadcasts to all connected clients
3. QuizHost's useEffect listens for the event
4. New Quiz object created and added to `quizzes` state
5. State update triggers re-render with new team in LeftSidebar

### Backward Compatibility
- Existing team management unchanged
- Manual team addition still works
- Network players behave like regular teams
- All existing game modes compatible with network players

## Build System Changes

### Multiple Apps
The project now builds two separate apps:
1. **Host App** (`dist/`) - Main Electron app
2. **Player App** (`dist-player/`) - Web app served from backend

### Build Order
```
npm run build:exe
    ↓
    npm run build:renderer    (host app)
    npm run build:player      (player app)
    ↓
    electron-builder
    ↓
    Both dist/ and dist-player/ included in final package
```

## Environment & Networking

### Port Assignment
- Backend: `4310` (configurable via `startBackend({ port })`)
- Host app: `3000` (Vite dev server)
- Player app dev: `3001` (Vite dev server)

### mDNS Advertisement
- Service name: `PopQuiz`
- Type: `http` + `tcp`
- Subtype: `popquiz`
- Accessible as: `popquiz.local`

### IP Detection
Automatically detects and logs:
- IPv4 address (ignores internal/IPv6)
- Suitable for network access
- Example: `192.168.1.100`

## Security Considerations

### Current Implementation
- No authentication required for player registration
- Network-local only (same WiFi)
- No data persistence beyond session
- WebSocket messages include timestamps

### Future Enhancements
- Consider PIN/code-based access control
- Session tokens for player validation
- Rate limiting on team registration
- HTTPS/WSS support

## Testing Checklist

- [ ] Player app builds successfully: `npm run build:player`
- [ ] Backend starts: `npm run dev`
- [ ] Host app loads at `localhost:3000`
- [ ] Player app accessible at `localhost:4310` (when built)
- [ ] Player can register team name
- [ ] Registered player appears in LeftSidebar
- [ ] Multiple players can join
- [ ] Network players can be deleted/managed like regular teams
- [ ] Questions sync to players
- [ ] Timers display correctly on players
- [ ] Answers can be submitted
- [ ] mDNS works (test with `popquiz.local`)
- [ ] IP address logging shows correct network IP

## Performance Considerations

- Player app uses Vite for fast build times
- WebSocket messages are small JSON payloads
- No persistent storage by default
- Auto-reconnection every 3 seconds on disconnect
- Quizzes state sorted after each team addition

## Dependencies Added

- `bonjour-service@^1.3.0` - mDNS/Bonjour advertising

All other dependencies reused from existing project.
