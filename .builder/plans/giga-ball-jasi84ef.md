# Team Photos Approval Workflow - Implementation Plan

## Problem Summary
The team photos approval system has three critical issues:
1. **Missing Visual Indicator**: Team Photos tab doesn't flash/pulse orange when pending photos await approval
2. **Auto-Approve Bug**: New photo uploads get auto-approved even when auto-approve setting is disabled (after a photo has been previously approved)
3. **Missing Cleanup**: When a new photo is uploaded, the old approved photo isn't deleted from storage

## Root Causes Identified

### Auto-Approve Bug (Primary Issue)
The backend (server.js) has an `autoApproveTeamPhotos` variable that controls whether `teamPhotoPending` moves to `teamPhoto` immediately on upload. However:
- This backend flag is not synced with the renderer's SettingsContext.teamPhotosAutoApprove setting
- The frontend's client-side auto-approve in BottomNavigation.tsx has logic that checks if a photo is already approved (`if (player?.teamPhoto && !player?.photoApprovedAt)`) before auto-approving
- When a photo is approved, `photoApprovedAt` is set, but when a new photo is uploaded, the backend doesn't clear this field
- This causes the client-side auto-approve check to fail on subsequent uploads (it sees `photoApprovedAt` is set and skips auto-approve), BUT the backend might still be auto-approving if `autoApproveTeamPhotos` is somehow enabled server-side

### Missing Photo Cleanup
When a team uploads a new photo after having an approved one:
- The new photo is saved to disk
- The old `teamPhoto` file path is not deleted from storage
- Both old and new files accumulate in the photos directory

### Missing Visual Indicator
The Team Photos tab button doesn't indicate when pending approvals exist, making it unclear that action is needed.

## Implementation Strategy

### 1. Fix Backend Auto-Approve Logic (server.js)
**File**: `electron/backend/server.js` - TEAM_PHOTO_UPDATE handler

**Changes**:
- When a new photo is uploaded, **always** set `teamPhotoPending` (never auto-set `teamPhoto`)
- Remove the `if (autoApproveTeamPhotos)` conditional that sets `teamPhoto` directly on upload
- The only way `teamPhotoPending` should move to `teamPhoto` is through the explicit `approveTeam` endpoint
- Client-side auto-approve (BottomNavigation) will still work but will be the ONLY mechanism

**Why**: This ensures server-side behavior matches renderer expectations: all new uploads go to pending state, and only client-side auto-approve (which checks the renderer setting) can move them to approved.

### 2. Handle Photo Replacement & Cleanup (server.js)
**File**: `electron/backend/server.js` - TEAM_PHOTO_UPDATE handler

**Changes**:
- Before saving the new photo, check if `existingPlayer.teamPhoto` exists (old approved photo)
- If it exists, delete the old file from disk (using fs.unlink or similar)
- Store the old file path so it can be properly cleaned up
- Only after cleanup, save the new photo and update `teamPhotoPending`
- Also clear `photoApprovedAt` and `photoApprovedHash` when a new photo is uploaded, forcing re-approval

**Why**: Prevents storage bloat and ensures new uploads truly start fresh in the approval workflow.

### 3. Reset Approval State on New Upload (server.js)
**File**: `electron/backend/server.js` - TEAM_PHOTO_UPDATE handler

**Changes**:
- When handling TEAM_PHOTO_UPDATE, reset:
  - `existingPlayer.photoApprovedAt = null` 
  - `existingPlayer.photoApprovedHash = null`
- This forces the photo to go through approval even if a previous one was approved

**Why**: Implements the requirement that "any submitted photo must wait for approval every time UNLESS auto-approve is enabled."

### 4. Add Orange Pulsing Indicator (BottomNavigation.tsx)
**File**: `src/components/BottomNavigation.tsx`

**Changes**:
- Add CSS for pulsing orange animation (keyframe animation that cycles orange)
- Add state to track if pending photos exist
- When `TEAM_PHOTO_UPDATED` is received, check if there are pending photos
- Apply the pulsing class to the Team Photos button when `pendingPhotosExist === true`
- Ensure the button returns to normal state when all pending photos are approved/declined

**Why**: Users need a visual cue that action is required.

### 5. Verify Client-Side Auto-Approve Still Works (BottomNavigation.tsx)
**File**: `src/components/BottomNavigation.tsx`

**Changes**:
- The existing client-side auto-approve logic should work correctly once the backend stops auto-approving
- The logic checks `if (teamPhotosAutoApprove === true && ... !player?.photoApprovedAt)` which will now properly handle new uploads since `photoApprovedAt` is cleared

**Why**: No code changes needed here once backend is fixed, but verify it works as intended.

## Implementation Order

1. **Backend photo state reset** (server.js):
   - Remove auto-approve on upload
   - Clear `photoApprovedAt` and `photoApprovedHash` on new upload
   - This is the core fix for the auto-approve bug

2. **Backend photo cleanup** (server.js):
   - Add logic to delete old photo when new one is uploaded
   - Handle file system errors gracefully

3. **Visual indicator** (BottomNavigation.tsx):
   - Add pulsing CSS animation
   - Add logic to apply animation when pending photos exist
   - Remove animation when all photos are approved/declined

4. **Testing & Verification**:
   - Verify that uploading a new photo after approval requires re-approval
   - Verify that auto-approve setting works correctly (is respected)
   - Verify that old photo files are deleted
   - Verify that Team Photos button pulses orange when pending photos exist
   - Test with both auto-approve enabled and disabled

## Files to Modify

- `electron/backend/server.js` (TEAM_PHOTO_UPDATE handler, approveTeam handler)
- `src/components/BottomNavigation.tsx` (CSS animation, pending photo detection, button styling)

## Key Considerations

- The backend file paths use `file://` URLs and Node.js fs operations - ensure proper path handling
- Photo cleanup should handle edge cases (file already deleted, permissions issues)
- The pulsing animation should be performant and not distract when there are no pending photos
- Once backend stops auto-approving, the client-side auto-approve in BottomNavigation becomes the single source of truth
