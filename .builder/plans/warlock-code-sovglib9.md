# Fix Host Remote Keypad Not Displaying After Question Type Selection

## Problem
After selecting a question type in on-the-spot mode, the host remote shows "No Question Loaded" instead of displaying the answer keypad and timer buttons. FLOW_STATE messages are being received on the remote, but the visibility conditions are still failing.

## Root Cause
In QuizHost.tsx lines 3916-3917, the code calls `sendFlowStateToController()` with stale values from `deps.flowState`:
```javascript
deps.sendFlowStateToController?.(
  deps.flowState.flow,           // ❌ OLD value - still undefined/idle
  deps.flowState.isQuestionMode, // ❌ OLD value - still undefined
  {...}
);
```

Since `deps.setFlowState()` is asynchronous (React state setter), by the time this transmission happens, the state hasn't updated yet. The remote receives the OLD flow state instead of the new one with:
- `flow: 'sent-question'`
- `isQuestionMode: true` 
- `selectedQuestionType: 'multiple-choice'` (etc)
- `currentQuestion: placeholderQuestion`

The visibility check at `showMissingQuestionMessage` is triggered because the received FLOW_STATE doesn't have the required fields.

## Solution
Pass the NEW values directly to `sendFlowStateToController()` instead of reading from the stale `deps.flowState` object:

```javascript
const newFlowState = {
  flow: 'sent-question',
  isQuestionMode: true,
  totalTime: typedDuration,
  selectedQuestionType: selectedType,
  currentQuestion: placeholderQuestion,
};

deps.setFlowState(newFlowState);

// Now pass the new values, not stale deps.flowState values
deps.sendFlowStateToController?.(
  newFlowState.flow,              // ✅ 'sent-question'
  newFlowState.isQuestionMode,    // ✅ true
  {
    totalTime: newFlowState.totalTime,
    currentQuestion: newFlowState.currentQuestion,
    currentLoadedQuestionIndex: deps.currentLoadedQuestionIndex,
    loadedQuizQuestions: deps.loadedQuizQuestions,
    isQuizPackMode: deps.isQuizPackMode,
    selectedQuestionType: newFlowState.selectedQuestionType,
    answerSubmitted: deps.flowState.answerSubmitted,
  },
  deps.authenticatedControllerId,
  deps.baseUrl
);
```

## Files to Modify
- **src/components/QuizHost.tsx** (lines 3898-3929)
  - Create local `newFlowState` object with all required fields
  - Pass this object to both `setFlowState()` and `sendFlowStateToController()`
  - Use explicit values instead of reading from stale `deps.flowState`

## Expected Behavior After Fix
1. Host user selects a question type (e.g., "multiple-choice")
2. Host state updates with `flow: 'sent-question'` and placeholder question
3. **IMPORTANT**: Remote receives FLOW_STATE with all required fields:
   - `flow: 'sent-question'`
   - `isQuestionMode: true`
   - `selectedQuestionType: 'multiple-choice'`
   - `currentQuestion: {type, q, options}`
   - `isQuizPackMode: false` (on-the-spot mode)
4. Remote visibility checks all pass:
   - `showAnswerKeypad = true` (all conditions met)
   - `shouldRenderAnswerKeypad = true`
5. Remote displays:
   - **Answer keypad** (2-column grid A-F for multiple-choice, letters/numbers pads for other types)
   - **Timer buttons** below keypad (🔊 Normal Timer, 🔇 Silent Timer)
6. Host user selects correct answer from keypad
7. Timer buttons become active for teams to answer

## Testing Checklist
- [ ] Select "letters" question type → letters keypad + timer buttons appear on remote
- [ ] Select "numbers" question type → numbers keypad + timer buttons appear
- [ ] Select "multiple-choice" → A-F grid + timer buttons appear
- [ ] Select "sequence" → text input + timer buttons appear
- [ ] Click "Normal Timer" button → timer starts on teams
- [ ] Click "Silent Timer" button → silent timer starts on teams
- [ ] No console errors or stale state warnings
