# Fix: Nearest Wins — Split Reveal Flow, Timer Delay, Remove Red X

## Issue 1: Reveal Answer jumps straight to Closest Team reveal

### Root Cause
In `NearestWinsInterface.tsx`, `handleRevealResults` (line 658) does everything in one shot:
- Sets `onGameAnswerRevealed(true)` AND `onGameFastestRevealed(true)` simultaneously (lines 693-698)
- Awards points immediately
- Broadcasts FASTEST to players immediately
- Sends results to external display immediately

This means the nav bar skips the intermediate "Closest Team" button state — it goes from "Reveal Answer" straight to "Next Question" because both `answerRevealed` and `fastestRevealed` are set at the same time.

### Fix
Split `handleRevealResults` into two separate functions:

**`handleRevealAnswer`** (triggered by "Reveal Answer" button):
- Sets `answerRevealed = true`
- Calls `onFlowStateChange('revealed')`
- Calls `onGameAnswerRevealed(true)` only (NOT `onGameFastestRevealed`)
- Broadcasts REVEAL to player devices (correct answer)
- Sends `nearest-wins-results` to external display (answer only, no winner highlight yet)

**`handleRevealClosestTeam`** (triggered by "Closest Team" button):
- Calls `onGameFastestRevealed(true)`
- Awards points to the closest team(s)
- Broadcasts FASTEST to player devices (closest team overlay)
- Updates external display with full results including winner highlight

**Files to modify:**

1. **`src/components/NearestWinsInterface.tsx`**:
   - Rename `handleRevealResults` → split into `handleRevealAnswer` + `handleRevealClosestTeam`
   - Update `handlersRef` to include a `revealClosestTeam` handler
   - Update `onGetActionHandlers` to expose `revealClosestTeam` to parent

2. **`src/components/QuizHost.tsx`**:
   - The `onRevealFastestTeam` handler at line 6889 already calls `gameActionHandlers?.revealFastestTeam?.()` — this will now map to the new `handleRevealClosestTeam` function
   - Update `setGameActionHandlers` type if needed to include `revealClosestTeam`

3. **`src/components/QuestionNavigationBar.tsx`**:
   - The nav bar already handles the two-stage flow correctly via `getOnTheSpotFlowButton()`:
     - Line 185: `onTheSpotAnswerRevealed && !onTheSpotFastestRevealed` → shows "Closest Team"
     - Line 204: `onTheSpotFastestRevealed` → shows "Next Question"
     - Line 301-303: "Closest Team" maps to `onRevealFastestTeam`
   - No changes needed here — it already supports the two-stage flow, it just wasn't being triggered correctly

---

## Issue 2: 5-10 second delay before "Reveal Answer" button appears

### Root Cause
The timer countdown effect (line 500-552) runs side effects inside the `setCountdown` state updater function:

```ts
setCountdown(prev => {
  const newValue = prev - 0.1;
  if (newValue < 0) {
    setIsTimerRunning(false);      // side effect inside state updater
    onFlowStateChange('timeup');   // side effect
    setTimerLocked(true);          // side effect
    sendTimeUpToPlayers();         // side effect
    onGameTimerFinished(true);     // side effect - KEY for nav bar
    setCurrentScreen('results');   // side effect
    return 0;
  }
  return newValue;
});
```

Problems:
1. React may call the state updater multiple times (StrictMode, concurrent features)
2. The setInterval continues firing every 100ms. Since `setIsTimerRunning(false)` is async, the interval fires again with `prev = 0`, computes `0 - 0.1 = -0.1 < 0`, and re-triggers ALL side effects. This can happen several times before React processes the state update and the useEffect cleanup clears the interval.
3. All these duplicate side effects (duplicate TIMEUP broadcasts, duplicate state sets) can cause state thrashing and delays in the nav bar condition becoming stable.

The logs confirm this — there are TWO sets of TIMEUP/LOCK broadcasts about 7 seconds apart.

### Fix
Move side effects OUT of the state updater. Use a ref to track "timer finished" and a separate useEffect to handle the finish logic:

```ts
const timerFinishedRef = useRef(false);

// Timer countdown - only updates countdown value
useEffect(() => {
  let interval: NodeJS.Timeout;
  if (isTimerRunning) {
    timerFinishedRef.current = false;
    interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return 0;
        const newValue = prev - 0.1;
        if (newValue < 0) return 0;
        return newValue;
      });
    }, 100);
  }
  return () => clearInterval(interval);
}, [isTimerRunning]);

// Separate effect to handle timer reaching 0
useEffect(() => {
  if (countdown !== null && countdown <= 0 && isTimerRunning && !timerFinishedRef.current) {
    timerFinishedRef.current = true;
    setIsTimerRunning(false);
    onFlowStateChange?.('timeup');
    setTimerLocked(true);
    onTimerLockChange?.(true);
    sendTimeUpToPlayers();
    onGameTimerFinished?.(true);
    if (answerConfirmed) {
      setCurrentScreen('results');
    }
  }
}, [countdown, isTimerRunning, answerConfirmed]);
```

This ensures:
- Side effects fire exactly once when countdown reaches 0
- No duplicate TIMEUP broadcasts
- The `gameTimerFinished` state is set cleanly, allowing the nav bar to show "Reveal Answer" immediately

**File to modify:** `src/components/NearestWinsInterface.tsx`

---

## Issue 3: Red X showing on player device for nearest wins questions

### Root Cause
When the answer is revealed, the player's `REVEAL` handler (App.tsx line 873) calls `determineAnswerCorrectness()` which does exact numeric comparison for 'numbers' type questions. Since nearest wins sends `type: 'numbers'` to players (via `sendQuestionToPlayers`), any guess that doesn't exactly match the target shows the red X overlay.

The REVEAL broadcast from NearestWinsInterface sends `type: 'nearestwins'` (line 671), but the player's `currentQuestion.type` is 'numbers' (set from the QUESTION message). The `cachedQuestionType` at line 846 picks up 'numbers', so the comparison is exact.

### Fix
In the player's REVEAL handler (App.tsx ~line 860-883), check if the reveal data type is 'nearestwins'. If so, skip the answer correctness feedback entirely — don't show the red X or green checkmark, since nearest wins isn't about right/wrong but about closest guess.

```ts
// Skip correctness feedback for nearest wins questions
const revealType = message.data?.type?.toLowerCase();
if (revealType === 'nearestwins' || revealType === 'nearest') {
  // Don't show correct/incorrect overlay for nearest wins
  setShowAnswerFeedback(false);
  setIsAnswerCorrect(undefined);
} else {
  // Normal correctness check
  const isCorrect = determineAnswerCorrectness(...);
  setShowAnswerFeedback(true);
  setIsAnswerCorrect(isCorrect);
}
```

**File to modify:** `src-player/src/App.tsx`

---

## Files to Modify

1. **`src/components/NearestWinsInterface.tsx`**
   - Split `handleRevealResults` into `handleRevealAnswer` + `handleRevealClosestTeam`
   - Fix timer countdown to move side effects out of state updater
   - Update action handlers to expose `revealClosestTeam`

2. **`src-player/src/App.tsx`**
   - Skip answer correctness feedback for nearest wins REVEAL messages

3. **`src/components/QuizHost.tsx`** (minor, if needed)
   - Verify `gameActionHandlers.revealFastestTeam` is wired correctly to new handler
