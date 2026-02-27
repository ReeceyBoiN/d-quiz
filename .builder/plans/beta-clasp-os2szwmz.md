# Plan: Fix "Show Fastest Team" from Host Remote

## Issue Summary
When the user clicks "Show Fastest Team" from the host remote, it correctly sends the `show-fastest` admin command. However, in `QuizHost.tsx`, the admin command handler for `show-fastest` only calls `deps.handlePrimaryAction()`. While this works for Quiz Pack mode, it is insufficient for On-The-Spot modes (like Keypad). In On-The-Spot mode, the inner `KeypadInterface` must be told to reveal the fastest team via `gameActionHandlers.revealFastestTeam()`. Because this is missing, the Keypad UI never transitions to show the fastest team when triggered from the remote.

This is exactly the same root cause as the "Reveal Answer" and "Next Question" bug we fixed earlier, where On-The-Spot actions require their respective `gameActionHandlers` to be invoked.

## Recommended Approach

### 1. Update Admin Command Handler in `QuizHost.tsx`
Modify the `handleAdminCommand` listener in `QuizHost.tsx` specifically for the `show-fastest` command. It should behave identically to how the host app's UI triggers the action.

- Check if the host is in On-The-Spot mode (`!deps.isQuizPackMode`) and if `deps.gameActionHandlers?.revealFastestTeam` is available.
- If so, call `deps.gameActionHandlers.revealFastestTeam()`.
- Also check the `next-question-nav` and `reveal-answer` handlers in the admin command listener to ensure they are also cleanly applying this `gameActionHandlers` logic if needed (they were partially fixed, but checking for consistency is good).

#### Code Changes:
In `src/components/QuizHost.tsx`, update the `show-fastest` case:
```tsx
case 'show-fastest':
  if (deps.flowState.flow === 'fastest') {
    success = true;
    break;
  }
  
  // For on-the-spot mode, we MUST trigger the keypad's internal handler
  if (!deps.isQuizPackMode && deps.gameActionHandlers?.revealFastestTeam) {
    deps.gameActionHandlers.revealFastestTeam();
  } else {
    // For quiz pack mode, handlePrimaryAction manages the flow
    deps.handlePrimaryAction();
  }
  
  success = true;
  break;
```

## Critical Files to Modify
- `src/components/QuizHost.tsx`
