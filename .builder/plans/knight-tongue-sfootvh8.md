# Fix Host Remote Navigation & Timer Protection

## Overview
Three interconnected issues to fix:
1. **Remote Next/Previous buttons send commands but host doesn't respond** (commands being sent but not handled)
2. **Remote buttons not disabled while timer is running** (can accidentally trigger during timer)
3. **Reveal Answer button not protected** (can cut timer short with accidental click)

## Root Causes Identified

### Issue 1: Remote Commands Not Handled by Host
- **Remote sends**: 'next-question-nav' and 'previous-question-nav' commands (for preview navigation)
- **Host handles**: 'next-question' and 'previous-question' commands
- **Gap**: Host admin command switch statement doesn't have cases for '-nav' variants
- **Result**: Commands arrive but no handler exists → command fails silently

### Issue 2: Remote Buttons Not Timer-Protected
- **Host UI buttons** (QuestionNavigationBar): Disabled while `flowState.flow === 'running'`
  - Have `disabled={actualTimerIsRunning}` prop and pointer-events blocking
  - Arrow key handlers early-return if timer running
- **Remote buttons** (GameControlsPanel): Only check `canGoNext`/`canGoPrevious` (question availability, not timer state)
  - No timer state checking before allowing clicks
  - Reveal Answer button completely lacks timer protection

### Issue 3: Flow State Not Accessible on Remote
- Host tracks timer via `flowState.flow === 'running'`
- Remote only has button command layouts that determine which buttons show, but not timer-aware disabling
- Need to pass timer state to remote controller so buttons can be disabled

## Solution Approach

### Part 1: Fix Command Handling on Host (src/components/QuizHost.tsx)
Add handlers for the '-nav' variants that the remote is actually sending:

**For 'next-question-nav':**
- Should advance question index without changing flow state (navigation preview, not flow change)
- Only in quiz pack mode
- Calls `handleQuizPackNext()` which increments `currentLoadedQuestionIndex`

**For 'previous-question-nav':**
- Already has handler but may need verification
- Should work in quiz pack mode
- Calls `handleQuizPackPrevious()`

**Key insight**: These '-nav' commands are for navigation within quiz pack (changing question preview), while 'next-question' and 'previous-question' are for flow advancement. The remote needs the '-nav' versions to preview questions without disrupting timer state.

### Part 2: Add Timer State to Remote's Button Logic (src-player/src/components/HostTerminal/GameControlsPanel.tsx)
**Track flowState from host**:
- Receive `flowState` via the host terminal API or state passed from parent
- Use `flowState.flow === 'running'` to determine if timer is active

**Update button disabled logic**:
- Previous button: `disabled={canGoPrevious ? false : true}` → add `|| isTimerRunning`
- Next button: `disabled={canGoNext ? false : true}` → add `|| isTimerRunning`
- Reveal Answer button: `disabled={flowState.flow !== 'running' && flowState.flow !== 'timeup'}` → add `|| isTimerRunning` to prevent accidental clicks

**Visual feedback**:
- Apply same styling pattern as QuestionNavigationBar:
  - `pointerEvents: isTimerRunning ? 'none' : 'auto'`
  - `opacity: isTimerRunning ? 0.5 : 1`
  - `cursor: isTimerRunning ? 'not-allowed' : 'pointer'`

### Part 3: Verify Flow State Broadcasting
- Ensure `flowState` is being sent to the remote controller in the host terminal API
- The remote needs access to current `flowState.flow` value to determine if timer is running
- May need to update host terminal message types or API to include this state

## Files to Modify

### 1. src/components/QuizHost.tsx
**Location**: Lines ~3400-3410 (add new cases after 'previous-question')
**Changes needed**:
- Add case 'next-question-nav': 
  - Log execution
  - If `deps.isQuizPackMode`: call `handleQuizPackNext()`
  - Set success = true
  - Break
- Add case 'previous-question-nav':
  - Log execution  
  - If `deps.isQuizPackMode`: call `handleQuizPackPrevious()`
  - Set success = true
  - Break

**Rationale**: These are navigation-only commands for quiz pack preview, not flow state changes. They should increment/decrement question index without affecting timer.

### 2. src-player/src/components/HostTerminal/GameControlsPanel.tsx
**Location**: Navigation buttons and Reveal Answer button sections
**Changes needed**:
- Add `flowState` to component props or retrieve from parent/context
- Update Previous button: Add `|| flowState.flow === 'running'` to disabled condition
- Update Next button: Add `|| flowState.flow === 'running'` to disabled condition
- Update Reveal Answer button: Add `|| flowState.flow === 'running'` to disabled condition
- Apply pointerEvents/opacity/cursor styling to all three buttons when disabled

**Rationale**: Prevents accidental button clicks during active timer, matching host UI behavior.

### 3. Host Terminal Message Flow (verify/update)
**Files to check**:
- src-player/src/components/HostTerminal/useHostTerminalAPI.ts
- Check if flowState is included in messages sent to GameControlsPanel
- May need to update to ensure remote receives current flowState

**Rationale**: Remote buttons need access to timer state to disable correctly.

## Implementation Sequence

1. **First**: Add 'next-question-nav' and 'previous-question-nav' handlers to QuizHost
   - This fixes the command handling gap
   - Remote buttons will start working for navigation
   
2. **Second**: Update GameControlsPanel to track flowState and disable buttons based on timer
   - This adds timer protection
   - Prevents accidental clicks
   
3. **Third**: Verify flowState is properly broadcast to remote
   - Ensure continuous state sync
   
4. **Finally**: Test all scenarios
   - Test local arrow key navigation (should still work, be disabled during timer)
   - Test remote next/previous buttons (should navigate questions, be disabled during timer)
   - Test reveal answer button on remote (should be disabled during timer)
   - Test previous fix for next-question admin command (should still work in quiz pack mode)

## Testing Checklist

- [ ] Local host app arrow keys: Work when timer not running, disabled while timer running
- [ ] Remote Previous button: Navigates backward through questions, disabled while timer running
- [ ] Remote Next button: Navigates forward through questions, disabled while timer running
- [ ] Remote Reveal Answer button: Reveals answer, disabled while timer running
- [ ] Remote next-question command: Advances to next question in quiz pack (not just preview)
- [ ] Combined scenario: Click next in remote to preview Q2, timer runs on Q1, click reveal in remote (disabled), timer completes, then next-question works
- [ ] Visual feedback: Buttons show disabled state (opacity 0.5, cursor not-allowed) during timer

## Key Insights from Previous Fixes

The previous fix for 'next-question' command addressed stale closure variables by:
- Adding `isQuizPackMode` to `adminListenerDepsRef`
- Using `deps.isQuizPackMode` instead of closure variables
- This ensures the right code path is taken when remote sends commands

This current fix complements that by:
- Adding handlers for the navigation commands the remote is actually sending
- Adding timer state protection to prevent accidental activations
- Ensuring button visibility matches actual button state
