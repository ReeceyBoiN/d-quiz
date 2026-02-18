# Plan: Fix Double-Click Approval Issue

## Problem
User has to click "Approve" twice on team photos. After first approval:
1. Photo gets status 'approved' in UI
2. 500ms refresh happens
3. Photo still in backend's pending list (sync delay or photoApprovedAt is null temporarily)
4. Status gets reset from 'approved' back to 'pending' by aggressive reset logic
5. Approve button reappears on UI
6. User has to click approve again

## Root Cause
In `fetchPendingPhotos()`, when resetting status for existing photos:
```javascript
} else if (newStatuses[deviceId] !== 'pending') {
  // If photo was previously approved/declined but is now back in pending, it's a NEW photo
  newStatuses[deviceId] = 'pending';
}
```

This logic assumes "if it was approved but is now in pending list again, it must be a new photo" - but that's wrong. It could be:
- Same photo with backend sync delay
- Same photo where `photoApprovedAt` is temporarily null due to API response timing

## Solution

### Fix 1: Don't reset 'approved' status back to 'pending'
- Change the status reset logic to preserve 'approved'/'declined' statuses
- Only initialize 'pending' for NEW deviceIds
- Status should flow: undefined → 'pending' → 'approved'/'declined' (never backwards)

### Fix 2: Clear status when new photo actually arrives
- In `handleNetworkTeamPhotoUpdated()` event, when a new photo is uploaded for a team, reset their status
- This clears any previous approval and lets new photo show as pending
- Detection: we can clear status whenever TEAM_PHOTO_UPDATED fires (indicates new photo uploaded)

### Fix 3: Filter respects user actions
- Add back the check in filter to exclude photos marked as 'approved' or 'declined'
- Even if backend hasn't synced yet, don't show in pending list if user already approved it
- Backend filter: `(p.teamPhotoPending || (p.teamPhoto && !p.photoApprovedAt))`
- UI filter: `&& status !== 'approved' && status !== 'declined'`

## Files to Modify
- `src/components/BottomNavigation.tsx`
  - Update status reset logic in `fetchPendingPhotos()` (remove the aggressive reset)
  - Update filter in `fetchPendingPhotos()` to exclude approved/declined by status
  - Update `handleNetworkTeamPhotoUpdated()` to reset status for new photos

## Expected Behavior After Fix
1. User clicks Approve on photo
2. Status changes to 'approved' in UI immediately
3. Photo disappears from pending list (because of status check)
4. 500ms refresh happens (whether backend synced or not, status is still 'approved')
5. Photo stays hidden
6. If new photo arrives from same team, TEAM_PHOTO_UPDATED event clears status
7. New photo shows as pending

This way only one click is needed to approve, and the UI state is respected even during backend sync delays.
