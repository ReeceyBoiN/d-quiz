# Nearest Wins Flow Verification - Complete Audit

## Result: All flows are verified and working correctly after the fixes applied in the previous session.

---

## On-the-Spot Mode Flow (NearestWinsInterface)

### Stage 1: Config Screen
- Host sees: Winner Points slider, target number input, tolerance, timer settings
- Nav bar: Not visible (config screen excluded from nav visibility)
- Player device: Waiting screen ("Please wait for your host")
- External display: Basic/idle mode

### Stage 2: Start Round (handleStartRound)
- Host sees: Playing screen with number keypad, question number header
- Flow state: `sent-question`
- Broadcast to players: `sendQuestionToPlayers('Nearest Wins', undefined, 'numbers')` + IPC broadcast with type `'nearestwins'`
- Player device: Number keypad appears (type normalized to 'numbers')
- External display: `nearest-wins-question` mode
- Nav bar: Visible, shows timer buttons (Start Timer / Silent Timer)

### Stage 3: Start Timer (handleStartTimer)
- Host sees: Timer counting down, number keypad for host answer
- Flow state: `running` (set via `onGameTimerStateChange` callback at QuizHost line 6625-6633)
- Broadcast to players: `sendTimerToPlayers(duration, isSilent, Date.now())`
- Player device: Timer countdown visible, keypad active
- External display: `nearest-wins-timer` mode (updated every 100ms, logging removed)
- Nav bar: Timer progress bar shown (no buttons during timer)

### Stage 4: Timer Ends (countdown reaches 0)
- Host sees: Timer stopped, keypad still available for host answer
- Flow state: `timeup` (set via flow sync effect at QuizHost line 1318-1319)
- Broadcast to players: `sendTimeUpToPlayers()` + LOCK message
- Player device: Keypad greyed out/locked, "Answer Submitted" shown
- Callbacks: `onGameTimerFinished(true)`, `onTimerLockChange(true)`
- If host answer already confirmed: auto-transitions to results screen

### Stage 5: Reveal Answer (handleRevealAnswer - stage 1)
- Triggered by: Spacebar or "Reveal Answer" button → `gameActionHandlers.reveal()`
- Prerequisite: `onTheSpotTimerFinished && onTheSpotAnswerSelected && !onTheSpotAnswerRevealed`
- Host sees: Results screen with correct answer displayed
- Flow state: `revealed` (via flow sync at line 1320-1324, with `teamsAnsweredCorrectly` set to true)
- Broadcast to players: `broadcastReveal({ answer, type: 'nearestwins', selectedAnswers: [] })`
- Player device: Shows correct answer, "Your guess: X, Off by Y". No red X (skipped for nearestwins/nearest types at App.tsx line 866-869)
- External display: `nearest-wins-results` with `answerRevealed: true, closestTeamRevealed: false`
- Callbacks: `onGameAnswerRevealed(true)`

### Stage 6: Reveal Closest Team (handleRevealClosestTeam - stage 2)
- Triggered by: Spacebar or "Closest Team" button → `gameActionHandlers.revealFastestTeam()`
- Nav bar label: "Closest Team" (QuestionNavigationBar line 188-193, checks isNearest)
- Host sees: Winner highlighted in results
- Flow state: `fastest` (via flow sync at line 1330-1331)
- Points awarded: Winner points to closest team(s) via `onAwardPoints`
- Broadcast to players: `broadcastFastest({ teamName, teamPhoto, guess, difference })`
- Player device: FastestTeamOverlay shows closest team name with "Guessed: X, Off by Y"
- External display: `nearest-wins-results` with `closestTeamRevealed: true`
- Callbacks: `onGameFastestRevealed(true)`

### Stage 7: Next Question (handleNextRound)
- Triggered by: Spacebar or "Next Question" button → `gameActionHandlers.nextQuestion()`
- Resets all state: answers, submissions, timer, flags
- Re-broadcasts: `sendQuestionToPlayers` + IPC broadcast for new question
- Callbacks: Resets `onGameTimerFinished(false)`, `onGameAnswerRevealed(false)`, `onGameFastestRevealed(false)`
- Flow state: `sent-question` (back to stage 2)
- Player device: Gets new QUESTION message, shows fresh number keypad

---

## Quiz Pack Mode Flow

### Stage 1: Ready
- `handlePrimaryAction` case 'ready'
- If picture: sends picture first → flow 'sent-picture' → next click sends question
- If no picture: sends question with `normalizeQuestionTypeForBroadcast('nearest')` = `'numbers'` → flow 'sent-question'
- Player device: Shows picture and/or number keypad (type 'numbers')

### Stage 2: Sent Question → Start Timer
- `handlePrimaryAction` case 'sent-question'
- Starts timer, sends `TIMER_START` to players → flow 'running'
- Timer uses `getTotalTimeForQuestion` which correctly maps 'nearest'/'nearestwins' to nearestwins timer (flowState.ts line 74-76)

### Stage 3: Running / Timeup → Reveal Answer
- Triggered by: "Reveal Answer" button → calls BOTH `handleRevealAnswer()` AND `handlePrimaryAction()`
- **handleRevealAnswer** (QuizHost line 4886):
  - Calculates nearest wins scoring: closest guess to target number wins
  - Awards winner points to closest team(s)
  - Stores `fastestTeamIdForDisplay` for later use
  - Sends `nearest-wins-results` to external display (lines 5052-5098)
  - Broadcasts REVEAL to players with `type: question.type` (which is 'nearest') — player skips red X
- **handlePrimaryAction** case 'running'/'timeup' (QuizHost line 2471):
  - **SKIPS** external display send for nearest wins (our fix at line 2499-2501) — prevents overwrite
  - **SKIPS** broadcastAnswerReveal for nearest wins (our fix at line 2549-2552) — prevents double broadcast
  - Transitions flow to `'revealed'`
- Nav bar: Shows "Closest Team" (getFlowButton 'revealed' case, line 242-248, detects isNearest)

### Stage 4: Revealed → Closest Team
- Triggered by: "Closest Team" button → `handlePrimaryAction()` case 'revealed'
- Computes winnerGuess and winnerDifference (lines 2636-2645)
- Shows FastestTeamDisplay with `displayMode: 'closest'` (line 2649-2653)
- Broadcasts FASTEST to players WITH `guess` and `difference` (our fix at lines 2672-2676)
- Sends `nearest-wins-results` to external display with `closestTeamRevealed: true` (our fix at lines 2686-2733)
- Transitions flow to `'fastest'`

### Stage 5: Fastest → Next Question
- `handlePrimaryAction` case 'fastest'
- Advances to next question, resets all answer state
- Or ends round if last question

---

## Player Device Behavior (src-player)

| Message | Player Shows |
|---------|-------------|
| QUESTION (type 'numbers') | Number keypad for answer input |
| TIMER_START | Timer countdown visible |
| TIMEUP/LOCK | Keypad greyed out, locked |
| REVEAL (type 'nearest'/'nearestwins') | Correct answer displayed, "Your guess: X, Off by Y", **NO red X** |
| FASTEST (with guess/difference) | FastestTeamOverlay: team name, "Guessed: X, Off by Y" (5 second display) |

---

## Verified: No Issues Found

All stages are properly connected. No stages are skipped. The flow correctly goes through:
1. Config/Ready → Question sent → Timer → Timeup → Reveal Answer → Closest Team → Next Question
2. Player devices show the right content at each stage
3. External display shows the right content at each stage
4. Red X is properly skipped for nearest wins questions
5. Guess/difference data is properly passed to both player devices and external display
6. Pictures in quiz pack mode work (generic picture handling applies to all question types)
7. Timer uses the correct `nearestwins` timer setting
8. Question type properly normalized to 'numbers' for player keypad display
9. Excessive timer logging (every 100ms) has been removed
10. Double external display sends and double broadcasts are prevented in quiz pack mode
