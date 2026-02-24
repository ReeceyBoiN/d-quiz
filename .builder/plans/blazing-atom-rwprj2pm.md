# Host Remote Action Parity Verification for On-The-Spot Keypad Mode

## Problem Statement
User wants to verify that all main actions available in the host app's on-the-spot keypad mode are properly accessible and functional from the host remote, with correct state-dependent behavior (button disabling/enabling during timer, etc.).

### User Priority Focus Areas:
1. **Question Type Selection** - Ensure remote can fully control on-the-spot type selection
2. **Answer Submission** - Verify host can enter expected answer via remote keypad
3. **Game Flow Actions** - Confirm reveal answer, show fastest, next question work from remote
4. **Timer Type Selection** - Ensure both normal (with audio) and silent timer options available on remote

## Current State Analysis

### Host App (KeypadInterface) - Main Actions
1. **Select Question Type** - Choose letters, numbers, multiple-choice, or sequence
   - Updates local state and broadcasts to players
   - Sets flowState from 'idle' → 'sent-question'

2. **Timer Controls**
   - Start Normal Timer (with countdown audio)
   - Start Silent Timer (no audio)
   - Auto-stops at zero, locks input, broadcasts time-up to players

3. **Answer Entry** (host can enter their own answer)
   - Letters: select letter button
   - Numbers: numeric keypad with CLR/backspace
   - Multiple-choice: A-F selection
   - Sequence: order items

4. **Reveal Actions**
   - Reveal Answer - shows correct answer, awards points, applies Evil Mode penalties
   - Reveal Fastest Team - shows fastest correct responder
   - Smart Reveal (space bar) - chains answer → fastest → next based on state

5. **Question Navigation** (for quiz pack)
   - Next Question - advances, resets state, prepares for next round
   - Previous Question - goes back, resets state

6. **Go Back** - return to question type selector

### Host Remote (GameControlsPanel + HostRemoteKeypad) - Available Actions

**GameControlsPanel Actions:**
- Start Normal Timer ✅
- Start Silent Timer ✅
- Stop Timer ✅
- Reveal Answer ✅ (disabled during timer)
- Show Fastest Team ✅
- Next Question ✅ (disabled during timer)
- Previous Question ✅ (disabled during timer, only if quiz loaded)
- Navigation buttons state-aware ✅

**HostRemoteKeypad Actions:**
- Select expected answer (mirrors host entry UI) ✅
- Submit answer via set-expected-answer command ✅
- Locked during timer and after submission ✅

**QuestionTypeSelector Actions:**
- Select question type (mirrors host selector UI) ✅
- Broadcasts to host via admin command ✅

## Verification Checklist

### 1. Action Parity Matrix
Need to verify each host action has corresponding remote capability:

| Host Action | Remote Command | UI Component | Status |
|-------------|----------------|--------------|--------|
| Select Question Type | select-question-type | QuestionTypeSelector | ✅ |
| Enter Answer (host) | set-expected-answer | HostRemoteKeypad | ✅ |
| Start Normal Timer | start-normal-timer | GameControlsPanel | ✅ |
| Start Silent Timer | start-silent-timer | GameControlsPanel | ✅ |
| Stop Timer | stop-timer | GameControlsPanel | ✅ |
| Reveal Answer | reveal-answer | GameControlsPanel | Need verify |
| Reveal Fastest | show-fastest | GameControlsPanel | Need verify |
| Next Question | next-question | GameControlsPanel | Need verify |
| Previous Question | previous-question-nav | GameControlsPanel | Need verify |

### 2. State-Dependent Button Behavior
Need to verify disabling/enabling logic:

| Button | Should Disable When | Host State | Remote State | Verified |
|--------|-------------------|-----------|-------------|----------|
| Reveal Answer | Timer running (flow='running') | ✅ | ✅ | ? |
| Next/Previous Nav | Timer running (flow='running') | ✅ | ✅ | ? |
| HostRemoteKeypad | Timer running or answer submitted | ✅ | ✅ | ? |
| Select Question Type | Should hide when flow!='idle' | ✅ | ✅ | ? |
| Timer Controls | Only in 'sent-question' state | ✅ | ✅ | ? |

### 3. Critical Verification Points

**Question Type Selection Flow:**
- Host selects type in KeypadInterface → onSelectQuestionType callback fires
- Handler updates flowState to 'sent-question' with selectedQuestionType
- FLOW_STATE broadcasts to remote via sendFlowStateToController
- Remote QuestionTypeSelector hides (flow no longer 'idle')
- Remote HostRemoteKeypad shows (flow='sent-question' and selectedQuestionType present)

**Timer & Reveal Flow:**
- Remote starts timer → sends start-normal-timer/start-silent-timer
- Host receives admin command and starts timer
- While timer running: all state-dependent buttons should be disabled
- Reveal Answer button specifically disabled when flow='running' on both host and remote
- Navigation buttons disabled when flow='running'

**Answer Submission:**
- Remote selects answer in HostRemoteKeypad
- Submits via set-expected-answer admin command
- Host receives command and stores as expected answer
- On reveal, host uses this as the correct answer for scoring

**Game Progression:**
- After reveal, show fastest
- After fastest shown, next question available
- Each state transition should sync flowState to remote

## Files to Verify

### Host App (src/)
1. `src/components/KeypadInterface.tsx` - Main host keypad UI
   - Lines ~1345-1357: onGetActionHandlers exposing actions
   - Lines ~692-816: handleStartTimer
   - Lines ~841-1001: handleSilentTimer
   - Lines ~1003-1132: handleRevealAnswer
   - Lines ~1134-1174: handleRevealFastestTeam
   - Lines ~1209-1316: handleNextQuestion / handlePreviousQuestion

2. `src/components/QuizHost.tsx` - Host state management
   - Lines ~3944-3971: sendFlowStateToController useEffect
   - Lines ~1935-1970: handleSelectQuestionType handler
   - Verify flowState transitions are broadcast correctly

### Host Remote (src-player/)
1. `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Remote button layout
   - Lines ~44-165: getButtonLayout() determining which buttons show
   - Lines ~212-239: executeCommand() mapping to admin commands
   - Lines ~281-339: Navigation button conditions
   - Lines ~494-531: Timer control section

2. `src-player/src/components/HostTerminal/HostRemoteKeypad.tsx` - Remote keypad input
   - Lines ~59-66: disabled state logic (during timer or after submission)
   - Lines ~79-83: handleSubmit sending set-expected-answer

3. `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx` - Remote type selection
   - Verify visibility and functionality

4. `src-player/src/components/HostTerminal/useHostTerminalAPI.ts` - Admin commands
   - Lines ~20-46: sendAdminCommand implementation
   - Lines ~84-94: Timer commands
   - Lines ~130-135: selectQuestionType
   - Lines ~137-139: setExpectedAnswer

## Implementation Strategy

### Phase 1: Deep Code Review
1. Verify each GameControlsPanel button has correct:
   - Visibility conditions (shows in right flowState)
   - Disabled state conditions (disabled during timer, after answer, etc.)
   - Admin command mapping (correct command sent to host)

2. Verify HostRemoteKeypad:
   - Disabled state when flowState.flow === 'running'
   - Disabled state when confirmedAnswer !== null
   - Sends correct set-expected-answer command

3. Verify QuestionTypeSelector:
   - Shows when flowState.flow === 'idle' and isQuestionMode
   - Hides when flowState transitions to 'sent-question'
   - Sends correct select-question-type command

### Phase 2: Admin Command Handler Verification
1. Check host-side admin command handlers process:
   - start-normal-timer / start-silent-timer (timer should start, lock input)
   - stop-timer (timer should stop)
   - reveal-answer (should trigger reveal logic)
   - show-fastest (should show fastest team)
   - next-question / previous-question-nav (should advance/go back)
   - set-expected-answer (should store expected answer for reveal)
   - select-question-type (should set flowState.selectedQuestionType)

2. Verify handlers:
   - Update flowState correctly
   - Trigger sendFlowStateToController to sync back to remote
   - Apply same logic as host keyboard/button handlers

### Phase 3: State Synchronization Verification
1. Test flowState transitions:
   - idle → sent-question (on question type select)
   - sent-question → running (on timer start)
   - running → timeup (on timer finish)
   - timeup → revealed (on reveal answer)
   - revealed → fastest (on show fastest)
   - fastest → idle (on next question)

2. Verify each transition broadcasts correctly:
   - Remote receives FLOW_STATE update
   - Remote UI components re-render with correct visibility
   - Remote buttons show/hide as expected
   - Remote keypad locks/unlocks correctly

## Key Risks & Edge Cases

1. **Timer Lock Consistency**: If timer running on host but remote doesn't know, buttons might be clickable on remote but not do anything on host
2. **Answer Submission Race Conditions**: If remote submits answer while host is processing reveal, state might get out of sync
3. **Question Type Not Broadcasted**: If host selects type but remote doesn't receive update, selector stays visible on remote
4. **Navigation While Timer**: Ensure prev/next buttons properly disabled during timer on both sides
5. **Fastest Team State**: Ensure show-fastest button only available after reveal, and next-question only available after fastest shown

## Testing Scenarios

1. **Complete On-The-Spot Round:**
   - Remote selects question type
   - Remote starts normal timer
   - Remote submits answer via keypad
   - Remote reveals answer
   - Remote reveals fastest team
   - Remote advances to next question
   - Remote repeats for next type

2. **Silent Timer Path:**
   - Remote selects type
   - Remote starts silent timer
   - Verify no audio on host (check Silent timer implementation)

3. **Stop/Resume Timer:**
   - Remote starts normal timer
   - Remote stops timer mid-countdown
   - Remote starts again
   - Verify timer resumes/resets correctly

4. **Back to Type Selection:**
   - During 'sent-question' state, can remote still see and use QuestionTypeSelector? (Should not)
   - After next question → idle, QuestionTypeSelector should reappear

5. **Navigation During Quiz Pack:**
   - Remote loads quiz pack
   - Remote uses prev/next navigation
   - Verify questions advance correctly on host

## Success Criteria

- ✅ All main host app actions have corresponding remote capability
- ✅ All state-dependent button disabling works correctly (disabled during timer, etc.)
- ✅ All buttons show/hide based on correct flowState conditions
- ✅ Admin commands are sent with correct parameters
- ✅ Host processes admin commands and updates flowState
- ✅ flowState broadcasts sync remote UI
- ✅ Complete game round can be played entirely from remote
- ✅ No buttons clickable when they shouldn't be (during timer, etc.)
- ✅ All visual feedback matches between host and remote
