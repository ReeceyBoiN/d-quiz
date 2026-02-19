# Plan: Add Ctrl+V Close Functionality to External Display Window

## Problem
Currently, pressing Ctrl+V in the external display window toggles between minimize/maximize states (using `toggleState()`). The user wants Ctrl+V to **close/hide the entire external display window** instead, leaving only the host app's Ctrl+V behavior intact (which cycles display modes).

Additionally, when the external window is closed via Ctrl+V, the host app's toggle button should update to reflect that the external display is closed.

## Solution Overview
Add a new IPC communication channel to allow the external display window to request closure from the Electron main process, with feedback to the host app:

1. **electron/main/main.js** - Add new IPC route `app/close-external-display` that closes the window and notifies the host
2. **electron/preload/preload.js** - Expose `closeWindow()` method in `window.api.externalDisplay`
3. **src/components/ExternalDisplayWindow.tsx** - Update Ctrl+V handler to call the new close method instead of toggleState
4. **src/components/QuizHost.tsx** - Ensure state updates when external window is closed via IPC notification

## Implementation Details

### File 1: electron/main/main.js
**Location**: IPC router section (after existing external-display routes)
**Change**: Add new route that closes the window and notifies the host renderer
```javascript
router.mount('app/close-external-display', async () => {
  if (global.externalWindow && !global.externalWindow.isDestroyed()) {
    global.externalWindow.close();
    
    // Notify host renderer that external window was closed
    if (global.mainWindow && global.mainWindow.webContents) {
      global.mainWindow.webContents.send('external-display/closed', {});
    }
    
    return { ok: true };
  }
  return { ok: false, error: 'External window not found' };
});
```

### File 2: electron/preload/preload.js
**Location**: `window.api.externalDisplay` object definition
**Change**: Add `closeWindow()` method that invokes the new IPC route
```javascript
closeWindow: () => invoke('app/close-external-display'),
```

### File 3: src/components/ExternalDisplayWindow.tsx
**Location**: Ctrl+V keyboard shortcut handler (the useEffect we just added)
**Change**: Replace `toggleState()` call with the new `closeWindow()` call:
```javascript
window.api?.externalDisplay?.closeWindow().catch((err: Error) => {
  console.error('[ExternalDisplayWindow] ❌ Error closing window via Ctrl+V:', err);
});
```

### File 4: src/components/QuizHost.tsx
**Location**: Where external display state is managed
**Change**: Add IPC listener for `external-display/closed` event to update host app state:
```javascript
if (isElectron) {
  window.api?.ipc.on('external-display/closed', () => {
    setExternalWindow(null);
    setIsExternalDisplayOpen(false);
  });
}
```
This listener should be added in a useEffect hook to ensure the toggle button state updates when the external window is closed.

## Expected Behavior After Implementation
- **Ctrl+V in external display window**: Closes the entire window and updates host app state
- **Host toggle button**: Updates to show window is closed (button appearance changes to inactive)
- **Ctrl+V in host app window**: Cycles through display modes (unchanged)
- **Double-click on external window content**: Toggles minimize/maximize (unchanged)
- **Drag external window header**: Moves the window when minimized (unchanged)

## Critical Notes
- No changes needed to DisplayModeToggle.tsx (host app behavior stays the same)
- The new IPC routes follow existing patterns in the codebase
- Proper error handling for when the external window is already closed
- State synchronization ensures UI stays consistent between host and external windows
- No changes to Electron security policies needed
