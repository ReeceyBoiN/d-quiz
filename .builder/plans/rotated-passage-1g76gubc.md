# Fix: Buzz-In On-The-Spot Mode Timer Not Starting

## Problem

When in buzz-in on-the-spot mode, pressing the timer buttons in the NavBar does nothing. The logs show:

```
gameActionHandlers: NULL
Calling gameActionHandlers.startTimer with duration: undefined
```

**Root cause**: The `BuzzInDisplay` component does not register `gameActionHandlers` with the parent `QuizHost`. Both `KeypadInterface` and `NearestWinsInterface` use the `onGetActionHandlers` prop to register their timer/action handlers, but `BuzzInDisplay` was never given this prop. So `gameActionHandlers` stays `null` when buzz-in mode is active.

## Solution

Add `onGetActionHandlers` and `onGameTimerStateChange` props to `BuzzInDisplay`, create the necessary handler callbacks inside it, and register them via a `useEffect` — matching the pattern used by `KeypadInterface`.

## Files to Modify

### 1. `src/components/BuzzInDisplay.tsx`

- **Add props**: `onGetActionHandlers` and `onGameTimerStateChange` to `BuzzInDisplayProps` interface
- **Create `handleStartTimer` callback**: Sets `timeRemaining` to the buzzin timer duration (from `gameModeTimers.buzzin` or custom duration), sets `timerStarted = true`, broadcasts timer start to players via `sendTimerToPlayers()`, and calls `onGameTimerStateChange(true, duration)`
- **Create `handleSilentTimer` callback**: Same as `handleStartTimer` but passes `silent: true` to `sendTimerToPlayers()`
- **Add `useEffect`** to register handlers via `onGetActionHandlers({ startTimer, silentTimer })` — similar to KeypadInterface pattern at line 1500
- **Call `onGameTimerStateChange(false)`** when timer stops (in timer countdown effect when `timeRemaining === 0`, and in `handleCorrectAnswer`/`handleWrongAnswer` when timer is cleared)

### 2. `src/components/QuizHost.tsx`

- **Pass `onGetActionHandlers={setGameActionHandlers}`** to the `BuzzInDisplay` component (around line 6842)
- **Pass `onGameTimerStateChange` callback** to `BuzzInDisplay` — same pattern as KeypadInterface (around line 7030)

## Implementation Notes

- The timer duration should come from `gameModeTimers.buzzin` (already available in BuzzInDisplay via `useSettings()`)
- `sendTimerToPlayers` needs to be imported in BuzzInDisplay from `../network/wsHost`
- The `handleStartTimer` should be wrapped in `useCallback` with proper dependencies
- Only `startTimer` and `silentTimer` handlers are needed for buzz-in mode (no `reveal`, `nextQuestion`, etc. since those flows are handled differently in buzz-in)
