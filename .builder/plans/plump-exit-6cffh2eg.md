# PLAN: Fix ENOTDIR Error - Rebuild Electron Executable

## Problem Identified
The ENOTDIR error persists despite fixing the folder path spelling in `electron/backend/server.js` because:
- We only ran `npm run build` which rebuilds the **frontend** (Vite renderer)
- The Electron **executable** was never rebuilt
- The old executable is still running with the old broken code

## Root Cause
We fixed the code in:
- `electron/backend/server.js` line 103 (in `saveTeamPhotoToDisk()`)
- `electron/backend/server.js` line 226 (in `cleanupTeamPhotos()`)

But the executable `PopQuiz.exe` that's actually running still contains the old buggy code.

## Solution
Run the proper Electron build command that packages everything into the executable:

**Command needed**: `npm run build:exe`

This command:
1. Builds the renderer (frontend) with `npm run build:renderer`
2. Builds the player web app with `npm run build:player`
3. Packages everything into `PopQuiz.exe` using electron-builder

## Expected Outcome
After running `npm run build:exe`:
- The new `PopQuiz.exe` will contain the corrected backend code
- Photo directory path will correctly reference `../../resorces/pics/Team Pics`
- ENOTDIR errors should be resolved
- Photos will save successfully

## Files Modified
- `electron/backend/server.js` (already fixed)
  - Line 103: `resources` → `resorces`
  - Line 226: `resources` → `resorces`

## Next Steps
1. Run `npm run build:exe` to create the new executable
2. Replace/restart with the updated PopQuiz.exe
3. Test the photo save flow again
