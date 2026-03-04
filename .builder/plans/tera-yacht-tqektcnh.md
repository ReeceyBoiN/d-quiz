## Goal
Ensure player devices exit the question answer UI and return to the normal idle display when the host ends a question (immediately on NEXT or END_ROUND), matching the host state and avoiding stale question input.

## Key Findings
- Player question UI is shown whenever `currentScreen === 'question'` (and `ready-for-question`).
- `NEXT` currently clears question state but sets `currentScreen` to `'ready-for-question'`, which keeps the answer input visible (src-player/src/App.tsx:589-625).
- There is no `END_ROUND` handler in the player app, so players can stay in question UI if the host ends a round without sending a display update.

## Recommended Approach
1. Update player message handling to treat `NEXT` and `END_ROUND` as “question ended” events and immediately return to the idle display screen.
2. Reuse the existing question-reset logic from the `NEXT` handler so both events clear question state identically.
3. Preserve host controller behavior by skipping the screen transition to idle if the device is an authenticated host controller (so they stay on the terminal).

## Planned Code Changes
- **src-player/src/App.tsx**
  - Extract the question cleanup logic from the `NEXT` case into a small local helper (e.g., `resetQuestionState()`), then call it from both `NEXT` and the new `END_ROUND` case.
  - Update `NEXT` handler to set `currentScreen` to `'display'` instead of `'ready-for-question'` when not a host controller and not in buzzer-selection deferral.
  - Add `END_ROUND` handler:
    - Respect `shouldIgnoreScreenTransition` like other screen changes.
    - Call the shared reset helper to clear question-related UI state.
    - Clear any pending timers (displayModeTimerRef, fastestTeamTimerRef, timerLockDelayRef).
    - Set `currentScreen` to `'display'` (unless `isHostController`).

## Notes / Rationale
- This keeps the player UI aligned with the host flow by ensuring the answer keypad disappears as soon as a question ends, without waiting for a separate DISPLAY_MODE broadcast.
- Using a shared reset helper avoids divergence between `NEXT` and `END_ROUND` cleanup behavior.

## Files to Modify
- src-player/src/App.tsx
