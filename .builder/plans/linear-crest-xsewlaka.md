# Team Photo Clearing and Approval Fix Plan

## Problem Statement
When a team submits a new photo:
1. The OLD photo still appears in the team's info tab (should be cleared immediately)
2. The new photo is correctly NOT shown (it's pending approval - our recent fix)
3. The approve button may need to be clicked twice (likely due to confusion from old photo still being visible)

## Root Cause Analysis
- **TEAM_PHOTO_UPDATED** is received when a new photo is uploaded
- Our current fix correctly ignores updating `photoUrl` on this event
- **BUT** we're not clearing the existing `photoUrl` for teams that already have a photo
- The old photo remains visible in TeamWindow until explicitly cleared

## Solution Overview
When a new photo is submitted (TEAM_PHOTO_UPDATED event received):
1. If the team already has a photoUrl, clear it immediately (set to null/undefined)
2. This way, the team info tab will be empty while the new photo is pending approval
3. When the user approves (PHOTO_APPROVAL_UPDATED), the new photo will appear
4. This creates a clear visual workflow: old photo → empty → new photo (approved)

## Implementation Steps

### Step 1: Modify TEAM_PHOTO_UPDATED Handler in QuizHost
**File**: `src/components/QuizHost.tsx`
**Location**: `handleNetworkTeamPhotoUpdated` function (around line 2879)

**Change**: Add logic to clear existing photoUrl when a new photo is submitted
- Check if the team already has a photoUrl
- If yes, clear it (set to undefined/null)
- This happens BEFORE checking for team match, so it applies to all teams receiving new submissions

**Why**: Clears visual confusion - team info will show empty while new photo is pending approval

### Step 2: Verify Approval Flow Still Works
**File**: `src/components/QuizHost.tsx`
**Location**: `handlePhotoApprovalUpdated` function (around line 3183)

**Verification**: Ensure PHOTO_APPROVAL_UPDATED still correctly updates the photoUrl with the approved photo
- Should already work correctly with our previous changes
- Just verify the logic is intact

## Expected Behavior After Fix
1. Team submits Photo 1 → Photo 1 appears in info tab
2. User approves Photo 1 → Photo 1 stays in info tab (approved)
3. Team submits Photo 2 → **Photo 1 immediately disappears, info tab is empty** (new photo pending)
4. User approves Photo 2 → Photo 2 appears in info tab (approved)

This creates a clear, unambiguous UI where:
- Old photo is immediately cleared when new submission arrives
- Team info shows empty during pending approval
- New photo appears only after approval
- Single-click approval should be sufficient (no confusion from old photo)

## Implementation Details

### Clearing Old Photo on New Submission
When `TEAM_PHOTO_UPDATED` is received:
1. Get the team by deviceId
2. If team exists AND currently has a photoUrl, clear it
3. Set team.photoUrl = undefined/null
4. This clears the visual immediately, without affecting the pending photo list

### Pending Photos List
Backend filters show only photos where: `(p.teamPhoto && !p.photoApprovedAt)`
- This automatically shows only the latest pending photo
- Old approved photos don't show as pending
- This is already working correctly

## Files to Modify
- `src/components/QuizHost.tsx` - TEAM_PHOTO_UPDATED handler

## Testing
- Submit a photo → verify it appears after approval
- Submit another photo → verify old photo disappears immediately
- Approve the new photo → verify it appears (single click should suffice)
