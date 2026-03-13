# Fix: Cross-Display Sync for Buzz-In Correct Answer Events

## Problem

When a team's answer is confirmed correct in buzz-in mode (both quiz pack and on-the-spot):
1. Player devices don't show the winning team name/photo (no "fastest team" overlay)
2. The correct answer isn't displayed on player devices or external display
3. After marking correct, the host UI still shows timer buttons and the question stays live instead of showing only "Next Question"
4. Other teams aren't properly blocked from buzzing after a correct answer is confirmed
5. Spacebar can still trigger timer actions when it should be disabled

## Root Cause

`handleBuzzCorrect` (quiz pack) sends `BUZZ_RESULT` and `buzzin-correct` to external display, but:
- Never sends `FASTEST` message to player devices (so no FastestTeamOverlay appears)
- Never transitions flowState to `'fastest'` (so NavBar keeps showing timer buttons instead of "Next Question")
- Clears `buzzWinnerTeamId` immediately, which removes the host's buzz panel but doesn't signal completion to the flow

`BuzzInDisplay.handleCorrectAnswer` (on-the-spot) has the same gaps - no FASTEST broadcast, no external display update, and no flowState transition.

## Changes

### 1. `src/components/QuizHost.tsx` — `handleBuzzCorrect` (quiz pack buzz-in)

**Current behavior:** Awards points, plays sounds, sends BUZZ_RESULT + buzzin-correct to external, clears state.

**Add after current logic:**
- Broadcast `FASTEST` to player devices (team name + photo) via `(window as any).api.network.broadcastFastest()`
- Also broadcast via in-memory `sendFastestToDisplay()` from wsHost for non-Electron
- Include the correct answer in the BUZZ_RESULT or as a separate field in FASTEST data
- Transition flowState to `'fastest'` so QuestionNavigationBar shows "Next Question" only
- Set `buzzTimerExpired = false` to ensure timer UI is hidden
- Set `showAnswer = true` so the answer displays on the host QuestionPanel (it's already conditionally shown when flow is `'fastest'`)

**Also:** The `'fastest'` case in `handlePrimaryAction` already handles advancing to next question, clearing state, and resetting flow. But for buzz-in pack mode, the current code at line ~2795 skips to `'revealed'` instead of `'fastest'`. Need to handle `'fastest'` for buzzin pack mode — it should advance to next question same as normal quiz pack.

### 2. `src/components/QuizHost.tsx` — `handlePrimaryAction` case `'fastest'`

The existing `'fastest'` case (line ~2947) already handles "Next Question" for both on-the-spot and quiz pack. For quiz pack buzz-in, we need to also:
- Clear `buzzLockedOutTeams`, `buzzWinnerTeamId`, `buzzTimerExpired`
- Reset `showAnswer` to false for next question
- This already happens in the existing quiz pack branch at line ~2966

### 3. `src/components/BuzzInDisplay.tsx` — `handleCorrectAnswer` (on-the-spot buzz-in)

**Add:**
- Broadcast `FASTEST` to player devices with team name (need to accept `onBuzzCorrectCallback` or similar prop from QuizHost)
- Send `buzzin-correct` to external display
- Accept new props: team photo URL data, external display callback, and a callback to QuizHost for the FASTEST broadcast

**Better approach:** Add `onCorrectAnswer` and `onWrongAnswer` callback props that delegate to QuizHost's `handleBuzzCorrect`/`handleBuzzWrong` equivalents, keeping the logic centralized. Currently BuzzInDisplay duplicates scoring/sound logic.

### 4. `src/network/wsHost.ts` — Extend `sendBuzzResultToPlayers`

Add optional `correctAnswer` field to BUZZ_RESULT data so player devices can display the answer:
```ts
export function sendBuzzResultToPlayers(teamName: string, correct: boolean, correctAnswer?: string) {
  // Include correctAnswer in broadcast data
}
```

### 5. `src-player/src/App.tsx` — Handle BUZZ_RESULT with correct answer + show fastest overlay

In the `BUZZ_RESULT` handler (line ~1341):
- When `correct === true`: show FastestTeamOverlay with the winning team name
- Set `showFastestTeam = true`, `fastestTeamName = resultTeamName`
- If correctAnswer is included, display it (could use `setCorrectAnswer()` + `setAnswerRevealed(true)`)
- Block further buzzing by setting `buzzLockedOut = true`

The FASTEST message will also arrive and trigger the overlay, but handling it in BUZZ_RESULT ensures immediate display.

### 6. `src/components/QuestionNavigationBar.tsx` — Block timer controls after buzz-in correct

The NavBar already derives its buttons from `flowState.flow`. When flow is `'fastest'`:
- `getFlowButton()` returns "Next Question" — this is correct
- `shouldShowTimerButtons` is false (only true for `sent-question` flow) — this is correct
- Spacebar handler maps to `onNextAction` — this is correct

So transitioning to `'fastest'` flow automatically fixes the NavBar. No changes needed here.

### 7. `src/components/ExternalDisplayWindow.tsx` — Show correct answer on buzzin-correct

The existing `buzzin-correct` case shows team name + photo + "CORRECT!" text. Enhance it to also display the correct answer text:
- Accept `correctAnswer` in the display data
- Render it below the team name

## File Summary

| File | Change |
|------|--------|
| `src/components/QuizHost.tsx` | `handleBuzzCorrect`: add FASTEST broadcast to players, transition flow to `'fastest'`, include correct answer, set showAnswer=true |
| `src/components/QuizHost.tsx` | `handlePrimaryAction` `'fastest'` case: add buzzin state cleanup for quiz pack mode |
| `src/components/BuzzInDisplay.tsx` | `handleCorrectAnswer`: add FASTEST broadcast, external display update, accept photoUrl in Team interface |
| `src/network/wsHost.ts` | `sendBuzzResultToPlayers`: add optional correctAnswer param |
| `src-player/src/App.tsx` | `BUZZ_RESULT` handler: when correct, show FastestTeamOverlay + block buzzing |
| `src/components/ExternalDisplayWindow.tsx` | `buzzin-correct` case: show correct answer text |
