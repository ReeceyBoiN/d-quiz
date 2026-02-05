# Fix "Hide Question" Button to Progress Question Flow

## Problem Statement
The "Hide Question" button in quiz pack mode only toggles visibility but doesn't progress the question stage. After clicking "Hide Question," users must click "Send Question" to advance to the next stage (showing timer buttons). The desired behavior is that clicking "Hide Question" should:
1. Hide the question from player devices/livescreen (already works)
2. Progress to the next stage and show "Start Timer" and "Silent Timer" buttons (currently missing)

## Current Behavior
- `handleHideQuestion` (QuizHost.tsx:1895) only toggles `hideQuestionMode` state
- To progress stages, users must call `handlePrimaryAction` 
- `handlePrimaryAction` (QuizHost.tsx:1341) already has logic to handle `hideQuestionMode`:
  - When `flowState.flow === 'ready'` and `hideQuestionMode === true`: advances to `'sent-question'` state
  - This progression shows the timer buttons in `QuestionNavigationBar`

## Desired Behavior
- Clicking "Hide Question" should toggle the mode AND trigger the flow progression logic
- This will show timer control buttons (Start Timer / Silent Timer)

## Solution Approach
Modify `handleHideQuestion` in `QuizHost.tsx` to:
1. Toggle `hideQuestionMode` state
2. Trigger `handlePrimaryAction` to progress the flow
3. Handle state update timing (React state updates are async)

### Implementation Strategy
Update the `handleHideQuestion` callback to:
- Toggle `hideQuestionMode`
- Call `handlePrimaryAction` immediately after (React batches updates, so handlePrimaryAction will read the updated value in most cases)
- If timing is an issue, use `setState` callback or `useEffect` to ensure flow progression happens after state update

## Files to Modify
1. **src/components/QuizHost.tsx** - Update `handleHideQuestion` function (line 1895)

## Testing Considerations
- Verify "Hide Question" button now progresses from ready → sent-question
- Confirm timer buttons appear after clicking "Hide Question"
- Ensure question remains hidden on player devices/livescreen
- Test that the flow progression works in both toggle directions (on/off)
