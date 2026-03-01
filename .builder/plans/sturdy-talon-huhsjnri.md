# Fix Plan: "infinitys" Display Issue and Timer Memory Leak

## Problem Summary
1. **"infinitys" text appearing in multiple places**: The team.icon field stores "infinitys" (a text string instead of emoji). FastestTeamDisplay has validation (getValidIcon), but other team UI components (BuzzersManagement, TeamSettings, TeamWindow) render the raw icon string without filtering, causing "infinitys" to appear in multiple host app screens.

2. **Timer memory leak/console spam**: KeypadInterface calls onTimerStateChange callback on every 100ms interval tick, causing the parent QuizHost to repeatedly call setState(). This creates constant re-renders and fills the console with "[KeypadInterface] Timer state changed" logs. The interval also doesn't guard against multiple simultaneous intervals being created.

## Root Causes

### "infinitys" Issue
- Team data has icon = "infinitys" (text instead of emoji)
- Only FastestTeamDisplay validates icons with getValidIcon()
- Other components render team.icon directly:
  - BuzzersManagement.tsx: renders icon with corrections map but no length validation
  - TeamSettings.tsx: renders team.icon directly in header
  - TeamWindow.tsx: renders team.icon directly in header

### Timer Loop Issue
- KeypadInterface.handleStartTimer() creates a setInterval that runs every 100ms
- Inside the interval, it calls `onTimerStateChange(true, newValue, timerLength)` on every tick
- Parent QuizHost receives this callback and calls `setState()` on every 100ms tick
- Additionally, KeypadInterface has a useEffect that calls onGameTimerStateChange when isTimerRunning changes
- No guard prevents multiple intervals from being created if handleStartTimer is called multiple times

## Recommended Solution

### Part 1: Fix "infinitys" Display (Add Icon Validation)
Create a centralized getValidIcon() helper or reuse existing one, then apply it to all team icon rendering locations:

**Files to modify:**
1. **BuzzersManagement.tsx** - Apply getValidIcon() validation when rendering team icon
2. **TeamSettings.tsx** - Apply getValidIcon() validation in the Badge header
3. **TeamWindow.tsx** - Apply getValidIcon() validation in header rendering

**Approach:** Use the same getValidIcon() logic already in FastestTeamDisplay:
- If icon.length > 2, return default emoji "🎯"
- Otherwise return the icon as-is

This prevents "infinitys" or any long text strings from being displayed in these components.

### Part 2: Fix Timer Memory Leak (Stop Per-Tick Updates)
Eliminate the per-tick state updates that cause the console spam and state churn:

**Files to modify:**
1. **KeypadInterface.tsx** - Modify handleStartTimer() and handleSilentTimer() to:
   - Remove per-tick calls to onTimerStateChange inside the interval
   - Add a guard using a useRef to prevent multiple simultaneous intervals
   - Keep per-tick countdown updates via onGameTimerUpdate (already exists and is used properly)
   - Keep the existing useEffect that calls onGameTimerStateChange only when isTimerRunning changes (true/false transitions)

2. **QuizHost.tsx** - Optional optimization:
   - Only call setFlowState when transitioning from not-running to running (first time isRunning=true)
   - Avoid calling setState on every timer tick

**Approach:**
- Store interval ID in useRef to track active interval
- Clear any existing interval before starting a new one
- Remove the per-tick `onTimerStateChange` calls from inside setInterval
- Let onGameTimerUpdate handle countdown data (it already does this at line ~1701)
- The useEffect for isTimerRunning changes (line ~1668) handles start/stop notifications properly

## Implementation Order
1. **First**: Fix icon validation (Part 1) - simpler, lower risk
   - Apply getValidIcon to BuzzersManagement, TeamSettings, TeamWindow
   
2. **Second**: Fix timer memory leak (Part 2) - more complex, carefully test
   - Modify KeypadInterface timer logic
   - Test that timer still counts down properly
   - Verify external display updates still work
   - Confirm console spam stops

## Key Files
- src/components/KeypadInterface.tsx (timer & reveal logic)
- src/components/QuizHost.tsx (parent handler)
- src/components/BuzzersManagement.tsx (team icon display)
- src/components/TeamSettings.tsx (team icon display)
- src/components/TeamWindow.tsx (team icon display)
- src/components/FastestTeamDisplay.tsx (already has getValidIcon - reference implementation)

## Success Criteria
- "infinitys" text no longer appears in BuzzersManagement, TeamSettings, or TeamWindow screens
- Console no longer shows repeated "[KeypadInterface] Timer state changed" messages
- Timer still counts down properly during quiz
- Fastest team reveal still displays correctly
- No memory leaks or performance degradation
