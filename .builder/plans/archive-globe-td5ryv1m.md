# Fix Team Photo Auto-Approval Setting

## Problem Summary
Auto-approval setting is enabled in the UI but photos are still showing as "Pending" waiting for manual approval. User focus: **retroactively approve photos that were submitted before auto-approval was enabled**.

## Root Cause Analysis

The issue is a **setting sync timing problem**:

1. **SettingsContext retroactive approval races the backend sync**
   - Frontend enables auto-approve and calls `network/set-team-photos-auto-approve` IPC
   - Code doesn't wait for backend confirmation before attempting retroactive approvals
   - SettingsContext tries to approve pending photos while backend is still processing the setting change

2. **The retroactive approval flow in SettingsContext needs fixing**
   - When user enables auto-approve, the code should:
     1. Call IPC to sync setting to backend
     2. **WAIT** for backend to acknowledge
     3. **THEN** fetch pending photos and approve them
   - Currently these steps are not properly sequenced

## Solution: Fix SettingsContext Retroactive Approval

### Primary Fix: `src/utils/SettingsContext.tsx`

When enabling auto-approve:
1. Make the `network/set-team-photos-auto-approve` IPC call properly awaited
2. Wait for the backend to confirm the setting change
3. Only after backend acknowledges, fetch pending photos with `network/all-players`
4. Approve each pending photo via `api.network.approveTeam()`
5. Broadcast `PHOTO_APPROVAL_UPDATED` for approved photos

**Key change**: The `updateTeamPhotosAutoApprove` function needs to properly await each async step in sequence rather than fire-and-forget.

### Secondary Verification: `electron/backend/server.js`

Ensure that:
1. `setAutoApproveTeamPhotos(enabled)` actually updates the `autoApproveTeamPhotos` variable
2. The IPC handler returns successfully to indicate backend received the change
3. The backend can find and approve pending photos

## Files to Modify

1. **src/utils/SettingsContext.tsx** (PRIMARY)
   - Fix `updateTeamPhotosAutoApprove` function
   - Make IPC calls properly awaited in sequence
   - Add error handling for failed approvals
   - Ensure retroactive approvals only happen after backend sync confirms

2. **electron/backend/server.js** (VERIFICATION)
   - Verify `setAutoApproveTeamPhotos` is being called and executed
   - Ensure IPC response indicates success/failure

## Expected Outcome

- User enables auto-approve setting
- Frontend waits for backend to confirm setting change
- Frontend fetches all pending photos
- Frontend approves each pending photo via IPC
- Pending photos transition to approved status immediately in UI
- User sees "Pending" photos become approved without manual intervention

## Implementation Steps

1. Update `updateTeamPhotosAutoApprove` in SettingsContext to properly await IPC call
2. After IPC returns, check for errors
3. If successful, fetch pending photos
4. Loop through pending photos and call approveTeam for each
5. After all approvals, broadcast PHOTO_APPROVAL_UPDATED events
6. Test: Enable auto-approve with pending photos present → photos should be auto-approved
