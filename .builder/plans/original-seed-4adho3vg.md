# Team Photo Approval State System Fix

## Problem Statement
Team photos are appearing on player devices and livescreen without being approved first. The approval system exists but has issues:
- Auto-approve setting may be accidentally enabled or approval logic isn't working properly
- No explicit "declined" state for photos - they should be deleted when rejected
- Auto-approved photos may still appear in the team photos tab when they should be hidden
- Pending photo filtering may not be working correctly

## User Requirements
1. **Declined Photos**: Delete file immediately when photo is declined (no history tracking)
2. **Auto-Approved Photos**: Hide immediately from team photos tab once auto-approved
3. **Approval Logging**: Only track approval timestamp, not the method (auto vs manual)
4. **Display Logic**: Only approved photos should show on player devices and livescreen
5. **Pending State**: Photos must be in pending state before approval and visible in team photos tab

## Current System Overview
- **Backend**: `electron/backend/server.js` - Photo storage, approval logic, auto-approve setting
- **Frontend Settings**: `src/utils/SettingsContext.tsx` - Auto-approve toggle stored in localStorage
- **Team Photos UI**: `src/components/BottomNavigation.tsx` - Displays pending photos, approve/decline buttons
- **Display Logic**: `src/components/QuizHost.tsx` - Controls what photos appear on screens
- **Photo Fields**:
  - `teamPhotoPending`: Photo awaiting approval
  - `teamPhoto`: Approved photo to display
  - `photoApprovedAt`: Timestamp of approval
  - `photoApprovedHash`: Hash of approved photo (for validation)

## Root Causes Identified
1. **Auto-Approve Default**: Need to verify the default is false, but may be accidentally enabled
2. **Approval Check Missing**: When displaying photos on player devices/livescreen, need to verify `photoApprovedAt` is not null
3. **Pending Filter**: Team photos tab filter `(p.teamPhotoPending) || (p.teamPhoto && !p.photoApprovedAt)` might not properly exclude auto-approved photos
4. **No Declined State**: When a photo is declined, it's not properly deleted from disk and state

## Implementation Plan

### Phase 1: Fix Backend Approval Logic
**File**: `electron/backend/server.js`

1. **Fix TEAM_PHOTO_UPDATE handler**:
   - When auto-approve is OFF: set `teamPhotoPending`, clear `teamPhoto`, clear `photoApprovedAt`
   - When auto-approve is ON: set `teamPhoto`, set `photoApprovedAt = Date.now()`, clear `teamPhotoPending`
   - Add explicit null clearing for declined/unapproved states

2. **Add declined photo deletion**:
   - In the decline handler, delete the photo file from disk if it exists
   - Clear both `teamPhotoPending` and `teamPhoto` fields
   - Ensure `photoApprovedAt` is null

3. **Fix approveTeam with photo approval**:
   - When `approvePhoto === true`, move `teamPhotoPending` → `teamPhoto`
   - Set `photoApprovedAt = Date.now()`
   - Clear `teamPhotoPending`

### Phase 2: Fix Frontend Display Logic
**File**: `src/components/QuizHost.tsx`

1. **Verify photo display conditions**:
   - When broadcasting `PHOTO_APPROVAL_UPDATED`, ensure it only happens when `photoApprovedAt` is set
   - Add validation that approved photos have `photoApprovedAt !== null`
   - If a photo is pending (no `photoApprovedAt`), do NOT broadcast it

2. **Add safeguard checks**:
   - Before displaying photo in TeamWindow or livescreen, check that either:
     - `photoApprovedAt` is not null, OR
     - Auto-approve is enabled AND photo was just received
   - Log warnings if unapproved photos are attempted to be displayed

### Phase 3: Fix Team Photos Tab UI
**File**: `src/components/BottomNavigation.tsx`

1. **Improve pending photo filter**:
   - Change filter to explicitly check: `(p.teamPhotoPending && !p.photoApprovedAt) || (p.teamPhoto && !p.photoApprovedAt)`
   - Only show photos that are actually pending (not approved)
   - Ensure auto-approved photos are immediately hidden

2. **Fix decline handler**:
   - Call API to delete the photo (add deleteTeamPhoto endpoint if needed)
   - Ensure file is deleted from disk
   - Update UI to remove the photo from list

3. **Add visual feedback**:
   - When auto-approve is enabled, show a note in the team photos tab that auto-approval is active
   - Show approved photos with clear indication (optional: "Auto-approved" badge)

### Phase 4: Fix Auto-Approve Behavior
**File**: `src/utils/SettingsContext.tsx`

1. **Verify setting sync**:
   - Ensure `teamPhotosAutoApprove` default is false
   - When toggling auto-approve ON, auto-approve all pending photos immediately
   - When toggling OFF, do nothing (new photos will require approval)

2. **Fix auto-approval routine**:
   - When enabling auto-approve, iterate pending photos and call approve endpoint
   - Wait for all to complete before returning

### Phase 5: Add Missing Decline Endpoint
**Files**: `electron/backend/server.js` and `electron/main/main.js`

1. **Backend handler** - Add photo decline/delete logic:
   - Find the photo file path from `teamPhotoPending` or `teamPhoto`
   - Delete the file from disk
   - Clear both `teamPhotoPending` and `teamPhoto`
   - Clear `photoApprovedAt` and `photoApprovedHash`
   - Send confirmation back to UI

2. **IPC handler** - Expose endpoint:
   - Add `network/decline-team-photo` endpoint in main.js
   - Calls backend decline handler and returns confirmation

## Files to Modify
1. `electron/backend/server.js` - Core approval/decline logic
2. `electron/main/main.js` - IPC endpoint for photo decline
3. `src/components/QuizHost.tsx` - Display safeguards
4. `src/components/BottomNavigation.tsx` - UI pending filter and decline handler
5. `src/utils/SettingsContext.tsx` - Verify defaults and auto-approve routine

## Testing Checklist
1. Verify photos start in pending state when uploaded
2. Verify pending photos appear in team photos tab
3. Verify declined photos are deleted from disk and UI
4. Verify approved photos hide from team photos tab
5. Verify approved photos display on player devices/livescreen
6. Verify auto-approve setting auto-hides photos in team photos tab
7. Verify toggling auto-approve on processes all pending photos correctly
8. Verify photos don't display on external screens until approved

## Dependencies
- No new dependencies needed
- Only modifying existing approval logic and adding decline file deletion
