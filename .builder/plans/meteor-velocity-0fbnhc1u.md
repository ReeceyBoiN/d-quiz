# Team Photo Approval System - Final Fixes

## Issues to Resolve

### Issue 1: Photos Displaying Before Approval
**Problem**: When a team uploads a new photo, it immediately replaces the old photo in team info, even though it's still pending approval.

**Root Cause**: In `server.js:857`, the code does:
```javascript
existingPlayer.teamPhoto = photoPath || existingPlayer.teamPhoto;
```
This updates the displayed photo IMMEDIATELY, regardless of approval status.

**Solution Options**:
- Keep a separate field: `teamPhotoDisplayed` (approved photo) and `teamPhotoPending` (new photo waiting)
- OR: Track photo approval status and only update `teamPhoto` when approved or auto-approve is enabled
- OR: Return new photo to pending approval list WITHOUT updating displayed photo until approval

**Recommended Approach**: 
Separate the "pending photo path" from the "displayed photo path":
- `teamPhoto` = currently displayed photo (only approved)
- `teamPhotoPending` = new photo awaiting approval
- Only update `teamPhoto` when photo is approved via `approveTeam`

### Issue 2: Team Photos Tab Not Flashing Orange
**Problem**: Orange flashing indicator not visible despite logs showing pending photos detected

**Root Cause Possibilities**:
1. State update not triggering re-render
2. CSS animation not applying correctly
3. Component not re-rendering when `pendingPhotos` state changes
4. Throttling preventing state updates

**Solution**: 
- Verify pendingPhotos state updates trigger component re-render
- Add explicit logging of hasPendingTeamPhotos value
- Ensure CSS animation is being applied with correct classes
- Check if polling interval is being cancelled prematurely

---

## Implementation Steps

### Step 1: Backend (server.js)
- Modify TEAM_PHOTO_UPDATE handler to track photo approval separately
- Only update `teamPhoto` (displayed photo) when approval is confirmed
- Add `teamPhotoPending` to track new uploads

### Step 2: Frontend (BottomNavigation.tsx)
- Ensure fetchPendingPhotos properly updates pendingPhotos state
- Add detailed logging for hasPendingTeamPhotos value
- Verify animate-flash-orange class is being applied
- Check if state updates are happening frequently enough

### Step 3: Verification
- Test new photo upload → should NOT show in team info until approved
- Test flashing indicator → should flash orange while photo pending
- Test approval → photo should appear after approval
- Test auto-approve setting → photo should appear immediately if enabled

---

## User Requirements (Confirmed)

1. **Photo Display When Pending**: Show NO PHOTO (blank/empty) - don't display until approved
2. **Flashing Indicator**: Currently NOT flashing at all - completely broken

---

## Detailed Fix Plan

### Phase 1: Backend Photo Separation (server.js)

In TEAM_PHOTO_UPDATE handler (~line 857):
- Do NOT update `existingPlayer.teamPhoto` immediately
- Create `existingPlayer.teamPhotoPending` to hold the new photo path
- Only update `existingPlayer.teamPhoto` when:
  1. Photo is approved via `approveTeam()` call, OR
  2. Auto-approve setting is enabled AND photo arrives

Current broken code:
```javascript
existingPlayer.teamPhoto = photoPath || existingPlayer.teamPhoto;
```

Fixed code:
```javascript
// Store pending photo separately - don't update displayed photo until approved
existingPlayer.teamPhotoPending = photoPath;
// Only update displayed photo if auto-approving
if (shouldAutoApprove) {
  existingPlayer.teamPhoto = photoPath;
}
```

### Phase 2: Fix approveTeam to Update Displayed Photo (server.js)

When approving a photo:
```javascript
if (approvePhoto) {
  // Move pending photo to displayed photo
  finalPlayer.teamPhoto = finalPlayer.teamPhotoPending;
  finalPlayer.teamPhotoPending = null;
  finalPlayer.photoApprovedAt = Date.now();
  finalPlayer.photoApprovedHash = currentPhotoHash;
}
```

### Phase 3: Fix Flashing Indicator (BottomNavigation.tsx)

Debug why flashing isn't working:
1. Add logging to see if `hasPendingTeamPhotos` is actually becoming `true`
2. Verify the animate-flash-orange class is being applied to the button
3. Check if component is re-rendering when state changes
4. Ensure CSS animation in globals.css is correct

---

## Files to Modify

1. `electron/backend/server.js` - Separate pending vs displayed photos
2. `src/components/BottomNavigation.tsx` - Debug flashing indicator
3. Possibly `src/styles/globals.css` - If CSS animation needs fixing
