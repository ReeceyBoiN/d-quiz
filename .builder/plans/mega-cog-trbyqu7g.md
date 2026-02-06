# Fix Missing broadcastPicture API Exposure

## Issue Identified
The picture broadcasting functionality was partially implemented but the API is not exposed to the frontend renderer.

### Root Cause
**Missing Preload Script Exposure**: The `broadcastPicture` method was added to the backend (electron/backend/server.js) and IPC endpoint (electron/main/main.js), but it was NOT added to the API bridge in electron/preload/preload.js.

### Current State
- ✅ Backend function exists: `broadcastPicture()` in electron/backend/server.js (line ~720)
- ✅ IPC endpoint exists: `network/broadcast-picture` in electron/main/main.js (line ~417)
- ✅ Frontend function exists: `broadcastPictureToPlayers()` in src/components/QuizHost.tsx (line ~323)
- ✅ Frontend calling code exists: Updated `handlePrimaryAction()` in QuizHost.tsx (line ~1376)
- ❌ MISSING: Preload API exposure in electron/preload/preload.js

### Error Evidence
Console logs show:
```
[QuizHost] api.network.broadcastPicture not available
```

This happens because the preload script (electron/preload/preload.js) doesn't expose the `broadcastPicture` method in the `api.network` object.

## Solution
Add one line to electron/preload/preload.js in the `api.network` object:

**File**: electron/preload/preload.js
**Location**: In the `contextBridge.exposeInMainWorld('api', { ... })` block, inside the `network:` object
**Add**: 
```javascript
broadcastPicture: (data) => invoke('network/broadcast-picture', data),
```

### Placement
Insert it after `broadcastTimeUp` (around line 62) to maintain alphabetical ordering:

```javascript
network: {
  getPendingTeams: () => invoke('network/pending-teams'),
  getAllPlayers: () => invoke('network/all-players'),
  approveTeam: (data) => invoke('network/approve-team', data),
  declineTeam: (data) => invoke('network/decline-team', data),
  broadcastDisplayMode: (data) => invoke('network/broadcast-display-mode', data),
  broadcastPicture: (data) => invoke('network/broadcast-picture', data),  // ← ADD THIS
  broadcastQuestion: (data) => invoke('network/broadcast-question', data),
  broadcastReveal: (data) => invoke('network/broadcast-reveal', data),
  broadcastFastest: (data) => invoke('network/broadcast-fastest', data),
  broadcastTimeUp: () => invoke('network/broadcast-timeup'),
},
```

## Why This Works
1. **Preload Pattern**: The preload script creates a safe bridge between renderer and main process using contextBridge
2. **API Exposure**: Each method in `api.network` maps to an IPC channel via `invoke()`
3. **IPC Flow**: When `broadcastPictureToPlayers()` calls `window.api.network.broadcastPicture({image: ...})`, it will invoke `'network/broadcast-picture'` in the main process
4. **Main Process Handler**: The already-existing `network/broadcast-picture` endpoint in main.js will receive the invoke and call `backend.broadcastPicture()`
5. **Backend Broadcasting**: The backend function sends the PICTURE WebSocket message to all approved players

## Files Modified
1. **electron/preload/preload.js** - Add broadcastPicture to api.network object

## Testing
After the fix:
1. Host loads a question with an image
2. Host clicks "Send Picture" button
3. Browser console should show: `[QuizHost] Broadcasting picture to players via IPC`
4. Player phones should display the image
