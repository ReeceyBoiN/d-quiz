# IMPLEMENTATION PLAN: Error Broadcasting

## PHASE 1: Modify Server to Broadcast Errors

### File: electron/backend/server.js

**Modify the TEAM_PHOTO_UPDATE handler:**
- When `saveTeamPhotoToDisk()` returns null/falsy (indicating failure)
- Broadcast a DEBUG_ERROR message to ALL connected clients
- Include the error details so host/player can see them

**Changes:**
1. In the TEAM_PHOTO_UPDATE handler (~line 550 in server.js)
2. Around the `if (!photoPath)` check
3. Add new broadcast function or use existing broadcast pattern
4. Send error message with detailed reason

**Code pattern to add:**
```javascript
// After saveTeamPhotoToDisk returns null/falsy
if (!photoPath) {
  const errorMessage = JSON.stringify({
    type: 'DEBUG_ERROR',
    source: 'TEAM_PHOTO_UPDATE',
    error: 'Photo save failed',
    deviceId: updateDeviceId,
    teamName: data.teamName,
    timestamp: Date.now()
  });
  
  // Broadcast error to all connected clients
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(errorMessage);
    }
  });
  
  return;
}
```

## PHASE 2: Add Error Handler in Host UI

### File: src/components/QuizHost.tsx or BottomNavigation.tsx

**Add listener for DEBUG_ERROR messages:**
- Register handler for 'DEBUG_ERROR' type messages
- Log them to console with clear formatting
- Include source and error message

**Code pattern:**
```javascript
useEffect(() => {
  const unsubscribe = onNetworkMessage('DEBUG_ERROR', (data) => {
    console.error(`[🔴 SERVER ERROR] ${data.source}: ${data.error}`);
    console.error('Details:', data);
  });
  
  return unsubscribe;
}, []);
```

## PHASE 3: Also Broadcast Photo Save Success

### Add success confirmation messages
When photo DOES save successfully:
- Send a DEBUG_INFO message confirming success
- Include the file path saved
- This confirms the flow is working

## EXPECTED OUTCOME

After implementation:
1. You'll see in browser console:
   - Either ✅ "Photo saved successfully to: file:///path/..."
   - Or 🔴 "Photo save failed: Permission denied" / "No space left" / "Invalid base64"

2. This reveals the EXACT failure reason

3. Then we can fix the root cause (file system issue)

## AFFECTED FILES (Read-Only to Identify Exact Line Numbers)
- electron/backend/server.js → TEAM_PHOTO_UPDATE handler (lines ~500-550)
- src/components/QuizHost.tsx → useEffect hooks for network messages (lines ~2400-2600)
- src/components/BottomNavigation.tsx → alternative location for error handler

## FALLBACK: Direct Electron Log Check

If you prefer not to modify code:
- Windows: Open `%APPDATA%\PopQuiz\logs\main.log` (or find in AppData folder)
- Mac: Open `~/Library/Logs/PopQuiz/main.log`
- Search for "[saveTeamPhotoToDisk]" to see exact error

## SUCCESS CRITERIA

✅ Browser console shows server error messages
✅ Error message clearly states WHY photo save failed
✅ We can then fix root cause (permissions, disk space, path, base64, etc.)
