# Fix Initial Buzzer Selection Not Being Registered

## Problem
When a player connects, enters their team name, and selects a buzzer during initial setup, the buzzer selection is NOT registered in the host app. However, if they change the buzzer afterwards from the SettingsBar, it works perfectly fine.

## Root Cause
**Race condition between PLAYER_JOIN and PLAYER_BUZZER_SELECT messages:**

1. Player joins → App sends PLAYER_JOIN message (no buzzer included)
2. Host auto-approves team after 150ms delay
3. Player selects buzzer → App immediately sends separate PLAYER_BUZZER_SELECT message
4. **Problem**: PLAYER_BUZZER_SELECT often arrives before backend's networkPlayers map has the player entry
5. Backend warns: "Player not found in networkPlayers when updating buzzer" and drops the buzzer selection
6. Later when player changes buzzer from SettingsBar, the player entry definitely exists, so it works fine

## Solution Approach
**Include buzzer selection in the approval flow** - Instead of sending buzzer as a separate message after join, include it in the approval process. This eliminates the race condition entirely and ties buzzer selection to team approval.

Flow:
1. Player joins (PLAYER_JOIN) - no buzzer yet
2. Player selects buzzer in modal (held locally)
3. When player confirms buzzer, also approve the team on host at same time
4. Host creates team with buzzer already set
5. No separate PLAYER_BUZZER_SELECT race condition

## Files to Modify

### 1. `src-player/src/App.tsx`
**Update handleBuzzerConfirm to send team approval with buzzer:**
- After buzzer selection confirmation, send a new message type: `TEAM_BUZZER_CONFIRM` or enhance existing flow
- Instead of immediately sending `PLAYER_BUZZER_SELECT`, send a combined message that includes:
  - deviceId
  - teamName
  - buzzerSound (the selected buzzer)
  - This should trigger approval on the host side (if not already approved)
- Or: send buzzer selection in the PLAYER_JOIN message itself (requires flow change)

### 2. `electron/backend/server.js`
**No changes needed** - backend will still handle and normalize buzzer through existing PLAYER_BUZZER_SELECT logic, but it will no longer be a race because buzzer arrives with/as-part-of approval

### 3. `src/components/QuizHost.tsx`
**Update approval flow to include buzzer:**
- When team is approved (either via user click or auto-approval), include buzzer data
- Create team with `buzzerSound` field populated at creation time, not in a separate message
- This ensures buzzer is set atomically with team creation

## Expected Outcome
- Buzzer selection during initial setup is registered immediately
- No race condition because buzzer and approval are synchronized
- Cleaner message flow (one approval message vs join + separate buzzer)
- Subsequent buzzer changes continue to work via SettingsBar/PLAYER_BUZZER_SELECT

## Implementation Notes
- Need to refactor how buzzer selection is passed from player modal through approval
- Current flow: BuzzerSelectionModal → handleBuzzerConfirm → separate PLAYER_BUZZER_SELECT
- New flow: BuzzerSelectionModal → handleBuzzerConfirm → TEAM_BUZZER_CONFIRM (which triggers approval with buzzer included)
- Host needs to apply buzzer when handling approval, not just in separate listener

## Testing Steps
1. Rebuild app
2. Have player join → enter team name → select buzzer
3. Check host app - buzzer should be displayed for that team immediately upon approval
4. Change buzzer from player settings - should continue to work via existing PLAYER_BUZZER_SELECT
5. Verify no "Player not found" warnings in backend logs
