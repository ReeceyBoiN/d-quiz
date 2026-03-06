# Fix: Nearest Wins - Missing Nav Button, Player Device Reset, Double Audio, Excessive Logging

## Root Cause Analysis

All four issues share a single root cause: **NearestWinsInterface is missing the `onGameTimerFinished`, `onGameAnswerRevealed`, and `onGameFastestRevealed` callbacks** that KeypadInterface already has. This means QuizHost never knows when the nearest wins timer finishes, when the answer is revealed, or when the closest team is shown. This cascading failure causes:

### Issue 1: No blue button on bottom nav during results
- `QuizHost.tsx:6845` only shows QuestionNavigationBar when `nearestWinsCurrentScreen === 'playing'`, not `'results'`.
- Even if we add `'results'`, the nav bar's `getOnTheSpotFlowButton()` relies on `onTheSpotTimerFinished`, `onTheSpotAnswerRevealed`, `onTheSpotFastestRevealed` props — which are never set for nearest wins because the callbacks are missing.

### Issue 2: Player device goes back to default
- `QuizHost.tsx:1328` has a sync effect that resets flow to `'idle'` when `!gameTimerRunning && !gameTimerFinished && !gameAnswerRevealed && !gameFastestRevealed`. Since `gameTimerFinished` is never set to `true` for nearest wins, this fires immediately after the timer stops — broadcasting `flow: 'idle'` to players, which exits them to the "Please wait for host" screen.

### Issue 3: Double timer sound
- When spacebar is pressed on the 'playing' screen, **two** keydown handlers fire:
  1. `NearestWinsInterface.tsx:632` — calls `handleStartTimer()` → plays audio
  2. `QuestionNavigationBar.tsx:103` — calls `onStartTimer` → `handleNavBarStartTimer` → `gameActionHandlers.startTimer` → calls `handleStartTimer()` again → plays audio a second time

### Issue 4: Excessive logging
- Related to Issue 2: the flow state bouncing to `'idle'` triggers cascading state updates and periodic broadcast logs. The flow state sync (every 1s) broadcasts `'idle'` which causes player reconnection/away messages to multiply.

---

## Fix Plan

### Step 1: Add missing game state callbacks to NearestWinsInterface

**File: `src/components/NearestWinsInterface.tsx`**

Add three new props to the interface and component:
```
onGameTimerFinished?: (finished: boolean) => void;
onGameAnswerRevealed?: (revealed: boolean) => void;
onGameFastestRevealed?: (revealed: boolean) => void;
```

Call them at appropriate lifecycle points:
- `onGameTimerFinished(true)` — when timer reaches 0 (in the countdown effect, line ~496-500)
- `onGameTimerFinished(false)` — when timer starts (in handleStartTimer) and when resetting (handleNextRound)
- `onGameAnswerRevealed(true)` — in `handleRevealResults` (line ~657)
- `onGameAnswerRevealed(false)` — in `handleNextRound` (line ~722)
- `onGameFastestRevealed(true)` — in `handleRevealResults` after awarding points (since nearest wins reveals answer + closest team in one step)
- `onGameFastestRevealed(false)` — in `handleNextRound`

Also add useEffect syncs (like KeypadInterface lines 1726-1744) to keep parent in sync.

### Step 2: Wire callbacks from QuizHost

**File: `src/components/QuizHost.tsx`**

Pass the three new props to NearestWinsInterface (around line 6546-6575):
```
onGameTimerFinished={setGameTimerFinished}
onGameAnswerRevealed={setGameAnswerRevealed}
onGameFastestRevealed={setGameFastestRevealed}
```

### Step 3: Show QuestionNavigationBar on results screen

**File: `src/components/QuizHost.tsx`**

Change line 6845 from:
```
(showNearestWinsInterface && nearestWinsCurrentScreen === 'playing')
```
to:
```
(showNearestWinsInterface && (nearestWinsCurrentScreen === 'playing' || nearestWinsCurrentScreen === 'results'))
```

### Step 4: Fix double spacebar / timer sound

**File: `src/components/NearestWinsInterface.tsx`**

Remove the timer-start case from NearestWinsInterface's own spacebar handler (lines 637-640). Since QuestionNavigationBar is visible during 'playing' and already handles spacebar → startTimer, having both causes double execution.

Keep the results screen spacebar handling only if QuestionNavigationBar can't cover it. Since we're making the nav bar visible on 'results' screen (Step 3), and the nav bar's `getOnTheSpotFlowButton()` will now work correctly (Step 1), we can remove NearestWinsInterface's spacebar handler entirely and rely on QuestionNavigationBar.

### Step 5: Handle the reveal flow for closest team

In nearest wins, `handleRevealResults` does both: reveals the answer AND shows the closest team in one action. After that, the next action is "Next Question". So:
- After reveal: set `gameAnswerRevealed(true)` AND `gameFastestRevealed(true)` — this skips the intermediate "Closest Team" button and shows "Next Question" directly on the nav bar.

---

## Files Modified
1. `src/components/NearestWinsInterface.tsx` — Add props, callbacks, remove spacebar handler
2. `src/components/QuizHost.tsx` — Pass new props, update isVisible condition
