# PLAN: Fix Team Photo Save - ENOTDIR Error

## Diagnosis ✅
**Error**: `ENOTDIR, not a directory` (error code: `ENOTDIR`)
**Location**: `saveTeamPhotoToDisk()` in `electron/backend/server.js`
**Root Cause**: **Spelling mismatch in folder name**
- Code path: `../../resources/pics/Team Pics` (two 's's in resources)
- Actual folder: `C:\Users\windows1\Documents\GitHub\d-quiz\resorces\pics\Team Pics` (one 's' in resorces)
- Folder status: ✅ Exists in project root

The code is trying to create/write to `resources` which doesn't exist, causing the ENOTDIR error.

## Solution
**Fix the spelling**: Change `resources` to `resorces` in the code

## Files to Modify
1. `electron/backend/server.js` - Line ~103 in `saveTeamPhotoToDisk()` function
   - Change: `const photosDir = path.join(__dirname, '../../resources/pics/Team Pics');`
   - To: `const photosDir = path.join(__dirname, '../../resorces/pics/Team Pics');`

## Expected Outcome
- Photo directory path matches actual folder structure
- `mkdir()` will work correctly and find the existing directory
- Photos will save successfully to the correct location
- No more ENOTDIR errors
