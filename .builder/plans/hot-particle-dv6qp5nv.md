# Fix Answer Persistence in On-the-Spot Reveal Flow

## Problem
When using the host remote to submit an answer in on-the-spot mode:
1. Remote sends 'set-expected-answer' command
2. Answer displays correctly on the host app
3. Host app confirms the answer locally
4. When 'reveal-answer' command is sent from remote, the host shows "Selected Answer: Unknown"
5. The answer that was just selected is not being displayed in the reveal

## Root Cause Analysis

The issue occurs in the on-the-spot mode answer handling flow:

1. **Answer Submission**: Remote sends `set-expected-answer` admin command
   - QuizHost receives it and sets `flowState.answerSubmitted = expectedAnswer`
   - KeypadInterface receives via `answerSubmitted` prop and updates local state (`selectedLetter`, etc.)

2. **Answer Confirmation**: Host app locally confirms the answer
   - This calls `onAnswerConfirmed()` which updates `flowState.answerSubmitted` again

3. **Reveal Issue**: When `reveal-answer` admin command comes in:
   - QuizHost calls `handleRevealAnswer()` which delegates to KeypadInterface
   - KeypadInterface's `getCorrectAnswer()` should return the selected answer
   - **BUG**: The answer is being lost because:
     - It may not be properly persisted in KeypadInterface's local state
     - OR flowState.answerSubmitted is being cleared before reveal is called
     - OR there's a timing/synchronization issue between flowState and KeypadInterface's local state

## Files to Investigate & Fix

### Priority 1: Core Issue
- **src/components/QuizHost.tsx**
  - Admin handler for `set-expected-answer` (ensure answer is properly saved to flowState)
  - Admin handler for `reveal-answer` (ensure flowState.answerSubmitted is NOT cleared before reveal)
  - Check if `handlePrimaryAction()` clears the answer prematurely

- **src/components/KeypadInterface.tsx**
  - The `answerSubmitted` prop sync logic (useEffect that applies remote answer to local state)
  - `getCorrectAnswer()` function - verify it reads from the correct local state variables
  - Ensure local answer state (`selectedLetter`, `selectedAnswers`, `numbersAnswer`) persists through reveal
  - Check for any state resets that happen when reveal is triggered

### Priority 2: State Flow Verification
- **src/components/QuizHost.tsx**
  - Verify `handleRevealAnswer()` doesn't modify `flowState.answerSubmitted` before it's used
  - Check if there's a gap between answer being set and reveal being called

### Priority 3: Timing Issues
- **src/components/KeypadInterface.tsx**
  - The `lastAppliedAnswerRef` tracking for remote answers
  - Check if there's a race condition where answer gets cleared while reveal is in progress

## Key Insight: Source of Truth
The answer should be read from **KeypadInterface's local state** (`selectedLetter`, `selectedAnswers`, `numbersAnswer`) when reveal is called, not from `flowState.answerSubmitted`. This means:
- When `set-expected-answer` arrives, it updates `flowState.answerSubmitted`
- KeypadInterface's useEffect should sync this to **local state** (`selectedLetter`, etc.)
- When `getCorrectAnswer()` is called during reveal, it must read from the local state
- **The bug**: The local state is not being properly synced or is being cleared before reveal

## Implementation Approach

1. **Ensure Remote Answer Sync Works**: Verify the useEffect in KeypadInterface that applies `answerSubmitted` prop to local state is working correctly and runs when the answer arrives

2. **Prevent Local State Clearing**: Check if local answer state is being reset anywhere in the flow that would cause it to be undefined/empty before reveal is called

3. **Fix getCorrectAnswer() Reliability**: Ensure it always returns the correct value from local state, with proper null-checking

4. **Track Answer State Through Flow**: Add console logging to track:
   - When `set-expected-answer` arrives (flowState.answerSubmitted gets set)
   - When KeypadInterface receives answerSubmitted prop (sync should happen)
   - When selectedLetter/selectedAnswers gets updated locally
   - When reveal-answer is called (getCorrectAnswer() returns value)

5. **Verify No Premature Resets**: Check that `handleRevealAnswer()` or `handlePrimaryAction()` don't trigger state resets that clear the answer before it's used

## Expected Outcome
- When remote sends `set-expected-answer`, the answer syncs to KeypadInterface's local state (selectedLetter)
- Local state persists until reveal is called
- When remote sends `reveal-answer`, `getCorrectAnswer()` properly reads the answer from local state
- "Selected Answer: Unknown" issue is resolved
- Answer properly displays in reveal screen with correct letter/value
