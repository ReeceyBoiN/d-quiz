# Plan: Fix Spacebar Timer Trigger in Keypad On-The-Spot Mode

## Problem Statement

In keypad on-the-spot mode, spacebar should start the timer both:
1. **BEFORE** an answer has been selected/confirmed by the host
2. **AFTER** an answer has been selected/confirmed

Currently, spacebar only works AFTER an answer is selected.

## Root Cause

`QuestionNavigationBar.getSpacebarHandler()` calls `getOnTheSpotFlowButton()` which returns `null` when the on-the-spot timer buttons are shown (the state when `!isOnTheSpotTimerRunning && !onTheSpotTimerFinished`). This prevents the spacebar handler from being registered even though the "Start Timer" button is visible on screen.

Meanwhile, `KeypadInterface` has its own spacebar listener that only works when an answer is selected.

## Solution

Add a special case in `QuestionNavigationBar.getSpacebarHandler()` to detect when on-the-spot timer buttons should be shown and return the `onStartTimer` handler directly - without relying on `getOnTheSpotFlowButton()`.

This mirrors the quiz pack mode fix we just implemented.

**Location:** `src/components/QuestionNavigationBar.tsx`, function `getSpacebarHandler()` (lines 267-294)

**Implementation:** Add this check BEFORE the call to `getOnTheSpotFlowButton()`:

```typescript
// Special case: on-the-spot mode with timer buttons should trigger Start Timer
if (isOnTheSpotsMode && !isOnTheSpotTimerRunning && !onTheSpotTimerFinished) {
  return onStartTimer;
}
```

## Why This Works

- When spacebar is pressed in keypad mode before an answer is selected, QuestionNavigationBar's handler will now catch it and call `onStartTimer`
- When spacebar is pressed after an answer is selected, KeypadInterface's existing handler will catch it (as it does now)
- Since both handlers call the same `handleStartTimer()` function, either path works fine

## Files to Modify
- `src/components/QuestionNavigationBar.tsx` - Update `getSpacebarHandler()` function (add the special case check)

## Expected Outcome
Spacebar will start the timer in keypad on-the-spot mode regardless of whether an answer has been selected.
