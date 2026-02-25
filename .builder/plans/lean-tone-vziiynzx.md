# Plan: Display Question Type Selector on Host Remote

## Problem
When the main host app displays the "Select Question Type" buttons (Letters, Multiple Choice, Numbers), the host remote should also display the same buttons so the host user can control/select the question type from the remote. Currently, the host remote is showing the Game Controls panel instead.

## Root Cause Analysis

### What SHOULD happen (from main host code):
When the host is in on-the-spot mode and wants to show QuestionTypeSelector, it broadcasts flowState with:
- `flow: 'idle'` (explicitly set in admin handler for next-question)
- `isQuestionMode: true` (kept true for next type selection)
- `isQuizPackMode: false` (on-the-spot mode)
- `selectedQuestionType: undefined` (cleared for fresh selection)

This happens in `src/components/QuizHost.tsx` at the next-question admin handler (lines ~3424-3434).

### What the host remote SHOULD do:
```javascript
const showQuestionTypeSelector = isOnTheSpotMode && isInIdleState && flowState?.isQuestionMode;
```
Where:
- `isOnTheSpotMode = flowState?.isQuizPackMode === false` ✓ Should be TRUE
- `isInIdleState = flowState?.flow === 'idle'` ✓ Should be TRUE  
- `flowState?.isQuestionMode` ✓ Should be TRUE

**The condition is correct.** But it's evaluating to FALSE on the host remote even though it should be TRUE.

### Likely Issue
The host remote is NOT receiving the correct flowState values from the main host, OR the QuestionTypeSelector component is being hidden by other UI elements in the render order.

## Investigation Needed

1. **Verify flowState is being transmitted correctly**
   - Check if FLOW_STATE messages are being sent from host to remote with the correct values
   - Verify the remote is receiving flow='idle', isQuestionMode=true, isQuizPackMode=false

2. **Check render order**
   - Current HostTerminal structure shows QuestionTypeSelector first, then other UI
   - Ensure it's not being hidden by Game Controls or other components

3. **Confirm the condition evaluation**
   - The logic IS correct IF flowState has the right values
   - Problem must be that flowState values don't match expectations

## Solution Approach (Two-Step)

### Step 1: Diagnosis (Quick Check)
Add temporary console logging to verify:
```javascript
console.log('[HostTerminal] showQuestionTypeSelector condition:', {
  showQuestionTypeSelector,
  isOnTheSpotMode,
  isInIdleState,
  isQuestionMode: flowState?.isQuestionMode,
  flow: flowState?.flow,
  isQuizPackMode: flowState?.isQuizPackMode,
});
```

This will reveal which part of the condition is failing.

### Step 2: Fix (Once root cause is identified)

**If flowState values are wrong:**
- Ensure the host app is broadcasting the correct FLOW_STATE message with flow='idle' 
- Verify the remote is correctly parsing and storing flowState in App.tsx

**If condition logic needs adjustment:**
- May need to check additional flowState fields or add flags
- Possibly need to show selector in states beyond just 'idle'

**If it's a rendering issue:**
- Reorganize the JSX structure to ensure QuestionTypeSelector isn't covered by other elements
- Check if QuestionTypeSelector is being rendered but offscreen or hidden

## Files to Modify
1. `src-player/src/components/HostTerminal/index.tsx` (lines ~37-49)
   - Add diagnostic console logging to the condition evaluation
   - May need to adjust the condition based on findings

2. `src-player/src/App.tsx` (FLOW_STATE handler)
   - Verify flowState is being set correctly from FLOW_STATE messages

## Success Criteria
- When main host app enters on-the-spot mode idle state → Host remote shows Question Type Selector
- Host user can tap/click buttons to select question type from remote
- Selection is transmitted to host and updates flow state correctly
- Game Controls only shown AFTER a question type is selected
