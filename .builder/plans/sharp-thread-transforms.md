# Fix Player WebSocket Connection in Dev Mode

## Problem Summary
The player app (running on Vite dev server at port 3001) is trying to connect to `ws://localhost:3001/events`, but the actual WebSocket server runs on port 4310 in the Electron backend. This causes connection timeouts and reconnection attempts that never succeed.

**Root Cause:**
- When running Vite dev server, the player app is served from `http://localhost:3001`
- `useNetworkConnection.ts` constructs the WebSocket URL from `window.location.host`, resulting in `ws://localhost:3001/events`
- Port 3001 (Vite dev server) doesn't have a WebSocket endpoint
- The real WebSocket server is on port 4310 (Electron backend)

## Architecture Context
- **Electron Backend (port 4310):** Runs `electron/backend/server.js` which hosts the WebSocket server at `/events`
- **Host App (port 3000):** The quiz host UI, which correctly uses `window.api.backend.ws()` to get the backend WebSocket URL from Electron
- **Player App (port 3001):** The player UI, which tries to connect based on `window.location.host` (doesn't have access to Electron's preload API when run via Vite)

## Solution Approach

**Option 1: Set up Vite proxy in dev mode (RECOMMENDED)**
- Add a Vite proxy configuration in `src-player/vite.config.ts` that forwards `/events` requests to the backend WebSocket server
- This way the player app can still use `ws://localhost:3001/events` but it will be proxied to the actual backend
- Minimal changes, works with existing code
- Only affects dev mode

**Option 2: Environment variable approach**
- Add an environment variable (e.g., `VITE_BACKEND_WS_URL`) that the player app can read
- Modify `useNetworkConnection.ts` to use this variable if available, falling back to the current logic
- More flexible but requires more setup

**Option 3: Custom dev server setup**
- Create a custom dev server that serves both host and player, with proper WebSocket proxying
- More complex, not recommended unless other options don't work

## Recommended Implementation (Option 1)

### Step 1: Update `src-player/vite.config.ts`
Add a Vite server proxy that forwards WebSocket connections from port 3001 to the backend:
```
server: {
  port: 3001,
  open: true,
  proxy: {
    '/events': {
      target: 'ws://localhost:4310',  // or the actual backend URL
      ws: true,
      rewriteWsOrigin: true,
    }
  }
}
```

### Step 2: Verify useNetworkConnection.ts
The existing code should work as-is since it constructs the URL from `window.location.host`. Once the proxy is in place, requests to `ws://localhost:3001/events` will be forwarded to the actual backend.

## Implementation Steps

### Task 1: Fix WebSocket Connection (High Priority)
**Files to modify:**
- `src-player/vite.config.ts` - Add WebSocket proxy configuration

**Change:**
Update the Vite server config to proxy `/events` WebSocket requests to the backend on port 4310.

### Task 2: Add Redirect Page for "popquiz" Access (Secondary)
**Files to modify/create:**
- `electron/backend/server.js` - Add a simple HTTP redirect endpoint
- The backend will serve a redirect page at `/` that detects the host and redirects users to the player app

**Implementation:**
When users access `popquiz.local:4310`, they'll be redirected to the player app with a redirect page. For example:
- User goes to `http://popquiz.local:4310` or `http://popquiz.local`
- Server responds with a redirect to `http://popquiz.local:4310/player` or similar
- Users can access the player without remembering the full URL

**Alternative simpler approach:**
Serve the player app as the root (`/`) on port 4310 instead of `/player` route, making `popquiz.local:4310` the direct access point.

## Expected Outcome
- Player app connects to `ws://localhost:3001/events` (browser sees this)
- Vite proxy forwards to `ws://localhost:4310/events` (actual backend)
- Connection succeeds and player can submit answers and receive messages

## Secondary Enhancement: mDNS "popquiz" Access
The Electron backend already advertises itself via mDNS (Bonjour) as "popquiz.local".

**Current Status:**
- Backend already runs with mDNS enabled and can be accessed via `popquiz.local:4310`
- Users can type `popquiz.local:4310` in browser but still need the port number
- Need to make it work with just "popquiz" (without port or .local suffix)

**Options:**
1. Create a simple landing page on port 80 that redirects to `popquiz.local:4310`
   - Requires port 80 (standard HTTP), may need admin privileges
   - Works for local network only
2. Use a custom protocol handler (popquiz://)
   - More reliable, but requires app installation
3. Document the mDNS approach: users type `popquiz.local:4310` in browser
   - Works now, just needs documentation
4. Add an HTTP endpoint on port 4310 that serves a simple redirect page
   - Minimal changes, users go to `popquiz.local` and get redirected

**Recommended for secondary feature:** Option 4 (redirect page on main backend)
