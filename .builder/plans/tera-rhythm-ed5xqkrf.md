# Plan: Auto-Refresh Pending Photos After Approve/Deny

## Problem Identified
When user clicks "Approve" or "Deny" on a team photo:
- Photo status changes to "Approved" or "Declined" immediately
- But photo remains visible in the list until manual refresh is clicked
- Requires user to manually click Refresh button to see the change

## Root Cause (Critical Finding)

**Timing Mismatch Between Schedule and Throttle:**
1. `handleApprovePhoto()` calls `schedulePhotoRefresh(300)` with 300ms delay
2. `fetchPendingPhotos()` has a 400ms throttle window
3. If a fetch occurred recently, the scheduled refresh at 300ms gets **THROTTLED and skipped**
4. Result: UI never updates because scheduled fetch is blocked

**Secondary Issues:**
1. Stale closure: `schedulePhotoRefresh` uses `React.useCallback(..., [])` with empty dependencies, so it may call a stale version of `fetchPendingPhotos`
2. Status cleanup deletes 'approved' statuses for devices not in pending list, losing the preserved state
3. No optimistic UI update - photo stays visible until backend confirms

## Solution: Three-Part Fix

### Part 1: Fix Throttle-vs-Schedule Timing Mismatch
**Change schedulePhotoRefresh delay from 300ms to 500ms** when called from approve/decline handlers
- This ensures the fetch happens AFTER the 400ms throttle window expires
- Makes the refresh request go through instead of being blocked

### Part 2: Fix Stale Closure Risk
**Wrap `fetchPendingPhotos` in `useCallback` and include in `schedulePhotoRefresh` dependencies**
- Currently `schedulePhotoRefresh` has empty deps `[]` which means it captures initial fetchPendingPhotos
- Across re-renders, this can reference a stale function
- Solution: make both functions properly dependent and use current references

### Part 3: Preserve 'approved'/'declined' Status Across Refreshes
**Update status cleanup logic in fetchPendingPhotos**
- Currently deletes all statuses for devices not in pending list
- Should ONLY delete 'pending' statuses for devices not in pending list
- This preserves 'approved'/'declined' flags so UI stays accurate if photo briefly reappears

## Implementation Details

### File: src/components/BottomNavigation.tsx

#### Change 1: Convert fetchPendingPhotos to useCallback
- Wrap the entire fetchPendingPhotos function with useCallback
- Dependencies: `[]` (only uses refs and external imports)

#### Change 2: Update schedulePhotoRefresh dependencies
- Add `fetchPendingPhotos` to the dependency array
- This ensures scheduled refresh always calls the current function

#### Change 3: Increase delay to 500ms in handlers
- In `handleApprovePhoto`: change `schedulePhotoRefresh(300)` → `schedulePhotoRefresh(500)`
- In `handleDeclinePhoto`: change `schedulePhotoRefresh(300)` → `schedulePhotoRefresh(500)`
- Line numbers: approximately ~806 and ~839

#### Change 4: Smart status cleanup in setPhotoStatuses
- Inside fetchPendingPhotos where it cleans up photoStatuses
- Change the cleanup condition from:
  ```
  if (!pendingDeviceIds.has(id)) {
    delete newStatuses[id];
  }
  ```
  To:
  ```
  if (!pendingDeviceIds.has(id) && newStatuses[id] === 'pending') {
    delete newStatuses[id];
  }
  ```
- This preserves 'approved'/'declined' statuses

## Expected Outcome
After these changes:
1. User clicks "Approve" on a photo
2. Photo status changes to "Approved" immediately (existing behavior)
3. After 500ms, `fetchPendingPhotos` runs and completes
4. Photo disappears from the list automatically (new behavior)
5. No manual refresh needed

## Priority & Complexity
- **Priority**: High (affects core user workflow)
- **Complexity**: Low (4 small targeted changes)
- **Risk**: Low (changes are isolated to photo refresh logic)
- **Testing**: Can test by approving/declining photos and watching for automatic removal

## Files to Modify
- `src/components/BottomNavigation.tsx` (only file needing changes)

## Key Insight
The issue wasn't that the refresh wasn't being scheduled - it was that the scheduled refresh was being **silently blocked by the throttle mechanism**. The 500ms delay ensures the throttle window has expired before the refresh attempt.
