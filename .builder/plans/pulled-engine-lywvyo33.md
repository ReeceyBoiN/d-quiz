# Picture Transmission Timing - Remaining imageUrl Fix

## Problem
The previous fix removed `imageUrl` from the main QUESTION broadcasts, but placeholder "Waiting for question..." broadcasts still include the imageUrl. This causes pictures to be sent to players when the question changes, before the host has a chance to click "Send Picture".

**Evidence from console logs:**
- Question 15-17: `imageUrl: null` ✓ (correct)
- Question 18: `imageUrl: 'data:image/jpeg;base64,...'` ✗ (WRONG - this is a placeholder broadcast)

## Root Cause
When a question with an image is loaded, the QUESTION_CHANGE useEffect immediately broadcasts a placeholder question that includes the imageUrl:

```javascript
broadcastQuestionToPlayers({
  text: 'Waiting for question...',
  q: 'Waiting for question...',
  options: placeholderOptions,
  type: normalizedType,
  imageUrl: currentQuestion.imageDataUrl || null,  // <-- PROBLEM
  isPlaceholder: true,
  goWideEnabled: goWideEnabled,
});
```

This happens in TWO places:
1. **QUESTION_CHANGE effect** (src/components/QuizHost.tsx, ~lines 551-572) - runs when question index changes
2. **FIRST_QUESTION_INIT effect** (src/components/QuizHost.tsx, ~lines 616-639) - runs on first question init

A third placeholder broadcast in `handleStartRoundWithQuestion` (~lines 1962-1973) does NOT include imageUrl, which is correct.

## Solution
Remove the `imageUrl` field from placeholder broadcasts in both the QUESTION_CHANGE and FIRST_QUESTION_INIT useEffect hooks.

The image should ONLY be sent:
1. Via dedicated PICTURE message when host clicks "Send Picture" button
2. NOT in any question broadcast (whether placeholder or real)

## Implementation Changes

### File: `src/components/QuizHost.tsx`

**Change 1: QUESTION_CHANGE effect (lines ~551-572)**
- Remove: `imageUrl: currentQuestion.imageDataUrl || null,`

**Change 2: FIRST_QUESTION_INIT effect (lines ~616-639)**
- Remove: `imageUrl: currentQuestion.imageDataUrl || null,`

## Files Affected
- `src/components/QuizHost.tsx` - Remove imageUrl from 2 placeholder broadcast calls

## Expected Behavior After Fix
1. Question changes → placeholder broadcast sent WITHOUT imageUrl
2. Players receive placeholder, show "Waiting for question..." UI
3. Host clicks "Send Picture" → PICTURE message sent with image
4. Players receive and display the image
5. Host clicks "Send Question" → QUESTION message sent WITHOUT imageUrl
6. Players receive question text/options (image already shown from step 4)

## Testing
- Load quiz with image-based questions
- Verify placeholder doesn't include imageUrl in console logs
- Verify image only appears on players after "Send Picture" is clicked
- Test non-image questions to ensure no regression
