# Fix Team Photo Auto-Approval for New Submitted Photos

## Problem
When auto-approval for team photos is enabled, new photos submitted by teams are not being auto-approved. Instead, they appear as "Pending" and require manual approval even though auto-approval is active.

**Scenario:**
1. Team submits photo → manual approval works fine
2. User enables auto-approve → existing pending photos get auto-approved correctly
3. Team submits a NEW photo while auto-approve is still enabled → new photo shows as pending (should be auto-approved)

## Root Cause Analysis
Based on code exploration, the auto-approval flow should work as follows:

1. **Backend receives new photo** via `TEAM_PHOTO_UPDATE` handler in `electron/backend/server.js`
2. **Backend checks `autoApproveTeamPhotos` flag** (lines ~1000-1050)
   - If `true` → should set `photoApprovedAt` and `teamPhoto` immediately
   - If `false` → leaves photo as `teamPhotoPending` (not approved)
3. **Backend broadcasts `TEAM_PHOTO_UPDATED`** with `photoApprovedAt` field
4. **Frontend receives `TEAM_PHOTO_UPDATED`**:
   - If `photoApprovedAt` exists → QuizHost broadcasts `PHOTO_APPROVAL_UPDATED` (auto-shows photo)
   - If no `photoApprovedAt` → waits for manual approval

**Likely Issues:**
1. **Backend flag not being set correctly** - The `autoApproveTeamPhotos` global variable may not be properly initialized or updated
2. **Photo approval logic skipped** - The backend's `TEAM_PHOTO_UPDATE` handler may not be properly checking/executing the auto-approval condition
3. **Pending photo refresh timing** - Frontend may refresh the pending photos list before the backend has auto-approved, causing the photo to show as pending
4. **Missing payload field** - The `photoApprovedAt` may not be included in the `TEAM_PHOTO_UPDATED` broadcast to the frontend

## Solution Approach

### Step 1: Verify Backend State
- Check that the `autoApproveTeamPhotos` global variable is being set correctly when SettingsContext calls the IPC route
- Verify the backend retains this state across photo submissions

### Step 2: Verify TEAM_PHOTO_UPDATE Handler Logic
- Ensure the handler in `electron/backend/server.js` (lines ~1000-1050) is:
  - Checking the `autoApproveTeamPhotos` flag
  - Setting `photoApprovedAt = Date.now()` when flag is true
  - Including `photoApprovedAt` in the broadcast payload

### Step 3: Add Debug Logging
- Add detailed logging in the backend `TEAM_PHOTO_UPDATE` handler to log:
  - Current value of `autoApproveTeamPhotos` when photo arrives
  - Whether approval was set or not
  - What fields were included in the broadcast payload

### Step 4: Test the Flow
- Verify that when a photo is submitted while auto-approve is already enabled:
  - Backend logs show `autoApproveTeamPhotos === true`
  - `photoApprovedAt` is set and included in broadcast
  - Frontend receives `TEAM_PHOTO_UPDATED` with `photoApprovedAt`
  - QuizHost broadcasts `PHOTO_APPROVAL_UPDATED`
  - Photo disappears from "Pending" approval UI

## Key Files to Examine/Modify
- **electron/backend/server.js** — `TEAM_PHOTO_UPDATE` handler (lines ~1000-1050)
  - Verify auto-approval logic is executed
  - Ensure `photoApprovedAt` is set and broadcast
  - Add debug logging
  
- **electron/backend/server.js** — `setAutoApproveTeamPhotos` function
  - Verify it's being called and the flag is persisting

- **electron/main/main.js** — IPC handler for `network/set-team-photos-auto-approve`
  - Verify the IPC is properly calling backend.setAutoApproveTeamPhotos

## Implementation Plan
1. Add console logging to backend `TEAM_PHOTO_UPDATE` handler to capture the actual state and logic flow
2. Review the logged output when a new photo is submitted while auto-approve is enabled
3. If the flag is false when it should be true → investigate setAutoApproveTeamPhotos
4. If the flag is true but photoApprovedAt isn't being set → fix the approval logic
5. If photoApprovedAt is being set but not broadcast → ensure payload includes it
6. Test the complete flow again with the fixes applied
