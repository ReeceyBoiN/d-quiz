# Team Photo Local Storage Implementation Plan

## Overview
Implement local disk storage for team photos to improve reliability and stability. Photos will be saved to disk when received (pending status), displayed from disk files instead of base64 data URLs, stored as JPEG format (compressed), and automatically cleaned up when Empty Lobby is triggered.

## Key Design Decisions
- **Save Timing**: Save immediately when photo is received (pending status)
- **Display Source**: Display from disk file paths (not base64 data URLs)
- **Image Format**: Convert to JPEG compressed format
- **Storage Path**: Parent project folder structure: `resorces/pics/Team Pics` (maintains existing folder naming)
- **File Naming**: `team_<deviceId>_<timestamp>.jpg` for unique, sortable identification
- **Cleanup**: Delete all photo files from Team Pics folder on Empty Lobby

## Architecture & Data Flow Changes

### Current Flow (Memory-Based)
```
Player sends PLAYER_JOIN (base64) → Server stores base64 in memory → Host displays base64 directly in UI
```

### New Flow (Disk-Based)
```
Player sends PLAYER_JOIN (base64) → Server saves to disk as JPEG → Server stores file path in memory → 
Host displays from file path → On Empty Lobby, delete all files
```

## Files That Need Modification

### 1. Backend/Server Files
**electron/backend/server.js**
- Add helper function `saveTeamPhotoToDisk(base64String, deviceId, teamName)` that:
  - Creates Team Pics folder if it doesn't exist (using path relative to project root)
  - Converts base64 to binary data
  - Saves as JPEG file: `team_<deviceId>_<timestamp>.jpg`
  - Returns file path
- Modify PLAYER_JOIN handler to:
  - Call saveTeamPhotoToDisk when teamPhoto is present
  - Store the returned file path (not base64) in networkPlayers
- Update getAllNetworkPlayers to return file paths (stored teamPhoto field)
- Add error handling and logging

**electron/main/main.js**
- Add IPC endpoint `network/save-team-photo` to handle base64-to-file conversion in main process (if needed for security)
- Alternative: handle conversion in server.js itself (simpler, but less isolated)

### 2. Host UI Components
**src/components/BottomNavigation.tsx**
- Update Team Photos popup to load and display photos from file paths instead of base64
- When fetching pending photos via `network/all-players`, the teamPhoto field will now be a file path
- Update image `src` attributes to use file paths directly

**src/components/QuizHost.tsx**
- Update `handleApproveTeam` to work with file paths instead of base64
- When passing fastestTeam data to external display, pass file paths
- Update fastest team display payloads to use file paths

**src/components/ExternalDisplayWindow.tsx**
- Update FastestTeamOverlaySimplified to accept and display photos from file paths

**src/components/FastestTeamOverlay.tsx** (player side)
- May need update if FASTEST message includes file path instead of base64 (but players won't have disk access, so broadcast FASTEST should still use base64 or we need special handling)

### 3. Empty Lobby / Cleanup
**src/components/QuizHost.tsx**
- Update `handleEmptyLobby` to call a cleanup function that:
  - Calls a new IPC endpoint `network/cleanup-team-photos` 
  - Deletes all files in the Team Pics folder

**electron/main/main.js**
- Add IPC endpoint `network/cleanup-team-photos` that:
  - Calls backend function to delete all team photo files
  - Deletes the Team Pics folder contents (not the folder itself)

**electron/backend/server.js**
- Add helper function `cleanupTeamPhotos()` that:
  - Lists all files in Team Pics folder
  - Deletes each file (error handling for missing/locked files)
  - Logs cleanup progress
- Add cleanup on server shutdown or graceful reload (optional)

## Critical Implementation Considerations

### File Path Handling
- Use `path.join()` and `path.resolve()` for cross-platform compatibility
- Store relative paths in memory, use absolute paths for disk I/O
- When returning to host UI, ensure paths work for `<img src="">` (may need file:// protocol)

### Image Conversion (Base64 → JPEG)
- Use Node.js built-in libraries (`Buffer`) to convert base64 to binary
- For actual JPEG encoding, consider:
  - Option A: Use `sharp` library (if already in dependencies) for robust image handling
  - Option B: Use basic Buffer.from() conversion (works if input is already JPEG base64)
  - Option C: Install a lightweight image library if needed

### File Size & Performance
- JPEG compression reduces file size (good for network transfer and storage)
- Team photos stored on disk = faster load times, reduced memory footprint
- Consider file size validation before saving (e.g., max 5MB per photo)

### Error Handling
- Handle cases where Team Pics folder can't be created (permissions)
- Handle disk space errors when saving
- Handle file deletion errors on Empty Lobby (locked files)
- Gracefully fall back to base64 if file operations fail (optional)

### Testing Points
1. Verify photos save to disk with correct naming
2. Verify photos display from disk (not base64)
3. Verify Empty Lobby deletes all photo files
4. Verify fastest team overlay still works with file paths
5. Verify external display shows photos correctly
6. Test with multiple team photos to ensure no collisions
7. Test on project rename (folder path still works)

## Step-by-Step Implementation Order

1. **Phase 1: Backend Photo Saving**
   - Add photo save function to server.js
   - Modify PLAYER_JOIN handler to save to disk
   - Add error handling and logging

2. **Phase 2: IPC Endpoints**
   - Add cleanup IPC endpoint in main.js
   - Wire backend cleanup function
   - Test IPC communication

3. **Phase 3: Host UI Updates**
   - Update BottomNavigation to display from file paths
   - Update QuizHost fastest team display logic
   - Update external display components

4. **Phase 4: Empty Lobby Integration**
   - Wire handleEmptyLobby to call cleanup
   - Test full cleanup flow

5. **Phase 5: Testing & Polish**
   - End-to-end testing
   - Error handling edge cases
   - Performance verification

## Success Criteria
- ✅ Team photos save to disk immediately when received
- ✅ Photos are stored as JPEG files with unique names
- ✅ Host displays photos from disk files (working file paths)
- ✅ Team Photos popup shows pending photos with approval/decline (current UI works with new file paths)
- ✅ Fastest team overlay displays photos from disk
- ✅ External display shows team photos correctly
- ✅ Empty Lobby completely deletes all photo files
- ✅ No broken links or missing images
- ✅ Error handling for file I/O failures
- ✅ Improved stability and reliability compared to memory-only approach
