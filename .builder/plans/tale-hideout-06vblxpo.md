# PIN Authentication Bug - Message Delivery Fix

## Root Cause (Confirmed)

1. ✅ PIN validation in QuizHost works correctly
2. ✅ sendControllerAuthToPlayer() is called with correct deviceId
3. ❌ **Message never reaches player because:**
   - In web mode, `window.api.network.sendToPlayer` (IPC) doesn't exist
   - Falls back to `broadcastMessage()` → `hostNetwork.broadcast()`
   - Line 83 of wsHost.ts has TODO: "When ws server is live, iterate clients and ws.send..."
   - **CURRENT: `hostNetwork.broadcast()` only triggers local listeners (line 85)**
   - **Players connected to backend WebSocket never receive the message**

## Architecture

- **Backend:** WebSocket server at `ws://192.168.0.103:4310/events`
- **Players:** Connect to backend WebSocket, backend stores their `player.ws` reference
- **Backend capability:** Can send to players via `player.ws.send(message)` (see lines 1807, 2004, 2034 of server.js)
- **Host:** Needs a way to tell backend "send this message to this player"

## Solution: Add HTTP API Endpoint for Message Forwarding

Since host is in a browser and cannot directly access backend's networkPlayers Map, add an HTTP endpoint that:
1. Receives message from host
2. Looks up player by deviceId in networkPlayers
3. Sends message to that player's WebSocket

### Step 1: Add HTTP endpoint in backend (electron/backend/server.js)

Add after existing broadcast endpoints:

```javascript
// Send message to specific player via HTTP request from host
app.post('/api/send-to-player', (req, res) => {
  try {
    const { deviceId, messageType, data } = req.body;
    
    if (!deviceId || !messageType) {
      return res.status(400).json({ ok: false, error: 'Missing deviceId or messageType' });
    }
    
    const player = networkPlayers.get(deviceId.trim());
    if (!player || !player.ws) {
      log.warn(`[/api/send-to-player] Player not found or WebSocket not ready: ${deviceId}`);
      return res.status(404).json({ ok: false, error: 'Player not found' });
    }
    
    const message = JSON.stringify({
      type: messageType,
      data: data || {},
      timestamp: Date.now()
    });
    
    player.ws.send(message, (err) => {
      if (err) {
        log.error(`[send-to-player] Error sending to ${deviceId}:`, err.message);
        res.status(500).json({ ok: false, error: err.message });
      } else {
        log.info(`[send-to-player] Message sent to ${deviceId}`);
        res.json({ ok: true });
      }
    });
  } catch (err) {
    log.error('[send-to-player] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

### Step 2: Update sendControllerAuthToPlayer in QuizHost.tsx

Replace the fallback (lines 397-402) to use the HTTP endpoint:

```typescript
} else {
  console.warn('[QuizHost] api.network.sendToPlayer not available - using HTTP API');
  try {
    // Get the backend URL from hostInfo hook or current window location
    const backendUrl = await (window as any).hostInfo?.httpUrl || 
                      `${window.location.protocol}//${window.location.hostname}:4310`;
    
    const response = await fetch(`${backendUrl}/api/send-to-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        messageType: success ? 'CONTROLLER_AUTH_SUCCESS' : 'CONTROLLER_AUTH_FAILED',
        data: { 
          message: message || (success ? 'Controller authenticated' : 'Controller authentication failed')
        }
      })
    });
    
    if (!response.ok) {
      console.error('[QuizHost] HTTP API error:', await response.text());
    } else {
      console.log('[QuizHost] Controller auth sent via HTTP API');
    }
  } catch (err) {
    console.error('[QuizHost] Error sending controller auth via HTTP:', err);
  }
}
```

Alternatively, get hostInfo from the useHostInfo hook that's already being used elsewhere.

## Files to Modify

1. **electron/backend/server.js** - Add `/api/send-to-player` HTTP endpoint
2. **src/components/QuizHost.tsx** - Update sendControllerAuthToPlayer() fallback to use HTTP API

## Testing

1. Click "Host Controller" to generate PIN (e.g., 5323)
2. Join player app with PIN as team name
3. Verify:
   - Host logs show PIN match and auth attempt
   - CONTROLLER_AUTH_SUCCESS sent via HTTP API
   - Player receives message on WebSocket
   - Player sees admin portal instead of buzzer selection

## Success Criteria

- CONTROLLER_AUTH_SUCCESS reaches player's WebSocket
- Player transitions to 'host-terminal' screen (admin portal)
- Works in both web and Electron modes
- No console errors
