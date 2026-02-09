# PLAN: Fix ENOTDIR Error - Team Photos Directory Not Found

## Problem Summary
When team photos are submitted via the player device, the `TEAM_PHOTO_UPDATE` handler in `electron/backend/server.js` fails with an `ENOTDIR` error when trying to create or write to the `resorces/pics/Team Pics` directory. The error suggests that one of the path components is being treated as a file instead of a directory, or the path calculation is incorrect.

### Current Situation
- PopQuiz.exe runs from: `C:\Users\windows1\Documents\GitHub\d-quiz\`
- Parent directories exist: `C:\Users\windows1\Documents\GitHub\d-quiz\resorces\pics\`
- The code should create: `C:\Users\windows1\Documents\GitHub\d-quiz\resorces\pics\Team Pics\`
- Current path calculation: `path.join(__dirname, '../../resorces/pics/Team Pics')`
- Error occurs at: `fsp.mkdir(photosDir, { recursive: true })` or `fsp.writeFile(filePath, buffer)`

## Root Cause Analysis
The ENOTDIR error could be caused by:
1. **Path Calculation Issue**: `__dirname` in `electron/backend/server.js` resolves incorrectly when running from the packaged executable
2. **Directory vs File Conflict**: `resorces/pics` might exist as a file instead of a directory
3. **Path Separator Issue**: Windows path handling with mixed separators or encoding issues
4. **Recursive Directory Creation Failure**: The `recursive: true` flag may not be working as expected for the specific path

## Solution Approach

### Step 1: Verify and Log the Actual Path
Add comprehensive logging to show:
- The actual `__dirname` value at runtime
- The resolved full path after `path.join()`
- Whether parent directories exist (using `fs.existsSync()`)
- Whether `resorces/pics` is a directory or file

### Step 2: Use Absolute Path as Fallback
If relative path calculation fails, use an absolute path based on:
- `app.getPath('exe')` to get the executable location
- Resolve upward from there to the project root
- Build the path to `resorces/pics/Team Pics`

### Step 3: Add Pre-checks Before Directory Creation
Before attempting to create the directory:
- Check if each parent directory exists individually
- If a parent path exists but is a file, log an error with specific guidance
- Attempt to create missing directories one level at a time if recursive fails

### Step 4: Update the saveTeamPhotoToDisk Function
Modify `electron/backend/server.js` (lines 74-190) to:
- Add detailed logging at each step
- Use a more robust path resolution strategy
- Include fallback logic for absolute path construction
- Better error messages that indicate exactly which path failed

### Step 5: Rebuild and Test
- Run `npm run build:exe` to create updated executable
- Test photo upload from player device
- Monitor console logs to identify exact failure point
- Verify photos are saved to the correct directory

## Implementation Details

### Key Files to Modify
- `electron/backend/server.js` - Enhanced `saveTeamPhotoToDisk()` function (lines 74-190)

### Changes Required
1. Import `app` from electron to get executable/app paths
2. Add path resolution logging
3. Implement absolute path fallback
4. Add pre-directory-existence checks
5. Improve error messages with exact path information

### Expected Outcome
After implementation:
- Photos will be saved to: `C:\Users\windows1\Documents\GitHub\d-quiz\resorces\pics\Team Pics\`
- Detailed logging will show exactly which path was used
- Error messages will clearly indicate what went wrong and why
- The directory structure will be created automatically if missing

## Testing Plan
1. Verify parent directories exist on the system
2. Delete `Team Pics` directory if it exists (to test creation)
3. Start the application (rebuild first)
4. Upload a team photo from player device
5. Check:
   - Console logs for path information
   - Whether `Team Pics` directory is created
   - Whether photo file is saved inside
   - Whether success message is received on host app

## Critical Considerations
- This is a Windows-specific path issue, so test on Windows
- The app runs in Electron, which may affect how `__dirname` is resolved
- The packaged executable may have a different working directory than dev mode
- Ensure the `resorces/pics` parent directory is actually a directory, not a file
