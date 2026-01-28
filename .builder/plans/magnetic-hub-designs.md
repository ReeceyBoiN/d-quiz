# Fix: Keypad Mode Stuck on Question-Type Selection After QuizPack

## Problem Summary
After completing a quiz in quizpack mode, when the user returns home and tries to load the "on the spot keypad" mode, the UI gets stuck on the "select question type" screen. The console logs show:
- `[Keypad] Broadcasting question type: multiple-choice with 6 options`
- `Starting keypad round with: {points, speedBonus, bonusType...}`
These logs repeat multiple times, suggesting `handleQuestionTypeSelect()` is being called repeatedly without the screen transitioning to the actual game screen.

## Root Cause Analysis
After code examination, the likely issues are:

1. **State not clearing properly between modes**: When returning from quiz pack mode, the KeypadInterface component's state (`isQuizPackMode`, `loadedQuestions`, `currentQuestionIndex`) may not be properly reset, causing the auto-start quiz pack effect to trigger again when keypad is reopened.

2. **Missing dependency in handleStartRound**: The `handleStartRound()` function has incomplete dependencies, which could cause stale closures and state synchronization issues.

3. **Auto-start effect logic conflict**: The effect that auto-starts quiz pack mode (when `isQuizPackMode && currentScreen === 'config'`) might conflict with on-the-spot mode initialization, especially if state isn't fully cleared.

4. **Key state reset issue**: The component's mount effect resets states, but if the component is being remounted with `isQuizPackMode=true` while user expects on-the-spot mode, this creates a mismatch.

## Confirmed Behavior
- Keypad skips config screen and goes straight to question-types (confirms auto-start is triggering)
- UI doesn't transition when clicking question type (state not updating properly)
- This indicates `isQuizPackMode` prop is still true OR `loadedQuestions` still has data when reopening keypad

## Root Cause
**The issue is in the `onHome` callback in KeypadInterface**: When the user navigates home from within the keypad (using the home navigation button), the keypad is NOT properly closed. The `onHome` prop callback only changes the tab:
```typescript
onHome={() => setActiveTab("home")}  // <- Only changes tab, doesn't reset keypad state!
```

Instead of calling `handleKeypadClose()` which would:
- Set `isQuizPackMode = false`
- Clear timer state
- Reset the keypad screen to 'config'

When the user then clicks "ON THE SPOT" again, the component still receives stale props and the auto-start effect for quiz pack mode triggers incorrectly.

**Additional issue**: `handleKeypadClick` in QuizHost clears `loadedQuestions` but doesn't explicitly set `isQuizPackMode = false`, even though it has the comment warning about this exact issue.

## Solution
Two fixes needed:

1. **In QuizHost.tsx - Fix handleKeypadClick()**: Explicitly reset `isQuizPackMode` state:
   - Change: `setLoadedQuizQuestions([]); setCurrentLoadedQuestionIndex(0);`
   - Add: `setIsQuizPackMode(false);` to ensure clean state

2. **In KeypadInterface.tsx - Fix onHome callback usage**: Change the onHome callback to properly close the keypad:
   - Current: `onHome={() => setActiveTab("home")}`
   - Should: Call a handler that properly resets keypad state (similar to handleKeypadClose but within KeypadInterface's state reset logic)

## Exact Changes Required

### 1. src/components/QuizHost.tsx - Line 1369-1378
In the `handleKeypadClick()` function, add `setIsQuizPackMode(false);` after line 1374:

**Before:**
```typescript
const handleKeypadClick = () => {
  closeAllGameModes();
  resetCurrentRoundScores();
  setLoadedQuizQuestions([]);
  setCurrentLoadedQuestionIndex(0);
  setShowKeypadInterface(true);
  setActiveTab("teams");
  setKeypadInstanceKey(prev => prev + 1);
};
```

**After:**
```typescript
const handleKeypadClick = () => {
  closeAllGameModes();
  resetCurrentRoundScores();
  setLoadedQuizQuestions([]);
  setCurrentLoadedQuestionIndex(0);
  setIsQuizPackMode(false); // ADD THIS LINE - Ensure quiz pack mode is disabled for on-the-spot
  setShowKeypadInterface(true);
  setActiveTab("teams");
  setKeypadInstanceKey(prev => prev + 1);
};
```

This ensures that when the user opens the on-the-spot keypad mode after closing from quiz pack mode, the `isQuizPackMode` prop is explicitly set to false, preventing the auto-start effect from triggering with stale quiz pack state.
