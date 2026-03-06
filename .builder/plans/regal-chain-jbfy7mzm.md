# Verify and Fix Nearest Wins in On-the-Spot and Quiz Pack Modes

## Verification Summary

### On-the-Spot Mode (NearestWinsInterface) - WORKING
- handleRevealAnswer (stage 1): broadcasts REVEAL with type 'nearestwins', sets gameAnswerRevealed
- handleRevealClosestTeam (stage 2): awards points, broadcasts FASTEST with guess/difference, sets gameFastestRevealed
- Timer countdown: side effects properly separated, fires exactly once
- handleNextRound: re-broadcasts QUESTION to players for subsequent questions
- handleStartTimer: sends timer to players via sendTimerToPlayers
- Nav bar: shows "Closest Team" button correctly (QuestionNavigationBar line 188)
- teamsAnsweredCorrectly: auto-set to true for nearest wins in flow state sync (QuizHost line 1349)
- Player red X: skipped for 'nearestwins' and 'nearest' reveal types

### Quiz Pack Mode - ISSUES FOUND

#### Issue 1: Double external display send overwrites nearest-wins-results with resultsSummary

When "Reveal Answer" is clicked in quiz pack mode, `onReveal` calls BOTH:
1. `handleRevealAnswer()` (line 4825) - sends `nearest-wins-results` to external display (line 4992-5038)
2. `handlePrimaryAction()` (line 2291) case 'running'/'timeup' - sends `resultsSummary` to external display (line 2517-2537)

The second send overwrites the first, so the external display shows a generic results summary instead of the nearest-wins-results format. This affects all nearest wins questions in quiz pack mode.

**Fix:** In `handlePrimaryAction` case 'running'/'timeup' (line 2497-2542), skip the external display send for nearest wins questions since `handleRevealAnswer()` already sends the correct `nearest-wins-results` format.

#### Issue 2: Double REVEAL broadcast to players

Both `handleRevealAnswer()` (line 5080) and `handlePrimaryAction` case 'running'/'timeup' (line 2546) call `broadcastAnswerReveal()`. Players receive two identical REVEAL messages. Not harmful but wasteful.

**Fix:** In `handlePrimaryAction` case 'running'/'timeup' (line 2545-2546), skip `broadcastAnswerReveal` for nearest wins since `handleRevealAnswer()` already broadcasts it.

#### Issue 3: broadcastFastest to players missing guess/difference for nearest wins

In `handlePrimaryAction` case 'revealed' (line 2661-2664), the broadcastFastest to player devices only sends `teamName`, `questionNumber`, `teamPhoto`. It does NOT include `guess` and `difference` like the on-the-spot mode does (NearestWinsInterface line 741-745). This means player devices don't show "guessed X, off by Y" for the closest team in quiz pack mode.

**Fix:** In `handlePrimaryAction` case 'revealed' (line 2661-2664), include `guess` and `difference` in the broadcastFastest data for nearest wins questions. The `winnerGuess` and `winnerDifference` are already computed at line 2636-2645.

#### Issue 4: External display shows generic 'fastestTeam' instead of nearest-wins-results when closest team revealed

In `handlePrimaryAction` case 'revealed' (line 2675-2677), the external display gets `mode: 'fastestTeam'` which shows a generic fastest team overlay. For nearest wins, it should send the nearest-wins-results with `closestTeamRevealed: true` (like on-the-spot mode does in NearestWinsInterface line 759-769).

**Fix:** In `handlePrimaryAction` case 'revealed', when the question is nearest wins type, send `nearest-wins-results` mode to external display with the full results data and `closestTeamRevealed: true`.

#### Issue 5: Excessive timer logging in on-the-spot mode

The timer display update effect (NearestWinsInterface line 568-582) logs every 100ms while the timer runs, creating thousands of log entries (visible in the user's logs). This was already identified in previous bug reports.

**Fix:** Remove or reduce the console.log calls in the timer display update effect (lines 568-582).

### Pictures in Quiz Pack Mode - WORKING
- `handlePrimaryAction` case 'ready' correctly detects `hasQuestionImage()` and sends the picture first (line 2312-2329)
- Flow: ready -> sent-picture -> sent-question -> running works for all question types
- The picture is broadcast to players and external display before the question
- Question type is normalized via `normalizeQuestionTypeForBroadcast` which maps 'nearest' -> 'numbers' for player keypad

---

## Files to Modify

### 1. `src/components/QuizHost.tsx`

**handlePrimaryAction case 'running'/'timeup' (~line 2471-2546):**
- Skip external display send (lines 2497-2542) when question type is 'nearest' or 'nearestwins' - handleRevealAnswer already sends the correct format
- Skip broadcastAnswerReveal (line 2546) when question type is 'nearest' or 'nearestwins' - handleRevealAnswer already broadcasts it

**handlePrimaryAction case 'revealed' (~line 2616-2694):**
- In the broadcastFastest data (lines 2661-2664), include `guess` and `difference` for nearest wins questions (values already computed at line 2636-2645)
- For external display send (lines 2675-2677), when the question is nearest wins type, send `nearest-wins-results` mode with full results data including `closestTeamRevealed: true`, instead of generic 'fastestTeam' mode

### 2. `src/components/NearestWinsInterface.tsx`

**Timer display update effect (~line 568-582):**
- Remove or significantly reduce the console.log calls that fire every 100ms
