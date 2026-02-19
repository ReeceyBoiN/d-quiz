# External Display Window - Fullscreen Taskbar Coverage Plan

## User Requirements
1. **Maximize to fullscreen**: Window should completely cover the taskbar (hidden, not visible)
2. **Header auto-hide**: Header should ONLY auto-hide when maximized, always visible when minimized
3. **100% reliable**: Must work on all Windows configurations without workarounds
4. **Smooth transitions**: Double-click to toggle between minimized (900x600) and maximized (fullscreen)

## Root Cause Analysis
The current implementation uses `setAlwaysOnTop(true)` without a level parameter, which on Windows is not aggressive enough to beat the Windows taskbar's own "always on top" setting. The solution is to use true fullscreen mode combined with the highest z-order level.

## Implementation Strategy

### Phase 1: Update Electron Window Management (electron/main/windows.js)

#### 1.1 Modify `maximizeExternalWindow()` Function
**Current Issue**: Uses only `setBounds()` + `setAlwaysOnTop(true)` which doesn't guarantee taskbar coverage
**Solution**: Use true fullscreen with highest always-on-top level

**Changes**:
```javascript
function maximizeExternalWindow() {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return;
  }

  externalWindowState.isMinimized = false;

  // Get primary display bounds (still needed as reference)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  // Set bounds first (positioning)
  externalWindow.setBounds({
    x: x,
    y: y,
    width: width,
    height: height,
  });

  // Enable true fullscreen mode to hide taskbar completely
  externalWindow.setFullScreen(true);

  // Use highest always-on-top level ('screen-saver') to ensure it stays above everything
  externalWindow.setAlwaysOnTop(true, 'screen-saver');

  // Make visible on all workspaces (for virtual desktop support)
  externalWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Focus the window to bring it to foreground
  externalWindow.focus();

  // Prevent resizing in fullscreen (it's already managed by fullscreen mode)
  externalWindow.resizable = false;
}
```

#### 1.2 Modify `minimizeExternalWindow()` Function
**Current Issue**: Need to cleanly exit fullscreen before resizing back
**Solution**: Exit fullscreen, then resize to 900x600, and disable always-on-top

**Changes**:
```javascript
function minimizeExternalWindow() {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return;
  }

  externalWindowState.isMinimized = true;

  // Exit fullscreen mode first
  externalWindow.setFullScreen(false);

  // Disable always-on-top when minimized
  externalWindow.setAlwaysOnTop(false);

  // Save current position (get from bounds before resize)
  const currentBounds = externalWindow.getBounds();
  externalWindowState.minimizedBounds = {
    x: currentBounds.x,
    y: currentBounds.y,
    width: 900,
    height: 600
  };

  // Set to 900x600 at saved position
  externalWindow.setBounds({
    x: externalWindowState.minimizedBounds.x,
    y: externalWindowState.minimizedBounds.y,
    width: 900,
    height: 600,
  });

  // Ensure window is resizable when minimized
  externalWindow.resizable = true;

  // Re-enable visible on current workspace only
  externalWindow.setVisibleOnAllWorkspaces(false);
}
```

#### 1.3 Add Initial Window Properties (in `createExternalWindow()`)
**Purpose**: Set foundational properties that help with window management

**Add after BrowserWindow creation, before loadURL**:
```javascript
// Apply initial settings for better behavior
externalWindow.setMinimumSize(400, 300); // Prevent resizing too small when minimized
externalWindow.setSkipTaskbar(false); // Keep in taskbar when minimized
```

### Phase 2: Update React Component (src/components/ExternalDisplayWindow.tsx)

#### 2.1 Fix Header Auto-Hide Logic
**Requirement**: Header should ONLY auto-hide when maximized, always visible when minimized
**Current State**: Already mostly correct, but verify the logic is clean

**Ensure the useEffect for header auto-hide is correct**:
- When `isMinimized === true`: Always set `showHeader = true`
- When `isMinimized === false`: Hide header by default, show on top-100px hover, auto-hide after 1500ms
- This is already implemented correctly in the current code

#### 2.2 Verify Header Rendering
**Requirement**: Header should have proper positioning for both states
**Current Implementation**: Already handles this with conditional positioning
- Minimized: `position: 'relative'` - normal flow
- Maximized: `position: 'absolute'` - floating at top with auto-hide

No changes needed here, but verify no other references to removed state variables.

### Phase 3: Test Plan

#### 3.1 Visual Testing
1. Open external display window (should be 900x600, minimized state)
2. Verify header is visible with "Double-click to maximize" text
3. Double-click window → should maximize to fullscreen
4. Verify:
   - Window covers entire screen including taskbar
   - Taskbar is completely hidden/behind window
   - Header is initially hidden
5. Move mouse to top of screen → header should appear
6. Move mouse away → after 1.5s, header should hide
7. Double-click header or anywhere → should minimize back to 900x600
8. Verify window returns to 900x600 size cleanly
9. Verify header is visible again in minimized state

#### 3.2 Edge Cases
1. Double-click multiple times rapidly → should toggle cleanly each time
2. Try dragging minimized window → should drag by header
3. Try resizing minimized window → should be resizable (if using Resizable wrapper)
4. Hover header in minimized state → no auto-hide (stays visible)
5. Alt+Tab to other windows → should be able to switch, external window should stay on correct z-order when it regains focus

#### 3.3 Windows-Specific Testing
- Test on Windows 10 and Windows 11
- Test with taskbar on different positions (bottom, left, right)
- Test with taskbar auto-hide enabled and disabled

### Phase 4: Build & Deployment
1. Verify both `electron/main/windows.js` and `src/components/ExternalDisplayWindow.tsx` are updated
2. Run `npm run build:exe` to rebuild the application
3. Test the rebuilt exe on target Windows machine
4. Verify fullscreen and taskbar coverage work correctly

## Key Technical Details

### Why Fullscreen Works
- `setFullScreen(true)` is the most reliable way to hide Windows taskbar
- Combined with `setAlwaysOnTop(true, 'screen-saver')` for highest z-order
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` ensures visibility on virtual desktops

### Why 'screen-saver' Level
- Electron supports always-on-top levels: 'normal', 'floating', 'pop-up-menu', 'screen-saver'
- 'screen-saver' is the highest level, designed for applications that need to override system UI
- This guarantees the window stays above the taskbar even on problematic Windows configurations

### Header Auto-Hide Logic
- Only active when `isMinimized === false` (maximized state)
- Mouse position detection: `e.clientY < 100` to show header
- Auto-hide timeout: 1500ms delay after mouse leaves top area
- Prevents jittery behavior with proper cleanup

## Success Criteria
✅ Window maximizes to fullscreen covering entire display
✅ Taskbar is completely hidden (not visible behind window)
✅ Header auto-hides when maximized, stays visible when minimized
✅ Double-click anywhere toggles minimize/maximize smoothly
✅ Header reveals on top-100px mouse hover (when maximized)
✅ Works reliably on Windows 10 and Windows 11
✅ No visual glitches during transitions

## Files Modified
1. `electron/main/windows.js` - Add fullscreen + highest z-order calls
2. `src/components/ExternalDisplayWindow.tsx` - Already correct, verify no issues

## Implementation Notes
- Order of operations matters: setFullScreen → setAlwaysOnTop → focus
- Exit fullscreen BEFORE resizing back down
- Clean cleanup in minimize function is critical
- Log these operations with electron-log for troubleshooting
