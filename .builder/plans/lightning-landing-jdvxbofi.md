# Plan: Add Background Bubble to Timer Countdown Display in Keypad Mode

## User Request
Add a dark bubble background around the question text during timer countdown in keypad on-the-spot mode to maintain consistent styling across all external display screens.

## Current Situation
- In `ExternalDisplayWindow.tsx`, the 'timer' case displays "Question {number}" in plain text
- We just added dark bubble styling to the 'questionWaiting' case
- User wants consistent bubble styling during active timer countdown

## Problem to Solve
The timer display currently shows question number without the dark bubble background that appears in the waiting state, creating visual inconsistency.

## Solution Approach

### File: src/components/ExternalDisplayWindow.tsx
**Location**: 'timer' case (around line 1000-1040)

**Changes**:
1. Locate the content area div in the 'timer' case where question number is displayed
2. Wrap the question display in a dark bubble container with styling that matches the 'questionWaiting' case:
   - Dark background: `rgba(31, 41, 55, 0.95)`
   - Dynamic border color: `displayData.borderColor`
   - Rounded corners: `borderRadius: '28px'`
   - Padding: `40px 60px`
   - Box shadow: `0 10px 40px rgba(0, 0, 0, 0.5)`
3. Keep the question number text styling the same (size, color: #1f2937)
4. Ensure text size multiplier is applied via `scaleFontSize()`

**Key Detail**: This applies ONLY during active countdown (timer > 0), not after timer expires

## Expected Outcome
- Timer countdown display has consistent dark bubble styling
- Matches the styling we just added to questionWaiting
- Creates uniform appearance across all keypad on-the-spot mode screens
- No impact on other game modes or host app

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (timer case only)

## Testing Checklist
- [ ] Timer countdown shows question with dark bubble
- [ ] Bubble has dynamic border color
- [ ] Text size scaling still works
- [ ] Only affects timer countdown display
- [ ] No changes to other modes
