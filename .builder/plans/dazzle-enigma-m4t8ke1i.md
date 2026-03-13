# Fix: BuzzInDisplay Timer Not Working After Memory Leak Fix

## Problem

After the previous memory leak fix (which correctly prevented setting `flowState` to `'running'` for BuzzInDisplay), the timer in buzz-in on-the-spot mode no longer works visually. The timer starts internally in BuzzInDisplay but the QuestionNavigationBar shows nothing — no progress bar, no timer buttons, no flow button.

## Root Cause

BuzzInDisplay is missing two callback props that KeypadInterface and NearestWinsInterface have:

1. **`onGameTimerUpdate`** — Reports `timeRemaining` and `totalTime` back to QuizHost on every tick. Without this, `gameTimerTimeRemaining` and `gameTimerTotalTime` stay at `0`, so the progress bar condition `totalTime > 0` fails and no progress bar renders.

2. **`onGameTimerFinished`** — Reports when the timer finishes. Without this, `gameTimerFinished` is never set to `true`, which means the QuestionNavigationBar never transitions to showing the post-timer flow buttons (Reveal Answer, Next Question, etc.).

**What happens currently:**
- Timer starts → `gameTimerRunning = true` → timer buttons hidden, flow button returns `null`, progress bar skipped (totalTime=0) → **empty nav bar**
- Timer finishes → `gameTimerRunning = false` but `gameTimerFinished` stays `false` → timer buttons re-appear instead of "Reveal Answer"

## Solution

Add `onGameTimerUpdate` and `onGameTimerFinished` props to BuzzInDisplay, matching the pattern already used by KeypadInterface.

### Files to Modify

#### 1. `src/components/BuzzInDisplay.tsx`

- Add `onGameTimerUpdate` and `onGameTimerFinished` props to the interface
- In the timer countdown `useEffect` (line ~236), call `onGameTimerUpdate` on each tick with the current `timeRemaining` and `totalTime`
- When timer reaches 0 (line ~242), call `onGameTimerFinished(true)` in addition to the existing `onGameTimerStateChangeRef.current?.(false)`
- Store totalTime in a ref/state so it can be reported each tick

#### 2. `src/components/QuizHost.tsx`

- Add `onGameTimerUpdate` and `onGameTimerFinished` props to the BuzzInDisplay rendering (line ~6849), matching the pattern used for KeypadInterface:
  ```tsx
  onGameTimerUpdate={(remaining, total) => {
    setGameTimerTimeRemaining(remaining);
    setGameTimerTotalTime(total);
  }}
  onGameTimerFinished={setGameTimerFinished}
  ```

### No other files need changes
The QuestionNavigationBar already handles `isOnTheSpotTimerRunning`, `timeRemaining`, `totalTime`, and `onTheSpotTimerFinished` correctly — it just needs to receive proper values.
