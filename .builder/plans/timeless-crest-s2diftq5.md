# Plan: Auto-Approve Team Photos - Silent Approval When Enabled

## Problem

When auto-approve is enabled and a team uploads a new photo:
1. The photo **still appears in the Team Photos approval dialog** requiring manual approval
2. This happens because `BottomNavigation` intentionally resets photo status to "pending" on `TEAM_PHOTO_UPDATED` event (line ~904-919)
3. `QuizHost` does attempt auto-approval but with delays, and by that time the UI already shows the photo as pending
4. Expected behavior: photos should auto-approve silently without appearing in the approval dialog

## Root Cause

The `BottomNavigation` component has logic that resets approval status back to "pending" whenever a new photo is detected (in `handleNetworkTeamPhotoUpdated`):
```typescript
// Current behavior (lines ~904-919 in BottomNavigation.tsx)
setPhotoStatuses(prev => {
  const currentStatus = prev[normalizedDeviceId];
  if (currentStatus === 'approved' || currentStatus === 'declined') {
    return { ...prev, [normalizedDeviceId]: 'pending' };
  }
  return prev;
});
```

This is appropriate for manual approval workflow, but when auto-approve is enabled, it should bypass this entirely.

## Solution Approach

**Check the auto-approve setting in `BottomNavigation`'s `TEAM_PHOTO_UPDATED` handler:**

1. **Access the auto-approval setting** in BottomNavigation (either via ref from SettingsContext or IPC call)
2. **In `handleNetworkTeamPhotoUpdated`**, check if auto-approve is enabled BEFORE resetting status to pending
3. **If auto-approve is ON:**
   - Do NOT reset status to 'pending'
   - Do NOT add photo to pendingPhotos list
   - Let QuizHost's auto-approval logic handle the approval silently
4. **If auto-approve is OFF:**
   - Keep current behavior (reset to 'pending' so photo appears for manual review)

**Alternative approach (if needed):**
- Filter out photos from `pendingPhotos` in the `fetchPendingPhotos` function itself if auto-approve is enabled AND the photo meets auto-approval criteria

## Files to Modify

### 1. `src/components/BottomNavigation.tsx`

**What to change:**
- Line ~504-515: Declare a ref to track auto-approval setting (similar to how settings are tracked elsewhere)
- Lines ~904-919 in `handleNetworkTeamPhotoUpdated`: Add auto-approval check before resetting status
- Potentially pass/subscribe to the auto-approval setting from SettingsContext

**Changes:**
```typescript
// Add near top of component (around line 504)
const autoApproveRef = useRef(false);

// Subscribe to auto-approval setting (add useEffect around line 530+)
useEffect(() => {
  // Listen for auto-approval setting changes
  // Could be from SettingsContext or a message listener
  // Store in autoApproveRef
}, []);

// Modify handleNetworkTeamPhotoUpdated (around line 904-919)
const handleNetworkTeamPhotoUpdated = (data: any) => {
  const normalizedDeviceId = (data?.deviceId || '').trim();
  
  console.log('[BottomNavigation] 📸 TEAM_PHOTO_UPDATED received:', data);
  
  // NEW: Check if auto-approve is enabled
  if (autoApproveRef.current === true) {
    console.log('[BottomNavigation] ✅ Auto-approve is ON - skipping pending status reset, letting QuizHost auto-approve silently');
    // Do NOT reset status, do NOT call setPhotoStatuses
    // Just schedule a refresh to verify final state after QuizHost approves
    schedulePhotoRefresh(1000); // Longer delay to let QuizHost complete auto-approval
    return;
  }
  
  // EXISTING: Only do this if auto-approve is OFF
  console.log('[BottomNavigation] 🔄 New photo detected - resetting status from approved to pending');
  setPhotoStatuses(prev => {
    const currentStatus = prev[normalizedDeviceId];
    if (currentStatus === 'approved' || currentStatus === 'declined') {
      return { ...prev, [normalizedDeviceId]: 'pending' };
    }
    return prev;
  });
  
  schedulePhotoRefresh(300);
};
```

### 2. `src/utils/SettingsContext.tsx` (Optional - if tracking setting there)

**What to check:**
- Verify how `teamPhotosAutoApprove` is managed
- Ensure it's accessible to BottomNavigation (either via context export or direct subscription)

### 3. `src/components/QuizHost.tsx` (Already Fixed)

**Status:** The type-tolerant check fix was already applied (handles string/number types for `teamPhotoPending`). Verify it's working correctly by checking console logs show auto-approval completing.

## Expected Outcome

✅ When auto-approve is enabled:
- New team photos auto-approve silently in the background
- Photos never appear in the Team Photos approval dialog
- No manual approval needed
- Photo is immediately assigned to the team

✅ When auto-approve is disabled:
- Current behavior preserved (photos appear in approval dialog)
- User manually approves/declines photos

✅ No visual flashing or state confusion

## Testing Points

1. Enable auto-approve setting
2. Upload a new team photo
3. Verify:
   - Photo does NOT appear in Team Photos dialog
   - Team Photos button does NOT show orange pending indicator
   - Console logs show "Auto-approve is ON - skipping pending status reset"
   - QuizHost logs show auto-approval completing
   - Photo appears assigned to the team after 1-2 seconds

4. Disable auto-approve setting
5. Upload a new team photo
6. Verify:
   - Photo DOES appear in Team Photos dialog as "Pending"
   - Team Photos button DOES show orange pending indicator
   - Can manually approve/decline as before
