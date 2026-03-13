# Fix: On-the-spot buzz-in mode losing sync with player devices

## Problem Summary

When the host starts an on-the-spot buzz-in mode, player devices sometimes don't show the buzzer (or show it briefly then revert to the waiting screen). The host has to go back to the home screen and re-enter buzz-in mode to fix it.

## Root Cause Analysis

There are **3 interacting bugs** causing this, all in the periodic "safety-net" sync system:

### Bug 1: Display mode sync doesn't know about on-the-spot buzz-in (`QuizHost.tsx:5696`)

The periodic display mode sync checks `isGameActive` to pause broadcasts during games, but only checks `showBuzzInInterface` (pre-loaded buzz-in). It does **not** check `showBuzzInMode` (on-the-spot buzz-in). Result: the host keeps broadcasting `DISPLAY_MODE: basic` every second, which tells the player to show the waiting screen instead of the buzzer.

### Bug 2: Flow state sync has NO game-active guard at all (`QuizHost.tsx:5714-5733`)

The periodic flow state sync broadcasts every second with no pause during active games. When buzz-in starts, there's a React state/ref timing gap — `setFlowState({flow: 'ready'})` is called, but `flowStateRef.current` (used by the interval) doesn't update until the next render cycle. The interval fires with stale `flow: 'idle'`, which tells the player to exit the question screen.

### Bug 3: Player has no protection against stale messages (`App.tsx:534-539`)

When a player receives `FLOW_STATE` with `flow: 'idle'`, it immediately calls `resetQuestionState()` and transitions to the display screen — even if the player just received a `QUESTION` message milliseconds earlier. There's no grace period or timestamp comparison.

## Fix Plan

### Fix 1: Add `showBuzzInMode` to display mode sync guard
**File:** `src/components/QuizHost.tsx` ~line 5696

Add `showBuzzInMode` to the `isGameActive` check so on-the-spot buzz-in pauses the display mode broadcasts (same as other game modes already do).

```
Before: const isGameActive = showKeypadInterface || showBuzzInInterface || showNearestWinsInterface || showQuizPackDisplay || showWheelSpinnerInterface;
After:  const isGameActive = showKeypadInterface || showBuzzInInterface || showBuzzInMode || showNearestWinsInterface || showQuizPackDisplay || showWheelSpinnerInterface;
```

Also add `showBuzzInMode` to the useEffect dependency array on line 5711.

### Fix 2: Add game-active guard to flow state sync
**File:** `src/components/QuizHost.tsx` ~line 5714-5733

Add the same `isGameActive` early-return to the flow state sync interval, matching the pattern already used by the display mode sync. This prevents stale `idle` broadcasts from interrupting active game modes.

Also add the game-mode state variables to the useEffect dependency array so the interval restarts when game modes change.

### Fix 3: Synchronously update `flowStateRef` when buzz-in starts
**File:** `src/components/QuizHost.tsx` in `handleBuzzInStart` (~line 3302)

After calling `setFlowState(...)`, also directly set `flowStateRef.current` to close the React render-cycle timing gap. This ensures any interval that fires before the next render sees the correct state.

### Fix 4: Add question-receipt grace period on player side
**File:** `src-player/src/App.tsx`

Add a ref that tracks when the last QUESTION message was received. In `applyFlowStateUpdate`, when `flow === 'idle'`, check if a QUESTION was received within the last ~3 seconds. If so, ignore the idle flow state to prevent stale messages from kicking the player out of the question screen.

This is a defense-in-depth measure — the host-side fixes (1-3) should prevent the bad messages, but this protects against any remaining edge cases or network reordering.

## Files to Modify

1. `src/components/QuizHost.tsx` — Fixes 1, 2, 3
2. `src-player/src/App.tsx` — Fix 4
