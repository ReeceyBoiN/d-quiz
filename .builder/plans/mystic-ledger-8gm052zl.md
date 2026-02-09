# PLAN: Fix Team Photo Save Issue

## User Decisions
✅ Approach: Modify server to include detailed error messages in DEBUG_ERROR broadcast
✅ Testing: Go straight to rebuild exe (skip dev mode testing)

## Implementation Steps

### Step 1: Enhance Error Broadcasting in server.js
**File**: `electron/backend/server.js`
**Location**: In TEAM_PHOTO_UPDATE handler, around line 580 where error is caught

**Current**: Sends generic "Photo save failed - check Electron logs for detailed error"
**Change**: Include actual error code and message from the exception

In the `saveTeamPhotoToDisk()` function error catches, capture and forward:
- `err.message` - Human readable error description
- `err.code` - Error code (EACCES, ENOSPC, EISDIR, etc)

The catch block that returns `null` should also trigger the error broadcast with these details.

**Expected Result**:
Browser console will show specific errors like:
- `EACCES: Permission denied` 
- `ENOSPC: No space left on device`
- `Invalid base64 string`
- Etc.

### Step 2: Rebuild Exe
After code changes, rebuild the executable with:
```
npm run build  // or equivalent build command
```

### Step 3: Test Photo Flow
In the rebuilt exe:
1. Host app launches
2. Player app connects via QR code
3. Player takes team photo
4. Check browser console for error details
5. Error message will indicate the exact problem

### Step 4: Fix Root Cause
Once we know the specific error:
- Permissions issue → Fix directory permissions
- Disk space → Clean up old photos
- Base64 issue → Validate encoding on client
- Path issue → Verify resources folder structure
- Etc.

## Files to Modify
1. **electron/backend/server.js** - Enhance error details in TEAM_PHOTO_UPDATE error handler

## Expected Outcome
After rebuild and test:
- Console shows specific error like "EACCES: Permission denied" or "ENOSPC: No space left on device"
- We identify the root cause immediately
- Subsequent fix will target that specific issue
- Team photos will save and display properly

## Success Criteria
✅ Exe rebuilt with enhanced error messages
✅ Error message in console shows actual error code + message
✅ Root cause is identified
✅ Fix can be implemented based on identified cause
