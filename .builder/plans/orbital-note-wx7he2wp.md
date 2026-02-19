# Plan: Extend Ctrl+V Shortcut to External Display Window

## Overview
Extend the Ctrl+V keyboard shortcut to toggle the External Display on/off when either the host app window OR the external display window is focused. Currently, the shortcut only works when the host app is focused because the keyboard listener is only in the DisplayModeToggle component.

## Problem Context
- Ctrl+V works in the host app window (already implemented)
- Ctrl+V does NOT work when the external display window is focused
- User wants the shortcut to work in both windows for better accessibility
- Should NOT trigger in other applications

## Current Implementation Status
- ✅ Ctrl+V listener added to DisplayModeToggle.tsx (host app)
- ✅ Smart detection prevents shortcut in text inputs
- ❌ External display window has no Ctrl+V listener

## Implementation Strategy

### Approach
Add a Ctrl+V keyboard listener to the ExternalDisplayWindow component (the React component that renders in the external display) that:
1. Listens for `Ctrl+V` when the window is focused
2. Checks for text input context (same smart detection as host app)
3. Calls the IPC method to toggle the external display state
4. Works seamlessly alongside the host app listener

### Key Implementation Details

**Files to Modify**:
1. `src-player/src/ExternalDisplayWindow.tsx` (or similar - the component running in the external Electron window)
   - Add `useEffect` hook for keyboard listener
   - Add Ctrl+V event handler
   - Use existing IPC mechanism to trigger toggle

**Implementation Steps**:
1. Import `useEffect` if not already imported
2. Add keyboard listener similar to DisplayModeToggle
3. Use the same IPC call pattern already in place for toggle functionality
4. Add smart text input detection to prevent shortcut in text fields
5. Ensure cleanup on component unmount

**Code Pattern**:
- Use the existing IPC communication pattern already established in the component
- Call the same `toggleState` or external-display toggle mechanism
- Implement identical text input detection logic

### Integration Points
- Will use existing IPC communication already established
- No changes needed to Electron main process
- Follows the same pattern as the host app implementation

## Files to Modify
1. `src-player/src/ExternalDisplayWindow.tsx`
   - Add `useEffect` hook for Ctrl+V listener
   - Smart detection for text inputs
   - Use existing IPC mechanism to trigger toggle

## Testing Checklist
- [ ] Ctrl+V toggles External Display when host app is focused
- [ ] Ctrl+V toggles External Display when external window is focused
- [ ] Shortcut doesn't work in other applications (browser/system level)
- [ ] Text input detection works in external window
- [ ] No errors in either window's console
- [ ] Component cleanup works properly on unmount

## Expected Outcome
Users can now press Ctrl+V to toggle the External Display on/off from either the host app window or the external display window, providing consistent behavior across both windows.
