# Plan: Fix Reveal Broadcast Conflicts in Quiz Pack Mode

## Issue Identified
**DUPLICATE REVEAL BROADCASTS** occur in quiz pack mode due to conflicting handler calls.

### Root Cause
In QuizHost.tsx lines 4042-4047, the reveal button handler for quiz pack mode calls BOTH functions in sequence:

```javascript
onReveal={
  isQuizPackMode || flowState.isQuestionMode
    ? () => {
        handleRevealAnswer();      // Broadcasts reveal (lines 2569-2578)
        handlePrimaryAction();     // ALSO broadcasts reveal (lines 1594-1604)
      }
    : gameActionHandlers?.reveal ?? (() => {})
}
```

### Consequence
- Player devices receive **TWO identical REVEAL messages** for a single reveal action
- This could cause display bugs, double-highlights, or confusion in player UI
- The messages have identical content but arrive as separate events

## Broadcast Points in QuizHost

**Path 1: handleRevealAnswer() (lines 2483-2583)**
- Broadcast at lines 2569-2578
- Called directly from UI button (lines 4045, 3869, 3886, 3918)
- Also called via combined handler (lines 4044-4046)
- Updates state: setShowAnswer(true), setShowTeamAnswers(true)

**Path 2: handlePrimaryAction() flow case 'running'/'timeup' (lines 1514-1610)**
- Broadcast at lines 1594-1604
- Called from combined handler (line 4046)
- Also called independently as primary action (lines 4050-4062)
- Updates state: setTeamAnswerStatuses, awards points (in quiz pack mode)

## Problem Summary
The reveal button handler calls BOTH paths, but:
- Both broadcast identical reveal data
- handleRevealAnswer handles UI/display updates
- handlePrimaryAction handles state machine transitions

Only ONE of these should broadcast to avoid duplicates.

## Solution Approaches

### Option A: Remove broadcast from handlePrimaryAction
- Keep broadcast only in handleRevealAnswer (lines 2569-2578)
- Remove broadcast from handlePrimaryAction flow case (lines 1594-1608)
- Pro: Simpler - single broadcast point for reveals
- Con: May break other code paths that call handlePrimaryAction directly without handleRevealAnswer

### Option B: Remove broadcast from handleRevealAnswer
- Keep broadcast only in handlePrimaryAction (lines 1594-1604)
- Remove broadcast from handleRevealAnswer (lines 2569-2578)
- Pro: Ensures broadcast happens in state machine
- Con: handleRevealAnswer is also used in on-the-spot mode via KeypadInterface callbacks, need to verify impact

### Option C: Refactor to single broadcast function
- Create a centralized `broadcastAnswerReveal()` function
- Call it from ONE location only (either handleRevealAnswer or handlePrimaryAction, not both)
- Ensure both handlers can trigger the same broadcast without duplication
- Pro: Cleanest solution, prevents future duplicates
- Con: Requires more refactoring

## Selected Approach
**Option C** - Refactor to centralized broadcast function

This is the cleanest, most maintainable solution that prevents future duplicates.

## Implementation Plan

### Step 1: Create centralized broadcast function
Create a new function in QuizHost.tsx that encapsulates reveal broadcasting logic:

```typescript
const broadcastAnswerReveal = useCallback((question: any) => {
  if (!question || !(window as any).api?.network?.broadcastReveal) {
    return;
  }

  try {
    const revealData = {
      answer: getAnswerText(question),
      correctIndex: question.correctIndex,
      type: question.type,
      selectedAnswers: []
    };
    console.log('[QuizHost] Broadcasting reveal to players:', revealData);
    (window as any).api.network.broadcastReveal(revealData);
  } catch (err) {
    console.error('[QuizHost] Error broadcasting reveal:', err);
  }
}, []);
```

### Step 2: Update handleRevealAnswer
- Remove broadcast code (lines 2569-2578)
- Add call: `broadcastAnswerReveal(currentQuestion)` at the end

### Step 3: Update handlePrimaryAction flow case
- Remove broadcast code (lines 1594-1608)
- Add call: `broadcastAnswerReveal(currentQuestion)` at the end

### Step 4: Verify single broadcast point
- Both handlers now call the same `broadcastAnswerReveal()` function
- No duplication possible
- Clear intent: reveal action = broadcast to players

## Files to Modify
- `src/components/QuizHost.tsx`
  1. Add `broadcastAnswerReveal` function (new useCallback)
  2. Lines 1594-1608: Replace broadcast with `broadcastAnswerReveal(currentQuestion)`
  3. Lines 2569-2578: Replace broadcast with `broadcastAnswerReveal(currentQuestion)`
  4. Add to dependency arrays if needed

## Benefits
- ✓ No more duplicate broadcasts
- ✓ Single source of truth for reveal broadcast logic
- ✓ Easier to modify broadcast behavior in future (change in one place)
- ✓ Clearer code intent
- ✓ Prevents accidental duplicates from future code changes

## Verification Required
- ✓ Both code paths now call broadcastAnswerReveal exactly once
- ✓ Verify quiz pack mode reveal works with centralized function
- ✓ Confirm on-the-spot mode still works (uses KeypadInterface)
- ✓ Test that reveal message reaches player devices exactly once
- ✓ No console errors about duplicate sends
