# Plan: Nearest Wins Sync Fix

## Issues Found
The Host Remote relies on the `flowState` object from `QuizHost` to stay in sync. While remote-initiated actions sync to the Host App, actions initiated directly from the Host App in Nearest Wins mode fail to sync back to the Remote. Specifically:
1. When the host confirms the answer, `flowState.answerSubmitted` is never updated.
2. When the timer finishes, `NearestWinsInterface` doesn't trigger a `timeup` flow state.
3. When the host clicks "Reveal", `NearestWinsInterface` doesn't trigger a `revealed` flow state.

## Proposed Solution

1. **Update `NearestWinsInterface` Props:**
   - Add `onAnswerConfirmed?: (answer: string) => void;` to its props definition.

2. **Update `NearestWinsInterface.tsx` Logic:**
   - In the timer completion effect (`if (newValue < 0)`): add `onFlowStateChange?.('timeup')`.
   - In the "Confirm Answer" button handler: add `onAnswerConfirmed?.(answer)`.
   - In `handleRevealResults`: add `onFlowStateChange?.('revealed')`.
   - In `handleNextRound`: add `onFlowStateChange?.('sent-question')` so the new round syncs properly.

3. **Update `QuizHost.tsx` Integration:**
   - In the `QuizHost` render block for `NearestWinsInterface`, pass the new prop:
     `onAnswerConfirmed={(ans) => setFlowState(prev => ({ ...prev, answerSubmitted: ans }))}`.
     
This approach uses the existing network state infrastructure seamlessly to keep the Host App and Host Remote 100% in sync without heavy architectural changes.
