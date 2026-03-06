# Fix Nearest Wins Player Input Bug & Add Nearest Wins to QuizPack Mode

## Part 1: Bug Fix — On-the-Spot Nearest Wins not always showing number input on players

### Root Causes Identified

1. **Missing QUESTION re-broadcast on "Next Round"** (`NearestWinsInterface.tsx:687`): When the host moves to the next question via `handleNextRound`, the QUESTION message is NOT re-broadcast to player devices. Players stay on whatever screen they had, and don't see the number keypad for the new question.

2. **Missing TIMER_START broadcast** (`NearestWinsInterface.tsx:392`): When the host starts the timer via `handleStartTimer`, no `TIMER_START` message is sent to players. This means players don't see a timer countdown, and response times can't be accurately tracked. The timer only runs locally on the host.

3. **Inconsistent IPC call patterns**: NearestWinsInterface uses `api.ipc.invoke('network/broadcast-question')` directly, while QuizHost uses `api.network.broadcastQuestion()`. The QuizHost method also has HTTP API fallback logic. The NearestWinsInterface should use the same pattern as other components for consistency and reliability.

### Fix Plan

**File: `src/components/NearestWinsInterface.tsx`**

1. **Add `sendTimerToPlayers` import** (already imports `sendTimeUpToPlayers` from `wsHost`).

2. **In `handleStartTimer`**: After setting up the local timer, call `sendTimerToPlayers(durationToUse, isSilent, Date.now())` to notify player devices that the timer has started. This ensures players see the timer and response times are tracked.

3. **In `handleNextRound`**: Add a QUESTION re-broadcast to player devices (same pattern as `handleStartRound` line 370), so players get the number keypad again for the new question. Also re-broadcast via IPC to ensure players transition to the question screen.

4. **In `handleStartRound`**: Consider also using `sendQuestionToPlayers` from wsHost in addition to the IPC broadcast, for consistency and reliability. The current IPC-only broadcast may fail silently if the API is not available.

---

## Part 2: Feature — Nearest Wins mode in QuizPack

### How it works currently
- Quiz pack questions with `userView === 'numbers'` get type `'nearest'` from the quiz loader (`quizLoader.js:69`)
- Questions from rounds with `roundGame === 'Nearest Wins'` also get type `'nearest'` (`quizLoader.js:71`)
- In quizpack mode, the type gets normalized to `'numbers'` for player broadcast (so players see number keypad — this is correct)
- However, the scoring in `handleRevealAnswer` uses **exact match** comparison for all quizpack questions, which doesn't work for nearest wins (should be "closest guess wins")
- The config screen shows the full Points/Speed Bonus/Go Wide/Evil Mode panel, but nearest wins only needs a single "Winner Points" slider

### Implementation Plan

**File: `src/components/QuizPackDisplay.tsx`**

1. **Detect nearest wins questions**: Check if `currentQuestion.type === 'nearest'` to determine if the current question is a nearest wins question.

2. **Show simplified config for nearest wins**: When the current question is 'nearest' type, show a simplified config screen with just a single "Winner Points" slider (matching the NearestWinsInterface config screen style at line 788-860) instead of the full Points/Speed Bonus/Go Wide/Evil Mode config. This means hiding Speed Bonus, Go Wide, Evil Mode cards and replacing the Points card with a "Winner Points" card.

3. **Add `onWinnerPointsChange` prop**: Add a callback to communicate winner points to the parent (QuizHost) separately from regular points. Or reuse the existing `onPointsChange` prop since nearest wins only needs one points value.

**File: `src/components/QuizHost.tsx`**

4. **Track nearest wins state for quizpack**: Add state/logic to detect when the current quizpack question is 'nearest' type and handle it differently in the reveal flow.

5. **Modify `handleRevealAnswer`** (line 4791): For 'nearest' type questions in quizpack mode, instead of exact match comparison:
   - Get the correct answer (target number) from `getAnswerText(currentQuestion)` — this will come from `answerText` or `meta.short_answer`
   - Parse each team's answer as a number
   - Calculate `Math.abs(teamGuess - correctAnswer)` for each team
   - Find the team(s) with the smallest difference (closest guess)
   - Award winner points to the closest team(s) — use `currentRoundWinnerPoints` or the points value from the slider
   - Skip speed bonus / staggered / go-wide logic for nearest wins (it's just winner points to the closest guess)

6. **Modify `handlePrimaryAction`** flow: The flow state machine for nearest wins quizpack questions should work the same as regular questions (ready → sent-picture/sent-question → running → timeup → revealed → fastest → next). The only difference is in scoring.

7. **Update external display**: When revealing a nearest wins answer in quizpack mode, send the correct answer (target number) and results with differences (like the on-the-spot NearestWinsInterface does) to the external display.

**File: `src/utils/quizHostHelpers.ts`**

8. **Update `getAnswerText`**: Add handling for 'nearest' type questions — return `meta.short_answer` or `answerText` (the target number). This already falls through to the generic case, so it should work, but add an explicit case for clarity.

**File: `src/state/flowState.ts`**

9. **Fix `getTotalTimeForQuestion`**: Currently maps both 'nearest' AND 'numbers' to `nearestwins` timer (line 74-76). Regular 'numbers' questions should use the `keypad` timer. Only 'nearest' should use `nearestwins` timer. Fix the switch case to separate 'numbers' from 'nearest'.

### Key Files to Modify
- `src/components/NearestWinsInterface.tsx` — Bug fixes (re-broadcast, timer)
- `src/components/QuizPackDisplay.tsx` — Nearest wins config UI for quizpack
- `src/components/QuizHost.tsx` — Nearest wins scoring in quizpack reveal flow
- `src/utils/quizHostHelpers.ts` — getAnswerText for nearest type
- `src/state/flowState.ts` — Fix timer mapping for numbers vs nearest
