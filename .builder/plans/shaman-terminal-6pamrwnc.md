# Fix Send Question/Send Picture Button Regression

## Problem Summary
When users click "Send Question" or "Send Picture" buttons (in host app or remote controller), a timer starts instead of actually sending the question/picture. This is a regression from the timer-related changes.

## Root Cause
In `src/components/QuestionNavigationBar.tsx`:

1. **Lines 293-295**: The `getButtonAction()` function incorrectly maps both "Send Picture" and "Send Question" buttons to call `onStartTimer`:
```javascript
case 'Send Picture':
case 'Send Question':
  return onStartTimer;  // WRONG - should call onPrimaryAction
```

2. **Lines 499-501**: When the flow button is clicked, it calls `onStartTimer()` for these buttons:
```javascript
} else {
  // For Send Picture/Send Question buttons, use onStartTimer
  onStartTimer();
}
```

The comment even admits this is for Send Picture/Send Question buttons, but using `onStartTimer` is incorrect. These buttons should progress the question flow (ready → sent-picture/sent-question), not start a timer.

## Why This Wasn't Caught Earlier
- The code was likely non-functional or this code path wasn't being used before
- My changes to timer handling made the state machine stricter, exposing this bug
- The button flow logic appears to have been incomplete/broken from the start

## Solution
Add a new prop `onSendQuestion()` callback to `QuestionNavigationBar` that gets called for "Send Question"/"Send Picture" button clicks instead of `onStartTimer`.

### Files to Modify

1. **src/components/QuestionNavigationBar.tsx**
   - Add new prop `onSendQuestion?: () => void` to QuestionNavigationBarProps interface
   - Update `getButtonAction()` to return `onSendQuestion` for "Send Picture"/"Send Question" cases
   - Update button click handler (line 501) to call `onSendQuestion?.()` instead of `onStartTimer()`

2. **src/components/QuizHost.tsx**
   - Pass `onSendQuestion={handlePrimaryAction}` to the QuestionNavigationBar component
   - This allows "Send Question" button in the UI to correctly call handlePrimaryAction

## Expected Outcome
- Clicking "Send Question" button → sends question (flow: ready → sent-picture/sent-question)
- Clicking "Send Picture" button → sends picture (flow: ready → sent-picture)
- Remote "send-question" command → same behavior via admin handler
- Timer buttons ("Normal Timer"/"Silent Timer") continue to work correctly
- No state machine regression
