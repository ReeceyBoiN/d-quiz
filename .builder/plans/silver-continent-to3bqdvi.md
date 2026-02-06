# Duplicate Fail Sound Bug - Keypad On-The-Spot Mode

## Problem Analysis

In keypad on-the-spot mode, when revealing an answer with no correct teams, the fail sound sometimes plays **twice** with two different audio files selected:
- First file: "Fail Sad Party Whistle.wav"
- Second file: "Fail sad trumpet.wav"

### Evidence from Console Logs
```
[Scoring] Playing fail sound
[audioUtils] playFailSound - looking in: C:\...
[audioUtils] playRandomSound - folderPath: ... files found: 5
[audioUtils] Selected file: ...Fail Sad Party Whistle.wav
[audioUtils] playRandomSound - folderPath: ... files found: 5
[audioUtils] Selected file: ...Fail sad trumpet.wav
```

Two distinct `playRandomSound` calls appear, indicating `playFailSound()` is being invoked twice.

### Root Cause (Hypothesis)

Multiple event handlers in KeypadInterface can trigger `handleRevealAnswer()` simultaneously:

1. **Spacebar keyboard handler** (line 1456-1457): Directly calls `handleRevealAnswer()` when on results screen and spacebar is pressed
2. **Parent navigation button**: Calls `handleReveal()` (via onGetActionHandlers at line 1314-1315), which then calls `handleRevealAnswer()` (line 1301)

Both handlers check `!answerRevealed` before invoking their respective reveal functions. If triggered almost simultaneously before the state updates propagate:
- Both see `answerRevealed = false`
- Both call `handleRevealAnswer()`
- `handleRevealAnswer()` calls `onAwardPoints()` → which calls `handleComputeAndAwardScores()` → which calls `playFailSound()` twice

### Why It's Sometimes Happening

The issue is **race condition-sensitive**. It occurs when:
- Spacebar handler and parent nav button handler are both triggered in quick succession
- OR the state update `setAnswerRevealed(true)` hasn't propagated to both handlers before they check the condition
- OR there's an unintended double-trigger from a single user action

## Recommended Solution

### Fix 1: Add Guard in handleRevealAnswer (PRIMARY)

**File:** `src/components/KeypadInterface.tsx`  
**Location:** Lines 985-1098 (handleRevealAnswer function)  
**Action:** Add a guard using a ref to prevent duplicate onAwardPoints calls

**Implementation:**
1. Create a `answerRevealInProgressRef` at component level
2. Check and set this ref at the start of `handleRevealAnswer()`
3. Only proceed with `onAwardPoints()` call if the reveal isn't already in progress
4. Reset the ref after the reveal is complete or after a timeout

**Code Pattern:**
```typescript
const answerRevealInProgressRef = useRef(false);

const handleRevealAnswer = useCallback(() => {
  // Guard against duplicate calls
  if (answerRevealInProgressRef.current) {
    console.log('[KeypadInterface] handleRevealAnswer already in progress, skipping');
    return;
  }
  
  answerRevealInProgressRef.current = true;
  
  // ... existing logic ...
  
  if (onAwardPoints) {
    // ... compute correctTeamIds, fastestTeamId ...
    onAwardPoints(correctTeamIds, 'keypad', fastestTeamId, teamAnswerTimes, true);
    // ... rest of logic ...
  }
  
  // Reset guard after completion
  setTimeout(() => {
    answerRevealInProgressRef.current = false;
  }, 500);
}, [/* existing dependencies */]);
```

**Rationale:**
- Prevents `onAwardPoints()` from being called multiple times within a single reveal action
- Uses ref instead of state to avoid triggering unnecessary re-renders
- 500ms timeout allows the state updates to settle before allowing another reveal
- Minimal change, non-invasive fix

### Fix 2: Ensure Single Event Path (OPTIONAL - for cleaner architecture)

**File:** `src/components/KeypadInterface.tsx`  
**Location:** Lines 1437-1489 (spacebar keyboard handler)  
**Consideration:** 
- The spacebar handler and parent nav button can both call reveal functions
- Consider if we should disable the spacebar handler when the parent nav button is handling reveals
- OR make the parent pass a flag to disable local keyboard handling

**Current State:** The keyboard handler is already guarded by `!answerRevealed`, which should prevent duplicate calls under normal conditions. The guard in Fix 1 is the safest approach.

## Implementation Order

1. **Apply Fix 1** (Guard in handleRevealAnswer) - this is the safest and most direct fix
2. **Test** on-the-spot keypad reveal scenarios with and without correct teams
3. **Verify** no duplicate sounds play in any scenario
4. **Consider Fix 2** only if issues persist after Fix 1

## Expected Outcome

✅ **On-the-spot Keypad (0 teams correct):** Plays exactly **1** fail sound  
✅ **On-the-spot Keypad (1+ teams correct):** Plays exactly **1** applause sound  
✅ **No race conditions** from simultaneous event handlers  
✅ **No duplicate audio** in any reveal scenario  

## Files Requiring Changes

1. **src/components/KeypadInterface.tsx** (1 location)
   - Add `answerRevealInProgressRef` to component level
   - Add guard logic at start of `handleRevealAnswer()` function
   - Add reset timeout after reveal completion
