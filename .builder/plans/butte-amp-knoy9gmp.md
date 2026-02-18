# Fix: Approved Photos Still Showing in Team Photos Tab

## Problem Statement
When a user approves a team photo via the Team Photos popup, the photo still appears in the list marked as "Approved" even after manual refresh. It should disappear completely from the list since it's no longer pending.

## Key Diagnostic Finding
- Photo persists as "Approved" **even after manual refresh**
- This indicates the **backend is not properly saving `photoApprovedAt`** timestamp
- The `isPhotoApproval: true` flag is being sent, but something in the backend flow isn't working

## Root Cause (Two Independent Approval Systems)
1. **Team Photo Approval** (Team Photos popup) - currently broken
   - Should set `photoApprovedAt` and remove from pending
   - Currently only updating `photoStatuses` to "approved" without removing

2. **Team Approval** (Team list) - working correctly
   - These are completely separate and should NOT interact

## Investigation Needed

### Primary Issue: Backend `approveTeam` with `isPhotoApproval: true`
The flow that should happen:
1. Frontend calls: `api.network.approveTeam({ deviceId, teamName, isPhotoApproval: true })`
2. IPC receives payload and routes to backend with the flag
3. Backend's `approveTeam(deviceId, teamName, ..., isPhotoApproval=true)` should:
   - Move `teamPhotoPending` → `teamPhoto`
   - Set `photoApprovedAt = now()`
   - Persist to backend storage
4. Next `fetchPendingPhotos` fetches updated player
5. Filter: `(p.teamPhotoPending || (p.teamPhoto && !p.photoApprovedAt))` excludes it
6. Photo disappears from `pendingPhotos` array

**What's probably broken**: One of these steps isn't working
- Backend not receiving the flag correctly
- Backend not writing `photoApprovedAt` to disk/memory
- IPC route mapping might be wrong
- Filter logic might need adjustment

## Files to Investigate
1. **src/components/BottomNavigation.tsx** - `handleApprovePhoto` 
   - Verify correct API call is being made
   - Verify `schedulePhotoRefresh` is being triggered

2. **electron/backend/server.js** - `approveTeam` handler
   - Verify it checks `isPhotoApproval` parameter correctly
   - Verify it's setting `finalPlayer.photoApprovedAt` when flag is true
   - Verify persistence (saving to disk/DB) is happening

3. **electron/main/main.js** - IPC route mapping
   - Verify `network/approve-team` route correctly extracts and passes `isPhotoApproval` flag

4. **src/components/BottomNavigation.tsx** - `fetchPendingPhotos` filter
   - Verify the filter condition is correct
   - Verify response from backend includes the `photoApprovedAt` field

## Implementation Steps
1. **Trace the approval flow** - add logging at each step to see where the `photoApprovedAt` gets lost
2. **Verify backend is saving** - check that `photoApprovedAt` is actually being set and persisted
3. **Verify filter logic** - ensure approved photos are being filtered out correctly
4. **Fix any broken links** in the approval chain
5. **Normalize status key usage** as secondary improvement

## Expected End State
- User approves photo → Backend sets `photoApprovedAt`
- Manual refresh fetches updated player data with `photoApprovedAt` set
- Filter excludes the photo from `pendingPhotos`
- Photo disappears from Team Photos tab completely
- Team can still be approved/denied independently (no interaction)
