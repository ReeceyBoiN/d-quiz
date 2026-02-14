# Fix External Display Wheel Spinner Flash Issue

## Problem Summary
When the host enters wheel spinner mode, the external display shows the wheel briefly then flashes to blank (basic mode). Logs reveal a pattern: `wheel-spinner` → `basic` → `wheel-spinner` → `basic`, indicating mode is being rapidly reset.

## Root Cause Analysis

The issue stems from **dependency-driven effect cleanup in WheelSpinnerInterface.tsx**:

### Problematic Code (WheelSpinnerInterface.tsx)
```typescript
// Cleanup effect that resets to 'basic' on dependency change
useEffect(() => {
  return () => {
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('basic');
    }
  };
}, [externalWindow, onExternalDisplayUpdate]);  // <-- Dependencies cause re-runs
```

The `onExternalDisplayUpdate` prop is a function created in the parent component (QuizHost). When this function reference changes (which happens frequently due to its dependencies or re-renders), React:
1. Runs the cleanup function (sets mode to `basic`)
2. Immediately runs the new effect (sets mode to `wheel-spinner`)

This creates a race condition causing the flashing effect on the external display.

## Solution Options

### Option A: Remove Dependency-Driven Cleanup (Recommended)
**Approach**: Keep wheel-spinner mode active while the component is mounted. Stop resetting to basic on prop changes.

**Implementation**:
- Change the cleanup effect to have empty dependencies `[]` (run only once on mount)
- The cleanup will only run when the component unmounts (user navigates away)
- When user exits wheel spinner mode, the component unmounts naturally and cleans up

**Pros**: 
- Simplest fix
- Prevents the race condition entirely
- No cross-component coordination needed
- Mode stays stable while viewing wheel

**Cons**: 
- Relies on proper component unmounting when leaving mode

### Option B: Coordinate Cleanup at Parent Level
**Approach**: Have QuizHost handle the "return to default display mode" responsibility instead of each component doing it.

**Implementation**:
- Remove the cleanup effect from WheelSpinnerInterface
- Let QuizHost decide what display mode to show when WheelSpinnerInterface unmounts
- Use a state variable to track the "previous" or "default" display mode

**Pros**: 
- Single source of truth for display mode management
- More predictable behavior across all game modes
- Easier to debug state transitions

**Cons**: 
- Requires refactoring parent component (QuizHost)
- More complex implementation

### Option C: Debounce Effect Dependencies
**Approach**: Stabilize the `onExternalDisplayUpdate` function reference or memoize it.

**Implementation**:
- Use useCallback in QuizHost to memoize onExternalDisplayUpdate
- Ensure it only changes when specific state changes occur
- This reduces spurious effect re-runs

**Pros**: 
- Prevents unnecessary re-renders throughout app
- Improves performance

**Cons**: 
- Doesn't address the underlying cleanup issue completely
- Still leaves race condition potential

## Recommended Fix: Option A

**Why**: Simplest fix with lowest risk. The purpose of the cleanup is to reset when the component unmounts (user navigates away), which will happen naturally. The cleanup shouldn't trigger on prop changes during normal operation.

### Files to Modify
1. **src/components/WheelSpinnerInterface.tsx**
   - Change cleanup effect dependencies from `[externalWindow, onExternalDisplayUpdate]` to `[]`
   - Add comment explaining this only runs on unmount

### Changes Required
```diff
// Before:
useEffect(() => {
  return () => {
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('basic');
    }
  };
}, [externalWindow, onExternalDisplayUpdate]);

// After:
useEffect(() => {
  // Initialize on mount - cleanup only runs when component unmounts
  return () => {
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('basic');
    }
  };
}, []);  // Empty deps: cleanup runs only on unmount, not on prop changes
```

## Expected Outcome
- External display shows wheel spinner immediately when entering mode
- No flashing or flickering
- Wheel remains displayed while in wheel spinner mode
- External display returns to basic mode when exiting wheel spinner mode (navigating away)

## Testing Checklist
- [ ] Enter wheel spinner mode - wheel displays immediately without flashing
- [ ] Wheel spinning animation plays smoothly on external display
- [ ] Exit wheel spinner mode - display returns to basic
- [ ] No console errors related to external display mode switching
- [ ] Verify with different host/external display scenarios
