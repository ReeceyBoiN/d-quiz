# Fix: Stuck Buzzer Folder Loading & Protect User Buzzer Files

## Problems
1. **UI Stuck on "Loading default buzzer folder path..."** - The IPC call `window.api.files.getDefaultBuzzerPath()` is not completing/resolving
2. **Buzzers being deleted on new builds** - User's MP3 buzzer files are being cleared when a new version is built/installed
3. **No protection on buzzer folder** - Need to ensure buzzer files are never accidentally deleted

## Root Causes Analysis

### Issue #1: Stuck Loading
The issue is in the preload.js expose function. The `getDefaultBuzzerPath()` function is calling `invoke()` directly without proper error handling or returning the promise correctly. When there's any error in the IPC handler or a timeout, the promise never resolves and the UI stays stuck.

Current problematic code in preload.js (line 44):
```javascript
getDefaultBuzzerPath: () => invoke('files/get-default-buzzer-path'),
```

The promise from `invoke()` is being returned but if there's any issue, it never settles (no catch handler).

### Issue #2: Buzzer Files Deletion
The `initializePaths()` in pathInitializer.js is safe - it only creates folders if they don't exist and doesn't delete files. However:
- The user may have placed custom buzzer files in the default folder
- When a new version updates/installs, these files could potentially be lost if not protected
- The folder structure initialization should include a safeguard comment and validation

## Solution Approach

### Part 1: Fix Stuck Loading Issue
1. **Update preload.js** - Add proper error handling and timeout to `getDefaultBuzzerPath()`
   - Wrap the promise with a timeout (5 seconds)
   - Return a default error response if timeout occurs
   - Add logging for debugging

2. **Update Settings.tsx & BuzzersManagement.tsx** - Handle error cases gracefully
   - Check if result is ok/successful
   - Provide fallback UI when path loading fails
   - Show a specific error message instead of stuck "Loading..."

3. **Update main.js IPC handler** - Ensure response wrapper is consistent
   - Verify the handler wraps response in `{ ok: true, data: { path: ... } }` format
   - Add explicit error wrapper on catch

### Part 2: Protect Buzzer Files
1. **Document folder safety** - Add comments in pathInitializer.js explaining that this folder is not touched after creation
2. **Add verification function** - Create a function to verify buzzer folder exists and is accessible after initialization
3. **Add safeguard note** - Document that users' buzzers in the default folder are preserved on updates
4. **Add migration logging** - Ensure any old buzzer migrations don't delete existing custom buzzers

## Files to Modify

### Frontend
- `src/components/Settings.tsx` - Add error handling to buzzer path loading
- `src/components/BuzzersManagement.tsx` - Add error handling to buzzer path loading

### Backend/Electron
- `electron/preload/preload.js` - Add error handling and timeout wrapper
- `electron/main/main.js` - Ensure IPC response wrapper is consistent
- `electron/backend/pathInitializer.js` - Add protection comments and verification

## Implementation Steps

1. Fix preload.js to add error handling and timeout wrapper to `getDefaultBuzzerPath()`
2. Update main.js IPC handler to use consistent response wrapper
3. Update Settings.tsx to handle errors and show default path or error message
4. Update BuzzersManagement.tsx to handle errors and show default path or error message
5. Add protection comments and verification logic to pathInitializer.js
6. Test both UI entry points to verify loading completes successfully

## Key Implementation Details

- Timeout should be 5 seconds with silent fallback to default path (no error message)
- **Always display the full file path** to the user (not "Using default folder" text)
  - If custom path is set: show the custom path
  - If using default: show the actual default path like `C:\Users\...\Documents\PopQuiz\Resources\Sounds\Buzzers`
- Buzzer files in the default folder will never be deleted by the app
- Migration logic won't touch custom buzzer selections or files
- IPC promise should resolve even on error, returning the default path instead of hanging

## UI Behavior
- Settings.tsx and BuzzersManagement.tsx will display the default path immediately (fetched via IPC)
- If IPC fails after 5 seconds, the app silently falls back and continues displaying the default path
- No error messages or warnings to the user
- User can still change the folder using the "Change Folder" button at any time
