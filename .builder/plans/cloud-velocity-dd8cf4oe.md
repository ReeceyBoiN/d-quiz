# Fix: Host Remote Question Type Selector Visibility Bug

## Problem
The Question Type Selector is showing on the host remote when the host app is on the **home screen** (before any game mode is selected), but it should only show when on-the-spot mode is actually **active** (after the user has clicked the keypad button).

**Root Cause**: Set `isQuestionMode: true` globally in initial flowState, but it should only be true when the user actively starts on-the-spot mode.

## Current Behavior (Broken)
- Home screen: isQuestionMode = true (wrong) → remote shows Question Type Selector
- Should be hidden until on-the-spot mode is started

## Solution
Change the initialization strategy:

1. **Initial state** (QuizHost.tsx:479): Keep `isQuestionMode: false`
2. **When starting on-the-spot** (handleStartOnTheSpotMode ~line 1943): Set `isQuestionMode: true`
3. **When closing keypad** (handleKeypadClose ~line 1950): Set `isQuestionMode: false`

## Implementation Steps

### Step 1: Revert isQuestionMode to false in initial state
- File: `src/components/QuizHost.tsx` line 479
- Change: `isQuestionMode: true,` → `isQuestionMode: false,`

### Step 2: Set isQuestionMode=true when starting on-the-spot mode
- File: `src/components/QuizHost.tsx` in `handleStartOnTheSpotMode` function (~line 1943)
- Add: `setFlowState(prev => ({ ...prev, isQuestionMode: true }))`
- This ensures isQuestionMode is only true when user actively starts on-the-spot mode

### Step 3: Set isQuestionMode=false when closing keypad
- File: `src/components/QuizHost.tsx` in `handleKeypadClose` function (~line 1950)
- Add: `setFlowState(prev => ({ ...prev, isQuestionMode: false }))`
- This ensures the flag resets when returning to home screen

## Expected Result
- **Home screen**: No Question Type Selector on host remote
- **After starting on-the-spot**: Question Type Selector appears on host remote
- **After closing on-the-spot**: Question Type Selector disappears from host remote

## Files to Modify
1. `src/components/QuizHost.tsx` (3 locations)
   - Line 479: Initial state change
   - ~Line 1943: handleStartOnTheSpotMode - add setFlowState call
   - ~Line 1950: handleKeypadClose - add setFlowState call
