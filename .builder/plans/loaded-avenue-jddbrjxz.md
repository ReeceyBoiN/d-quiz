# Single Dynamic Button for Host Terminal Remote Control

## User Request
Replace the multiple action buttons (Next Question, Reveal Answer, Skip, End Round, Start Timer) in the remote host terminal with a single primary button that:
- Changes its label dynamically based on the current game flow state
- Shows what action will be triggered next (matches the spacebar behavior in main host app)
- Provides a simpler, more intuitive remote control experience

## Current State
- **Main host app**: Already has excellent flow progression via `handlePrimaryAction` and spacebar support - NO CHANGES NEEDED
- **Remote host terminal** (src-player/src/components/HostTerminal/GameControlsPanel.tsx):
  - Shows multiple individual buttons (Next Question, Reveal Answer, Skip, End Round, Start Timer, etc.)
  - Button handlers currently just console.log
  - Has access to `useHostTerminalAPI` hook but handlers aren't wired up

## Solution Overview

### 1. Get Current Flow State in Remote Terminal
The GameControlsPanel needs to receive/subscribe to the current `flowState` from the host. Since this is running on a player device via WebSocket connection, options are:
- **Option A** (Recommended): Include `flowState` in existing WebSocket status messages
- **Option B**: Add a new network message type specifically for flow state updates
- **Option C**: Derive flow state on the player side based on game events received

**Recommendation**: Use Option A - piggyback on existing connection messages to sync `flowState`. This minimizes changes and reuses established communication patterns.

### 2. Map Flow State to Button Label & Action
Create a helper function in GameControlsPanel (or reuse logic from QuestionNavigationBar) that maps `flowState.flow` to:
- **Button text**: The label to show (e.g., "Start Timer", "Reveal Answer", "Next Question", etc.)
- **Admin command**: The command to send via `useHostTerminalAPI` (e.g., 'start-timer', 'reveal-answer', 'next-question', etc.)

Flow state mapping:
```
'ready' -> "Send Question" -> command: 'send-question'
'sent-picture' -> "Send Question" -> command: 'send-question'
'sent-question' -> "Start Timer" -> command: 'start-timer'
'running'/'timeup' -> "Reveal Answer" -> command: 'reveal-answer'
'revealed' -> "Fastest Team" -> command: 'show-fastest'
'fastest' -> "Next Question" / "End Round" -> command: 'next-question' or 'end-round'
'idle' -> "Start Quiz" -> command: null (disabled)
```

### 3. Refactor GameControlsPanel UI
Replace individual action buttons with:
- **Single primary action button** (large, prominent) with dynamic label
- **Button click handler**: Uses `useHostTerminalAPI` to send the mapped command to host
- **Disabled state**: Button is disabled when no question is active (`flowState.flow === 'idle'`)
- Keep timer controls separate (they're utility controls, not flow progression)

### 4. Wire Admin Command Handlers on Host (QuizHost.tsx)
Ensure the host can receive and process admin commands from the remote terminal:
- Listen for admin commands: 'send-question', 'start-timer', 'reveal-answer', 'show-fastest', 'next-question', 'end-round'
- Map each command to the corresponding handler (these already exist):
  - 'send-question' -> `handleSendQuestion()` or `handlePrimaryAction()`
  - 'start-timer' -> `handleNavBarStartTimer()`
  - 'reveal-answer' -> `handleReveal()`
  - 'show-fastest' -> `handleShowFastestTeam()`
  - 'next-question' -> `handleNextQuestion()`
  - 'end-round' -> `handleEndRound()`

This might already be partially implemented in `onAdminCommand` listener.

## Files to Modify

### 1. **src-player/src/components/HostTerminal/GameControlsPanel.tsx** (Primary Change)
- Import `flowState` from props or create a state from incoming messages
- Create helper function `getNextActionButton(flowState)` that returns `{ label, commandType, disabled }`
- Replace individual action buttons with a single primary button
- Wire button click to `sendAdminCommand(commandType)` via `useHostTerminalAPI`
- Update JSX to show only the primary button instead of multiple buttons

### 2. **src/network/wsHost.ts** (Possibly Already Done)
- Verify that `onAdminCommand` listener already handles the required admin command types
- If missing, add handlers for any commands not yet implemented
- Ensure commands properly map to QuizHost functions

### 3. **src/components/QuizHost.tsx** (Verify Integration)
- Check that `onAdminCommand` is properly registered and listening
- Verify all admin command handlers route to the correct functions
- May already be implemented - just needs verification

### 4. **src-player/src/App.tsx or Connection Handler** (For Flow State Sync)
- Add `flowState` to network messages sent from host to player
- Include in periodic status updates or game state broadcasts
- Ensure player app receives and stores current flow state

## Implementation Steps

1. **Step 1**: Read src-player/src/components/HostTerminal/GameControlsPanel.tsx to understand current structure
2. **Step 2**: Create helper function to map flow state to button label and command
3. **Step 3**: Refactor GameControlsPanel to show single dynamic button
4. **Step 4**: Update wsHost.ts to ensure all admin commands are handled
5. **Step 5**: Add flow state sync to network messages (App.tsx or wsHost.ts)
6. **Step 6**: Test full flow - verify button label changes with game progression and commands execute properly

## Key Design Decisions

- **Single button UX**: More intuitive - user always knows what happens next
- **Reuse existing logic**: Leverage `getFlowButton` pattern from QuestionNavigationBar
- **Admin commands**: Use existing `useHostTerminalAPI` infrastructure
- **No changes to main app**: Keep PrimaryControls and QuestionNavigationBar as-is
- **Backward compatible**: Timer controls remain separate, not affected by this refactor

## Success Criteria

- Single dynamic button visible in GameControlsPanel (instead of multiple buttons)
- Button label changes correctly as game progresses (ready → sent-question → running → revealed → fastest → next)
- Button click sends appropriate admin command to host
- Host receives command and progresses game state correctly
- Button is disabled when no active question (`flow === 'idle'`)
- No console errors or broken functionality
