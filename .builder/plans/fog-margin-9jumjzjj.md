# Complete End-to-End Flow Verification Plan
## Triple-Check: Every Button, Command, and Action

### OVERVIEW
Verify that EVERY button implemented on the host remote:
1. Sends the correct admin command via WebSocket
2. Is received by QuizHost admin command handler
3. Triggers the correct action in the host app
4. Updates flowState correctly
5. Broadcasts updated FLOW_STATE back to controller
6. Displays correct next button(s)

---

## QUIZ PACK MODE - COMPLETE VERIFICATION

### Button 1: SEND QUESTION (Ready State)
**Location**: GameControlsPanel, ready state
**Button Label**: "Send Question" (📝) or "Send Picture" (🖼️)
**Expected Command**: `send-question`

**Verification Checklist**:
- [ ] Button visible: GameControlsPanel shows it when flowState.flow = 'ready'
- [ ] Command sent: useHostTerminalAPI.sendAdminCommand('send-question') called
- [ ] WebSocket message: {type: 'ADMIN_COMMAND', commandType: 'send-question', deviceId, ...}
- [ ] Handler called: QuizHost admin command listener receives it
- [ ] Auth check: deviceId matches authenticatedControllerId
- [ ] Action triggered: deps.handlePrimaryAction() executed
- [ ] Flow state: setFlowState({flow: 'sent-question', ...})
- [ ] Question displayed: Host app shows question to players
- [ ] Next buttons: "Normal Timer" and "Silent Timer" appear
- [ ] Old button: "Send Question" disappears
- [ ] FLOW_STATE broadcast: Sent to controller with flow='sent-question'

---

### Button 2: HIDE QUESTION (Ready State)
**Location**: GameControlsPanel, ready state
**Button Label**: "Hide Question" (🙈)
**Expected Command**: `hide-question`

**Verification Checklist**:
- [ ] Button visible: Shows next to Send Question button
- [ ] Command sent: sendAdminCommand('hide-question')
- [ ] Handler called: QuizHost receives command
- [ ] Action triggered: deps.handleHideQuestion() executed
- [ ] Flow state: Returns to idle or ready state
- [ ] Question hidden: Question disappears from host app display
- [ ] Button update: Both Send/Hide buttons disappear
- [ ] State restored: Ready to show new question or start new round

---

### Button 3: NORMAL TIMER (Sent-Question State)
**Location**: GameControlsPanel, sent-question state
**Button Label**: "Normal Timer" (🔊)
**Expected Command**: `start-normal-timer`
**Command Data**: {seconds: 30} (user-configurable)

**Verification Checklist**:
- [ ] Button visible: Shows when flowState.flow = 'sent-question'
- [ ] Command sent: sendAdminCommand('start-normal-timer', {seconds: timerDuration})
- [ ] Handler called: QuizHost receives start-normal-timer command
- [ ] Duration validation: Command validates seconds is number between 1-600
- [ ] Action triggered: deps.handleNavBarStartTimer(validatedDuration) called
- [ ] Flow state: setFlowState({flow: 'running', ...})
- [ ] Timer started: Host app countdown begins with audio
- [ ] Player update: Timer sent to all players
- [ ] Next button: "Reveal Answer" button appears
- [ ] Old buttons: "Normal Timer" and "Silent Timer" disappear
- [ ] Audio: Countdown audio plays (if enabled in settings)

---

### Button 4: SILENT TIMER (Sent-Question State)
**Location**: GameControlsPanel, sent-question state
**Button Label**: "Silent Timer" (🔇)
**Expected Command**: `start-silent-timer`
**Command Data**: {seconds: 30}

**Verification Checklist**:
- [ ] Button visible: Shows next to Normal Timer
- [ ] Command sent: sendAdminCommand('start-silent-timer', {seconds: timerDuration})
- [ ] Handler called: QuizHost receives command
- [ ] Duration validation: Same as normal timer (1-600 seconds)
- [ ] Action triggered: deps.sendTimerToPlayers(duration, true) - silent=true
- [ ] Flow state: setFlowState({flow: 'running', ...})
- [ ] Timer started: Countdown begins WITHOUT audio
- [ ] Player update: Timer sent to players (silent)
- [ ] Next button: "Reveal Answer" appears
- [ ] Audio: NO countdown audio plays
- [ ] Old buttons: Timer buttons disappear

---

### Button 5: REVEAL ANSWER (Running/Timeup State)
**Location**: GameControlsPanel, running or timeup state
**Button Label**: "Reveal Answer" (🔍)
**Expected Command**: `reveal-answer`
**No command data needed**

**Verification Checklist**:
- [ ] Button visible: Shows when flowState.flow = 'running' OR flowState.flow = 'timeup'
- [ ] Command sent: sendAdminCommand('reveal-answer')
- [ ] Handler called: QuizHost receives command
- [ ] Actions triggered: BOTH called:
  - [ ] deps.handleRevealAnswer() - reveals correct answer
  - [ ] deps.handlePrimaryAction() - transitions flow state
- [ ] Flow state: setFlowState({flow: 'revealed'} OR {flow: 'fastest'})
- [ ] Answer displayed: Correct answer shown to players and host
- [ ] Team answers: Teams' responses visible (correct/incorrect highlighted)
- [ ] Next button: "Show Fastest Team" appears (or already showed if fastest auto-displayed)
- [ ] Old button: "Reveal Answer" disappears
- [ ] FLOW_STATE: Broadcast with flow='revealed' or flow='fastest'

---

### Button 6: SHOW FASTEST TEAM (Revealed State)
**Location**: GameControlsPanel, revealed state
**Button Label**: "Show Fastest Team" (⚡)
**Expected Command**: `show-fastest`
**No command data needed**

**Verification Checklist**:
- [ ] Button visible: Shows when flowState.flow = 'revealed'
- [ ] Command sent: sendAdminCommand('show-fastest')
- [ ] Handler called: QuizHost receives command
- [ ] Action triggered: deps.handlePrimaryAction()
- [ ] Flow state: setFlowState({flow: 'fastest', ...})
- [ ] Display update: Fastest team highlighted/emphasized
- [ ] Visual feedback: Team animations/highlights show who was fastest
- [ ] Next button: "Next Question" appears
- [ ] Old button: "Show Fastest Team" disappears
- [ ] FLOW_STATE: Broadcast with flow='fastest'

---

### Button 7: NEXT QUESTION (Fastest State)
**Location**: GameControlsPanel, fastest state
**Button Label**: "Next Question" (➡️)
**Expected Command**: `next-question`
**No command data needed**

**Verification Checklist**:
- [ ] Button visible: Shows when flowState.flow = 'fastest'
- [ ] Command sent: sendAdminCommand('next-question')
- [ ] Handler called: QuizHost receives command
- [ ] Quiz pack check: isQuizPackMode = true
- [ ] Question advance: currentLoadedQuestionIndex incremented
- [ ] Question available: currentLoadedQuestionIndex < loadedQuizQuestions.length
- [ ] Flow state: Reset to 'ready' via useEffect watching currentLoadedQuestionIndex
- [ ] New question loaded: Next question in quiz displayed
- [ ] Player update: Players receive new question
- [ ] Button transition: Back to "Send Question" / "Hide Question" state
- [ ] Old button: "Next Question" disappears
- [ ] Question counter: "Question X of Y" updated correctly
- [ ] Navigation arrows: Previous/Next buttons enabled/disabled correctly

---

## ON-THE-SPOT MODE (KEYPAD) - COMPLETE VERIFICATION

### Button 1: QUESTION TYPE SELECTION (Idle State)
**Location**: QuestionTypeSelector component
**Button Options**: Letters, Numbers, Multiple Choice
**Expected Command**: `select-question-type`
**Command Data**: {type: 'letters' | 'numbers' | 'multiple-choice'}

**Verification Checklist**:
- [ ] Component visible: QuestionTypeSelector shows when flow='idle' AND isQuestionMode=true AND isQuizPackMode=false
- [ ] Type navigation: Arrow buttons cycle through types (Letters → Numbers → MC → Letters)
- [ ] Type preview: Selected type shows emoji, name, description, example
- [ ] Command sent: When user clicks "Confirm & Start" → sendAdminCommand('select-question-type', {type: 'letters'})
- [ ] Handler called: QuizHost receives command
- [ ] Type validation: Validates type is in ['letters', 'numbers', 'multiple-choice']
- [ ] Mode check: Only works when isQuizPackMode = false
- [ ] Flow state: setFlowState({flow: 'sent-question', isQuestionMode: true})
- [ ] Component change: QuestionTypeSelector hides
- [ ] Timer buttons: "Normal Timer" and "Silent Timer" appear in GameControlsPanel
- [ ] Answer keypad: AnswerInputKeypad appears with correct buttons:
  - [ ] Letters: A-F buttons in 3x2 grid
  - [ ] Numbers: 0-9 numpad with Clear button
  - [ ] Multiple Choice: A-D buttons in 2x2 grid
- [ ] Header update: Shows selected question type
- [ ] FLOW_STATE: Broadcast with flow='sent-question', isQuizPackMode=false

---

### Button 2: NORMAL TIMER (On-The-Spot, Sent-Question State)
**Location**: GameControlsPanel, on-the-spot mode, sent-question state
**Button Label**: "Normal Timer" (🔊)
**Expected Command**: `start-normal-timer`
**Command Data**: {seconds: 30}

**Verification Checklist** (Same as Quiz Pack + additional for on-the-spot):
- [ ] Button visible: Shows when isOnTheSpotMode=true AND flow='sent-question'
- [ ] Command sent: sendAdminCommand('start-normal-timer', {seconds: 30})
- [ ] Handler called: QuizHost receives and validates command
- [ ] Action triggered: deps.handleNavBarStartTimer(30)
- [ ] Flow state: setFlowState({flow: 'running', ...})
- [ ] Timer started: Countdown begins on host app
- [ ] Player timer: Players see countdown
- [ ] Answer keypad active: AnswerInputKeypad still shows A-F/0-9/A-D buttons
- [ ] Next button: "Reveal Answer" appears
- [ ] Old buttons: Timer buttons disappear
- [ ] Audio: Countdown plays with audio

---

### Button 3: SILENT TIMER (On-The-Spot, Sent-Question State)
**Location**: GameControlsPanel, on-the-spot mode
**Button Label**: "Silent Timer" (🔇)
**Expected Command**: `start-silent-timer`
**Command Data**: {seconds: 30}

**Verification Checklist** (Same as above but no audio):
- [ ] Button visible: Shows next to Normal Timer
- [ ] Command sent: sendAdminCommand('start-silent-timer', {seconds: 30})
- [ ] Handler called: QuizHost receives command
- [ ] Action triggered: deps.sendTimerToPlayers(30, true)
- [ ] Flow state: setFlowState({flow: 'running'})
- [ ] Timer silent: NO countdown audio
- [ ] Answer keypad: Still visible for teams to answer
- [ ] Next button: "Reveal Answer" appears
- [ ] Old buttons: Timer buttons disappear

---

### Button 4: ANSWER INPUT KEYPADS (On-The-Spot, Running/Sent-Question State)
**Location**: AnswerInputKeypad component (right panel)
**Question Types & Buttons**:
- **Letters**: A, B, C, D, E, F buttons
- **Numbers**: 0-9 numpad with Clear button
- **Multiple Choice**: A, B, C, D buttons

**Expected Command** (from Set Answer button): `set-expected-answer`
**Command Data**: {answer: 'A'} or {answer: '5'} etc.

**Verification Checklist**:
- [ ] Component visible: Shows when isOnTheSpotMode=true AND (flow='sent-question' OR flow='running')
- [ ] Question type display: Shows which type was selected ("Expected Answer Input • Letters")
- [ ] Answer display: Large text area shows selected answer (or dash if none selected)

**Letters Keypad**:
- [ ] Buttons present: A-F buttons arranged in 3x2 grid
- [ ] Click behavior: Click letter → displays in answer box
- [ ] Selection highlight: Selected letter shows with green background
- [ ] Single selection: Clicking new letter replaces old one
- [ ] Submit: "Set Answer" button becomes enabled (blue) when letter selected
- [ ] Command sent: Click "Set Answer" → sendAdminCommand('set-expected-answer', {answer: 'A'})
- [ ] Handler called: QuizHost receives command
- [ ] Mode check: Only works in on-the-spot mode (!isQuizPackMode)
- [ ] Answer stored: Expected answer recorded (for future scoring)
- [ ] ADMIN_RESPONSE: Server confirms success

**Numbers Keypad**:
- [ ] Buttons present: 0-9 buttons arranged in numpad layout
- [ ] Click behavior: Click number → appends to answer (e.g., click 1 then 2 → "12")
- [ ] Max length: Limits to 10 digits
- [ ] Clear button: "🗑️ Clear" button clears current answer
- [ ] Display: Shows accumulated number (e.g., "12345")
- [ ] Submit: "Set Answer" button enabled when number entered
- [ ] Command sent: Click "Set Answer" → sendAdminCommand('set-expected-answer', {answer: '12345'})
- [ ] Handler called: QuizHost receives command
- [ ] Answer stored: Numeric answer recorded

**Multiple Choice Keypad**:
- [ ] Buttons present: A, B, C, D buttons in 2x2 grid
- [ ] Click behavior: Click letter → displays in answer box
- [ ] Selection highlight: Selected letter shows green
- [ ] Single selection: Clicking new letter replaces old one
- [ ] Submit: "Set Answer" enabled when letter selected
- [ ] Command sent: Click "Set Answer" → sendAdminCommand('set-expected-answer', {answer: 'A'})
- [ ] Handler called: QuizHost receives command
- [ ] Answer stored: Expected answer recorded

---

### Button 5: REVEAL ANSWER (On-The-Spot, Running State)
**Location**: GameControlsPanel
**Button Label**: "Reveal Answer" (🔍)
**Expected Command**: `reveal-answer`

**Verification Checklist**:
- [ ] Button visible: Shows when isOnTheSpotMode=true AND flow='running'
- [ ] Command sent: sendAdminCommand('reveal-answer')
- [ ] Handler called: QuizHost receives command
- [ ] Actions triggered: deps.handleRevealAnswer() + deps.handlePrimaryAction()
- [ ] Flow state: setFlowState({flow: 'fastest'}) - skip 'revealed' state
- [ ] Answer revealed: Expected answer shown on host app
- [ ] Team answers: Teams' answers displayed (correct/incorrect)
- [ ] Answer keypad: AnswerInputKeypad hides
- [ ] Next button: "Show Fastest Team" appears
- [ ] Old button: "Reveal Answer" disappears
- [ ] FLOW_STATE: Broadcast with flow='fastest'

---

### Button 6: SHOW FASTEST TEAM (On-The-Spot, Fastest State)
**Location**: GameControlsPanel
**Button Label**: "Show Fastest Team" (⚡)
**Expected Command**: `show-fastest`

**Verification Checklist**:
- [ ] Button visible: Shows when flow='fastest'
- [ ] Command sent: sendAdminCommand('show-fastest')
- [ ] Handler called: QuizHost receives command
- [ ] Action triggered: deps.handlePrimaryAction()
- [ ] Display update: Fastest team highlighted
- [ ] Next button: "Next Question" appears
- [ ] Old button: "Show Fastest Team" disappears

---

### Button 7: NEXT QUESTION (On-The-Spot, Fastest State)
**Location**: GameControlsPanel
**Button Label**: "Next Question" (➡️)
**Expected Command**: `next-question`

**Verification Checklist - ON-THE-SPOT SPECIFIC**:
- [ ] Button visible: Shows when isOnTheSpotMode=true AND flow='fastest'
- [ ] Command sent: sendAdminCommand('next-question')
- [ ] Handler called: QuizHost receives command
- [ ] Mode check: isQuizPackMode = false
- [ ] Flow reset: setFlowState({flow: 'idle', isQuestionMode: true})
- [ ] Team data reset: setTeamAnswers({}), setTeamResponseTimes({}), etc.
- [ ] Fastest reveal reset: setFastestTeamRevealTime(null)
- [ ] Component change: GameControlsPanel hides
- [ ] Type selector returns: QuestionTypeSelector appears again
- [ ] Navigation arrows: Hidden (not applicable in type selection)
- [ ] Button disappears: "Next Question" button gone
- [ ] Ready for new round: User can select new question type
- [ ] Players notified: FLOW_STATE broadcast to players

---

## CRITICAL VERIFICATION POINTS

### Question Type Display on Host Remote
- [ ] When on-the-spot type selected: Header shows selected type OR AnswerInputKeypad shows type
- [ ] Question type displayed: Letters/Numbers/Multiple Choice clearly visible
- [ ] Answer keypad labeled: Shows "Expected Answer Input • Letters" (or Numbers/Multiple Choice)
- [ ] Host can identify: Which type teams are answering

### Host Answer Entry Flow
- [ ] Host selects type: Click "Letters" → Confirm
- [ ] Keypads appear: A-F buttons show
- [ ] Host enters answer: Click letter, appears in display
- [ ] Host submits: Click "Set Answer" → command sent
- [ ] QuizHost receives: Command handler logs answer
- [ ] Ready for team answers: Timer running, teams can answer

### Flow State Consistency
- [ ] Quiz Pack: ready → sent-question → running → revealed/fastest → idle (loop)
- [ ] On-The-Spot: idle → sent-question → running → revealed (skipped) → fastest → idle
- [ ] No state skipping: Each state transition valid
- [ ] No stuck states: Every flow state has an exit button

### Button Disappearance Verification
- [ ] Quiz Pack ready: Only Send + Hide visible (no timer buttons)
- [ ] Quiz Pack sent-question: Only Timer buttons visible (no Send/Hide)
- [ ] Quiz Pack running: Only Reveal visible (no timer buttons)
- [ ] On-The-Spot idle: No GameControlsPanel buttons (TypeSelector only)
- [ ] On-The-Spot sent-question: Only Timer buttons (no TypeSelector)
- [ ] On-The-Spot running: Reveal + Keypad (no timer buttons)

### Admin Command Handler Verification
Each admin command handler must:
- [ ] Log receiving command: '[QuizHost] Executing: [Command Name]'
- [ ] Authenticate: Check deviceId === authenticatedControllerId
- [ ] Validate: Check command data is valid
- [ ] Execute: Call appropriate handler function
- [ ] Update state: Call setFlowState with new state
- [ ] Broadcast: Call sendFlowStateToController
- [ ] Respond: Send ADMIN_RESPONSE to controller
- [ ] No errors: No console errors or warnings

---

## VERIFICATION METHOD
1. Load Host App in debug mode
2. Load Host Remote in separate window
3. Open Developer Tools in both
4. Watch console for logs: [QuizHost], [HostTerminal], [GameControlsPanel], etc.
5. For each button:
   - [ ] Click button on Host Remote
   - [ ] Check console logs in Host Remote (command sent)
   - [ ] Check console logs in Host App (command received)
   - [ ] Check Host App display (action triggered)
   - [ ] Check next button appears
   - [ ] Check previous button disappears

---

## TEST SCENARIOS

### Scenario 1: Complete Quiz Pack Round
1. Load quiz with 2+ questions
2. Click "Send Question" → watch question display
3. Click "Normal Timer" → watch countdown start
4. Click "Reveal Answer" → watch answer show
5. Click "Show Fastest Team" → watch team highlight
6. Click "Next Question" → watch new question load
7. Verify no orphaned buttons at any step

### Scenario 2: Complete On-The-Spot Round (Letters)
1. Load on-the-spot mode
2. Select "Letters" type → confirm
3. Click "Normal Timer" → countdown starts
4. Host selects answer "A" in keypad
5. Click "Reveal Answer" → answer shows
6. Click "Show Fastest Team" → team highlighted
7. Click "Next Question" → back to type selector
8. Repeat with "Numbers" and "Multiple Choice" types

### Scenario 3: Silent Timer Test
1. Quiz Pack: "Silent Timer" → no audio
2. On-The-Spot: "Silent Timer" → no audio
3. Verify countdown still runs

### Scenario 4: Navigation (Quiz Pack Only)
1. Load 5-question quiz
2. Check Previous disabled on question 1
3. Click Next on question 1 → question 2, Previous enabled
4. Navigate through all questions
5. Next disabled on question 5
