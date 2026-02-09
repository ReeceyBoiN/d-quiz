# Plan: Fix ENOTDIR Error - Use Writable Path for Team Photos

## Root Cause Analysis

The ENOTDIR error persists because of a fundamental architectural issue, not a path calculation problem:

### The Problem
1. **asar Archive is Read-Only**: The packaged executable uses electron-builder with `asar: true`, which creates a read-only `app.asar` archive. The backend server code runs inside this archive.
2. **__dirname Resolves to asar**: When `__dirname = path.dirname(fileURLToPath(import.meta.url))` runs in server.js inside the packaged app, it resolves to something like `C:\...\resources\app.asar\electron\backend`
3. **Relative Path Points Inside asar**: `path.join(__dirname, '../../resorces/pics/Team Pics')` resolves to a path inside the read-only asar archive, which cannot be written to
4. **Missing Directory**: Even if the path calculation worked, the `resorces/pics` folder doesn't exist in the repository, so it won't be packaged or available at runtime
5. **Existing Pattern Ignored**: The app already has `electron/backend/pathInitializer.js` that creates a proper writable folder structure in `Documents/PopQuiz/Resources/...` - but the photo save logic doesn't use it

### Why Previous Fix Failed
The enhanced logging and absolute path fallback I added still tried to create directories relative to the executable or __dirname, which all resolve inside or near the asar archive. This doesn't solve the fundamental problem: we need to write to a **writable user directory**, not app resources.

## Solution Approach

### Use Existing pathInitializer Pattern
The app already has a proven pattern for storing user-writable runtime files:
- `pathInitializer.js` creates: `Documents/PopQuiz/Resources/...` (writable location)
- This is used for sounds and other runtime resources
- **We should follow the same pattern for team photos**

### Implementation Strategy
1. **Import pathInitializer** in server.js to access the writable resources path
2. **Replace relative path logic** with a call to get the writable resources directory
3. **Create a 'Phone Slideshow' or 'Team Pictures' subdirectory** within the existing Resources structure (or use the existing 'Phone Slideshow' folder if that's appropriate)
4. **Update saveTeamPhotoToDisk()** to use this writable path instead of relative paths
5. **Remove the asar-based fallback logic** since we'll be using the proper user-writable location

### Key Files to Modify
- `electron/backend/server.js` - Update saveTeamPhotoToDisk() to use pathInitializer
- Possibly `electron/backend/pathInitializer.js` - Add 'Team Pics' folder creation if needed

### Expected Result
- Photos will be saved to: `C:\Users\<username>\Documents\PopQuiz\Resources\Phone Slideshow\` (or dedicated Team Pics folder)
- This location is created by pathInitializer on app startup, so it's guaranteed to exist
- Path is writable (user's Documents folder, not app.asar)
- ENOTDIR error will be resolved because the directory will exist and be writable

## Critical Insight
This isn't a path calculation problem - it's an architectural decision about where to store user-generated content. The existing app already knows how to do this correctly with pathInitializer. We just need to apply that same pattern to the photo storage logic.

## User Decisions
1. **Storage Location**: Create a new `Team Pictures` folder within `Documents/PopQuiz/Resources/`
2. **Photo Cleanup**: Delete photos only when the "Empty Lobby" function is triggered
3. **Full Path**: `C:\Users\<username>\Documents\PopQuiz\Resources\Team Pictures\`

## Implementation Steps

### Step 1: Update pathInitializer.js
- Add 'Team Pictures' folder to the `FOLDERS_TO_CREATE` array so it's created on app startup
- Optionally add a helper function `getTeamPicturesPath()` to centralize the path logic

### Step 2: Update server.js saveTeamPhotoToDisk()
- Import pathInitializer to get the writable resources path
- Replace all relative path logic with a call to get the Team Pictures directory
- Remove asar-based fallback attempts (no longer needed)
- Keep detailed logging but update it to show the writable path being used
- Simplify the function since we now know the directory will exist

### Step 3: Integrate Photo Cleanup
- Find where "Empty Lobby" function is triggered (likely in main.js or a handler)
- Call the existing `cleanupTeamPhotos()` function at that point
- Update cleanupTeamPhotos() to use the correct writable path from pathInitializer

### Step 4: Rebuild and Test
- Run `npm run build:exe` to create new executable with fixes
- Test photo upload to verify photos save to `Documents/PopQuiz/Resources/Team Pictures/`
- Test that photos persist between quiz rounds until "Empty Lobby" is triggered
- Verify photos are deleted when lobby is emptied

## Why This Solution Works
- ✅ Uses writable user directory (not read-only asar)
- ✅ Follows existing app pattern (pathInitializer)
- ✅ Directory guaranteed to exist at startup
- ✅ Proper cleanup integration with Empty Lobby function
- ✅ No more ENOTDIR errors
