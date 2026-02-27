# Plan: Fix Sync Issues, Timer Mismatches, and "Unknown" Answers

## Issue Summary
1. **"Unknown" Selected Answer in Results:** When an answer is submitted from the remote controller, the local KeypadInterface's duplicate suppression can sometimes prevent `remoteSubmittedAnswer` from being populated properly, or `questionType` mismatch causes a direct fallback to `'Unknown'`, skipping the remote answer entirely.
2. **Reveal Answer Sync for Remote:** When the host clicks "Reveal Answer" on the Host App, if no teams answered correctly, the host app correctly skips to "Next Question", but the host remote still shows "Show Fastest Team" because the flow state only advanced to `'revealed'`.
3. **Timer Length Mismatch & Second Start Bug:** The remote triggers a 30s timer instead of the 5s specified in settings because it uses the host's `flowState.totalTime`, which can be stale. Also, starting the timer a second time from the Host App fails because `gameTimerFinished` remains `true` from the previous run.

## Recommended Approach

### 1. Fix "Unknown" Answer Fallback (`src/components/KeypadInterface.tsx`)
- In the `useEffect` that syncs `answerSubmitted`, **unconditionally** set `setRemoteSubmittedAnswer(answerSubmitted)` when `answerSubmitted` is present, even if it matches `lastAppliedAnswerRef.current`.
- In the Results Screen rendering block, update the final default fallback for `questionType` to `(remoteSubmittedAnswer || 'Unknown')` so if `questionType` is null or invalid, it still displays the remote answer.

### 2. Fix Reveal Answer Sync for Host Remote (`src/components/QuizHost.tsx`)
- In the `useEffect` that synchronizes On-The-Spot game states (`gameTimerRunning`, `gameTimerFinished`, `gameAnswerRevealed`), update the logic for `gameAnswerRevealed && !gameFastestRevealed`:
  - If `teamsAnsweredCorrectly` is `false`, set `flowState.flow` to `'fastest'` directly.
  - This guarantees the remote bypasses the "Show Fastest" state and displays "Next Question", perfectly matching the Host UI.

### 3. Fix Timer Length Mismatch & Second Start (`src/components/QuizHost.tsx`)
- In `handleAdminCommand` cases for `start-normal-timer` and `start-silent-timer`:
  - Calculate `timerDuration` by dynamically checking `deps.gameModeTimers` if `!deps.isQuizPackMode`.
  - Prioritize `deps.gameModeTimers.keypad` / `nearestWins` / `buzzin` based on which interface is active, falling back to `deps.flowState.totalTime` or `30`.
- In the `KeypadInterface` component rendering (`<KeypadInterface onGameTimerStateChange={...} />`), add `if (isRunning) setGameTimerFinished(false);`. This clears the finished flag when the timer starts, allowing subsequent starts from the nav bar.

## Critical Files to Modify
- `src/components/KeypadInterface.tsx`
- `src/components/QuizHost.tsx`
