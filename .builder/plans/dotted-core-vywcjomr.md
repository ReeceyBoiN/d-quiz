# Bug Fix Plan: Team Photos Auto-Approving When Setting is Disabled

## Problem Statement
Team photos are being automatically approved even when the "Team Photos Auto Approval" toggle is turned OFF in settings.

## Root Cause Analysis
The bug occurs due to a disconnect between team approval and photo approval logic:

1. **When a new team joins** (PLAYER_JOIN event received):
   - QuizHost checks if the quiz has started (any team has points > 0)
   - If quiz HASN'T started: automatically calls `handleApproveTeam()` for the new team
   - This sets `player.status = 'approved'` in the backend

2. **The `teamPhotosAutoApprove` setting is NEVER checked** in this auto-approval code path
   - The setting only exists in UI (SettingsContext, Settings.tsx, BottomNavigation.tsx)
   - No code path actually uses this setting to control auto-approval behavior

3. **When photos appear**:
   - BottomNavigation filters pending photos by: `player.status === 'pending'`
   - Since the team was already auto-approved, photos associated with that team don't show as pending
   - This makes photos appear auto-approved regardless of the setting

## Files Involved

### High Priority (Must Change)
- **src/components/QuizHost.tsx** (Lines 2697-2726)
  - Contains the unconditional `handleApproveTeam()` call in PLAYER_JOIN handler
  - Needs to check `teamPhotosAutoApprove` setting before auto-approving

### Related (Reference Only)
- src/utils/SettingsContext.tsx - Provides `teamPhotosAutoApprove` state
- src/components/BottomNavigation.tsx - Filters pending photos by `player.status === 'pending'`
- electron/backend/server.js - Backend's `approveTeam()` sets `player.status = 'approved'`

## Solution Approach

**The Key Insight**: We need to **separate photo approval from team approval**.
- Teams are ALWAYS approved for gameplay (can submit answers, buzzers, etc.)
- Photos are approved ONLY if:
  1. The host manually approves them, OR
  2. They arrive when `teamPhotosAutoApprove` is enabled

**Implementation Strategy**: Add a separate photo approval tracking field to decouple photo status from team status.

### Step 1: Add Photo Approval Field to Backend Player Object
**File: electron/backend/server.js**
- When initializing a new player, add: `photoApprovedAt: null`
- This field tracks when a photo was specifically approved (independent from team approval)
- Keep existing `approvedAt` field for team approval

### Step 2: Modify approveTeam() Function
**File: electron/backend/server.js**
- When `approveTeam()` is called, set `photoApprovedAt = Date.now()`
- This marks both the team AND photo as approved

### Step 3: Auto-Approve Photos When Settings Allow
**File: src/components/BottomNavigation.tsx - useEffect for TEAM_PHOTO_UPDATED**
- When a `TEAM_PHOTO_UPDATED` event arrives from a new photo upload:
  - Check if `teamPhotosAutoApprove` is enabled
  - If TRUE: automatically call `handleApprovePhoto()` for that photo
  - If FALSE: leave photo in pending state (do nothing)
- This ensures photos auto-approve only when the setting is enabled

### Step 4: Update Photo Pending Filter
**File: src/components/BottomNavigation.tsx**
- Change the pending photos filter from:
  ```javascript
  result.data.filter((p: any) => p.teamPhoto && p.status === 'pending')
  ```
- To:
  ```javascript
  result.data.filter((p: any) => p.teamPhoto && !p.photoApprovedAt)
  ```
- This ensures photos show as pending if `photoApprovedAt` is null, regardless of team status

## Expected Outcome
- ✅ Teams are ALWAYS approved for gameplay when they join (can submit answers/buzzers)
- ✅ When auto-approval is OFF: photos require manual approval despite team being approved
- ✅ When auto-approval is ON: photos auto-approve immediately when uploaded
- ✅ Host sees accurate pending photo count in Team Photos button (orange flash)
- ✅ Photo approval status is independent from team approval status

## Testing Checklist (Setting OFF)
1. ✅ Turn OFF auto-approval setting
2. ✅ New team joins before quiz starts
3. ✅ Team can play (submit answers, select buzzers, etc.)
4. ✅ Team uploads photo
5. ✅ Photo shows as pending in Team Photos popup
6. ✅ Team Photos button flashes orange
7. ✅ Host must manually approve/decline photo
8. ✅ After approval, photo disappears from pending list

## Testing Checklist (Setting ON)
1. ✅ Turn ON auto-approval setting
2. ✅ New team joins and uploads photo
3. ✅ Photo automatically shows as approved (NOT in pending list)
4. ✅ Team Photos button does NOT flash (no pending photos)
5. ✅ Team can still play normally
6. ✅ Photo appears in approved section (if viewing approved photos)

## Files Modified
1. `electron/backend/server.js` - Add `photoApprovedAt` field, initialize for new players
2. `electron/backend/server.js` - Update `approveTeam()` to set `photoApprovedAt`
3. `src/components/BottomNavigation.tsx` - Add auto-approval logic in TEAM_PHOTO_UPDATED handler
4. `src/components/BottomNavigation.tsx` - Update pending photos filter to check `photoApprovedAt`

## Risk Assessment
- **Low Risk**: Only affects new team approval logic
- **Backward Compatible**: Maintains existing auto-approval behavior when setting is enabled
- **Minimal Changes**: Single file modification (QuizHost.tsx)
