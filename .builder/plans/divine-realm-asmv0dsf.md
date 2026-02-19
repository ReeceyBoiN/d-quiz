# Plan: Add Ctrl+V Keyboard Shortcut for External Display Toggle

## Overview
Add keyboard shortcut (Ctrl+V) to trigger the same action as clicking the External Display toggle checkbox button in the DisplayModeToggle component.

## Problem Context
- Users currently must click the checkbox button (with green checkmark) to toggle the External Display on/off
- A keyboard shortcut would improve accessibility and workflow efficiency
- Target: Ctrl+V key combination (when external display toggle button is available)

## Implementation Strategy

### Approach
Add a keyboard event listener to the DisplayModeToggle component that:
1. Listens for `keydown` events with `Ctrl+V` combination
2. Checks if the focused element is a text input/textarea (smart detection)
   - If text input is focused: allow normal paste behavior, don't trigger toggle
   - If not in text input: trigger `onExternalDisplayToggle` callback
3. Only activates when the toggle button is available (`onExternalDisplayToggle` prop exists)

### Key Implementation Details

**File**: `src/components/DisplayModeToggle.tsx`

**What to Add**:
1. Add a `useEffect` hook that attaches a global keydown event listener
2. Inside the listener:
   - Check if `event.ctrlKey && event.key === 'v'` (case-insensitive)
   - Check if the focused element is a text input or textarea:
     - `document.activeElement` should not be an input, textarea, or contenteditable element
     - If it is: skip the handler and allow normal paste behavior
   - If not in text input AND listener is present: call `event.preventDefault()` and invoke `onExternalDisplayToggle()`
   - Only attach listener if `onExternalDisplayToggle` is defined
3. Cleanup: Remove the event listener on component unmount
4. No visual hints added - silent implementation

**Why This Approach**:
- Global listener ensures shortcut works throughout the app (except in text inputs)
- Smart detection preserves standard Ctrl+V paste functionality in text fields
- Prevents conflicts with browser/app paste behavior in appropriate contexts
- Minimal code changes, isolated to the component that controls the feature
- Automatically enabled/disabled based on whether toggle function is available
- Silent implementation - no UI clutter, users discover shortcut organically

### Code Location
Insert useEffect hook after the existing hooks in DisplayModeToggle component (after any existing state declarations, before the return statement).

### Optional Enhancements (Future)
- Add visual indicator (tooltip) showing the shortcut hint
- Add user preference to enable/disable keyboard shortcuts
- Document shortcut in help/settings UI

## Files to Modify
1. `src/components/DisplayModeToggle.tsx`
   - Add useEffect hook for keyboard listener
   - Cleanup on unmount

## Testing Checklist
- [ ] Ctrl+V toggles External Display on (when off)
- [ ] Ctrl+V toggles External Display off (when on)
- [ ] Shortcut works in all UI contexts
- [ ] Default browser paste is prevented when shortcut is triggered
- [ ] Shortcut doesn't interfere with Ctrl+V in text inputs (if needed)
- [ ] Component cleanup works properly on unmount

## Expected Outcome
Users can now press Ctrl+V to toggle the External Display on/off, providing a faster alternative to clicking the checkbox button.
