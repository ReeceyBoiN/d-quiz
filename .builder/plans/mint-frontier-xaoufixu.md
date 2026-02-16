# Team Photos Approval Workflow Fix Plan

## Problem Summary
Currently, team photos submitted after an approved photo are being auto-approved when they shouldn't be (unless the auto-approve setting is enabled). The root cause is a mismatch between where photos are stored (server-side `teamPhotoPending`) and what's exposed to the UI, plus a missing synchronization between the host UI auto-approve toggle and the backend logic.

## Root Causes Identified

1. **Missing IPC Field**: The backend stores new photos in `teamPhotoPending` but `getAllNetworkPlayers` (IPC endpoint) doesn't return this field, so the host UI can't detect pending photos.

2. **Unsynchronized Backend Variable**: The backend code references `autoApproveTeamPhotos` variable but it's never initialized or synced with the host UI setting (`teamPhotosAutoApprove` in SettingsContext). This means the backend doesn't know the current auto-approve preference.

3. **Duplicate Auto-Approval Logic**: Auto-approval happens in two places (backend TEAM_PHOTO_UPDATE handler and client-side BottomNavigation listener), causing inconsistent behavior and missed approvals.

4. **Photo Deletion Logic**: The backend already deletes old `teamPhoto` and `teamPhotoPending` when a new photo is submitted, but this needs to work consistently regardless of approval status.

## Implementation Strategy

### Phase 1: Expose Pending Photos to Host UI
**File**: `electron/backend/server.js` - `getAllNetworkPlayers` function

**Change**: Include `teamPhotoPending` in the returned player object so the host UI can detect pending photos.

**Details**:
- Add `teamPhotoPending: player.teamPhotoPending || null` to the returned player object
- This allows BottomNavigation.fetchPendingPhotos to properly filter players with pending photos

### Phase 2: Sync Auto-Approve Setting Between UI and Backend
**Files**: 
- `electron/backend/server.js` - Initialize and expose setter for `autoApproveTeamPhotos`
- `electron/main/main.js` - Add new IPC route to set auto-approve preference
- `src/utils/SettingsContext.tsx` - Wire the updateTeamPhotosAutoApprove to call the new IPC

**Changes**:
1. In `server.js`: Declare `let autoApproveTeamPhotos = false;` at module level and create a function to set it
2. In `main.js`: Add IPC route `'network/set-team-photos-auto-approve'` that calls the setter in backend
3. In `SettingsContext.tsx`: Modify `updateTeamPhotosAutoApprove` to call the IPC route whenever the setting is toggled

**Impact**: The backend will now know the current auto-approve preference and can act accordingly during TEAM_PHOTO_UPDATE

### Phase 3: Verify Photo Deletion on New Submission
**File**: `electron/backend/server.js` - `TEAM_PHOTO_UPDATE` handler

**Verify**: The existing code already deletes `teamPhoto` and `teamPhotoPending` files when a new photo arrives (via `deletePhotoFile`). This logic should:
- Delete the old approved photo file (if exists)
- Delete the old pending photo file (if exists)
- This happens regardless of approval status, freeing the slot for the new submission

**No changes needed** - this is already implemented correctly with the "CRITICAL FIX" comments in place.

### Phase 4: Ensure Hash Comparison Works for Identical Photos
**File**: `electron/backend/server.js` - `TEAM_PHOTO_UPDATE` handler

**Verify**: The logic compares `newPhotoHash` with `photoApprovedHash`:
- If identical and already approved: preserve `photoApprovedAt` timestamp (existing logic)
- If identical but never approved, or different: reset `photoApprovedAt = null` (requires re-approval)

**Changes needed**:
- Current code preserves approval if hashes match. Per requirements, identical photos should STILL require approval unless auto-approve is enabled
- Modify the logic: Only preserve approval if the hash matches AND we're within a certain context. Otherwise, always require re-approval unless auto-approve setting is true
- Simpler approach: Always reset `photoApprovedAt` and `photoApprovedHash` to `null` when a new photo is submitted, regardless of hash match. Let the auto-approval flow (backend or client) handle approval based on the auto-approve setting.

### Phase 5: Centralize Auto-Approval Trigger
**Files**:
- `electron/backend/server.js` - `TEAM_PHOTO_UPDATE` handler
- `src/components/BottomNavigation.tsx` - Verify client-side auto-approve still works

**Strategy**: Keep the architecture as is (client-driven auto-approval for UI responsiveness) but ensure:
- Backend correctly stores pending photos in `teamPhotoPending`
- Backend does NOT auto-set `teamPhoto` when a new photo arrives (leave that for the approval step)
- Host UI's auto-approve listener (BottomNavigation) can now properly detect pending photos via the returned `teamPhotoPending` field
- When auto-approve is enabled, the UI calls `approveTeam` with `isPhotoApproval: true`

**Changes**:
- In TEAM_PHOTO_UPDATE handler: Remove or disable the `if (autoApproveTeamPhotos === true)` branch that sets `teamPhoto` immediately. Instead, always store to `teamPhotoPending` first, and let the approval flow decide when to move it to `teamPhoto`
- Alternatively, keep both branches but ensure `autoApproveTeamPhotos` is properly synced from the UI

## Critical Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `electron/backend/server.js` | 1) Include `teamPhotoPending` in `getAllNetworkPlayers` return; 2) Initialize `autoApproveTeamPhotos = false`; 3) Modify TEAM_PHOTO_UPDATE to always reset approval status for new submissions; 4) Create setter function for auto-approve setting | HIGH |
| `electron/main/main.js` | Add IPC route `'network/set-team-photos-auto-approve'` | HIGH |
| `src/utils/SettingsContext.tsx` | Wire `updateTeamPhotosAutoApprove` to call new IPC route | HIGH |
| `src/components/BottomNavigation.tsx` | Verify auto-approve listener works with new `teamPhotoPending` field (likely no changes needed) | MEDIUM |
| `src-player/src/components/SettingsBar.tsx` | No changes needed; player submission already works correctly | LOW |

## Testing Checklist

After implementation:
1. Host toggles "Auto Approve Team Photos" setting on/off - backend should reflect the change
2. Team submits a photo - should appear as pending in the Team Photos tab
3. With auto-approve disabled - pending photo should wait for manual approval
4. With auto-approve enabled - pending photo should auto-approve within a moment
5. Team submits identical photo (same hash) - should still require approval unless auto-approve is on
6. Host manually approves a photo - old photo file should be deleted from disk
7. Team submits new photo after approved one - old photo should be deleted, new photo appears as pending
8. Team submits photo, then immediately submits different photo before first is approved - first photo deleted, second appears as pending

## Implementation Order

1. Start with Phase 1 (expose `teamPhotoPending`) - simplest change, unblocks UI
2. Then Phase 4 (fix hash comparison to always require approval) 
3. Then Phase 2 (sync auto-approve setting)
4. Then Phase 5 (verify/adjust auto-approval trigger logic)
5. Verify Phase 3 (deletion logic already works)
