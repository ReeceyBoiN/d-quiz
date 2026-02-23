# Comprehensive Host Remote and Host App Audit Plan

## Executive Summary
This plan outlines a systematic audit of the quiz hosting application's remote controller integration, timer systems, main menu flow, quiz pack mode, and on-the-spot keypad mode. The audit will verify that remote commands correctly trigger the same behaviors as UI interactions.

## 1. Host Remote & Admin Command Communication System

### 1.1 Remote Controller Architecture
**Files to Review:**
- `src-player/src/components/HostTerminal/index.tsx` - Main remote controller UI
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Primary game control buttons
- `src-player/src/components/HostTerminal/TeamManagementPanel.tsx` - Team operations
- `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx` - On-the-spot mode type selection
- `src-player/src/components/HostTerminal/AnswerInputKeypad.tsx` - Expected answer input
- `src-player/src/components/HostTerminal/useHostTerminalAPI.ts` - Command sending API
- `src-player/src/types/network.ts` - AdminCommandMessage type definitions

**Audit Checklist:**
- [ ] Verify HostTerminal displays all available commands (send-question, send-picture, hide-question, next-question, previous-question, reveal-answer, show-fastest, skip-question, end-round)
- [ ] Verify timer commands are properly wired (start-normal-timer, start-silent-timer, stop-timer, pause-timer, resume-timer)
- [ ] Verify team management commands work (edit-team-name, adjust-score, approve-photo, decline-photo, remove-team)
- [ ] Verify on-the-spot commands are available when needed (select-question-type, set-expected-answer)
- [ ] Check that command payloads are correctly formed in useHostTerminalAPI
- [ ] Verify AdminCommandMessage structure matches network.ts definitions
- [ ] Check that commandData includes required parameters for each command type
- [ ] Verify error handling when commands fail (check for ADMIN_RESPONSE message handling)

### 1.2 Communication Pipeline
**Files to Review:**
- `electron/backend/server.js` - WebSocket server that routes admin commands
- `src/network/wsHost.ts` - Host-side listener registration and response sending
- `src/components/QuizHost.tsx` - Admin command handler and execution (lines 3247+)

**Audit Checklist:**
- [ ] Verify backend server correctly routes ADMIN_COMMAND from controller to host app
- [ ] Verify backend handles GET_CONNECTED_TEAMS special command correctly
- [ ] Verify host app registers admin listener exactly once on mount (empty dependency array)
- [ ] Verify authentication check: deviceId matches authenticatedControllerId (with trim)
- [ ] Verify commandType validation (must be non-empty string)
- [ ] Verify ADMIN_RESPONSE is sent back to controller after each command
- [ ] Verify response includes: commandType, success boolean, message, data
- [ ] Check IPC fallback path: Electron IPC → HTTP API → local broadcast
- [ ] Verify command delivery works in both Electron and browser contexts

### 1.3 Authentication Flow
**Files to Review:**
- `src/components/QuizHost.tsx` - PLAYER_JOIN handling and authentication
- `src/components/TopNavigation.tsx` - Host controller code input UI

**Audit Checklist:**
- [ ] Verify controller PIN validation when client sends PLAYER_JOIN with teamName = PIN
- [ ] Verify CONTROLLER_AUTH_SUCCESS is sent to authenticated device
- [ ] Verify authenticatedControllerId is stored and persists for session
- [ ] Verify subsequent commands are rejected if deviceId doesn't match authenticatedControllerId
- [ ] Verify PIN cannot be changed to another team's name (security check in edit-team-name)
- [ ] Test: Enter PIN → device should authenticate → HostTerminal should appear
- [ ] Test: Try sending command from different device → should be rejected with "Not authenticated" message

---

## 2. Main Menu Screen and Game Mode Transitions

### 2.1 Main Menu UI and State Management
**Files to Review:**
- `src/components/QuizHost.tsx` - Main component with activeTab and game mode state
- `src/components/QuestionDisplay.tsx` - Main menu/home view content
- `src/components/QuizPackDisplay.tsx` - Quiz pack configuration screen

**Audit Checklist:**
- [ ] Verify default state shows "home" tab (main menu) when no quiz is loaded
- [ ] Verify QuestionDisplay is rendered when activeTab === "home" and no game modes active
- [ ] Check state variables controlling mode transitions:
  - [ ] `activeTab` - controls which tab is shown (home/teams/leaderboard/handset)
  - [ ] `showKeypadInterface` - boolean controlling on-the-spot keypad mount
  - [ ] `showQuizPackDisplay` - boolean controlling quiz pack UI mount
  - [ ] `isQuizPackMode` - boolean tracking if loaded quiz is quiz pack
  - [ ] `flowState.isQuestionMode` - boolean tracking if in active question state
  - [ ] `flowState.flow` - state machine value (idle/ready/sent-question/running/timeup/revealed/fastest/complete)
- [ ] Verify closeAllGameModes() properly resets all flags when transitioning between game types
- [ ] Verify quiz selection properly sets isQuizPackMode based on currentQuiz.isQuizPack
- [ ] Test: Load quiz pack → verify showQuizPackDisplay=true, isQuizPackMode=true
- [ ] Test: Load on-the-spot quiz → verify showKeypadInterface=true, isQuizPackMode=false
- [ ] Test: Close game → verify flags reset, returns to home menu

### 2.2 Remote Control Impact on Main Menu
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin command handler switch cases
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Which buttons show in which states

**Audit Checklist:**
- [ ] Verify remote commands cannot start game if no quiz is loaded
- [ ] Verify remote commands are disabled/hidden in HostTerminal when in main menu state
- [ ] Verify 'next-question' command in on-the-spot mode properly increments question counter
- [ ] Verify 'previous-question' command only works in quiz pack mode
- [ ] Test: Send 'send-question' from main menu (idle state) → should not crash, should be rejected
- [ ] Test: Load quiz, send 'send-question' → should advance to sent-question state
- [ ] Verify flowState is properly updated via admin commands and synced back to controller via sendFlowStateToController()

---

## 3. Timer System and Remote Timer Interactions

### 3.1 Timer Duration Configuration
**Files to Review:**
- `src/utils/SettingsContext.tsx` - Timer settings storage (gameModeTimers, nearestWinsTimer)
- `src/state/flowState.ts` - getTotalTimeForQuestion() function
- `src/components/Settings.tsx` - Settings UI for timer configuration

**Audit Checklist:**
- [ ] Verify Settings UI allows users to configure timer durations per game mode:
  - [ ] Keypad timer setting
  - [ ] Buzz-in timer setting
  - [ ] Nearest wins timer setting
- [ ] Verify getTotalTimeForQuestion() correctly maps question type to timer setting:
  - [ ] 'letters', 'multi', 'sequence' → gameModeTimers.keypad
  - [ ] 'buzzin' → gameModeTimers.buzzin
  - [ ] 'numbers', 'nearest' → gameModeTimers.nearestwins
- [ ] Verify Settings changes persist to localStorage
- [ ] Verify Settings changes immediately take effect (no restart needed)
- [ ] Test: Change keypad timer to 15s in Settings → Load quiz → flowState.totalTime should be 15 for keypad questions

### 3.2 UI Button Timer Triggers
**Files to Review:**
- `src/components/QuestionNavigationBar.tsx` - Timer button UI (Start Timer, Silent Timer buttons)
- `src/components/QuizHost.tsx` - handleNavBarStartTimer() and handleNavBarSilentTimer() functions (lines 2476-2545)

**Audit Checklist:**
- [ ] Verify timer buttons only appear when flowState.flow === 'sent-question'
- [ ] Verify timer buttons are disabled if timer is already running
- [ ] Verify Start Timer button triggers handleNavBarStartTimer() with no parameters (uses flowState.totalTime)
- [ ] Verify Silent Timer button triggers handleNavBarSilentTimer() with no parameters
- [ ] Verify both handlers call unified timer executors: executeStartNormalTimer() and executeStartSilentTimer()
- [ ] Check that handlers pass correct duration to unified executors
- [ ] Test: UI Start Timer button → timer should play audio for flowState.totalTime seconds
- [ ] Test: Change Settings timer duration → UI Start Timer should use new duration

### 3.3 Remote Timer Command Triggers
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'start-normal-timer' and 'start-silent-timer' cases (lines 3434-3491)
- `src/utils/unifiedTimerHandlers.ts` - executeStartNormalTimer() and executeStartSilentTimer()

**Audit Checklist:**
- [ ] Verify admin handler uses flowState.totalTime (Settings-based) instead of hardcoded values
- [ ] Verify both 'start-normal-timer' and 'start-silent-timer' commands determine duration correctly:
  - [ ] If commandData.seconds provided, validate and use it
  - [ ] Otherwise, use flowState.totalTime (which was set by getTotalTimeForQuestion)
- [ ] Verify handlers pass explicit timerDuration to handler functions
- [ ] Check that both paths (UI button and remote command) call same unified executors
- [ ] Verify logging shows determined duration and game mode context
- [ ] Test: Load quiz pack with keypad question → Remote start-normal-timer → should use keypad timer duration
- [ ] Test: Change Settings timer to 20s → Remote start-normal-timer → should use 20s
- [ ] Test: UI button vs remote command → both should use same duration

### 3.4 Unified Timer Handlers and Audio Playback
**Files to Review:**
- `src/utils/unifiedTimerHandlers.ts` - executeStartNormalTimer() and executeStartSilentTimer()
- `src/utils/countdownAudio.ts` - playCountdownAudio() function

**Audit Checklist:**
- [ ] Verify executeStartNormalTimer() does:
  - [ ] Play countdown audio (normal mode, not silent)
  - [ ] Send timerDuration to players via sendTimerToPlayers()
  - [ ] Notify external display with duration
  - [ ] Return flowStateUpdate { flow: 'running', answerSubmitted: 'normal' }
- [ ] Verify executeStartSilentTimer() does:
  - [ ] Play countdown audio (silent mode)
  - [ ] Send timerDuration to players
  - [ ] Notify external display
  - [ ] Return flowStateUpdate { flow: 'running', answerSubmitted: 'silent' }
- [ ] Verify playCountdownAudio() correctly:
  - [ ] Loads audio file (Countdown.wav for normal, Countdown Silent.wav for silent)
  - [ ] Waits for loadedmetadata before calculating start time
  - [ ] Calculates startTime = audioDuration - (timerDuration + 1)
  - [ ] Plays last (timerDuration + 1) seconds of audio file
  - [ ] Handles both Electron file:// URLs and relative paths
- [ ] Verify stopCountdownAudio() properly stops and resets audio
- [ ] Test: Start normal timer for 10s → audio should play for ~11 seconds
- [ ] Test: Start silent timer for 10s → audio should play without sound for ~11 seconds
- [ ] Test: Start timer with 30s duration → should work (edge case)

### 3.5 Timer State Updates in QuizHost
**Files to Review:**
- `src/components/QuizHost.tsx` - handleNavBarStartTimer/handleNavBarSilentTimer response handling (lines 2476-2545)
- `src/hooks/useTimer.ts` - Local timer countdown logic

**Audit Checklist:**
- [ ] Verify unified handler promise resolves with timerStartTime and flowStateUpdate
- [ ] Verify handleNavBarStartTimer() merges result.flowStateUpdate into flowState:
  - [ ] Sets flow: 'running'
  - [ ] Sets answerSubmitted: 'normal'
  - [ ] Preserves other flowState properties
- [ ] Verify handleNavBarSilentTimer() merges with answerSubmitted: 'silent'
- [ ] Verify gameTimerStartTime is captured from result.timerStartTime
- [ ] Verify this triggers useEffect that calls timer.start(flowState.totalTime, isSilent)
- [ ] Verify timer updates flowState.timeRemaining on each tick
- [ ] Verify timer calls onEnd when duration expires, which:
  - [ ] Sets flowState.flow = 'timeup'
  - [ ] Sets flowState.timeRemaining = 0
  - [ ] Calls sendTimeUpToPlayers()
  - [ ] Triggers handleTimeUp() logic

### 3.6 On-the-Spot Keypad Timer Handling
**Files to Review:**
- `src/components/KeypadInterface.tsx` - handleStartTimer() and handleSilentTimer() (lines 687-994)
- `src/components/QuizHost.tsx` - gameActionHandlers setup (lines 2479-2525)

**Audit Checklist:**
- [ ] Verify KeypadInterface.handleStartTimer():
  - [ ] Gets timerLength from gameModeTimers.keypad
  - [ ] Captures timerStartTime = Date.now()
  - [ ] Plays countdown audio (normal, not silent)
  - [ ] Starts interval that decrements countdown every 100ms
  - [ ] Sends timer updates to external display
  - [ ] On finish: stops audio, locks timer, calls sendTimeUpToPlayers()
- [ ] Verify KeypadInterface.handleSilentTimer() is similar but with silent audio
- [ ] Verify gameActionHandlers is populated by KeypadInterface via onGetActionHandlers
- [ ] Verify when remote command comes for on-the-spot: delegates to gameActionHandlers.startTimer()
- [ ] Verify both UI button and remote trigger use same handleStartTimer() function
- [ ] Test: On-the-spot keypad mode → UI Start Timer → verify local countdown works
- [ ] Test: On-the-spot keypad mode → Remote start-normal-timer → verify delegates to KeypadInterface handler

### 3.7 Pause/Resume Timer Status
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'pause-timer' and 'resume-timer' cases (lines 3477-3488)

**Audit Checklist:**
- [ ] Verify pause-timer and resume-timer admin commands exist
- [ ] Check if functionality is implemented or stubbed (appears to be stubbed, marked "Would need timer pause functionality")
- [ ] If stubbed: Document that pause/resume not yet implemented
- [ ] If implemented: Verify they work correctly:
  - [ ] Pauses countdown without losing time state
  - [ ] Resumes from exact pause point
  - [ ] Notifies players of pause state
  - [ ] Works for both UI and remote triggers

---

## 4. Quiz Pack Mode and Remote Integration

### 4.1 Quiz Pack Initialization
**Files to Review:**
- `src/components/QuizHost.tsx` - currentQuiz useEffect and loadedQuizQuestions setup (lines 854-887)
- `src/components/QuizPackDisplay.tsx` - Quiz pack config screen

**Audit Checklist:**
- [ ] Verify quiz pack is detected correctly: currentQuiz.isQuizPack boolean
- [ ] Verify loadedQuizQuestions array is populated with all questions
- [ ] Verify currentLoadedQuestionIndex starts at 0
- [ ] Verify showQuizPackDisplay is set true, showKeypadInterface is set false
- [ ] Verify hideQuestionMode is reset to false
- [ ] Verify QuizPackDisplay component shows config UI when isQuestionMode=false
- [ ] Test: Load quiz pack → Verify correct UI appears, question count shows

### 4.2 First Question Initialization
**Files to Review:**
- `src/components/QuizHost.tsx` - FIRST_QUESTION_INIT effect (lines 973-992)
- `src/state/flowState.ts` - getTotalTimeForQuestion() function

**Audit Checklist:**
- [ ] Verify when showQuizPackDisplay=true and flowState.flow='idle':
  - [ ] First question is loaded from loadedQuizQuestions[0]
  - [ ] getTotalTimeForQuestion() is called with question and gameModeTimers
  - [ ] flowState is set to { flow: 'ready', totalTime, timeRemaining: totalTime, currentQuestion, ... }
  - [ ] timer is reset to new totalTime
- [ ] Verify flowState.totalTime matches the question's type-specific setting
- [ ] Test: Load quiz pack with mixed question types → First question timer should match its type

### 4.3 Question Index Changes and Timer Recalculation
**Files to Review:**
- `src/components/QuizHost.tsx` - currentLoadedQuestionIndex useEffect (lines 910-938)

**Audit Checklist:**
- [ ] Verify when currentLoadedQuestionIndex changes:
  - [ ] New question is loaded from loadedQuizQuestions[newIndex]
  - [ ] getTotalTimeForQuestion() is called with new question
  - [ ] flowState is reset to { flow: 'ready', totalTime: recalculatedTime, ... }
  - [ ] All previous answers/response times are cleared
  - [ ] timer is reset to new duration
- [ ] Verify this happens automatically when index changes, before any remote command can use it
- [ ] Test: Navigate through quiz pack questions → Each should use correct timer duration

### 4.4 Remote Navigation Commands
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'next-question', 'previous-question', 'next-question-nav' (lines 3331-3651)
- `src/components/QuizHost.tsx` - handleQuizPackNext() and handleQuizPackPrevious()

**Audit Checklist:**
- [ ] Verify 'next-question' command in quiz pack mode:
  - [ ] Increments currentLoadedQuestionIndex
  - [ ] Calls sendNextQuestion() to broadcast to players
  - [ ] Returns success=true
- [ ] Verify 'previous-question' command:
  - [ ] Calls handleQuizPackPrevious()
  - [ ] Works only in quiz pack mode
- [ ] Verify 'next-question-nav' command:
  - [ ] Calls handleQuizPackNext()
  - [ ] Used for navigation preview
- [ ] Verify commands check bounds (don't go past last question or before first)
- [ ] Test: Remote next-question → currentLoadedQuestionIndex increments → new question displays
- [ ] Test: Remote previous-question → index decrements → previous question displays
- [ ] Test: Navigate to question → timer duration should update correctly

### 4.5 Answer Reveal and Scoring
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'reveal-answer' (lines 3368-3376)
- `src/components/QuizHost.tsx` - handleRevealAnswer() function

**Audit Checklist:**
- [ ] Verify 'reveal-answer' command triggers handleRevealAnswer()
- [ ] Verify command also calls handlePrimaryAction() to progress flowState
- [ ] Verify flowState transitions from running/timeup to revealed
- [ ] Verify answer is sent to players and external display
- [ ] Verify scoring is calculated and teams are awarded points
- [ ] Test: Remote reveal-answer in quiz pack → answer should appear on all screens

### 4.6 Fastest Team Display
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'show-fastest' (lines 3377-3382)

**Audit Checklist:**
- [ ] Verify 'show-fastest' command calls handlePrimaryAction()
- [ ] Verify flowState transitions to 'fastest' state
- [ ] Verify fastest team overlay appears on host, external display, and players
- [ ] Verify fastest team is calculated based on response times (if multiple correct)
- [ ] Test: Remote show-fastest → fastest team overlay should appear

### 4.7 Quiz Completion and Round End
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'end-round' (lines 3390-3394)
- `src/components/QuizHost.tsx` - Admin handler 'skip-question' (lines 3384-3388)

**Audit Checklist:**
- [ ] Verify 'skip-question' command:
  - [ ] Calls sendNextQuestion() to move to next question
  - [ ] Works from any state
- [ ] Verify 'end-round' command:
  - [ ] Calls sendEndRound()
  - [ ] Resets game state
  - [ ] Returns to main menu or awaits next quiz
- [ ] Test: Remote skip-question → should advance immediately without answering
- [ ] Test: Remote end-round → game should end, return to menu

---

## 5. On-the-Spot Keypad Mode and Remote Integration

### 5.1 Keypad Mode Initialization
**Files to Review:**
- `src/components/QuizHost.tsx` - currentQuiz useEffect setting up keypad (lines 854-887)
- `src/components/KeypadInterface.tsx` - Component initialization (lines 300-343)

**Audit Checklist:**
- [ ] Verify on-the-spot quiz (isQuizPack=false) triggers showKeypadInterface=true
- [ ] Verify KeypadInterface mounts and shows config/type selection screen
- [ ] Verify no quiz pack UI appears
- [ ] Verify initial state: currentScreen='config', answers cleared, no timer running
- [ ] Verify game mode timers are available (gameModeTimers.keypad, etc.)
- [ ] Test: Load on-the-spot quiz → KeypadInterface should appear with config screen

### 5.2 Question Type Selection via Remote
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'select-question-type' (lines 3655-3690)
- `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx` - Remote UI for type selection

**Audit Checklist:**
- [ ] Verify admin handler validates question type is one of: 'letters', 'numbers', 'multiple-choice'
- [ ] Verify only works in on-the-spot mode (!isQuizPackMode)
- [ ] Verify handler computes timerDuration via getTotalTimeForQuestion():
  - [ ] 'letters' → keypad timer
  - [ ] 'numbers' → nearestwins timer
  - [ ] 'multiple-choice' → keypad timer (or appropriate setting)
- [ ] Verify flowState is set to { flow: 'sent-question', isQuestionMode: true, totalTime: typedDuration, selectedQuestionType: selectedType }
- [ ] Verify this triggers UI to show timer buttons and KeypadInterface to load the selected game
- [ ] Verify QuestionTypeSelector shows correct buttons on remote
- [ ] Test: Remote select-question-type 'letters' → KeypadInterface should load letters game with correct timer
- [ ] Test: Select different types → each should use correct timer duration from Settings

### 5.3 Expected Answer Input via Remote
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'set-expected-answer' (lines 3692-3716)
- `src-player/src/components/HostTerminal/AnswerInputKeypad.tsx` - Remote answer input UI

**Audit Checklist:**
- [ ] Verify admin handler validates answer is non-empty string
- [ ] Verify only works in on-the-spot mode (!isQuizPackMode)
- [ ] Verify handler stores answer in flowState.answerSubmitted
- [ ] Verify answer is available when revealing (for scoring comparison)
- [ ] Verify AnswerInputKeypad appears on remote and accepts input
- [ ] Test: Remote set-expected-answer → answer should be stored and used for scoring
- [ ] Test: Multiple question types → answer input should work for all

### 5.4 Keypad Game Flow
**Files to Review:**
- `src/components/KeypadInterface.tsx` - Screen state machine (lines 300-1350+)
- `src/components/KeypadInterface.tsx` - Game screen rendering for each type

**Audit Checklist:**
- [ ] Verify config screen allows user (host) to select game mode (UI side, not remote)
- [ ] Verify question type screen shows selected type
- [ ] Verify game screen (letters/numbers/multiple-choice) renders correctly:
  - [ ] Shows current question
  - [ ] Shows timer when timer is running
  - [ ] Locks answers when timer finishes
  - [ ] Shows results screen after time expires
- [ ] Verify answers are captured from teams via network updates
- [ ] Verify host can reveal answer and scoring appears
- [ ] Test: Play through complete on-the-spot game → all screens should appear in order

### 5.5 On-the-Spot Timer Operations
**Files to Review:**
- `src/components/KeypadInterface.tsx` - handleStartTimer() and handleSilentTimer() (lines 687-994)
- `src/components/QuizHost.tsx` - Admin command routing to gameActionHandlers (lines 2479-2525)

**Audit Checklist:**
- [ ] Verify UI Start Timer button triggers KeypadInterface.handleStartTimer()
- [ ] Verify UI Silent Timer button triggers KeypadInterface.handleSilentTimer()
- [ ] Verify both use gameModeTimers.keypad for duration
- [ ] Verify remote start-normal-timer command routes to gameActionHandlers.startTimer()
- [ ] Verify remote start-silent-timer command routes to gameActionHandlers.silentTimer()
- [ ] Verify both paths call same underlying handler function
- [ ] Verify timer countdown appears on external display
- [ ] Verify answers are locked when timer expires
- [ ] Test: UI vs remote start timer → both should behave identically

### 5.6 Next Question Flow in On-the-Spot
**Files to Review:**
- `src/components/QuizHost.tsx` - Admin handler 'next-question' for on-the-spot mode (lines 3342-3360)
- `src/components/KeypadInterface.tsx` - handleNextQuestion()

**Audit Checklist:**
- [ ] Verify 'next-question' command in on-the-spot mode:
  - [ ] Resets flowState to idle
  - [ ] Sets totalTime to default (gameModeTimers.keypad || 30)
  - [ ] Clears previous answers and response times
  - [ ] Broadcasts next-question to players
- [ ] Verify handlers properly clear all answer state
- [ ] Verify UI returns to question type selection after next
- [ ] Test: Remote next-question → game should reset for new round

### 5.7 Reveal and Scoring in On-the-Spot
**Files to Review:**
- `src/components/QuizHost.tsx` - handleRevealAnswer() for on-the-spot mode
- `src/components/KeypadInterface.tsx` - Answer reveal logic

**Audit Checklist:**
- [ ] Verify reveal-answer command works in on-the-spot mode
- [ ] Verify expected answer (from set-expected-answer) is compared with team answers
- [ ] Verify points are awarded based on correctness
- [ ] Verify results screen shows scores
- [ ] Test: Set expected answer, reveal, verify scoring

---

## 6. State Synchronization Between Remote and Host

### 6.1 Flow State Sync
**Files to Review:**
- `src/network/wsHost.ts` - sendFlowStateToController()
- `src/components/QuizHost.tsx` - flowState updates (lines 670-680 ref updates)

**Audit Checklist:**
- [ ] Verify flowState is sent to controller after each state change
- [ ] Verify controller receives and updates its UI based on flowState
- [ ] Verify buttons are enabled/disabled correctly based on flow state
- [ ] Verify remote UI shows current game progress
- [ ] Test: Change flowState on host → remote buttons should enable/disable appropriately

### 6.2 Admin Response Delivery
**Files to Review:**
- `src/network/wsHost.ts` - sendAdminResponse()
- `src-player/src/components/HostTerminal/useHostTerminalAPI.ts` - Response handling

**Audit Checklist:**
- [ ] Verify ADMIN_RESPONSE is sent after each command execution
- [ ] Verify response includes success/failure status
- [ ] Verify response includes error message if failed
- [ ] Verify controller receives response and can update UI (e.g., show error toast)
- [ ] Verify response delivery works in both IPC (Electron) and HTTP fallback modes
- [ ] Test: Send invalid command → controller should receive error response

### 6.3 Player Updates from Remote Actions
**Files to Review:**
- `src/network/wsHost.ts` - Message broadcast functions
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Command mappings

**Audit Checklist:**
- [ ] Verify when remote commands update game state, players are notified
- [ ] Verify send-question broadcasts question to players
- [ ] Verify send-picture broadcasts image to players
- [ ] Verify timer start sends timer data to players
- [ ] Verify answer reveal sends correct answer to players
- [ ] Verify fastest team reveal sends fastest info to players
- [ ] Test: Send remote command → verify players receive corresponding data

---

## 7. Edge Cases and Error Handling

### 7.1 Authentication Edge Cases
**Checklist:**
- [ ] Send command from unauthenticated device → should be rejected
- [ ] Send command from wrong device (different from authenticated) → should be rejected
- [ ] Authenticate twice with same PIN → should replace previous authentication
- [ ] Try to rename team to PIN → should be rejected (security)
- [ ] Authenticate with empty/null PIN → should be rejected

### 7.2 Timer Edge Cases
**Checklist:**
- [ ] Start timer with 0 duration → should handle gracefully (error or minimum duration)
- [ ] Start timer with negative duration → should be rejected or use default
- [ ] Start timer with extremely large duration (600+) → should be clamped to 600s max (validateTimerDuration)
- [ ] Start timer twice without stopping → second should reset/replace first
- [ ] Start timer while timer running → should be ignored or replace current
- [ ] Change timer setting during countdown → should not affect current countdown

### 7.3 Navigation Edge Cases
**Checklist:**
- [ ] Previous-question on first question → should be ignored or stay on first
- [ ] Next-question on last question → should trigger end-round or stay on last
- [ ] Navigate during active timer → should clear answers appropriately
- [ ] Send multiple navigation commands rapidly → should queue or ignore duplicates

### 7.4 Mode Transition Edge Cases
**Checklist:**
- [ ] Switch game modes without ending current game → should reset state properly
- [ ] Load new quiz while game is running → should stop current game, load new
- [ ] Select question type that doesn't exist → should reject with error
- [ ] Set expected answer in quiz pack mode → should be rejected (only on-the-spot)
- [ ] Send keypad-specific command while in quiz pack → should reject

### 7.5 Network Disconnection Handling
**Checklist:**
- [ ] Disconnect remote during game → host should continue, commands ignored
- [ ] Disconnect remote, reconnect → should re-authenticate, continue
- [ ] Host disconnects from backend server → should handle gracefully
- [ ] Broadcast message lost to some players → verify recovery mechanism

---

## 8. Visual and Audio Verification

### 8.1 Audio Playback
**Checklist:**
- [ ] Normal timer audio plays for correct duration
- [ ] Silent timer audio plays (no sound) for correct duration
- [ ] Audio starts at correct timestamp based on timerDuration
- [ ] Audio stops immediately when stop-timer called
- [ ] Multiple timer starts don't create overlapping audio

### 8.2 External Display Updates
**Checklist:**
- [ ] Question displays on external display when sent
- [ ] Picture displays on external display when sent
- [ ] Timer updates on external display (countdown visible)
- [ ] Answer displays on external display when revealed
- [ ] Fastest team displays on external display
- [ ] All updates synchronized with host UI

### 8.3 Remote UI Updates
**Checklist:**
- [ ] Remote buttons appear/disappear based on flowState
- [ ] Remote shows current game progress (question 1 of 5, etc.)
- [ ] Remote shows timer running indicator
- [ ] Remote shows team scores
- [ ] Error messages appear when commands fail
- [ ] Success feedback when commands succeed

---

## 9. Performance and Stability

### 9.1 Command Processing Performance
**Checklist:**
- [ ] Commands processed within acceptable latency (<500ms)
- [ ] Multiple rapid commands don't cause app to freeze
- [ ] Large quiz pack (100+ questions) handles navigation smoothly
- [ ] Many teams (20+) handle commands smoothly

### 9.2 Memory and Resource Usage
**Checklist:**
- [ ] No memory leaks when running long games
- [ ] Audio resources properly cleaned up
- [ ] Timer intervals properly cleared
- [ ] Event listeners properly unregistered

### 9.3 Browser Compatibility
**Checklist:**
- [ ] Works in Chrome/Edge (Electron and web)
- [ ] Works in Safari
- [ ] Works on mobile browsers (for remote)
- [ ] Works with various screen sizes

---

## 10. Regression Testing

**Key Scenarios to Test After Any Timer/Remote Changes:**

1. **Quiz Pack Full Flow:**
   - Load quiz pack → See first question with correct timer → Click Start Timer → Timer counts down → Reveal answer → Show fastest team → Next question → Last question → End round

2. **Quiz Pack Remote Full Flow:**
   - Load quiz pack → Remote send-question → Remote start-normal-timer → Remote reveal-answer → Remote show-fastest → Remote next-question → Remote end-round

3. **On-the-Spot Full Flow:**
   - Load on-the-spot → Select question type (UI) → Click Start Timer → Timer counts down → Set expected answer → Reveal → Show results → Next question

4. **On-the-Spot Remote Full Flow:**
   - Load on-the-spot → Remote select-question-type → Remote set-expected-answer → Remote start-silent-timer → Remote reveal-answer → Remote next-question

5. **Settings Changes During Game:**
   - Load game → Change timer setting in Settings → Continue game → New questions should use new timer
   - Verify remote commands also use new timer

6. **Mixed UI and Remote Commands:**
   - Start with UI button, navigate with remote
   - Start with remote, reveal with UI
   - Mixed operations should work seamlessly

---

## Key Files Summary

| File | Purpose | Priority |
|------|---------|----------|
| src/components/QuizHost.tsx | Main app, admin handler, state machine | CRITICAL |
| src/components/KeypadInterface.tsx | On-the-spot keypad UI and timer | CRITICAL |
| src/components/QuizPackDisplay.tsx | Quiz pack config UI | HIGH |
| src/state/flowState.ts | Flow state machine, getTotalTimeForQuestion() | CRITICAL |
| src/utils/unifiedTimerHandlers.ts | Unified timer executors | CRITICAL |
| src/utils/countdownAudio.ts | Audio playback | HIGH |
| src/utils/SettingsContext.tsx | Timer settings storage | CRITICAL |
| src/network/wsHost.ts | Admin command listener, response delivery | CRITICAL |
| src-player/src/components/HostTerminal/ | Remote controller UI | HIGH |
| electron/backend/server.js | WebSocket server, command routing | CRITICAL |

---

## Success Criteria

All of the following must be true:
- [ ] All admin commands are properly routed and executed
- [ ] Remote timer commands use same duration as UI buttons (Settings-based, not hardcoded)
- [ ] All timer durations match configured Settings values
- [ ] Quiz pack mode works identically via UI and remote
- [ ] On-the-spot mode works identically via UI and remote
- [ ] Audio plays for correct duration in both normal and silent modes
- [ ] Flow state is synchronized between host and remote
- [ ] All error cases handled gracefully
- [ ] No hardcoded timer values in admin handler (only Settings-based)
- [ ] Remote authentication works correctly

