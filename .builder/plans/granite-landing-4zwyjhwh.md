# Nearest Wins Sync and Logic Improvements

## Issue Summary
1. **Ties Not Handled**: If multiple teams guess equidistant to the correct answer, only the first team in the sorted list is awarded points.
2. **Host Remote Answer Submission**: The host remote's numeric keypad sends an admin command (`set-expected-answer`) which updates `flowState.answerSubmitted`, but `NearestWinsInterface` ignores this state. Thus, the remote cannot confirm answers for Nearest Wins.
3. **Host Remote Timer Controls**: When the host app starts a Nearest Wins round, it does not update the global `flowState.flow` to `'sent-question'`. Consequently, the remote's `GameControlsPanel` doesn't know to show the "Start Timer" buttons.

## Recommended Approach

### 1. Fix Tie Logic in Nearest Wins
**File:** `src/components/NearestWinsInterface.tsx`
- Update `calculatedResults` useMemo to properly rank teams with the same difference.
- Update `handleRevealResults` to find the minimum difference (closest guess), collect all team IDs with that difference, and award points to all tied teams. `onAwardPoints` already supports an array of multiple IDs.

### 2. Sync Remote Answer Submission
**File:** `src/components/NearestWinsInterface.tsx` and `src/components/QuizHost.tsx`
- Add `remoteSubmittedAnswer?: string` to `NearestWinsInterfaceProps`.
- In `QuizHost.tsx`, pass `remoteSubmittedAnswer={flowState.answerSubmitted}` to `NearestWinsInterface`.
- In `NearestWinsInterface.tsx`, add a `useEffect` that listens to `remoteSubmittedAnswer`. When it receives a new, valid number, it will sync the local state (`answer` and `correctAnswer`) and mark `answerConfirmed` to `true`.

### 3. Sync Flow State for Remote Controls
**File:** `src/components/NearestWinsInterface.tsx` and `src/components/QuizHost.tsx`
- Add `onFlowStateChange?: (flow: string) => void` to `NearestWinsInterfaceProps`.
- In `QuizHost.tsx`, pass `onFlowStateChange={(flow) => setFlowState(prev => ({...prev, flow}))}` to `NearestWinsInterface`.
- In `NearestWinsInterface.tsx`'s `handleStartRound` function, call `onFlowStateChange('sent-question')`. This will broadcast the updated flow state to the remote, allowing `GameControlsPanel` to display the timer start buttons.
- Call `onFlowStateChange('idle')` when `handleBackWithCleanup` or `handleBackToConfig` is triggered to clear the remote's active controls.
