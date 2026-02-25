# Fix Missing Keypad and Timer Buttons After Question Type Selection

## Problem Summary
After selecting a question type in on-the-spot mode on the host remote, the answer keypad (letters pad, numbers pad, multiple-choice grid) should appear so the host user can select/confirm the correct answer. Instead, users see a "No Question Loaded" message and no keypad or timer buttons.

## Current Flow (What Should Happen)
1. Host user selects a question type (e.g., "multiple-choice")
2. Appropriate keypad appears on remote (2-column grid A-F for multiple-choice, letters pad for letters, etc.)
3. Host user selects the correct answer from keypad
4. Timer buttons appear for teams to answer
5. Teams see the timer buttons + their own keypad to enter answers

## Root Cause Analysis

The UI visibility depends on `shouldRenderAnswerKeypad` in `HostTerminal/index.tsx`:

```javascript
const shouldRenderAnswerKeypad = showAnswerKeypad && hasSelectedQuestionType && hasLoadedQuestion;
```

Components shown only if `shouldRenderAnswerKeypad === true`:
- HostRemoteKeypad or AnswerInputKeypad (for host user to select answer)
- GameControlsPanel (contains timer buttons)

### The Missing Piece

When `select-question-type` command is executed in `QuizHost.tsx` (lines 3878-3928):
- ✅ Sets `flowState.selectedQuestionType` (allows keypad to render)
- ✅ Sets `flowState.flow = 'sent-question'` (game in progress)
- ✅ Sets `flowState.isQuestionMode = true` (in question mode)
- ❌ **Does NOT set `flowState.currentQuestion`** (MISSING!)

Without `currentQuestion`, the remote evaluates:
- `hasLoadedQuestion = !!flowState?.currentQuestion` = **false**
- Therefore: `shouldRenderAnswerKeypad = true && true && false` = **false**
- Result: Nothing renders, "No Question Loaded" message appears

## Solution

**Create a minimal placeholder question object** when a question type is selected.

This placeholder enables the keypad rendering while the host user selects/confirms the answer.

### Implementation Steps

1. **Modify `select-question-type` handler** in `QuizHost.tsx` (lines 3878-3928):
   
   When in on-the-spot mode:
   - Create a placeholder `currentQuestion` object:
     ```javascript
     const placeholderQuestion = {
       type: selectedType,
       q: `Select correct answer (${selectedType})`,
       // Minimal fields to satisfy visibility checks
     };
     ```
   
   - Include placeholder in state update:
     ```javascript
     deps.setFlowState({
       flow: 'sent-question',
       isQuestionMode: true,
       totalTime: typedDuration,
       selectedQuestionType: selectedType,
       currentQuestion: placeholderQuestion,  // ADD THIS
     });
     ```
   
   - Include in broadcast to remote:
     ```javascript
     deps.sendFlowStateToController(
       ...,
       {
         totalTime: deps.flowState.totalTime,
         currentQuestion: placeholderQuestion,  // ADD THIS
         selectedQuestionType: selectedType,
         // ... other fields
       }
     );
     ```

2. **No changes needed elsewhere** - the placeholder is sufficient for:
   - HostRemoteKeypad/AnswerInputKeypad to render
   - GameControlsPanel to show timer buttons
   - Existing answer submission flow to work

### Files to Modify

- **src/components/QuizHost.tsx** (lines 3878-3928)
  - In `select-question-type` case
  - Add placeholder question creation
  - Include in setFlowState call
  - Include in sendFlowStateToController broadcast

### Expected Behavior After Fix

1. Host user selects question type → remote receives flowState with placeholder question
2. **Keypad renders** based on selectedQuestionType (HostRemoteKeypad for letters/numbers/multi, AnswerInputKeypad for sequence)
3. Host user selects/confirms correct answer
4. `set-expected-answer` command updates answerSubmitted
5. **Timer buttons visible** for team answer entry
6. Flow continues normally with team responses

### Why This Works

- Placeholder is a simple data object, doesn't require question content
- Satisfies `hasLoadedQuestion` check: `!!{...}` = true
- Allows downstream UI components to render
- Doesn't interfere with normal quiz pack mode behavior
- Can be minimal - just needs to exist and contain the question type

### Testing Checklist

- [ ] Select "letters" question type → letters keypad appears
- [ ] Select "numbers" question type → numbers keypad appears  
- [ ] Select "multiple-choice" question type → grid A-F appears
- [ ] Select "sequence" question type → text input appears
- [ ] Select an answer from keypad
- [ ] Timer buttons become visible after answer selection
- [ ] Click timer button → starts timer for teams
- [ ] Verify full flow works end-to-end
