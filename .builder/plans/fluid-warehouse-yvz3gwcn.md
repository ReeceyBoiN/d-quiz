# Team Photo Not Saving/Displaying - Investigation & Fix Plan

## Status: CRITICAL FINDING - Ready for Implementation

---

## Root Cause Identified

**The backend is NOT receiving the TEAM_PHOTO_UPDATE message from the player app.**

### Evidence:
1. ✅ Player logs show: `[SettingsBar] ✅ TEAM_PHOTO_UPDATE message sent`
2. ❌ Backend logs show: NO `[TEAM_PHOTO_UPDATE]` or `[saveTeamPhotoToDisk]` reception
3. ❌ Host logs show: No `[QuizHost] 📸 TEAM_PHOTO_UPDATED received` messages
4. ✅ File system: `resources/pics/Team Pics/` exists and is writable

**Conclusion**: Message is being constructed and sent from player, but never reaching backend for processing.

---

## Why This Happens - Likely Causes

### Theory 1: `sendMessage` callback is broken or not bound correctly
- **Location**: `src-player/src/components/SettingsBar.tsx` lines 103-114
- **Issue**: The `sendMessage` function may not be properly connected to WebSocket
- **Evidence**: Initial PLAYER_JOIN messages work (photo data sent with that), but separate TEAM_PHOTO_UPDATE doesn't arrive
- **Fix**: Verify `sendMessage` is the same WebSocket handler as PLAYER_JOIN

### Theory 2: Backend message handler never set up for async
- **Location**: `electron/backend/server.js` line 241 (message handler)
- **Issue**: Recent changes converted handler to `async (message)` - but may not be properly awaiting or handling the async flow
- **Fix**: Verify async handler is correctly wired and not breaking message flow

### Theory 3: Network/WebSocket state issue between messages
- **Location**: Player WebSocket connection between PLAYER_JOIN and TEAM_PHOTO_UPDATE
- **Issue**: WebSocket state may degrade after initial connection
- **Evidence**: Initial message (PLAYER_JOIN) works, but later message (TEAM_PHOTO_UPDATE) doesn't arrive
- **Fix**: Add connection state logging and verify WebSocket remains open (readyState === 1)

### Theory 4: Message path validation failing silently
- **Location**: Backend message parsing or routing
- **Issue**: `data.type === 'TEAM_PHOTO_UPDATE'` check may fail due to case sensitivity or JSON parsing issue
- **Fix**: Add verbose logging at backend message handler entry

---

## Implementation Plan

### Step 1: Verify Backend is Processing Messages
**Goal**: Confirm backend message handler is running and receiving messages

**Changes to `electron/backend/server.js` line 237:**
```javascript
ws.on('message', async (message) => {
  try {
    let data;
    try {
      data = JSON.parse(message);
    } catch (parseErr) {
      log.error(`[WS-${connectionId}] ❌ Failed to parse message:`, parseErr.message);
      console.error('[WebSocket] PARSE ERROR - Raw message:', message.toString().substring(0, 200));
      return;
    }

    // ADD THIS LOGGING:
    console.log('[WebSocket] Message received, type:', data.type);
    log.info(`[WS-${connectionId}] Message received: ${data.type}`);
    
    if (data.type === 'PLAYER_JOIN') {
      // ... existing code ...
```

**Expected result**: Every message type should be logged, including TEAM_PHOTO_UPDATE

---

### Step 2: Verify sendMessage in Player App
**Goal**: Confirm TEAM_PHOTO_UPDATE message is actually being sent

**Changes to `src-player/src/components/SettingsBar.tsx` line 114:**
```javascript
if (isConnected && sendMessage && deviceId && teamName) {
  console.log('[SettingsBar] About to send TEAM_PHOTO_UPDATE with:');
  console.log('[SettingsBar] - isConnected:', isConnected);
  console.log('[SettingsBar] - sendMessage function exists:', !!sendMessage);
  console.log('[SettingsBar] - deviceId:', deviceId);
  console.log('[SettingsBar] - teamName:', teamName);
  console.log('[SettingsBar] - photoData length:', base64.length);
  
  const updatePayload = {
    type: 'TEAM_PHOTO_UPDATE',
    playerId,
    deviceId,
    teamName,
    photoData: base64,
    timestamp: Date.now(),
  };
  
  console.log('[SettingsBar] Payload constructed, calling sendMessage...');
  sendMessage(updatePayload);
  console.log('[SettingsBar] ✅ TEAM_PHOTO_UPDATE message sent via sendMessage');
}
```

**Expected result**: Detailed logs showing the message was passed to sendMessage

---

### Step 3: Verify WebSocket Connection State
**Goal**: Confirm WebSocket stays open and ready for TEAM_PHOTO_UPDATE

**Changes to `src-player/src/network/usePeerConnection.ts` (or equivalent connection handler):**
```javascript
// After PLAYER_JOIN is sent, add:
console.log('[Player] WebSocket state after PLAYER_JOIN:', ws?.readyState);
// readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED

// Before TEAM_PHOTO_UPDATE is sent, add:
console.log('[SettingsBar] WebSocket state before TEAM_PHOTO_UPDATE:', ws?.readyState);
if (ws?.readyState !== 1) {
  console.warn('[SettingsBar] ⚠️ WebSocket NOT open! State:', ws?.readyState);
}
```

**Expected result**: WebSocket readyState should be 1 (OPEN) when TEAM_PHOTO_UPDATE is sent

---

### Step 4: Check for Message Queue/Buffering Issues
**Goal**: Verify messages are sent immediately, not buffered

**Potential issue**: If WebSocket `bufferedAmount` is high, messages may be queued or dropped

**Add logging in player app:**
```javascript
console.log('[SettingsBar] WebSocket bufferedAmount:', ws?.bufferedAmount);
// If > 0, messages are being buffered
// If > 65536, messages may be dropped
```

---

## Files Needing Changes

| File | Lines | Change |
|------|-------|--------|
| `electron/backend/server.js` | 237-248 | Add verbose message reception logging |
| `electron/backend/server.js` | 415 | Add console.log for TEAM_PHOTO_UPDATE handler entry |
| `src-player/src/components/SettingsBar.tsx` | 103-117 | Add detailed logs for sendMessage call |
| `src-player/src/components/SettingsBar.tsx` | Before line 103 | Add WebSocket state check |

---

## Testing Procedure

1. **Restart backend** with full console output visible
2. **Reload player app** in browser
3. **Upload photo** from player device
4. **Check backend console** for:
   - `[WebSocket] Message received, type: TEAM_PHOTO_UPDATE`
   - `[TEAM_PHOTO_UPDATE] Received message...`
   - `[saveTeamPhotoToDisk]` logs
5. **Check player console** for:
   - `[SettingsBar] About to send TEAM_PHOTO_UPDATE with:`
   - `[SettingsBar] WebSocket state before TEAM_PHOTO_UPDATE: 1`
   - `[SettingsBar] ✅ TEAM_PHOTO_UPDATE message sent via sendMessage`

**Success criteria**: Backend logs show TEAM_PHOTO_UPDATE reception and processing

---

## If Backend Still Doesn't Receive Message

If after Step 1-4 the backend still shows no TEAM_PHOTO_UPDATE logs:

1. **Check Network Tab** in browser DevTools (Network tab, WS filter)
   - Verify TEAM_PHOTO_UPDATE message appears in WebSocket frame list
   - Check payload size and content

2. **Check if `sendMessage` is actually the WebSocket send function**
   - Trace back from NetworkContext to see what `sendMessage` is bound to
   - Verify it's calling `ws.send(JSON.stringify(message))`

3. **Check for duplicate WebSocket connections**
   - Backend should show multiple client connections
   - Verify player is sending on correct connection

---

## Summary

The issue is **message delivery from player to backend**, not file saving or broadcasting. 

**Next step**: Implement Steps 1-4 logging changes and re-test. Backend logs will reveal where the message is being lost.
