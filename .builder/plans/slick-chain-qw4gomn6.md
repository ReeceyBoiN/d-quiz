# Fix Auto-Approval for New Team Photos

## Problem
When auto-approval is enabled and a new team photo is uploaded with `teamPhotoPending=true`, the frontend skips auto-approval because it checks `!player.photoApprovedAt`. However, `photoApprovedAt` is leftover from the **previous photo approval**, not from the current photo.

The logs show:
```
⚠️ Skipping auto-approve: photo already approved at 2026-02-17T23:45:09.733Z
```

This happens because the validation logic checks a stale timestamp from the prior photo.

## Root Cause
In BottomNavigation.tsx, the TEAM_PHOTO_UPDATED handler validates with:
```javascript
if (player?.teamPhoto && !player?.photoApprovedAt) {
  handleApprovePhoto(deviceId, teamName);
}
```

This fails when:
- The event payload has `teamPhotoPending=true` (new pending photo)
- But the player record still has `photoApprovedAt` from the previous photo

## Solution
Modify the validation logic in BottomNavigation.tsx to:
1. **Primary signal**: If `teamPhotoPending=true`, immediately auto-approve (don't check photoApprovedAt)
2. **Fallback signal**: Also check for `teamPhoto && !photoApprovedAt` for older pending detection

The logic becomes:
```javascript
// If new photo is explicitly marked as pending, approve it
if (player?.teamPhotoPending === true) {
  handleApprovePhoto(deviceId, teamName);
} 
// Otherwise fall back to checking if photo exists but isn't approved
else if (player?.teamPhoto && !player?.photoApprovedAt) {
  handleApprovePhoto(deviceId, teamName);
}
```

## Files to Modify
- **src/components/BottomNavigation.tsx**: Update the validation logic in the TEAM_PHOTO_UPDATED handler (lines ~933–951)

## Expected Outcome
- When auto-approval is enabled and a new photo arrives with `teamPhotoPending=true`, it will be auto-approved immediately
- Existing pending detection fallback still works for edge cases
- The orange flash disappears when photo is auto-approved
- Photo doesn't stay in team photos tab after auto-approval
