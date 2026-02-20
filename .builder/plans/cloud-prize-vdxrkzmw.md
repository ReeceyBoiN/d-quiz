# Host Terminal Feature Plan

## Overview
Build a remote host control terminal on the player app that enables hosts to control the quiz from a mobile device via a 4-digit PIN authentication. The host joins as a special "controller" user that:
- Connects via the same WebSocket network as regular players
- Uses the randomly generated 4-digit PIN as the team name
- Gets authenticated and hidden from the regular leaderboard
- Unlocks a full admin control panel instead of the normal game interface

**Key Requirement**: Host terminal is remote (over WiFi network) and accessed through the player app.

---

## Architecture Overview

### Authentication Flow
1. Host clicks "Host Controller" button in host app
2. Host app generates 4-digit PIN (already implemented in QuizHost.tsx:handleToggleHostController)
3. PIN is displayed to host for sharing
4. Remote user joins player app with team name = 4-digit PIN
5. Host app recognizes PIN match → sends special authentication message to that player
6. Player app recognizes "host-controller" role → hides normal game UI, shows admin terminal

### Network Protocol Extensions
New message types to add:
- `CONTROLLER_AUTH_SUCCESS` - sent by host to player confirming PIN authentication
- `CONTROLLER_AUTH_FAILED` - authentication failed
- `ADMIN_COMMAND` - player sends admin commands to host (change score, edit team, etc)
- `ADMIN_RESPONSE` - host confirms admin action

---

## Implementation Tasks

### Phase 1: PIN Authentication System

**1.1 Extend QuizHost.tsx PIN Management**
- File: `src/components/QuizHost.tsx`
- Current: PIN generated but not tracked for authentication
- Changes needed:
  - Store PIN in state with metadata: `hostControllerPin: { code: string, enabled: boolean, timestamp: number }`
  - Create `validatePlayerAsPIN(playerName)` function: checks if incoming player's team name matches the PIN
  - When player joins with matching PIN, mark that player as `isHostController: true` in the players list
  - Send `CONTROLLER_AUTH_SUCCESS` message to that player's connection
  - Exclude host controller player from leaderboard/scores/team list broadcast

**1.2 Modify Player Join Handler**
- File: `src/components/QuizHost.tsx` - message handler for `PLAYER_JOIN`
- When a player joins, after they've connected, check if their teamName matches hostControllerPin
- If match: send `CONTROLLER_AUTH_SUCCESS` instead of `TEAM_PENDING` or `TEAM_APPROVED`
- Track controller player separately (don't add to quizzes/teams array)

**1.3 Extend Network Message Types**
- File: `src-player/src/types/network.ts`
- Add message types:
  ```
  type: 'CONTROLLER_AUTH_SUCCESS' | 'CONTROLLER_AUTH_FAILED' | 'ADMIN_COMMAND' | 'ADMIN_RESPONSE'
  ```

---

### Phase 2: Host Terminal UI - Player App

**2.1 Create Host Terminal Screen**
- File: `src-player/src/components/HostTerminal/index.tsx` (new)
- Route: Add `'host-terminal'` screen state in App.tsx
- When player receives `CONTROLLER_AUTH_SUCCESS`:
  - Set `currentScreen: 'host-terminal'`
  - Hide all normal game UI
  - Show admin control panel
- Layout:
  - Header: "Host Controller Active" badge + session info
  - Tab/Section navigation: Leaderboard | Teams | Game Controls | Settings
  - Responsive design for mobile devices

**2.2 Leaderboard Panel** 
- File: `src-player/src/components/HostTerminal/LeaderboardPanel.tsx` (new)
- Display all teams from received leaderboard updates
- Real-time score updates as received
- Features:
  - View current scores ranked
  - Pin/unpin teams (visual emphasis for current round)
  - Filter/search teams

**2.3 Team Management Panel**
- File: `src-player/src/components/HostTerminal/TeamManagementPanel.tsx` (new)
- Features:
  - **Edit Team Name**: Click team → inline edit → send `ADMIN_COMMAND` with type 'edit-team-name'
  - **Adjust Points**: +/- buttons on each team → send `ADMIN_COMMAND` with type 'adjust-score'
  - **Approve/Decline Photos**: Show pending team photos, approve/decline buttons → send `ADMIN_COMMAND` with type 'approve-photo' or 'decline-photo'
  - **Remove Team**: Delete button (with confirmation) → send `ADMIN_COMMAND` with type 'remove-team'
  - **Add Points Dialog**: Quick modal to add/subtract X points from multiple teams at once
- Real-time sync with host (wait for `ADMIN_RESPONSE` confirmation)

**2.4 Game Controls Panel**
- File: `src-player/src/components/HostTerminal/GameControlsPanel.tsx` (new)
- Top-level controls visible regardless of game mode:
  - **Next Question**: Send `ADMIN_COMMAND` type 'next-question'
  - **Reveal Answer**: Send `ADMIN_COMMAND` type 'reveal-answer'
  - **Skip Question**: Send `ADMIN_COMMAND` type 'skip-question'
  - **End Round**: Send `ADMIN_COMMAND` type 'end-round'
  - **Show Leaderboard**: Trigger leaderboard display on external screens
  
- Game mode specific sections (collapsible/tabs):

  **2.4.1 KEYPAD (On-the-Spot) Controls**
  - Current question display
  - Show answer options (if multiple choice)
  - Reveal correct answers button
  - Show fastest answering team
  - Award points controls

  **2.4.2 BUZZ-IN Controls**
  - Current question display
  - Reset buzzer state
  - Validate correct team
  - Show fastest buzz time
  - Award points controls

  **2.4.3 NEAREST WINS Controls**
  - Current question display
  - Show all submitted numbers
  - Mark correct answer
  - Show nearest team
  - Award points controls

  **2.4.4 WHEEL SPIN Controls**
  - Trigger spin animation
  - Show wheel result
  - Award points to selected team
  - Skip/rewind controls

  **2.4.5 Timer Controls** (universal)
  - Start Silent Timer button
  - Start Normal Timer button
  - Manual timer duration input (default from game settings)
  - Pause/Resume timer
  - Stop timer
  - Show countdown on terminal while running

**2.5 Settings Panel**
- File: `src-player/src/components/HostTerminal/SettingsPanel.tsx` (new)
- Display host device connection info
- Show current game mode
- Quick settings toggle: Theme, text size, layout (compact/expanded)
- Manual refresh leaderboard button
- Disconnect/logout button

**2.6 Main Navigation Component**
- File: `src-player/src/components/HostTerminal/HostTerminalNav.tsx` (new)
- Bottom navigation or side tab bar for mobile
- Tabs: Leaderboard | Teams | Controls | Settings
- Responsive design (vertical for mobile, horizontal option for tablet)

---

### Phase 3: Network Communication

**3.1 Extend wsHost.ts (Host Side)**
- File: `src/network/wsHost.ts`
- Add new broadcast helpers:
  ```
  - sendControllerAuthSuccess(playerId)
  - sendControllerAuthFailed(playerId)
  - broadcastControllerCommand(command, data) - echo back to controller after action
  ```
- Add listener for incoming `ADMIN_COMMAND` messages from controller
- Handlers should validate commands and execute (e.g., modify scores, team names, etc.)

**3.2 Host Handler for Admin Commands**
- File: `src/components/QuizHost.tsx`
- New handler: `handleAdminCommand(command, data)`
- Routes to appropriate handler:
  - `'edit-team-name'` → calls `handleEditTeamName(teamId, newName)`
  - `'adjust-score'` → calls `handleScoreChange(teamId, points)`
  - `'approve-photo'` → processes team photo approval
  - `'decline-photo'` → processes team photo rejection
  - `'remove-team'` → removes team from quizzes array
  - `'next-question'` → advances flowState
  - `'reveal-answer'` → same as current Reveal button
  - `'skip-question'` → skips to next question
  - `'end-round'` → ends current round
  - Timer commands → calls appropriate timer handler
- Send `ADMIN_RESPONSE` back confirming success/failure

**3.3 Player App Message Handlers**
- File: `src-player/src/App.tsx`
- Add message handlers for:
  - `'CONTROLLER_AUTH_SUCCESS'`: Set `currentScreen: 'host-terminal'`, store controller session info
  - `'CONTROLLER_AUTH_FAILED'`: Show error, reset to team entry screen
  - `'ADMIN_RESPONSE'`: Process response from admin commands, show success/error toast
  - Continue receiving `LEADERBOARD_UPDATE`, `DISPLAY_MODE` messages for live data

**3.4 Controller Command Sender (Player App)**
- File: `src-player/src/components/HostTerminal/useHostTerminalAPI.ts` (new hook)
- Helper function: `sendAdminCommand(commandType, commandData)`
  - Validates command is from authorized controller
  - Sends over WebSocket: `{ type: 'ADMIN_COMMAND', commandType, commandData, timestamp }`
  - Handles errors and retries

---

### Phase 4: Integration with Existing Systems

**4.1 Leaderboard Broadcasting**
- Ensure `LEADERBOARD_UPDATE` messages are sent to all connected players (including controller)
- Controller receives live leaderboard updates in real-time

**4.2 Game Mode State Sync**
- When controller joins, send current game mode, current question, flow state
- Controller always has latest game state

**4.3 Timer Integration**
- Existing `useTimer` hook in host can be controlled remotely
- New timer commands: `'start-silent-timer'`, `'start-normal-timer'`, `'stop-timer'`, `'pause-timer'`

**4.4 Score Updates**
- When controller adjusts scores via `adjust-score` command:
  - Host calls existing `handleScoreChange(teamId, newPoints)`
  - Triggers sort and broadcast to all players
  - Controller receives confirmation in `ADMIN_RESPONSE`

---

## Key Implementation Notes

### Security Considerations
- PIN is temporary and stored in memory only (expires when Host Controller is disabled)
- Only one controller connection allowed per session (or allow multiple?)
- Controller cannot affect host app UI locally, only remote communication
- All admin commands validated on host side before execution

### Data Flow Examples

**Example 1: Controller Reveals Answer**
1. Host Terminal shows "Reveal Answer" button
2. User clicks button
3. HostTerminal sends: `{ type: 'ADMIN_COMMAND', commandType: 'reveal-answer', timestamp }`
4. QuizHost.handleAdminCommand() processes command
5. Calls existing reveal logic (sendRevealToPlayers, updateFlowState, etc.)
6. Sends back: `{ type: 'ADMIN_RESPONSE', commandType: 'reveal-answer', success: true }`
7. Host Terminal shows toast "Answer revealed"
8. All players receive `REVEAL` message automatically

**Example 2: Controller Adjusts Team Score**
1. Host Terminal shows team list with +/- buttons
2. User clicks "+10 points" on Team A
3. Sends: `{ type: 'ADMIN_COMMAND', commandType: 'adjust-score', teamId: 'team-1', points: 10 }`
4. QuizHost.handleAdminCommand() calls `handleScoreChange('team-1', currentScore + 10)`
5. Updates quizzes[] state, triggers re-sort
6. Broadcasts new leaderboard to all players
7. Sends `ADMIN_RESPONSE` to controller
8. Controller receives `LEADERBOARD_UPDATE` and displays new scores

### UI/UX Patterns
- Use toast notifications for admin action feedback
- Confirm before destructive actions (remove team, skip question)
- Show loading states while waiting for `ADMIN_RESPONSE`
- Use emoji/icons for quick visual recognition of actions
- Provide visual feedback when connected (green badge with PIN)
- Auto-reconnect if connection drops (existing behavior)

### Mobile Optimization
- Touch-friendly button sizes (min 44px)
- Vertical layout for phone screens
- Horizontal layout option for tablets
- Large, readable fonts for controlling from distance
- Minimized animations for quick response time
- Landscape orientation support

---

## Files to Create/Modify

### New Files to Create
- `src-player/src/components/HostTerminal/index.tsx`
- `src-player/src/components/HostTerminal/LeaderboardPanel.tsx`
- `src-player/src/components/HostTerminal/TeamManagementPanel.tsx`
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx`
- `src-player/src/components/HostTerminal/SettingsPanel.tsx`
- `src-player/src/components/HostTerminal/HostTerminalNav.tsx`
- `src-player/src/components/HostTerminal/useHostTerminalAPI.ts`
- `src/components/QuizHost/AdminCommandHandler.ts` (extracted admin command logic)

### Files to Modify
- `src/components/QuizHost.tsx` - PIN authentication, admin command routing
- `src/network/wsHost.ts` - new message type helpers, admin command listener
- `src-player/src/App.tsx` - controller auth handlers, new screen routing
- `src-player/src/types/network.ts` - new message types
- `src/components/BottomNavigation.tsx` - Host Controller button behavior update (show PIN in status)
- `src-player/src/hooks/useNetworkConnection.ts` - may need to handle special controller messages

---

## Implementation Order

1. **Foundation**: Network types & PIN validation system
2. **Auth Flow**: QuizHost PIN validation, send CONTROLLER_AUTH_SUCCESS
3. **Player App Route**: Add host-terminal screen, basic layout
4. **Leaderboard Panel**: Display teams, real-time updates
5. **Team Management**: Edit names, scores, photos, remove
6. **Game Controls**: Basic next/reveal/skip, then game-mode specific panels
7. **Timer Controls**: Integrate with existing timer system
8. **Integration & Polish**: Error handling, mobile optimization, testing

---

## Success Criteria
- [ ] Host can click "Host Controller" and see PIN
- [ ] Remote user joins player app with PIN as team name
- [ ] Host app recognizes PIN match and sends auth success
- [ ] Player app shows host terminal instead of game UI
- [ ] Controller can view live leaderboard
- [ ] Controller can edit team names and scores
- [ ] Controller can proceed to next question
- [ ] Controller can reveal answers
- [ ] Controller can manage team approvals and photos
- [ ] All game modes (KEYPAD, BUZZ-IN, NEAREST WINS, WHEEL SPIN) have controller support
- [ ] Timer can be started/stopped from controller
- [ ] Changes sync back to all players in real-time
- [ ] Host Controller button goes green only when PIN is active AND controller is authenticated
- [ ] Mobile UI is responsive and touch-friendly
