# Fix Host Remote Answer Input Display and Confirmation Issues

## Problem Summary
Two issues reported with the host remote answer input in "on-the-spot" mode:
1. **Only A-D options shown** when question has A-F answer options (6 options)
2. **Submitted correct answer not confirmed** - remote doesn't show the answer as confirmed/correct

## Root Causes Identified

### Issue #1: A-D Display Limit
- **HostRemoteKeypad.tsx** (lines ~194-196) hardcodes multiple-choice to `['A','B','C','D']`
- **AnswerInputKeypad.tsx** (lines ~132) also hardcodes multiple-choice to 4 options
- When `flowState.selectedQuestionType` is set to 'multiple-choice', the app renders HostRemoteKeypad with hardcoded 4-option display
- The actual question may have 6 options (A-F) but the UI doesn't reflect this

### Issue #2: No Confirmation/Marking
- **HostRemoteKeypad.tsx** sets local `confirmedAnswer` state when submitting (lines ~79-84), but this only reflects local UI state
- **QuizHost.tsx** (lines ~3795-3802) receives 'set-expected-answer' admin command and updates `flowState.answerSubmitted`, BUT **does not call `sendFlowStateToController`** to broadcast this update back to the remote
- **HostRemoteKeypad.tsx** has no `useEffect` to sync `confirmedAnswer` with `flowState.answerSubmitted` when flowState updates
- No logic to detect when answer is revealed and mark it as correct/incorrect

## Proposed Solution

### Fix #1: Dynamic Answer Options Display
**File: `src-player/src/components/HostTerminal/HostRemoteKeypad.tsx`**
- Replace hardcoded `const choices = ['A', 'B', 'C', 'D'];` in `renderMultipleChoiceKeypad()`
- Derive the number of options dynamically from `flowState.currentQuestion?.options?.length` or a max default
- Generate choices array: `const choiceCount = flowState.currentQuestion?.options?.length || 4; const choices = Array.from({length: choiceCount}, (_,i) => String.fromCharCode(65+i));`
- This allows A-D for 4-option questions, A-F for 6-option questions, etc.
- Also update grid columns: change `grid-cols-2` to `grid-cols-${Math.ceil(choiceCount/2)}` or use a responsive approach (cols-2 for 1-4 options, cols-3 for 5-6 options)

### Fix #2: Broadcast Answer Submission to Remote
**File: `src/components/QuizHost.tsx`**
- In the 'set-expected-answer' admin command handler (lines ~3795-3802)
- After `setFlowState(prev => ({ ...prev, answerSubmitted: expectedAnswer }))`, add a call to `deps.sendFlowStateToController?.(deviceId)` 
- This ensures the controller/remote receives the updated `answerSubmitted` value immediately
- Example: `setFlowState(prev => { const updated = {...prev, answerSubmitted: expectedAnswer}; deps.sendFlowStateToController?.(deviceId, updated); return updated; });`

### Fix #3: Sync HostRemoteKeypad with flowState Updates
**File: `src-player/src/components/HostTerminal/HostRemoteKeypad.tsx`**
- Add a `useEffect` that listens to `flowState.answerSubmitted` 
- When flowState updates with a new `answerSubmitted` value, update local `confirmedAnswer` to match
- This keeps the UI in sync with the host's tracked answer
- Example: `useEffect(() => { if (flowState?.answerSubmitted) { setConfirmedAnswer(flowState.answerSubmitted); } }, [flowState?.answerSubmitted])`

## Files to Modify
1. **src-player/src/components/HostTerminal/HostRemoteKeypad.tsx** (high priority)
   - Make multiple-choice options dynamic based on actual question options
   - Add useEffect to sync confirmedAnswer with flowState.answerSubmitted
   - Update grid layout to accommodate variable number of options

2. **src/components/QuizHost.tsx** (high priority)
   - Add sendFlowStateToController call in 'set-expected-answer' handler to broadcast update to remote

## Implementation Details

### Change 1: HostRemoteKeypad - Dynamic Options
Replace the hardcoded choices with dynamic generation:
```javascript
const renderMultipleChoiceKeypad = () => {
  const optionCount = flowState?.currentQuestion?.options?.length || 4;
  const choices = Array.from({length: optionCount}, (_,i) => String.fromCharCode(65+i));

  // Keep 2-column layout for consistency (A/B row 1, C/D row 2, E/F row 3, etc.)
  const gridCols = 'grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-3 sm:gap-4 md:gap-5`}>
      {choices.map((choice) => (
        // ... existing button logic
      ))}
    </div>
  );
};
```

### Change 2: HostRemoteKeypad - Add Sync Effect
Add after the state declarations:
```javascript
useEffect(() => {
  if (flowState?.answerSubmitted && !confirmedAnswer) {
    setConfirmedAnswer(flowState.answerSubmitted);
  }
}, [flowState?.answerSubmitted, confirmedAnswer]);
```

### Change 3: QuizHost - Broadcast After Set-Expected-Answer
In the 'set-expected-answer' case, modify the handler to broadcast update:
```javascript
case 'set-expected-answer':
  console.log('[QuizHost] Executing: Set Expected Answer');
  const expectedAnswer = commandData?.answer;
  if (typeof expectedAnswer !== 'string' || expectedAnswer.trim().length === 0) { ... }
  if (!isQuizPackMode) {
    console.log('[QuizHost] - On-the-spot mode: setting expected answer:', expectedAnswer);
    setFlowState(prev => ({
      ...prev,
      answerSubmitted: expectedAnswer,
    }));
    // Broadcast the updated flowState to the controller immediately
    deps.sendFlowStateToController?.(deviceId);
    console.log('[QuizHost] - Expected answer stored and broadcasted to controller');
    success = true;
  } else { ... }
```

## Testing Strategy
1. Load a question with 6 answer options (A-F) in on-the-spot mode
2. Verify the host remote shows all 6 buttons (A-F) - not just A-D
3. Select an answer on the host remote
4. Verify the local "✓ Confirmed" state appears
5. Check that the answer submission is received by the host
6. Verify when the host reveals the answer, it correctly identifies this as the expected answer

## Rationale
- **Dynamic options**: Respects the actual question structure instead of hardcoding limits
- **Broadcasting**: Ensures remote receives confirmation that host has recorded the answer
- **useEffect sync**: Keeps remote UI consistent with host's recorded answer state
- These changes maintain backward compatibility (4-option questions still work, just derived dynamically)
