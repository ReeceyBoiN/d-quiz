# Port Connectivity Issue - Diagnosis and Solution

## Current Architecture

The app is an Electron + Vite + Express setup with **two separate servers**:

1. **Vite Dev Server (Port 3000)**
   - Web browser interface
   - Currently NOT exposed to network (needs `--host` flag)
   - Accessible only as `localhost:3000`

2. **Express/WebSocket Backend (Port 4310)**
   - Runs in Electron main process
   - Handles WebSocket connections (`/events` endpoint)
   - Only starts when Electron app is running
   - Uses port 4310 by default (can be overridden via `BACKEND_PORT` env var)

## Current Problem

When you try to access `192.168.1.116:4310`, the backend server isn't running because:
- Current dev script is `npm run dev:builder` which runs Vite dev server only
- The Express backend (port 4310) only starts when running the full Electron app
- Even if it was running, Vite on port 3000 isn't exposed to your network

## Root Cause

1. **Port mismatch**: You're trying to access 4310, but only the Vite server (3000) is running
2. **No network exposure**: Vite isn't configured with `--host` to expose to the network
3. **Missing backend**: The Express backend only runs when Electron app is launched

## Solution Options

### Option A: Access the Vite dev server from phone (recommended for browser testing)
- Modify `npm run dev` to include `--host` flag
- Access as `http://192.168.1.116:3000`
- Works for UI development but backend API calls will fail without running Electron

### Option B: Run full Electron app for complete functionality
- Run `npm run dev:electron` instead
- This starts Electron app which launches Express backend on 4310
- Vite dev server also runs on 3000
- Can access from phone on either port depending on what you need

### Option C: Run separate dev servers for browser and Electron
- Run `npm run dev:vite` in one terminal for browser (add `--host`)
- Run `npm run dev:electron` in another for Electron backend
- Provides full functionality with network access

## Your Specific Setup (Player App)

You're trying to access the **player app** (`src-player/`) from your phone with full WebSocket functionality.

**Current problem:**
- Player app (port 3001) is NOT exposed to the network - no `--host` flag
- Backend server (port 4310) is NOT running - only Vite is running
- Player app tries to connect WebSocket to `ws://HOST:PORT/events` using its own host
- There's a **port mismatch**: app is on 3001 but backend is on 4310

**Why 4310 doesn't work:**
- The Express backend server only starts when running the full Electron app
- Currently, only the Vite dev server is running

## Solution

To test the player app on your phone with full functionality:

1. **Expose player app to network**: Add `--host` flag to player app dev script
   - Changes port 3001 to expose as `0.0.0.0:3001`
   - Accessible as `http://192.168.1.116:3001`

2. **Run the backend server**: Need to either:
   - Option A: Run `npm run dev:electron` to start full Electron app (starts backend on 4310)
   - Option B: Start the Express backend separately (more complex)

3. **Fix the WebSocket URL mismatch**:
   - Player app currently tries to connect to `/events` on the same host:port it's served from
   - This would try port 3001, but backend is on 4310
   - Need to configure WebSocket URL to point to correct backend host:port

**Recommended approach:**
1. Modify `src-player/vite.config.ts` to add `--host` to expose on network
2. Run `npm run dev:electron` in the background to start backend on 4310
3. Update player app's WebSocket connection to use backend host:4310 instead of same-host

## Key Files to Modify
- `src-player/vite.config.ts` - Add server host configuration
- `src-player/src/hooks/useNetworkConnection.ts` - Fix WebSocket URL to point to correct backend
- May need env variable for backend URL
- `electron/backend/server.js` - Express/WebSocket server on port 4310
- `electron/main/main.js` - Electron main process
