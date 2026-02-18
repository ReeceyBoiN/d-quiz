# Plan: Fix Auto-Approved Photos Not Displaying in UI

## Problem Statement
When team photos are auto-approved (whether during initial team join or when a team submits a new photo), they are not properly:
1. Assigned to the team in the quizzes state (photo doesn't show on host display)
2. Removed from the Team Photos approval modal (photo still shows as "Pending" to manually approve)

## Root Causes Identified

### Issue 1: Missing Broadcast After Auto-Approval via TEAM_PHOTO_UPDATED
When `handleNetworkTeamPhotoUpdated()` in QuizHost auto-approves a photo via `handleApproveTeam()`, the function doesn't broadcast `PHOTO_APPROVAL_UPDATED` event to the rest of the app. This means:
- The photo URL doesn't get assigned to the team in quizzes state
- BottomNavigation doesn't know the photo was approved
- Photo remains in "Pending" state in UI

**Current flow (broken)**:
```
TEAM_PHOTO_UPDATED event → validateAndApprove() → handleApproveTeam() (IPC call only)
→ No broadcast → QuizHost state updated but no event to other components
```

**Expected flow**:
```
TEAM_PHOTO_UPDATED event → validateAndApprove() → handleApproveTeam() 
→ IPC call + broadcast PHOTO_APPROVAL_UPDATED → All components updated
```

### Issue 2: Auto-Approval Logic Doesn't Track Photo Timestamps
The validation in `handleNetworkTeamPhotoUpdated()` checks `player.photoApprovedAt` to decide if a photo is already approved. However:
- When a TEAM_PHOTO_UPDATED event arrives with a NEW photo submission, the backend's `photoApprovedAt` might still contain the timestamp from a PREVIOUS photo approval
- This causes the logic to skip auto-approval with message: "Skipping auto-approve: photo already approved at [old-timestamp]"
- Need to track the actual photo content/hash to detect new submissions vs old approvals

### Issue 3: Backend State Inconsistency with teamPhotoPending Field
Backend observations show `teamPhotoPending` field sometimes contains the photo URL as a string instead of a proper boolean, causing type-checking issues in validation logic.

## Solution Approach

### Change 1: Modify `handleNetworkTeamPhotoUpdated()` to Broadcast Approval Event
After `handleApproveTeam()` successfully approves via the auto-approve path, broadcast `PHOTO_APPROVAL_UPDATED` event so that:
- QuizHost's own listener updates the team photo in quizzes state
- BottomNavigation knows the photo was approved and can hide it
- Player devices receive the approval confirmation

**Implementation**:
- In the auto-approve path of `handleNetworkTeamPhotoUpdated()` (after `handleApproveTeam()` is called)
- Fetch the approved photo URL (either from IPC result or from backend)
- Broadcast `PHOTO_APPROVAL_UPDATED` with `{ type: 'PHOTO_APPROVAL_UPDATED', data: { deviceId, teamName, photoUrl, timestamp } }`
- Add console logs to track when this broadcast occurs

### Change 2: Improve Photo State Tracking in TEAM_PHOTO_UPDATED Handler
To detect when a NEW photo is submitted (vs old approved photos):
- Store a reference to the current photo content/path for each team
- When TEAM_PHOTO_UPDATED arrives, compare the new photo path with the stored one
- If different, mark as truly "pending" regardless of `photoApprovedAt` age
- If same, respect the `photoApprovedAt` check

**Alternative simpler approach**:
- When TEAM_PHOTO_UPDATED arrives with a photoPath, always treat it as needing potential approval
- Check both: `teamPhotoPending === true` AND `(photoPath !== lastStoredPhotoPath || !photoApprovedAt)`
- This ensures new submissions trigger auto-approval even if `photoApprovedAt` is old

### Change 3: Update BottomNavigation to Handle Auto-Approved Photos from TEAM_PHOTO_UPDATED
When BottomNavigation receives `PHOTO_APPROVAL_UPDATED` from the auto-approval flow:
- Immediately update local `photoStatusesRef` to mark as 'approved'
- Schedule a refresh to fetch the latest backend state
- Ensure the photo disappears from pending list

**Note**: BottomNavigation already has this logic for manual approvals via the PHOTO_APPROVAL_UPDATED listener. Ensure it triggers for auto-approvals too.

## Files to Modify

1. **src/components/QuizHost.tsx** - `handleNetworkTeamPhotoUpdated()` function
   - Add logic to broadcast PHOTO_APPROVAL_UPDATED after auto-approval is triggered
   - Optionally add photo path tracking to detect new submissions vs old approvals
   
2. **src/components/BottomNavigation.tsx** (possibly, depending on testing)
   - Verify the PHOTO_APPROVAL_UPDATED listener properly handles auto-approved photos
   - May need to enhance how pending photos are detected/filtered after auto-approval

## Testing Strategy

1. **Scenario A**: New team joins with auto-approval already ON
   - Team joins → Photo appears in pending → Auto-approval executes → Photo disappears from pending, appears on host display
   
2. **Scenario B**: Team with existing photo submits a new photo (auto-approval ON)
   - New photo submitted → Photo appears in pending → Auto-approval executes → Photo disappears from pending, appears on host display
   
3. **Scenario C**: Manual approval still works
   - Auto-approval OFF → Photo in pending → User clicks Approve → Photo disappears and displays correctly

## Expected Outcome
After these changes:
- ✅ Auto-approved photos immediately appear on host display (team photo visible)
- ✅ Auto-approved photos don't appear in Team Photos approval modal
- ✅ Both initial team join and new photo submission scenarios work correctly
- ✅ Manual approval continues to work without regression
- ✅ Console logs clearly show when photos are auto-approved and broadcast
