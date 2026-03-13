# Fix: Infinite Re-render Loop in Buzz-In Timer

## Problem

When the start timer or silent timer is triggered in buzz-in on-the-spot mode, `[QuizHost] Timer starting` is logged thousands of times per second, creating an infinite loop that freezes the app.

## Root Cause

An infinite re-render cycle between `QuizHost` and `BuzzInDisplay`:

1. `onGameTimerStateChange` is an **inline arrow function** in QuizHost's JSX (line 6850), so it gets a **new reference on every render**
2. In BuzzInDisplay, `handleStartTimer` and `handleSilentTimer` are `useCallback` hooks that list `onGameTimerStateChange` as a dependency — so they get **recreated every render**
3. The `useEffect` (line 73) that registers handlers via `onGetActionHandlers` depends on `handleStartTimer`/`handleSilentTimer` — so it **re-runs every render**
4. `onGetActionHandlers` is `setGameActionHandlers` (a state setter), so calling it **triggers a QuizHost re-render**
5. The re-render creates a new inline `onGameTimerStateChange` → go to step 1

Additionally, when `onGameTimerStateChange(true, duration)` fires, it sets `flowState.flow = 'running'`, which triggers the QuizHost `useEffect` at line 1296 that calls `timer.start()` — this compounds the loop since it fires on every iteration.

## Solution

Two changes to break the cycle:

### 1. `src/components/BuzzInDisplay.tsx` — Remove `onGameTimerStateChange` from useCallback dependencies

Use a ref to hold `onGameTimerStateChange` so the callbacks don't need it as a dependency. This prevents the handler recreation chain.

- Add `const onGameTimerStateChangeRef = useRef(onGameTimerStateChange)` 
- Keep the ref updated: `useEffect(() => { onGameTimerStateChangeRef.current = onGameTimerStateChange; })`
- In `handleStartTimer` and `handleSilentTimer`, call `onGameTimerStateChangeRef.current?.(...)` instead of `onGameTimerStateChange?.(...)`
- Remove `onGameTimerStateChange` from both `useCallback` dependency arrays
- Same pattern for all other places that call `onGameTimerStateChange` (handleCorrectAnswer, handleWrongAnswer, timer countdown effect)

### 2. `src/components/QuizHost.tsx` — Don't set flow to 'running' for buzz-in mode

The `onGameTimerStateChange` callback currently sets `flowState.flow = 'running'`, which triggers the QuizHost timer-start `useEffect` that calls `timer.start()`. But BuzzInDisplay already manages its own timer internally — it doesn't need QuizHost's timer system. This causes a duplicate timer and the "Timer starting" spam.

- In the `onGameTimerStateChange` callback passed to BuzzInDisplay, only call `setGameTimerRunning(isRunning)` and `setGameTimerFinished(false)` — do **not** call `setFlowState` to set `flow: 'running'`. The BuzzInDisplay component handles its own countdown timer internally.

## Files to Modify

1. `src/components/BuzzInDisplay.tsx` — Use ref for `onGameTimerStateChange` to stabilize callback references
2. `src/components/QuizHost.tsx` — Remove `setFlowState` from BuzzInDisplay's `onGameTimerStateChange` callback
