# External Display Window - Double-Click and Maximize Fix Plan

## Problem Statement
The external display window was not responding to double-clicks to toggle between minimized/maximized states. Additionally, when maximized, the window did not cover the taskbar completely, and the header bar would not hide properly.

## Root Cause Analysis
The `-webkit-app-region: drag` CSS property on the header was intercepting mouse events at the OS level before JavaScript could receive them, preventing the double-click handler from firing.

## Solution Implemented

### Changes Made
1. **ExternalDisplayWindow.tsx**
   - Removed `-webkit-app-region: drag` from header CSS (line 977)
   - Added JavaScript-based drag handler (lines 214-285) to replace CSS region drag
   - Drag handler only activates when window is minimized
   - Uses mousedown/mousemove/mouseup events to track dragging

2. **electron/main/main.js**
   - Added new IPC handler `get-window-bounds` (after line 201)
   - Returns current window position for drag calculations

3. **electron/preload/preload.js**
   - Added `externalDisplay.getWindowBounds()` method to API
   - Allows safe access to window bounds from renderer process

### How It Works Now
- **Double-click**: Events now reach JavaScript (no `-webkit-app-region` blocking)
- **Toggle State**: Double-click calls `externalDisplay.toggleState()` IPC handler
- **Dragging**: When minimized, JavaScript handles drag via mousedown/mousemove/mouseup
- **Maximize**: Window covers full screen including taskbar (already coded in windows.js)
- **Header Auto-hide**: When maximized, header hidden by default, shows on mouse hover near top

## Verification Steps

### Step 1: Build and Test Double-Click Detection
1. Rebuild the executable
2. Open external display window
3. **Expected**: Double-click the header bar
4. **Verify**: 
   - Console shows `🖱️ Double-click detected` message
   - Window transitions to maximized state (fills screen, covers taskbar)

### Step 2: Test Maximize/Minimize Toggle
1. Window starts minimized (900x600)
2. Double-click header → window maximizes to fill display
3. Double-click header again → window returns to 900x600 at previous position
4. **Verify**: All state transitions work smoothly

### Step 3: Test Dragging When Minimized
1. Window is in minimized state (900x600)
2. Click and drag the header bar
3. **Verify**: Window moves with mouse cursor smoothly

### Step 4: Test Header Auto-Hide When Maximized
1. Window is maximized (full screen)
2. Move mouse to top of screen
3. **Verify**: Header appears when mouse is within ~100px of top
4. Move mouse away from top
5. **Verify**: Header hides after ~1.5 second delay

### Step 5: Test Taskbar Coverage
1. Window maximized on external display
2. **Verify**: 
   - Window covers entire screen
   - Taskbar is completely hidden behind window
   - Window is in front of all other windows (z-order)

## Success Criteria
- ✅ Double-click on header toggles maximized/minimized
- ✅ Window can be dragged when minimized
- ✅ Header hides when maximized (shows on hover)
- ✅ Window covers taskbar when maximized
- ✅ No JavaScript errors in console
- ✅ All IPC handlers working correctly

## Files Modified
1. `src/components/ExternalDisplayWindow.tsx` - Removed CSS drag region, added JS handler
2. `electron/main/main.js` - Added get-window-bounds IPC handler
3. `electron/preload/preload.js` - Added getWindowBounds API method

## Next Steps After Verification
If any issues found:
1. Check console for error messages
2. Verify IPC communication with dev tools
3. Adjust timing/thresholds if needed
4. Re-test after changes

If all tests pass:
1. Commit changes
2. Build production executable
3. Deploy to users
