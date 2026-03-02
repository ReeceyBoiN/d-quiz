# Quiz Pack Results Summary: Center Text & Persist After Reveal

## Problem Statement

### Issue 1: Text Alignment
The "Correct Answer:" text in the results summary box is not centered. It should be center-aligned for better visual presentation.

### Issue 2: Results Summary Disappears After Reveal
When reveal answer is triggered:
1. `flowState.flow` transitions from 'timeup' to 'revealed'
2. A useEffect clears `showResultsSummary` when flow is not 'timeup' or 'running'
3. This causes the results summary overlay to disappear and the question screen reappears
4. Expected behavior: Results summary should persist through 'revealed' and 'fastest' states until next question is triggered

## Root Cause Analysis

### Issue 1
In `renderQuizPackResultsSummary()`, the "Correct Answer:" label div lacks text alignment styling.

### Issue 2
File: `src/components/QuizHost.tsx`
- Around line ~1205-1209, there's a useEffect:
```javascript
useEffect(() => {
  if (flowState.flow !== 'timeup' && flowState.flow !== 'running') {
    setShowResultsSummary(false);
  }
}, [flowState.flow]);
```
This effect clears `showResultsSummary` whenever flow transitions out of 'timeup'/'running', but it should keep it visible through 'revealed' and 'fastest' states.

## Solution

### Fix 1: Center the "Correct Answer:" Text
In `renderQuizPackResultsSummary()` function (around line ~6007), add `text-center` to the label div:
- Change the text-lg div to include `text-center` class

### Fix 2: Keep Results Summary Visible Through Reveal and Fastest States
Update the useEffect that controls `showResultsSummary` (around line ~1205-1209) to keep the overlay visible through 'revealed' and 'fastest' states:
- Modify condition from `if (flowState.flow !== 'timeup' && flowState.flow !== 'running')` 
- To: `if (flowState.flow !== 'timeup' && flowState.flow !== 'running' && flowState.flow !== 'revealed' && flowState.flow !== 'fastest')`

This ensures:
- Results summary appears when timer ends (timeup)
- Stays visible after reveal answer is triggered (revealed state)
- Continues visible during fastest team display (fastest state)
- Finally disappears when moving to next question (back to idle/ready state)

## Files to Modify
1. `src/components/QuizHost.tsx`
   - Line ~6007: Add `text-center` class to Correct Answer label
   - Line ~1205-1209: Update useEffect condition to include 'revealed' and 'fastest' states

## Verification
After changes:
- ✅ "Correct Answer:" text appears centered in the box
- ✅ Results summary stays visible after reveal answer is clicked
- ✅ Results summary persists until fastest team is shown or next question is triggered
- ✅ Normal flow progression continues (reveal → fastest → next question)
