# Fix: Spacebar Reveal Doesn't Trigger Fail Sound in Quiz Pack Mode

## Root Cause Found ✓
**File:** `src/components/QuestionNavigationBar.tsx` (lines 100-121)

The spacebar handler is hardcoded to always call `onStartTimer()`, but the button action changes based on flow state:
- When button shows "Reveal Answer" → spacebar should call `onReveal()`
- When button shows "Start Timer" → spacebar should call `onStartTimer()`
- When button shows "Next Question" → spacebar should call `onNextAction()`

### Current Code (BROKEN):
```typescript
// Line 113 - ALWAYS calls onStartTimer, regardless of button label
onStartTimer();
```

### Desired Behavior:
The spacebar should trigger whatever button is currently being displayed, not just always start the timer.

## Impact
- Clicking "Reveal Answer" button → works ✓ (calls onReveal via onClick)
- Pressing spacebar when "Reveal Answer" shows → doesn't work ✗ (calls onStartTimer instead of onReveal)

## Why This Affects Fail Sound
1. Quiz pack reveal goes to `QuizHost.handleRevealAnswer()`
2. This calls `handleComputeAndAwardScores()` which plays fail sound
3. When spacebar calls `onStartTimer()` instead of `onReveal()`, the reveal never happens
4. Therefore no scoring, no sound

## Solution
Update the spacebar handler in QuestionNavigationBar to dynamically call the correct handler based on current flow state, similar to how the button UI already determines which action to show.

### Implementation Strategy
1. Analyze the current button determination logic (getOnTheSpotFlowButton / flowState logic)
2. Create a similar function to determine which spacebar handler to call
3. Replace the hardcoded `onStartTimer()` call with context-aware handler dispatch

## Files to Modify
- `src/components/QuestionNavigationBar.tsx` - Update spacebar handler (lines 100-121)

## Why My Previous Fix Didn't Cause This
- This bug exists independently
- My guard in KeypadInterface is unrelated (quiz pack doesn't use KeypadInterface)
- The spacebar bug was always present, just not noticed because users clicked the button instead

## Status
✅ Root cause identified and understood
Ready to implement fix
