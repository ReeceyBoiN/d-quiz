# Plan: Fix Question Width Layout and Question Number Sync Issues

## Issue 1: Question Width Cramping in Quiz Pack Mode

### Problem
When a question is sent to the external display in quiz pack mode, the question container appears cramped and doesn't utilize the available width. The results screen displays well with proper scaling, but the initial question display is compressed.

### Root Cause
In ExternalDisplayWindow.tsx, the 'question' case (line 744-800):
- The outer container has `width: '100%'` with `display: 'flex'` and `flexDirection: 'column'`
- The question header div has `width: '100%'` but uses standard padding
- The options grid has `width: '100%'` and `maxWidth: '1200px'` but lacks center alignment
- The container doesn't have `alignItems: 'center'` or `justifyContent: 'center'` to center content
- Contrast: The 'resultsSummary' case uses the same structure but appears better styled

### Solution
1. Add `alignItems: 'center'` and `justifyContent: 'center'` to the 'question' case outer container
2. Ensure the question header wrapper has appropriate width constraints
3. Apply consistent styling between 'question' and 'resultsSummary' cases for visual balance
4. May need to add `maxWidth` constraints to the question text container to prevent it from being too narrow

**File to Modify**: `src/components/ExternalDisplayWindow.tsx`
**Case to Update**: `case 'question'` (line 744-800)

---

## Issue 2: Question Number Mismatch in Keypad On-The-Spot Mode

### Problem
**SPECIFIC ISSUE**: In keypad on-the-spot mode ONLY, the external display always shows "Question 1" regardless of which question number is actually being displayed (Question 2, 3, etc.).

**NOT Affected**: Quiz pack mode question numbering works correctly.

### Root Cause Analysis
In KeypadInterface.tsx, the 'timer' case at line 712 displays:
```
Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
```

The questionInfo being sent includes `number: currentQuestion` (line 723 in KeypadInterface), but it's always evaluating to 1.

**Most Likely Root Causes**:
1. **`currentQuestion` Variable Issue**: The `currentQuestion` state in KeypadInterface is being initialized or updated incorrectly for non-quiz-pack mode
2. **Fallback to Default**: The questionInfo is not being passed or received properly, causing it to fall back to the default `|| 1`
3. **questionInfo Override**: QuizHost's `handleExternalDisplayUpdate` may be overriding the questionInfo with its own currentQuestionIndex which could be at a different value

The difference between quiz pack and keypad modes suggests the issue is specific to how KeypadInterface manages its own question state.

### Solution Approach

**Step 1**: Find where `currentQuestion` is defined and initialized in KeypadInterface
- Look for `useState` declaration of currentQuestion
- Check what its initial value is
- Verify it's being incremented/updated when navigating between questions

**Step 2**: Trace the data flow
- Confirm `currentQuestion` is being used in the questionInfo object (line 723)
- Check if onExternalDisplayUpdate is receiving the correct questionInfo
- Verify ExternalDisplayWindow is displaying the received questionInfo.number

**Step 3**: Check for override issues
- Look in QuizHost's handleExternalDisplayUpdate (line 3987) to see if it's overriding the questionInfo for timer mode
- The code at line 3987 shows `questionInfo: content === 'question' ? data?.questionInfo : {...}`
- For 'timer' mode, this would use data?.questionInfo, so it should work correctly

**Step 4**: Identify the root cause and apply fix
- If currentQuestion is wrong: Fix initialization and updates
- If data isn't being passed: Ensure questionInfo is in the data object
- If display is wrong: Check ExternalDisplayWindow logic

**Critical Files**:
- `src/components/KeypadInterface.tsx` - Search for currentQuestion initialization (~100-150 lines from top)
- `src/components/ExternalDisplayWindow.tsx` - Line 712 (timer case display)
- `src/components/QuizHost.tsx` - Line 3987 (data pass-through logic)

---

## Implementation Order
1. **Fix Width Issue First** (simpler, visual improvement)
   - Update 'question' case container alignment
   - Apply centering logic
   
2. **Investigate Question Number Issue** (requires deeper understanding)
   - Trace currentQuestion state in KeypadInterface
   - Verify it matches the displayed question
   - Apply fix based on findings

## Testing Checklist

### Width Issue (Quiz Pack Mode)
- [ ] Load quiz pack with multiple questions
- [ ] Verify question container uses full available width (not cramped)
- [ ] Compare visual appearance to results summary screen - should be similar
- [ ] Test with all question types (multiple choice, text, etc.)
- [ ] Confirm padding and alignment are proper

### Question Number Issue (Keypad On-The-Spot Mode)
- [ ] Start keypad on-the-spot mode (NOT quiz pack)
- [ ] Verify first question shows "Question 1" ✓
- [ ] Navigate to Question 2 - external display should show "Question 2" (not "Question 1")
- [ ] Continue through remaining questions - verify number updates each time
- [ ] Test with next/previous question navigation
- [ ] Confirm this works for both silent timer and regular timer starts

### Overall
- [ ] No regressions in quiz pack mode question numbering (should still work)
- [ ] No impact on other game modes (nearest-wins, buzz-in, wheel spinner)
- [ ] Both issues are fixed without affecting each other
