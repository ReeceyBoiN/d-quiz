# Buzz-In Mode: Fail Sound Fix & Re-Buzz Logic Fix

## Problem 1: Duplicate/Wrong Fail Sounds in Buzz-In Mode
Currently, when the host marks a buzz-in answer as wrong, **two** sounds play:
1. `playFailSound()` — picks a random file from the general `Fail Sounds` folder (intended for other game modes)
2. `playBuzzWrongSound()` — plays the specific `buzz in - wrong.wav` (the correct one for buzz-in)

**Fix**: Remove the `playFailSound()` call from buzz-in wrong-answer handlers so only `playBuzzWrongSound()` plays.

### Files to change:
1. **`src/components/QuizHost.tsx` ~line 6146** — `handleBuzzWrong` callback: remove `playFailSound()` call
2. **`src/components/BuzzInDisplay.tsx` ~line 97** — `handleWrongAnswer` callback: remove `playFailSound()` call

## Problem 2: Re-Buzz After Wrong Answer
The current logic looks correct based on code review:
- When `oneGuessPerTeam` is OFF, `handleBuzzWrong` in QuizHost.tsx does NOT add the team to `buzzLockedOutTeams` (line 6149-6156)
- It sends `sendBuzzResetToPlayers([])` with an empty locked-out list when `oneGuessPerTeam` is off (line 6175-6177)
- Player-side `BUZZ_RESET` handler (App.tsx line 1321-1338) correctly clears `buzzLockedBy` and `buzzLockedOut` for teams not in the locked list, and resets `submittedAnswer` so they can buzz again

However, there's a subtle issue: `BUZZ_RESULT` is sent **before** `BUZZ_RESET`. The `BUZZ_RESULT` handler (line 1341-1350) clears `buzzLockedBy` but does NOT clear `submittedAnswer` or `buzzLockedOut`. This means:
- The team that buzzed still has `submittedAnswer` set (which disables the button via `disabled={timerEnded || submitted}`)
- `BUZZ_RESET` comes after and fixes this for non-locked teams, but if there's a race condition or the messages arrive in unexpected order, the UI could stay stuck

The `BUZZ_RESET` message does handle this correctly by setting `setSubmittedAnswer(null)` for unlocked teams (line 1333). So the flow should work. But let me also verify the BuzzInDisplay.tsx (on-the-spot mode) has the same correct logic.

**BuzzInDisplay.tsx issue**: In `handleWrongAnswer`, the on-the-spot buzz-in display resets state correctly — it sets `state` back to "waiting", clears `buzzedTeam`, and calls `sendBuzzResetToPlayers`. This looks correct.

## Summary of Changes

### File 1: `src/components/QuizHost.tsx`
- Line 6146: Remove `playFailSound().catch(...)` from `handleBuzzWrong` — only keep `playBuzzWrongSound()`

### File 2: `src/components/BuzzInDisplay.tsx`  
- Line ~97 in `handleWrongAnswer`: Remove `playFailSound().catch(...)` — only keep `playBuzzWrongSound()`

These are the only changes needed. The re-buzz logic after wrong answer already works correctly when `oneGuessPerTeam` is disabled.
