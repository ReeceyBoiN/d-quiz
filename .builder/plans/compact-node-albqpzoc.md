# Plan: Fix Timer Animation Jitter in On-The-Spot Mode

## Problem Analysis
The timer animation in on-the-spot keypad mode still shows jitter compared to quiz pack mode despite both now using 100ms update intervals. Investigation revealed several root causes:

### Root Causes Identified:
1. **Falsy value coercion bug** - Message handler uses `event.data.timerValue || null` which converts numeric 0 to null, causing the display to think there's no timer value at zero
2. **Mismatched CSS transitions** - 'timer' mode uses `transition: width 0.05s linear` while 'timer-with-question' uses `0.1s linear` (50ms vs 100ms)
3. **Inconsistent message shapes** - Quiz pack sends timerValue nested in `data.timerValue`, keypad sends at top-level `timerValue`, causing different rendering paths
4. **Silent timer still using 1000ms** - Keypad silent mode wasn't updated to 100ms frequency like normal timer
5. **Floating-point precision noise** - Repeated 0.1 subtractions create values like 29.900000000000002

## Solution Approach - ALL 5 FIXES

### Fix 1: Eliminate Falsy Value Coercion (HIGH IMPACT)
**File:** src/components/ExternalDisplayWindow.tsx (message handler, lines ~90)
- Replace: `timerValue: event.data.timerValue || null`
- With: `timerValue: event.data.timerValue ?? null` (nullish coalescing)
- Also apply to IPC handler (Electron path around lines ~120)
- **Impact:** Prevents display jumping when timer reaches 0, preserves numeric 0 values

### Fix 2: Unify CSS Transition Durations (HIGH IMPACT)
**File:** src/components/ExternalDisplayWindow.tsx
- Change 'timer' mode progress bar transitions: `'width 0.05s linear'` → `'width 0.1s linear'`
- Keep 'timer-with-question' at `'width 0.1s linear'`
- Apply to both top progress bar (around line 481) and bottom progress bar (around line 511) in 'timer' case
- **Impact:** Matches transition duration to 100ms tick interval for consistent smoothing across all modes

### Fix 3: Update Silent Timer to 100ms (IMPORTANT)
**File:** src/components/KeypadInterface.tsx (silent timer handler, lines ~882-907)
- Verify/change interval from 1000ms to 100ms
- Ensure decrement is 0.1 (not 1) to match normal timer
- This ensures silent mode also gets smooth 100ms updates
- **Impact:** Prevents silent mode from appearing chunky with 1s step jumps

### Fix 4: Standardize Message Format (MEDIUM IMPACT)
**File:** src/components/KeypadInterface.tsx
- Verify both normal timer (lines ~751-761) and silent timer (lines ~897-907) are sending consistent message structure
- Ensure both include `totalTime` at top level for consistent ExternalDisplayWindow processing
- **Impact:** Ensures both keypad modes use the same ExternalDisplayWindow rendering code path, reducing mode-switching hiccups

### Fix 5: Reduce Floating-Point Noise (LOW IMPACT, POLISH)
**File:** src/components/KeypadInterface.tsx
- Before sending to external display: Round timer values to 2 decimal places
- Example: `timerValue: Number(newValue.toFixed(2))`
- Apply to both normal timer and silent timer update calls
- **Impact:** Eliminates floating-point precision artifacts (29.900000000000002 → 29.90) in progress calculations

## Implementation Order
1. Fix 1: Falsy coercion in ExternalDisplayWindow message handlers
2. Fix 2: CSS transition durations in ExternalDisplayWindow
3. Fix 3: Update silent timer interval in KeypadInterface
4. Fix 4: Verify/standardize message format in KeypadInterface
5. Fix 5: Round values before sending in KeypadInterface

## Expected Outcome
- Smooth, continuous countdown animation across all on-the-spot modes (keypad normal, keypad silent, nearest wins, buzz-in)
- No visible jumps or hitches when timer reaches zero
- Animation smoothness matching quiz pack mode exactly
- Consistent behavior across all game modes and display scenarios

## Critical Files to Modify
- **src/components/ExternalDisplayWindow.tsx** - Message handlers + CSS transitions (Fixes 1, 2)
- **src/components/KeypadInterface.tsx** - Timer intervals + message formatting (Fixes 3, 4, 5)
