# Fix Initial Buzzer Selection Race Condition

## Problem
When a player connects, enters their team name, and selects a buzzer during initial setup, the buzzer is NOT registered in the host app. However, when they change the buzzer later from SettingsBar, it works perfectly. This indicates a race condition during initial team creation.

## Root Cause
The PLAYER_BUZZER_SELECT message is sent as a separate message AFTER the buzzer modal closes. Due to timing:
1. Host creates/approves team BEFORE PLAYER_BUZZER_SELECT arrives
2. Host then receives PLAYER_BUZZER_SELECT but doesn't find the team (or finds it but state updates don't sync properly)
3. Later buzzer changes work because team already exists and is in state

## Solution: Include Buzzer Sound in PLAYER_JOIN Message

Instead of sending buzzer as a separate message, include it in the initial PLAYER_JOIN payload. This makes the operation atomic - team and buzzer are created together.

### Detailed Changes

#### 1. `src-player/src/App.tsx` - Include buzzer in PLAYER_JOIN
- In `handleBuzzerConfirm()`: Store the selected buzzer in state
- Delay the PLAYER_JOIN message that was originally sent in `handleTeamNameSubmit()`
- When buzzer is confirmed, send PLAYER_JOIN AGAIN with the buzzer sound included
- This ensures backend receives team info + buzzer together
- Add logging: "Sending PLAYER_JOIN with buzzer: [buzzer name]"

**Key change**: Modify `handleTeamNameSubmit` to NOT send PLAYER_JOIN immediately, or send it first and then update it after buzzer is selected.

#### 2. `electron/backend/server.js` - Handle buzzer in PLAYER_JOIN
- In PLAYER_JOIN handler, extract `data.buzzerSound` if present
- Store it immediately in the networkPlayers entry: `newEntry.buzzerSound = buzzerSound`
- This ensures buzzer is stored ON THE BACKEND at team creation time
- Add logging: "PLAYER_JOIN received with buzzer: [buzzer name]"

#### 3. `src/components/QuizHost.tsx` - Retrieve buzzer from network
- When handleApproveTeam runs, fetch the player from backend via IPC
- The player entry should now have `buzzerSound` property already set
- Extract it and include in the team creation: `newTeam.buzzerSound = player.buzzerSound`
- Remove the pending buzzer system (no longer needed)
- Add logging: "Team created with buzzer: [buzzer name]"

## Implementation Flow

1. **Player enters team name** → Send PLAYER_JOIN without buzzer (or skip for now)
2. **Player selects buzzer** → Update state, send updated PLAYER_JOIN WITH buzzer OR re-join with buzzer
3. **Backend receives PLAYER_JOIN** → Extract and store buzzer sound immediately in networkPlayers
4. **Host approves team** → Fetch player from backend, extract buzzer sound, create team with it
5. **Host displays team** → Buzzer is already set, visible immediately

## Logging Added
- Player app: Log when buzzer is included in PLAYER_JOIN
- Backend: Log when buzzer is stored in networkPlayers
- Host: Log when buzzer is retrieved from backend player entry

## Files Modified
1. `src-player/src/App.tsx` - Modify PLAYER_JOIN sending logic for buzzer inclusion
2. `electron/backend/server.js` - Extract and store buzzer in PLAYER_JOIN handler
3. `src/components/QuizHost.tsx` - Retrieve buzzer from backend when approving team
