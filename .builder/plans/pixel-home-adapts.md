# Feature: Arrow Key Navigation for Question Navigation Arrows

## Summary
Add keyboard shortcuts using arrow keys to trigger the question navigation buttons:
- **Left Arrow Key** → Go to previous question (calls `onPreviousQuestion`)
- **Right Arrow Key** → Go to next question (calls `onNextQuestion`)

## User Requirements
1. Left arrow key should trigger the left navigation arrow button
2. Right arrow key should trigger the right navigation arrow button
3. Should work consistently with existing keyboard patterns in the app

## Current State Analysis
Based on codebase exploration:
- **Pattern Used**: Components use `window.addEventListener('keydown', ...)` in useEffect with cleanup
- **Existing Implementation**: Spacebar already triggers timer in QuestionNavigationBar (lines 92-115)
- **Guards Used**: 
  - Avoid triggering during input: Check `(e.target as HTMLElement).tagName` against INPUT/TEXTAREA
  - State-aware: Check `isTimerRunning` before executing
  - Call `e.preventDefault()` to prevent default browser behavior
- **Arrow Key Example**: Carousel component uses `event.key === "ArrowLeft" / "ArrowRight"`

## User Preferences (Confirmed)
✅ Arrow keys **disabled** when timer is running (safer behavior)
✅ Arrow keys **only work** when navigation arrows are visible (active gameplay only)
✅ **Plain arrow keys** only - no modifiers needed

## Implementation Approach

### Location
**File**: `src/components/QuestionNavigationBar.tsx`

### Changes Required

**1. Add new useEffect for arrow key handling** (after existing spacebar handler)
   - Add listener for 'keydown' events
   - Check for `ArrowLeft` and `ArrowRight` keys using `event.key`
   - Guard against:
     - Input/textarea fields (same pattern as spacebar)
     - Timer running (only navigate when timer is not active)
     - Navigation buttons being hidden (showNavigationArrows = false)
     - Invalid navigation (left arrow disabled on first question, right arrow disabled on last question)
   - Call `e.preventDefault()` to prevent default browser scrolling
   - Call appropriate handler: `onPreviousQuestion()` or `onNextQuestion()`
   - Proper cleanup on component unmount

### Key Logic Points
```
For ArrowLeft:
  - Check if showNavigationArrows is true
  - Check if canGoToPreviousQuestion is true  
  - Check if timer is NOT running
  - Call onPreviousQuestion()

For ArrowRight:
  - Check if showNavigationArrows is true
  - Check if timer is NOT running
  - Call onNextQuestion()
```

### Guards and Conditions
- Only execute if `isVisible` is true (navigation bar is visible)
- Skip if target is INPUT or TEXTAREA field
- Skip if any timer is running (`isTimerRunning` or `isOnTheSpotTimerRunning`)
- Skip if navigation arrows are not shown (`showNavigationArrows` is false)
- For left arrow: also check `canGoToPreviousQuestion` (respects first question constraint)

### Code Pattern to Follow
Match the existing spacebar implementation in QuestionNavigationBar:
- Use `useEffect` hook
- Add listener with `window.addEventListener('keydown', handler)`
- Return cleanup function with `window.removeEventListener('keydown', handler)`
- Include dependencies array with all required variables

## Benefits
- Keyboard-first navigation experience
- Consistent with existing shortcuts (spacebar for timer)
- Follows established patterns in the codebase
- Works alongside button clicks

## Risks & Considerations
- Arrow key navigation might conflict with other keyboard inputs on the page
  - **Mitigation**: Guard against INPUT/TEXTAREA, check component visibility
- Timer state should block navigation
  - **Confirmed**: Already using `isTimerRunning` and `isOnTheSpotTimerRunning` checks
- Must respect button disable states
  - **Confirmed**: Use `canGoToPreviousQuestion` and timer running checks

## Files to Modify
1. `/src/components/QuestionNavigationBar.tsx` - Add arrow key handler (1 location)

## No Changes Needed
- QuizHost.tsx (handlers already wired)
- KeypadInterface.tsx (logic already in place)
- Other components (isolated change)
