# Photo Upload Backend Debug & Fix Plan

## Current Status
- ✅ Player side: File upload, FileReader, base64 conversion working perfectly
- ✅ Network: Player is sending photo via PLAYER_JOIN WebSocket message
- ❌ Backend: Photo not being saved to disk
- ❌ Host: No photo displayed, file not in Team Pics folder

## Root Cause Analysis

The flow should be:
1. Player app: `SettingsBar.tsx` → FileReader → base64 → `updateTeamPhoto()`
2. Player app: Stores in localStorage and state
3. Player app: Sends via `PLAYER_JOIN` WebSocket message with `teamPhoto` field
4. Backend: `electron/backend/server.js` receives message
5. Backend: Calls `saveTeamPhotoToDisk(base64, deviceId)`
6. Backend: Writes file to `resorces/pics/Team Pics/` directory (typo noted)
7. Backend: Stores file path in `networkPlayers` map
8. Host: Reads from `networkPlayers` and displays

**Issue is in steps 4-6**: Backend is either not receiving the photo or failing to save it.

## Investigation Needed

Before implementing fix, need to answer:

### Q1: Directory Exists?
- Is `resorces/pics/Team Pics` directory actually created in your project?
- Note: There's a typo in code ("resorces" not "resources") - need to verify if this is intentional or a bug
- If directory doesn't exist, `fs.mkdirSync()` should create it, but may fail silently if permissions issue

### Q2: Backend Logs?
- Are you seeing any console output from the backend when player joins?
- Expected logs: `[WS-xxx] 📸 Team photo received...` or `[Photo Storage] ❌ Failed to save...`
- If no logs appear, backend may not be receiving the photo at all

### Q3: WebSocket Message Structure?
- Is the `teamPhoto` field actually being included in the PLAYER_JOIN message?
- Need to add logging to backend WebSocket handler to verify message contents

## Implementation Plan

### Phase 1: Add Comprehensive Backend Logging to PLAYER_JOIN Handler
**File**: `electron/backend/server.js`

In the PLAYER_JOIN WebSocket handler (where `if (data.type === 'PLAYER_JOIN')`):
1. Add log for incoming message: `log.info('[PLAYER_JOIN] Received message with fields:', Object.keys(data))`
2. Add log for photo presence: `log.info('[PLAYER_JOIN] Photo field present:', !!data.teamPhoto, 'Size:', data.teamPhoto?.length)`
3. Log the ENTIRE teamPhoto value (first 100 chars) to confirm it's a valid base64 data URL: `log.info('[PLAYER_JOIN] Photo data prefix:', data.teamPhoto?.substring(0, 100))`
4. Add log before calling saveTeamPhotoToDisk
5. Add log after calling saveTeamPhotoToDisk with the returned path

### Phase 2: Add Logging to saveTeamPhotoToDisk Function
**File**: `electron/backend/server.js`, in `saveTeamPhotoToDisk(base64String, deviceId)` function:

1. Log the function entry: `console.log('[saveTeamPhotoToDisk] Called with deviceId:', deviceId)`
2. Log the photosDir path being used: `console.log('[saveTeamPhotoToDisk] Attempting to save to:', photosDir)`
3. Add logging to directory creation:
   ```
   if (!fs.existsSync(photosDir)) {
     console.log('[saveTeamPhotoToDisk] Directory does not exist, creating...');
     // log any errors from mkdirSync
   }
   ```
4. Log the filename being created: `console.log('[saveTeamPhotoToDisk] Generated filename:', fileName)`
5. Log the base64 string length BEFORE and AFTER stripping prefix
6. Wrap the `fs.writeFileSync` in try/catch with detailed error logging including:
   - Error message
   - Error code (permission denied, disk full, etc)
   - File path that failed
7. Log success with file size

### Phase 3: Fix Path Issues
**File**: `electron/backend/server.js`

The current path is: `path.join(__dirname, '../../resorces/pics/Team Pics')`

Two issues to fix:
1. **Typo**: "resorces" should be "resources"
2. **Path reliability**: Use `path.join(__dirname, '../../resources/pics/Team Pics')` with verification that __dirname points to electron/backend/
3. Add logging to show the ABSOLUTE path being used (not relative)

### Phase 4: Add Base64 Validation
**File**: `electron/backend/server.js`, in `saveTeamPhotoToDisk()`:

Before attempting to decode:
```javascript
if (!base64String || typeof base64String !== 'string') {
  log.error('[saveTeamPhotoToDisk] Invalid base64String - not a string');
  return null;
}
if (!base64String.includes('data:image')) {
  log.warn('[saveTeamPhotoToDisk] WARNING: base64 string does not include data: prefix');
}
```

### Phase 5: Verify Player Sends Photo in PLAYER_JOIN
**File**: `src-player/src/App.tsx`

In the code where PLAYER_JOIN is constructed for WebSocket send:
- Add console log to show what fields are in joinPayload
- Specifically log if `settings.teamPhoto` exists: `console.log('[App] PLAYER_JOIN payload includes teamPhoto:', !!joinPayload.teamPhoto, 'Length:', joinPayload.teamPhoto?.length)`
- Log this BEFORE sending via `wsRef.current.send()`

## Expected Outcome After Implementation
When user uploads a photo:
1. Player console will show:
   - `[App] PLAYER_JOIN payload includes teamPhoto: true Length: 343638`
2. Backend console will show:
   - `[saveTeamPhotoToDisk] Called with deviceId: ...`
   - `[saveTeamPhotoToDisk] Attempting to save to: /full/absolute/path/...`
   - `[saveTeamPhotoToDisk] Generated filename: team_[deviceId]_[timestamp].jpg`
   - `[saveTeamPhotoToDisk] File written successfully, size: [bytes]`
3. Photos will appear in the Team Pics folder
4. Host app can read the file paths and display them

This logging will pinpoint exactly where the process is failing.

## Key Files to Modify
1. `electron/backend/server.js` - Add logging throughout, fix "resorces" typo, add error handling
2. `src-player/src/App.tsx` - Add logging to verify photo in join payload (optional, for verification)

## Critical Notes
- This is diagnostic logging first, then fix. Don't remove logs after - they help with troubleshooting
- The typo "resorces" must be fixed to "resources"
- File paths are relative from `__dirname` which is `electron/backend/` - verify this is correct
- Base64 strings are large (your test was 343KB) - ensure no truncation in logs
- Dependencies: This change only affects PLAYER_JOIN handler and photo save function - isolated changes
- No changes needed to message types or network protocol - just making existing flow work
