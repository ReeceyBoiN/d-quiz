# Plan: Add MCQ Options to External Display in Quiz Pack Mode

## Problem Summary
In Quiz Pack mode, when a Multiple Choice Question is sent to the external display, only the question text appears. The options (A, B, C, D, etc.) are not shown.

## Root Cause
**Type mismatch in QuizHost.tsx**: The code that decides whether to include options in the external display payload checks for `currentQuestion.type === 'multiple-choice'`, but the quiz loader sets the question type as `'multi'`. This mismatch causes the condition to evaluate to false, resulting in an empty options array being sent to the external display.

### Evidence:
- Quiz loader (src/utils/quizLoader.ts): Sets type as `'multi'` ✓
- QuizPackDisplay.tsx: Correctly renders MCQ with `currentQuestion.type === 'multi'` ✓
- QuizHost.tsx: Checks for `currentQuestion.type === 'multiple-choice'` ✗ (Wrong type string)
- ExternalDisplayWindow.tsx: Renders options only if array is non-empty ✓

## Solution Approach
Fix the type check in QuizHost.tsx by using the existing `normalizeQuestionTypeForBroadcast()` function before checking the type. This ensures both the loader's `'multi'` type and any other variants are handled correctly.

### Implementation Steps:

1. **Locate and fix the shouldIncludeOptions conditional in QuizHost.tsx**
   - Find both occurrences where options are conditionally included in the external display payload
   - These should be around the "send question" logic sections
   - Replace the direct type comparison with normalized type comparison

2. **Change the logic from:**
   ```javascript
   const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
   ```
   
   **To:**
   ```javascript
   const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
   const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
   ```

3. **Verify both occurrences are fixed:**
   - One before sending question directly
   - One after sending picture
   - Both should use the normalized type check

4. **Test the fix:**
   - Create a quiz with MCQ questions
   - Send a question in Quiz Pack mode
   - Verify external display shows question + all options (A, B, C, D, etc.)
   - Verify hideQuestionMode still works (options hidden when intended)

## Files to Modify
- **src/components/QuizHost.tsx** (2 locations): Fix shouldIncludeOptions condition in both places where external display payload is composed

## Key Dependencies
- `normalizeQuestionTypeForBroadcast()` function already exists in QuizHost.tsx
- `ExternalDisplayWindow.tsx` already correctly renders options when array is non-empty
- No other files need modification (player and host UI already work correctly)

## Expected Outcome
When sending an MCQ question in Quiz Pack mode:
- External display will show the question text ✓
- External display will show all available options (A, B, C, D, E, F, etc.) ✓
- Options dynamically adjust based on how many are present in the question
- hideQuestionMode still correctly suppresses options when needed ✓
