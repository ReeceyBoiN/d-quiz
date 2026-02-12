# Fix Player Device Connection to Quiz Server

## Current Architecture
- **Backend server**: electron/backend/server.js runs at port 4310 (default)
- **Serves**: 
  - Player app static files (dist-player) via express.static
  - HTTP REST endpoints (quizzes, users)
  - WebSocket endpoint at /events
  - All on same server at 0.0.0.0:4310

- **Backend startup**: electron/main/main.js starts the backend and determines local IP
  - Sets `process.env.BACKEND_URL = http://${localIP}:${backend.port}`
  - Sets `process.env.BACKEND_WS = ws://${localIP}:${backend.port}/events`

## Problem
Player devices trying to connect to the WebSocket fail because:

1. Backend server knows its local IP (set in process.env during startup)
2. But this information is **NOT shared with the player app**
3. Player app falls back to `window.location.hostname` which may not be correct if:
   - The app is loaded via mDNS hostname (popquiz.local) but WebSocket also tries that hostname
   - The hostname doesn't resolve correctly on player devices' networks
   - The connection uses an IP but expects a hostname or vice versa

## Root Cause
- The backend server in electron/backend/server.js knows its local IP but doesn't expose it to the client
- The player app has no way to know the server's actual IP address for WebSocket connection
- Current fallback `window.location.hostname` may not resolve properly across all devices

## Solution Approach
**Add a simple HTTP endpoint that exposes the server's local IP to the player app:**

1. **Add `/api/host-info` endpoint** in electron/backend/server.js:
   - Returns JSON with `{ localIP: "192.168.1.63", port: 4310, wsUrl: "ws://192.168.1.63:4310/events" }`
   - Called before the player app attempts WebSocket connection
   - Uses the same `localIP` that main.js already has

2. **Update player app connection logic** (src-player/src/hooks/useNetworkConnection.ts):
   - On startup, fetch `http://{current_host}:4310/api/host-info` to get the server's actual local IP
   - Use the returned `wsUrl` or IP for WebSocket connection
   - Fall back to current logic if endpoint fails (for backward compatibility)

3. **No need for .env files or UI changes**: The endpoint automatically provides the correct IP

## Key Files to Modify
1. **electron/backend/server.js** - Add `/api/host-info` endpoint (1 file, ~10 lines)
2. **src-player/src/hooks/useNetworkConnection.ts** - Query host-info before WebSocket connection (~20 lines)

## Implementation Details

### Step 1: Backend Endpoint
In electron/backend/server.js, add endpoint before starting WebSocket:
```javascript
// Endpoint to provide host info to player devices
app.get('/api/host-info', (req, res) => {
  res.json({
    localIP: localIP, // already available in scope
    port: port,
    wsUrl: `ws://${localIP}:${port}/events`
  });
});
```

### Step 2: Player App Connection
In useNetworkConnection.ts, before establishing WebSocket:
1. Try to fetch `/api/host-info` from current window location
2. If successful, extract `wsUrl` or use returned `localIP` and `port`
3. If fails, fall back to current logic (import.meta.env, window.location.hostname, etc.)
4. Add logging to show which IP is being used

## Expected Outcome
- Player devices automatically discover and connect to the backend using its actual local IP
- Works even when server IP changes (no restart of player app needed)
- Backward compatible - falls back to current logic if endpoint unavailable
- No configuration needed from users - completely automatic
