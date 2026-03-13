# Fix: BUZZ_RESET / BUZZ_RESULT / BUZZ_LOCKED Messages Not Reaching Player Devices

## Root Cause

The `sendBuzzResetToPlayers()`, `sendBuzzResultToPlayers()`, and `sendBuzzLockedToPlayers()` functions in `src/network/wsHost.ts` call `api.network.broadcastMessage(...)` to relay messages via the Electron IPC to the backend WebSocket server. However, **`broadcastMessage` does not exist** in the preload API (`electron/preload/preload.js`) or as an IPC route (`electron/main/main.js`), and the backend server (`electron/backend/server.js`) does not expose a generic broadcast function.

This means `BUZZ_RESET`, `BUZZ_RESULT`, and `BUZZ_LOCKED` messages are only broadcast via `hostNetwork.broadcast()` which only triggers **local in-memory listeners** within the host app. They never reach player devices over WebSocket.

This is why:
- After the host marks a buzz wrong, the player's button stays disabled (they never receive `BUZZ_RESET`)
- The player logs show no `BUZZ_RESET received` or `BUZZ_RESULT received` entries
- The same applies to `BUZZ_LOCKED` (players may not see who buzzed), and also `TIMER_PAUSE` / `TIMER_RESUME`

## Fix: Add Generic `broadcastMessage` to the IPC Pipeline

### File 1: `electron/backend/server.js`

Add a generic `broadcastMessage(type, data)` function that sends any message type to all approved WebSocket-connected players. Model it after existing broadcast functions (e.g. `broadcastPrecache`).

Add it to the return object at line 2820.

```js
function broadcastMessage(type, data) {
  try {
    const message = JSON.stringify({
      type,
      data: data || {},
      timestamp: Date.now()
    });

    let successCount = 0;
    let failCount = 0;

    networkPlayers.forEach((player, deviceId) => {
      if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
        try {
          player.ws.send(message, (err) => {
            if (err) {
              log.error(`❌ [broadcastMessage] ws.send error for ${deviceId}:`, err.message);
            }
          });
          successCount++;
        } catch (error) {
          log.error(`❌ Failed to send ${type} to ${deviceId}:`, error.message);
          failCount++;
        }
      }
    });

    log.info(`📡 Broadcast ${type} to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed` : ''));
  } catch (err) {
    log.error(`❌ broadcastMessage error (${type}):`, err.message);
  }
}
```

### File 2: `electron/main/main.js`

Add an IPC route `network/broadcast-message` after the existing broadcast routes (after line ~931):

```js
router.mount('network/broadcast-message', async (payload) => {
  try {
    const { type, data } = payload;
    log.info('[IPC] network/broadcast-message called with:', { type });

    if (!backend || !backend.broadcastMessage) {
      log.error('[IPC] Backend not initialized for broadcast-message');
      throw new Error('Backend not initialized');
    }

    backend.broadcastMessage(type, data);
    return { broadcasted: true };
  } catch (err) {
    log.error('[IPC] network/broadcast-message error:', err.message);
    throw err;
  }
});
```

### File 3: `electron/preload/preload.js`

Add `broadcastMessage` to the `network` object (around line 121):

```js
broadcastMessage: (data) => invoke('network/broadcast-message', data),
```

### No changes needed in `src/network/wsHost.ts`

The existing calls `api.network.broadcastMessage({ type: 'BUZZ_RESET', data: ... })` will now correctly route through the preload → IPC → backend → WebSocket pipeline. The same applies for `BUZZ_RESULT`, `BUZZ_LOCKED`, `TIMER_PAUSE`, and `TIMER_RESUME`.

## Verification

After this fix, when the host marks a buzz-in answer as wrong:
1. `handleBuzzWrong` calls `sendBuzzResultToPlayers()` → sends `BUZZ_RESULT` via IPC → backend broadcasts to all players
2. `handleBuzzWrong` calls `sendBuzzResetToPlayers()` → sends `BUZZ_RESET` via IPC → backend broadcasts to all players
3. Player receives `BUZZ_RESET` → `App.tsx` clears `buzzLockedBy` and `buzzLockedOut`
4. `QuestionDisplay.tsx` `useEffect` sees both cleared → resets `submitted` to `false`
5. Buzz button becomes clickable again
