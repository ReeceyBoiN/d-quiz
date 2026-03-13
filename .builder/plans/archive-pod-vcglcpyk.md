# Fix: "END ROUND" button should be "NEXT QUESTION" in on-the-spot buzz-in mode

## Problem

After a team answers correctly in on-the-spot buzz-in mode, the center button says "END ROUND" and calls `onEndRound` (which is `handleBuzzInEnd`). This exits buzz-in mode entirely and returns to the home screen. There's already an "END BUZZ-IN MODE" button at the bottom for that purpose, so the center button is redundant. The center button should instead reset the display back to "waiting" state so the host can run another buzz-in question.

## Fix

### File: `src/components/BuzzInDisplay.tsx`

In the `state === "complete"` section (~line 320-332):

1. Change the button text from "END ROUND" to "NEXT QUESTION"
2. Instead of calling `onEndRound`, create an internal `handleNextQuestion` function that:
   - Resets `state` back to `"waiting"`
   - Clears `buzzedTeam` to `null`
   - Clears `lockedOutTeams`
   - Resets timer state (`timeRemaining`, `timerPaused`, `timerStarted`)
   - Sends `sendBuzzResetToPlayers([])` to unlock all player devices for the next question
   - Calls `onTeamBuzzReset` for all teams that had buzzed (to clear QuizHost's `teamAnswers` and `buzzInModeHandledBuzzesRef`)

No changes needed in `QuizHost.tsx` — the existing `onEndRound`/`handleBuzzInEnd` remains wired to the bottom "END BUZZ-IN MODE" button, which is correct.
