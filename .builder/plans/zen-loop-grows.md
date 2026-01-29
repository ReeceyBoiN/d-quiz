# Fix: End Round Button at Final Question

## Problem Summary
In quiz pack mode, when the final question's flow reaches 'fastest' state, an "End Round" button appears in QuestionNavigationBar. However, clicking it does nothing (or doesn't properly end the round), while the "End Round" button in the bottom navigation bar works correctly.

## Root Cause Analysis
The issue is a **handler mismatch**:

- **Bottom Navigation's "End Round" button** (BottomNavigation.tsx)
  - Calls: `onEndRound` prop → `handleEndRound()` in QuizHost
  - Effect: Full cleanup including stop audio, reset state, clear questions, play sound, close modes, reset answers, navigate home, etc.
  - **Works correctly** ✅

- **QuestionNavigationBar's "End Round" button** (when at final question in quiz pack)
  - Calls: `onNextAction` prop → `handlePrimaryAction()` in QuizHost
  - Effect: Only sends network broadcast (`sendEndRound()`) and sets `flowState` to 'complete'
  - **Missing the full cleanup** ❌
  - Does NOT call `handleEndRound()`

## Solution
Modify `handlePrimaryAction()` in QuizHost.tsx to call `handleEndRound()` when reaching the final question in quiz pack mode, instead of just calling `sendEndRound()`.

### Key Changes Required

**File: src/components/QuizHost.tsx**

In the `handlePrimaryAction()` function, locate the `case 'fastest':` section for quiz pack mode:

Current code (lines ~1210-1222):
```javascript
case 'fastest':
  if (isOnTheSpotMode) {
    // on-the-spot behavior ...
  } else {
    if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
      // go to next question
      setCurrentLoadedQuestionIndex(prev => prev + 1);
      setFlowState(prev => ({ ...prev, flow: 'ready' }));
    } else {
      // Last question - send END_ROUND and set flow to complete
      setFlowState(prev => ({ ...prev, flow: 'complete' }));
      setIsSendQuestionDisabled(true);
      sendEndRound();
      if (externalWindow) {
        sendToExternalDisplay({ type: 'END_ROUND' });
      }
    }
  }
  break;
```

**Fix:** Replace the final question branch (else block) to call `handleEndRound()`:
```javascript
} else {
  // Last question - call handleEndRound (performs full cleanup + broadcast)
  handleEndRound();
}
```

This ensures the same full cleanup logic runs whether the user clicks:
- The "End Round" button in the bottom navigation, OR
- The "End Round" button at the end of the final question

## Implementation Details

### Why This Works
- `handleEndRound()` already performs all necessary cleanup: stop audio, reset state, clear questions, play sound, close modes, reset answers, force keypad remount, navigate home, update external display
- By calling `handleEndRound()` from the final question branch of `handlePrimaryAction()`, we ensure consistent behavior from both entry points
- The `handleEndRound()` function internally handles flow state changes and external display updates

### Files to Modify
1. `src/components/QuizHost.tsx` - handlePrimaryAction() case 'fastest' → else block (1 location, ~3 lines changed)

### No Changes Needed
- QuestionNavigationBar.tsx (already wired correctly)
- BottomNavigation.tsx (already working)
- Any other components

## Testing Plan
1. Load a quiz pack with multiple questions
2. Progress through all questions to the final question
3. Reach 'fastest' state on final question (End Round button should appear)
4. Click the "End Round" button
5. Verify that:
   - Audio stops (if playing)
   - Quiz pack display closes
   - UI returns to home tab
   - Questions are cleared
   - Team answers are reset
   - External display updates (if open)
   - Behavior matches the bottom navigation "End Round" button

## Risk Assessment
**Low Risk** - This is a simple change with direct parallel to existing working code. We're just calling the same tested cleanup function (`handleEndRound()`) that already works from the bottom nav button.
