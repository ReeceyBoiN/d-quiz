# Plan: Fix Auto-Approved Photos Not Displaying in Team Info Tab

## Root Cause (From Logs)
When a team submits a NEW photo with auto-approval enabled:
1. TEAM_PHOTO_UPDATED event fires
2. QuizHost waits 500ms then queries backend for photo state
3. Backend has already auto-approved photo (set `photoApprovedAt`)
4. QuizHost sees `photoApprovedAt` is set and **skips calling handleApproveTeam**
5. **`PHOTO_APPROVAL_UPDATED` is NEVER broadcast**
6. quizzes state never gets updated with the new photoUrl
7. Photo doesn't display in team info tab, but BottomNavigation still shows it as "Pending"

## Solution
Don't wait 500ms for validation. Instead, broadcast `PHOTO_APPROVAL_UPDATED` **immediately** when:
- TEAM_PHOTO_UPDATED is received
- AND auto-approval is enabled
- AND it's a new photo (not a duplicate of existing approved photo)

This ensures the quizzes state always gets updated with the photo, regardless of backend approval timing.

## Implementation Steps
1. In `handleNetworkTeamPhotoUpdated` in QuizHost.tsx, when `teamPhotosAutoApprove === true`:
   - Extract the photoUrl from the TEAM_PHOTO_UPDATED data (convertedPhotoUrl)
   - Broadcast `PHOTO_APPROVAL_UPDATED` immediately with the photoUrl
   - Keep the 500ms validation query but DON'T skip auto-approve based on `photoApprovedAt`

2. This way:
   - The quizzes state gets updated immediately with the new photo
   - The team info tab shows the photo
   - The 500ms query still validates but doesn't interfere with the broadcast

## Files to Modify
- `src/components/QuizHost.tsx` - handleNetworkTeamPhotoUpdated function (around line 2920)
