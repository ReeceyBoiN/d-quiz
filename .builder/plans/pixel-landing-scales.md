# Plan: Fix Countdown Audio File Location Issue

## Problem Analysis

The countdown audio cannot be found because of a **path location mismatch**:

### Current Situation:
1. **Electron expects files at**: `C:\Users\windows1\Documents\PopQuiz\Resources\Sounds\Countdown\Countdown.wav`
   - This is what the Electron `pathInitializer.js` returns via the `get-resource-paths` IPC channel
   - The browser correctly converts this to: `file:///C:/Users/windows1/Documents/PopQuiz/Resources/Sounds/Countdown/Countdown.wav`
   - But the files don't exist at this location

2. **Audio files are currently at**: `C:\PopQuiz\d-quiz\resorces\sounds\Countdown\` ✓ CONFIRMED
   - This is the old location that needs to be migrated

### Root Cause:
The Electron `pathInitializer.js` has a migration function that attempts to copy old sounds automatically, but it's looking in the wrong path. The code assumes old files are at `process.cwd()/resorces/sounds`, but your actual files are at `C:\PopQuiz\d-quiz\resorces\sounds`.

## Recommended Solution: Update Migration Logic

### Option A: Fix the migration to use hardcoded path (RECOMMENDED)
- Update `electron/backend/pathInitializer.js` to check for the actual old location: `C:\PopQuiz\d-quiz\resorces\sounds`
- The migration function will automatically copy files on next app startup
- This is a one-time migration, then files will be in the correct Documents location

### Option B: Manual migration (if Option A doesn't work)
- Copy the folder: `C:\PopQuiz\d-quiz\resorces\sounds\Countdown`
- Paste it to: `C:\Users\windows1\Documents\PopQuiz\Resources\Sounds\Countdown`
- Replace existing empty folder (if it exists)

## Implementation Steps:

1. **Update migration logic in `pathInitializer.js`**:
   - Modify `migrateSoundsIfNeeded()` function
   - Check for the actual old path: `C:\PopQuiz\d-quiz\resorces\sounds`
   - If found, copy to new Documents location

2. **Restart the app** to trigger migration

3. **Verify files are in new location**:
   - Check: `C:\Users\windows1\Documents\PopQuiz\Resources\Sounds\Countdown\`
   - Should contain: `Countdown.wav` and `Countdown Silent.wav`

4. **Test countdown audio**:
   - Start a quiz with timer
   - Verify audio plays without console errors

## Files to Modify:
- `electron/backend/pathInitializer.js` - Fix the `migrateSoundsIfNeeded()` function to find files at the correct old location

## Expected Outcome:
- Audio files successfully migrated to Documents folder
- Countdown audio loads and plays correctly
- No more `ERR_FILE_NOT_FOUND` errors
