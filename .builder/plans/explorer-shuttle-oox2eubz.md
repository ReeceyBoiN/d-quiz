# Plan: Fix "Unknown" Answer and Scoring Issue on Remote Selection

## Issue Summary
When the host selects a question type (e.g., "Letters") from the host remote, they can successfully submit the correct answer (e.g., "P"), and the UI correctly highlights it. However, when the timer finishes and the Results screen appears, it shows:
- **"Your Selected Answer: Unknown"** instead of the selected answer ("P").
- **0 Correct, 0 Wrong, 0 No Answer** regardless of how teams answered.

## Root Cause
1. When the host remote triggers `select-question-type`, `QuizHost` updates `flowState.selectedQuestionType` and sets `keypadCurrentScreen` (e.g., to `'letters-game'`).
2. `KeypadInterface` receives the screen change via the `externalCurrentScreen` prop and correctly updates its UI, but its internal `questionType` state remains `null` because `QuizHost` never passes the selected question type down to it.
3. When the answer is submitted remotely, it saves to `remoteSubmittedAnswer` (and correctly updates `selectedLetter` since the screen matches).
4. However, when the timer finishes, the `Results` screen rendering and the `getCorrectAnswer()` function both rely on the internal `questionType` state. Since `questionType` is still `null`:
   - The UI evaluates `questionType === 'letters' ? ... : 'Unknown'` and falls back to `"Unknown"`.
   - `getCorrectAnswer()` returns `null`, which causes `onAnswerStatusUpdate(null, null)` to fire, completely wiping the evaluation scores in `QuizHost`.

## Solution Approach

### 1. Update `KeypadInterface` Props and Sync Logic
**File**: `src/components/KeypadInterface.tsx`
- Add `externalQuestionType` to `KeypadInterfaceProps`:
  ```tsx
  externalQuestionType?: 'letters' | 'numbers' | 'multiple-choice' | 'sequence' | null;
  ```
- Add a new `useEffect` to synchronize the internal `questionType` state when the prop is provided by the parent:
  ```tsx
  // Synchronize external question type changes to local state
  useEffect(() => {
    if (externalQuestionType && externalQuestionType !== questionType) {
      console.log('[KeypadInterface] External question type change:', externalQuestionType);
      setQuestionType(externalQuestionType as any);
    }
  }, [externalQuestionType, questionType]);
  ```

### 2. Pass the Question Type from `QuizHost`
**File**: `src/components/QuizHost.tsx`
- Pass `flowState.selectedQuestionType` as the new prop when rendering `<KeypadInterface />`:
  ```tsx
  <KeypadInterface
    ...
    externalCurrentScreen={keypadCurrentScreen}
    externalQuestionType={flowState.selectedQuestionType as any}
    answerSubmitted={flowState.answerSubmitted}
    ...
  />
  ```

By explicitly passing down and syncing the `questionType`, the `Results` screen and scoring calculation will accurately recognize the selected answer.
