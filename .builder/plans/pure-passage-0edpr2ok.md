# Auto-close External Display on Host App Close

## Problem Statement
Currently, when the host closes the main application window (clicking the X button), the external display window remains open. The user must close both windows manually, when the external display should automatically close with the host app.

## Current State

### Electron Architecture
- **Host window (main)**: Managed by Electron main process as the primary BrowserWindow
- **External display window**: Created by Electron main process via `createExternalWindow()` in `electron/main/windows.js`
- **Current behavior**: When host window closes, no automatic signal is sent to close the external window
- **Problem**: External BrowserWindow remains open, orphaned from the closed host

### Browser Architecture
- **Host window**: Regular browser window
- **External display window**: Opened via `window.open()` popout
- **Current behavior**: Both windows exist independently; closing host doesn't close external

## Recommended Solution

### For Electron Architecture (Primary)
When the main host window closes, automatically close the external display window:

1. **In `electron/main/windows.js`**:
   - Add a listener to the main window's 'close' event
   - In that listener, check if `global.externalWindow` exists and close it
   - This ensures external window closes when host closes

2. **Implementation approach**:
   - Modify the main window creation/setup to attach this close listener
   - Call `externalWindow.close()` if it exists and is still open
   - Maintain existing 'closed' event cleanup logic

### For Browser Architecture (Secondary)
For browser popouts, add a close listener to the host window:

1. **In `src/components/QuizHost.tsx`**:
   - Add an `beforeunload` or `unload` event listener to detect main window closing
   - Call the existing `closeExternalDisplay()` function to clean up the external window
   - Clear local state properly

2. **Implementation approach**:
   - Use `window.beforeunload` event to trigger external window closure
   - Call `externalWindow.close()` for browser popouts before page unloads

## Key Files to Modify
1. **`electron/main/windows.js`**: Add close event listener to main window
2. **`src/components/QuizHost.tsx`**: Add beforeunload listener for browser popouts (optional but recommended)

## Why This Approach
- **Minimal changes**: Only touches window lifecycle management
- **Natural flow**: Aligns with OS window closing behavior - closing the parent closes children
- **Preserves existing logic**: Doesn't remove or break current close handlers
- **Solves both contexts**: Works for both Electron and browser scenarios
- **User expectation**: Standard app behavior when closing main window

## Verification Checklist
- [ ] Click X on main host window → external display closes automatically
- [ ] Close external window manually → main host window remains open
- [ ] Quiz functionality remains unaffected
- [ ] No console errors or warnings
- [ ] Works in both Electron and browser modes

## Implementation Complexity
Low - This is a straightforward window lifecycle enhancement requiring only event listener additions to existing window management code.
