# Plan: Fix MCQ Options Disappearing When Timer Starts in Quiz Pack Mode

## Problem Summary
When a timer is started in Quiz Pack mode, the MCQ options disappear from the external display, leaving only the question text. Both should remain visible throughout the timer countdown.

## Root Cause
**Type mismatch in QuizHost.tsx timer update logic**: When the timer is running, QuizHost sends periodic `timer-with-question` DISPLAY_UPDATE messages (lines 842-864). The `shouldIncludeOptions` check in this location still uses the incorrect type comparison:
```javascript
const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
```

Since the quiz loader sets question type as `'multi'` (not `'multiple-choice'`), this condition evaluates to false, and QuizHost sends an empty options array to the external display, causing options to disappear when the timer starts.

## Solution Approach
Apply the same fix we made for the initial question send to the timer update logic by using the `normalizeQuestionTypeForBroadcast()` function.

### Implementation Steps:

1. **Locate the timer update section in QuizHost.tsx (lines 842-864)**
   - This is the useEffect that updates the external display while the timer is running
   - Find the `shouldIncludeOptions` check that currently compares against raw `currentQuestion.type`

2. **Normalize the type before the comparison**
   - Add: `const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);`
   - Change the condition from using `currentQuestion.type` to using `normalizedType`

3. **Change from:**
   ```javascript
   const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
   ```
   
   **To:**
   ```javascript
   const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
   const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
   ```

4. **Test the fix:**
   - Start a quiz in Quiz Pack mode with MCQ questions
   - Send a question and start the timer
   - Verify options remain visible on the external display while the timer counts down
   - Verify options disappear when hideQuestionMode is enabled

## Files to Modify
- **src/components/QuizHost.tsx** (1 location): Fix shouldIncludeOptions condition in the timer update useEffect (around line 849)

## Expected Outcome
- MCQ options will remain visible on the external display throughout the timer countdown
- Both question text and options are displayed together
- hideQuestionMode still works correctly (options hidden when intended)
