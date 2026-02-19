# Plan: Restore Window Drag Functionality for Minimized State

## Problem
The external display window header no longer supports dragging when minimized. The drag handler was removed when simplifying the header rendering logic.

## Current State
- Header now conditionally renders: only shows when `isMinimized === true` (good)
- Drag handler was removed (bad - we need to restore it)
- Window needs to be draggable by the header bar when in minimized state

## Solution

### Key Implementation Points
1. **Restore JavaScript-based drag handler**
   - Re-add the `useEffect` that was previously managing the drag behavior
   - Keep it simple: only handle drag when `isMinimized === true`
   - The header element has `data-external-display-header="true"` attribute for targeting

2. **Drag Behavior Details**
   - On mousedown on header: Capture starting position and current window bounds
   - On mousemove: Calculate delta from start position and call `setBounds()` to move window
   - On mouseup: Stop dragging
   - Only activate when header is clicked (use `e.target.closest('[data-external-display-header="true"]')`)

3. **No Changes Needed For**
   - Double-click toggle (already working)
   - Header visibility logic (already fixed)
   - IPC communication (already in place)

## Files to Modify
1. `src/components/ExternalDisplayWindow.tsx`
   - Re-add the drag handler useEffect (lines ~280-340 in original code)
   - Only runs when `isMinimized === true`
   - Uses existing `window.api.externalDisplay.setBounds()` and `getWindowBounds()` methods

## Verification
After changes:
1. Build and run the executable
2. Open external display window (should be minimized by default)
3. Click and drag the header bar - window should move smoothly with mouse
4. Double-click header to maximize - header disappears, drag should stop being possible
5. Double-click again to minimize - header reappears, drag should work again

## Success Criteria
- ✅ Header is draggable when window is minimized
- ✅ Window moves smoothly with mouse cursor
- ✅ Dragging only works on minimized state
- ✅ No JavaScript errors in console
- ✅ Double-click functionality still works
