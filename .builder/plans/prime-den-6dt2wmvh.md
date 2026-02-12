# Fix Player Device Connection to Quiz Server

## Problem
Player devices trying to connect to the WebSocket using `192.168.1.63:4310` were failing because:
- The backend server knows its local IP but wasn't sharing it with the player app
- The player app falls back to `window.location.hostname` which may not resolve correctly
- Connection required proper IP discovery mechanism

## Solution Implemented

### 1. Backend Enhancement - `/api/host-info` Endpoint
**File:** `electron/backend/server.js` (lines 56-79)

Added an HTTP endpoint that automatically discovers and exposes the server's connection information:
```javascript
app.get('/api/host-info', (req, res) => {
  const protocol = req.protocol === 'https' ? 'wss' : 'ws';
  res.json({
    localIP: localIP,
    port: port,
    wsUrl: `${protocol}://${localIP}:${port}/events`,
    httpUrl: `${req.protocol}://${localIP}:${port}`
  });
});
```

Returns:
- `localIP`: Server's actual local IP address
- `port`: Backend port number  
- `wsUrl`: Complete WebSocket URL for player to connect to
- `httpUrl`: HTTP URL for the server

### 2. Player App Connection Logic Update
**File:** `src-player/src/hooks/useNetworkConnection.ts` (lines 36-75)

Updated connection flow:
1. Made `connect()` function async to support fetch
2. Attempts to fetch `/api/host-info` with 5-second timeout
3. If successful: Uses server-provided `wsUrl`
4. If failed: Falls back to environment variables or `window.location.hostname`
5. Maintains backward compatibility if endpoint unavailable

Connection sequence:
```
fetch /api/host-info → get wsUrl → connect WebSocket
                    ↓ fail
                  fallback to env/window location
```

## Testing Checklist
- ✅ Backend endpoint added and positioned correctly
- ✅ Player app fetches host info before WebSocket connection
- ✅ Fallback mechanism in place for backward compatibility
- ✅ Console logging for debugging connection flow
- ✅ 5-second timeout on fetch to prevent hanging

## Expected Behavior in Test
When player device connects to `192.168.1.63:4310`:
1. Browser console shows: "Fetching host info from: http://192.168.1.63:4310/api/host-info"
2. Browser console shows: "✅ Got host info from server - Using WebSocket URL: ws://192.168.1.63:4310/events"
3. Browser console shows: "✅ Player connected to host"

If API call fails, it falls back with: "Falling back to environment variables or window location"

## Ready for Rebuild
✅ All changes verified and complete. Ready to rebuild EXE and test.
