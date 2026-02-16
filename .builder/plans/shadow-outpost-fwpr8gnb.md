# Team Photos Auto-Approval Bug Fix Plan

## Problem
Team photos are being auto-approved even when "Team Photos Auto Approval" setting is turned OFF.

Looking at the logs:
- Team "test" joins
- Team is auto-approved for gameplay (expected - no points scored yet)
- Photo is uploaded (`TEAM_PHOTO_UPDATE` received)
- Photo appears to be auto-approved regardless of the toggle setting

## Root Cause Analysis (Hypothesis)
The issue is likely in the backend `approveTeam()` function modification we made:
- When a new team joins before the quiz starts, `handleApproveTeam()` is called to approve them for gameplay
- Our change sets BOTH `approvedAt` AND `photoApprovedAt` unconditionally in this function
- This means photos get marked as approved during team-for-gameplay approval, regardless of the teamPhotosAutoApprove setting
- The pending photos filter checks `!p.photoApprovedAt`, so these photos never show as pending

## Solution Approach
We need to **separate team approval for gameplay from photo approval**:

1. **Revert photoApprovedAt assignment in approveTeam()** - Don't set photoApprovedAt when approving teams for gameplay
2. **Only set photoApprovedAt when photos are explicitly approved** via:
   - Manual host approval (handleApprovePhoto clicks approve button)
   - Auto-approval when setting is enabled (TEAM_PHOTO_UPDATED handler)
3. **Ensure auto-approval logic respects the setting** - Only auto-approve photos if teamPhotosAutoApprove is true

## Files to Modify

### Backend (electron/backend/server.js)
- **Line 1288-1289 in approveTeam()**: Remove the `finalPlayer.photoApprovedAt = Date.now();` line
  - This prevents team approval from auto-approving photos
  - Teams can be approved for gameplay without approving photos

### Frontend (src/components/BottomNavigation.tsx)
- **handleApprovePhoto()**: Should set photoApprovedAt when manually approving
  - Currently works via approveTeam IPC call, which now won't set photoApprovedAt
  - Need to ensure manual approvals still work
- **TEAM_PHOTO_UPDATED handler**: Auto-approve logic is correct but only works if backend sets photoApprovedAt
  - Already checks teamPhotosAutoApprove before calling handleApprovePhoto ✓
  - May need adjustment based on backend changes

## Expected Outcome
- ✅ Teams are auto-approved for gameplay when joining before quiz starts (score independent from photo approval)
- ✅ When teamPhotosAutoApprove is OFF: Photos show as pending until host manually approves/declines
- ✅ When teamPhotosAutoApprove is ON: Photos auto-approve immediately upon upload via TEAM_PHOTO_UPDATED handler
- ✅ Button indicator shows orange flash only when there are actual pending photos to approve

## Testing Checklist
1. Turn OFF auto-approval setting
2. New team joins (before quiz starts)
3. Team can play normally (gameplay works)
4. Team uploads photo
5. Photo shows as pending in Team Photos popup
6. Team Photos button flashes orange
7. Host must manually approve/decline photo

Then:
1. Turn ON auto-approval setting
2. New team uploads photo
3. Photo should NOT appear in pending list (auto-approved)
4. Team Photos button should NOT flash (no pending)
