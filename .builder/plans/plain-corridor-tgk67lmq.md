# Comprehensive Host Remote Button Synchronization Plan

## Problem Statement
The host remote app needs to have perfect synchronization with the host app such that:
1. **Button visibility**: Remote shows exactly the right buttons at each game state, for all game modes
2. **Button functionality**: Clicking a remote button executes the EXACT same code as clicking the corresponding button on the host app
3. **Behavioral consistency**: No discrepancies between admin command execution and UI button execution
4. **Command completeness**: All buttons/commands that exist on host UI are supported on remote (and vice versa)

## Current Issues Found

### Critical Issues (Block Functionality)
1. **Timer pause/resume unimplemented** - Commands exist but are stubs ("Would need timer pause functionality")
2. **Missing question-type navigation** - Commands 'previous-type' and 'next-type' sent by controller but not handled by host
3. **Command name inconsistency** - Mix of lowercase (approve-photo) and UPPERCASE (APPROVE_TEAM_PHOTO) variants

### Important Issues (Behavioral Divergence)
1. **Score adjustment**: Admin commands bypass scoresPaused and team.blocked checks that UI respects
2. **Name validation**: Admin commands enforce 1-50 char limit and PIN-avoidance that UI doesn't

### Flow State / Button Visibility (Needs Verification)
1. **Quiz pack mode**: Need to verify button flow matches expected state machine
2. **On-the-spot mode**: Need to verify question selector, answer keypad, and button flow
3. **Other game modes**: Keypad interface, nearest-wins, buzz-in, wheel spinner - verify remote can control all of them

## Solution Architecture

### Phase 1: Map All Game Modes and States
**Goal**: Create authoritative documentation of which buttons should appear when

**Tasks**:
1. Document all game modes:
   - Quiz pack mode (question-driven)
   - On-the-spot mode (real-time question selection)
   - Keypad Interface
   - Nearest Wins Interface
   - Buzz In Interface
   - Wheel Spinner Interface

2. For each mode, map flow states to visible buttons:
   - Quiz pack: idle → ready → sent-picture → sent-question → running → timeup → revealed → fastest → complete
   - On-the-spot: idle → (question-type-select) → ready → sent-question → running → timeup → revealed → (back to idle for next round)
   - Other modes: (specify state machines for each)

3. For each button/state combination:
   - Button label/action on host UI
   - Button label/action on remote UI
   - Expected admin command sent
   - Expected handler function called
   - Expected flow state change

4. Create a verification matrix (CSV/JSON) with format:
   ```
   mode | flowState | buttonLabel | commandType | handlerFunction | expectedFlowTransition | isImplemented(host) | isImplemented(remote)
   ```

**Key Files to Review**:
- src/components/QuestionNavigationBar.tsx - host UI button visibility for quiz pack
- src/components/PrimaryControls.tsx - host UI button visibility for quiz pack
- src-player/src/components/HostTerminal/GameControlsPanel.tsx - remote button visibility (getButtonLayout function)
- src/components/KeypadInterface.tsx - keypad game mode
- src/components/NearestWinsInterface.tsx - nearest wins mode
- src/components/BuzzInInterface.tsx - buzz-in mode
- src/components/WheelSpinnerInterface.tsx - wheel spinner mode

### Phase 2: Standardize Command Names
**Goal**: Single authoritative command name for each action across host and remote

**Tasks**:
1. Create canonical command name list for all admin commands:
   - Identify duplicate/variant names (e.g., 'approve-photo' vs 'APPROVE_TEAM_PHOTO')
   - Choose single canonical name for each (recommend lowercase with hyphens for consistency)
   
2. Update host command handler:
   - Map all variant names to canonical name in switch statement
   - OR refactor switch to handle variants gracefully
   
3. Update remote command sender:
   - Ensure useHostTerminalAPI sends only canonical names
   - Check TeamManagementPanel and other remote UI panels for hardcoded command names
   - Update all command emissions to use canonical names

4. List of commands to standardize:
   ```
   Current → Canonical
   approve-photo, APPROVE_TEAM_PHOTO → approve-photo
   decline-photo, DECLINE_TEAM_PHOTO → decline-photo
   remove-team, REMOVE_TEAM → remove-team
   edit-team-name, UPDATE_TEAM_NAME → edit-team-name
   adjust-score, ADJUST_TEAM_SCORE → adjust-score
   ```

**Key Files to Update**:
- src/components/QuizHost.tsx - handleAdminCommand switch (create alias handling)
- src-player/src/components/HostTerminal/useHostTerminalAPI.ts - all sendAdminCommand calls
- src-player/src/components/HostTerminal/TeamManagementPanel.tsx - command names
- src-player/src/components/HostTerminal/GameControlsPanel.tsx - command names
- src-player/src/components/HostTerminal/AnswerInputKeypad.tsx - command names

### Phase 3: Implement Missing Features
**Goal**: Make pause/resume and question-type navigation work

#### 3.1: Implement Timer Pause/Resume
1. Extend unifiedTimerHandlers.ts with new functions:
   - `executePauseTimer(displayCallback)` - pauses local timer, broadcasts pause to players/display
   - `executeResumeTimer(displayCallback)` - resumes local timer, broadcasts resume to players/display

2. Update host timer management:
   - useTimer hook needs pauseTimer() and resumeTimer() methods
   - Paused state needs to be added to flow state or timer context
   - Update display pause state via sendToExternalDisplay

3. Update admin command handler:
   - 'pause-timer' case calls executeResult of executeResumeTimer
   - 'resume-timer' case calls executeResumeTimer

4. Update remote UI:
   - Ensure GameControlsPanel shows pause/resume buttons when appropriate
   - Update useHostTerminalAPI if methods don't exist

**Key Files**:
- src/utils/unifiedTimerHandlers.ts - add executePauseTimer, executeResumeTimer
- src/hooks/useTimer.ts - add pause/resume methods
- src/components/QuizHost.tsx - add pause/resume command cases
- src-player/src/components/HostTerminal/GameControlsPanel.tsx - add pause/resume buttons to timer-running state

#### 3.2: Implement Question-Type Navigation (On-the-spot mode)
1. Review on-the-spot question type cycling logic:
   - Current flow: idle → show question-type-selector → select type → sent-question
   - Need: previous-type and next-type commands to cycle through question types

2. Add cases to admin command handler:
   - 'previous-type': cycle to previous question type in list
   - 'next-type': cycle to next question type in list
   - Both should update flowState.selectedQuestionType

3. Ensure question type selector UI shows these commands

**Key Files**:
- src/components/QuizHost.tsx - add previous-type and next-type cases
- src/components/GlobalGameModeSelector.tsx or on-the-spot mode handler - type cycling logic
- src-player/src/components/HostTerminal/QuestionTypeSelector.tsx - verify buttons exist

### Phase 4: Harmonize Safety Checks
**Goal**: Admin commands respect same constraints as UI

**Tasks**:
1. Score adjustment alignment:
   - Issue: Admin adjust-score bypass scoresPaused and team.blocked checks
   - Solution: Make admin handler call same validateScoreChange logic as UI
   - OR: Create unified scoreChangeValidator function used by both paths

2. Name change alignment:
   - Issue: UI allows longer/invalid names; admin enforces 1-50 and PIN-check
   - Solution: Make UI use same validation as admin (apply 1-50 char and PIN-check consistently)
   
3. Approach:
   - Create centralized validation utilities in src/utils/:
     - validateTeamNameChange(newName, hostControllerEnabled, controllerPin) → {valid, error}
     - validateScoreAdjustment(teamId, pointsDelta, scoresPaused, team) → {valid, adjustedValue}
   - Use from both admin handler and UI handlers

**Key Files to Create**:
- src/utils/gameValidators.ts - centralized validation

**Key Files to Update**:
- src/components/QuizHost.tsx - admin score and name cases use validators
- src/components/RightPanel.tsx or score panel - UI score change handler uses validators
- src-player/src/components/HostTerminal/TeamManagementPanel.tsx - remote name change uses validators

### Phase 5: Verify Button Visibility Sync Across Game Modes
**Goal**: Remote displays correct buttons for every game mode at every state

**Tasks**:
1. **Quiz Pack Mode**:
   - ready → [Send Picture/Send Question, Hide Question]
   - sent-picture → [Send Question, Hide Question]
   - sent-question → [Start Timer, Silent Timer] (+ nav arrows if allowed)
   - running/timeup → [Reveal Answer]
   - revealed → [Show Fastest / Next Question]
   - fastest → [Next Question / End Round]
   
   Verify: GameControlsPanel.getButtonLayout covers all these cases

2. **On-the-Spot Mode**:
   - idle, not-in-question → [Ready to Start / disabled]
   - idle, in-question → [Question Type Selector] (letters, numbers, multiple-choice buttons)
   - (question-type selected) → [Start Timer, Silent Timer]
   - running → [Reveal Answer]
   - revealed → [Show Fastest / Next]
   
   Verify: HostTerminal shows QuestionTypeSelector, Answer Keypad at right times

3. **Keypad Interface**:
   - Show option selection buttons
   - Verify remote can see team answers, submissions
   - Check if remote can control timer/reveal while in keypad mode

4. **Nearest Wins**:
   - Show score adjustments
   - Verify timer and reveal buttons

5. **Buzz In**:
   - Show buzz-in status and response buttons
   - Verify remote buzzer controls

6. **Wheel Spinner**:
   - Show wheel and controls

   Implementation:
   - Audit GameControlsPanel.getButtonLayout and HostTerminal conditional rendering
   - Ensure flowState fields transmitted to remote include all needed state
   - Check if on-the-spot game mode info is broadcast correctly
   - Update GameControlsPanel if it doesn't handle all modes/states

**Key Files**:
- src-player/src/components/HostTerminal/index.tsx - conditional panel rendering
- src-player/src/components/HostTerminal/GameControlsPanel.tsx - getButtonLayout function
- src/components/QuizHost.tsx - ensure all flow state fields broadcast via sendFlowStateToController

### Phase 6: Create Testing Strategy
**Goal**: Prevent regression of button sync issues

**Tasks**:
1. Create admin-command-to-ui-button mapping test:
   - For each game mode and flow state:
     - Verify UI button exists and works
     - Verify corresponding admin command handler exists
     - Verify both call the same underlying handler function
   
2. Create flow-state-to-button-visibility test:
   - For each flow state:
     - Check host shows expected buttons
     - Simulate FLOW_STATE message to remote
     - Check remote shows same buttons
   
3. Create end-to-end test:
   - Click button on remote
   - Verify ADMIN_COMMAND sent with correct command type
   - Verify host executes correct handler
   - Verify game state changes as expected
   - Verify FLOW_STATE broadcast back to remote
   - Verify remote UI updates correctly

4. Create regression test suite:
   - Test that pause/resume works in all flow states
   - Test question-type cycling in on-the-spot
   - Test score adjustments with and without scoresPaused
   - Test name changes with validation

**Files to Create**:
- __tests__/adminCommandMapping.test.ts - maps commands to handlers
- __tests__/buttonVisibility.test.ts - verifies button state machine
- __tests__/endToEndRemote.test.ts - full integration test

## Implementation Order

1. **Phase 1 (Documentation)** - Create mapping matrix and verification checklist
2. **Phase 2 (Standardization)** - Fix command name inconsistencies
3. **Phase 3 (Missing Features)** - Implement pause/resume and question-type navigation
4. **Phase 4 (Safety Checks)** - Harmonize validation between admin and UI paths
5. **Phase 5 (Verification)** - Audit button visibility for all game modes
6. **Phase 6 (Testing)** - Add comprehensive test coverage

## Success Criteria

✅ Remote buttons visible at same times as host UI buttons for all game modes
✅ Clicking remote button executes identical code to clicking host UI button
✅ Timer pause/resume works from both UI and remote
✅ Question-type navigation works in on-the-spot mode
✅ All command names standardized (no duplicate variants)
✅ Safety checks (scoresPaused, team.blocked, name validation) applied consistently
✅ All game modes (quiz pack, on-the-spot, keypad, nearest-wins, buzz-in, wheel) supported
✅ Admin command responses sent back to controller confirming execution
✅ Comprehensive test coverage for button sync issues

## Critical Files Summary

**Host-side**:
- src/components/QuizHost.tsx - main handler and command routing
- src/components/QuestionNavigationBar.tsx - host UI button visibility
- src/components/PrimaryControls.tsx - host UI button visibility
- src/utils/unifiedTimerHandlers.ts - canonical timer handlers
- src/network/wsHost.ts - flow state broadcasting

**Remote-side**:
- src-player/src/components/HostTerminal/GameControlsPanel.tsx - button layout mapping (getButtonLayout)
- src-player/src/components/HostTerminal/useHostTerminalAPI.ts - command sending
- src-player/src/components/HostTerminal/index.tsx - panel routing
- src-player/src/App.tsx - flow state reception

**New files to create**:
- src/utils/gameValidators.ts - centralized validation
- __tests__/adminCommandMapping.test.ts
- __tests__/buttonVisibility.test.ts
- __tests__/endToEndRemote.test.ts
