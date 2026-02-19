# Plan: Fix External Display Window Maximization and Sizing

## User Requirements
1. **Maximize trigger**: Double-click anywhere on the window content (NOT the header) to toggle maximize/minimize
2. **Minimized sizing**: Window should be freely resizable when minimized (not fixed 900x600)
3. **Maximized header**: Hide the header bar when window is maximized (full-screen mode)
4. **Keep header for dragging**: When minimized, keep header visible and draggable

## Current Issues
- Double-click on header bar doesn't properly maximize to fill screen
- Double-clicking just below the header works better but header doesn't disappear
- Window is fixed at 900x600 size
- Header remains visible even when maximized

## Solution Approach

### Part 1: Fix Double-Click Handler (Renderer - React)
**File**: `src/components/ExternalDisplayWindow.tsx`

**Current behavior**: Double-click handler is on entire document, triggers from header too

**Change**:
1. Remove the global `dblclick` listener on document
2. Add `dblclick` listener ONLY to the content area div (the one with `renderContent()`)
3. Header should keep only the `-webkit-app-region: drag` for native dragging
4. Keep the header visible condition based on `isMinimized` state (already in code: `{isMinimized && (...)}`

### Part 2: Hide Header When Maximized
**File**: `src/components/ExternalDisplayWindow.tsx`

**Change**: The header conditional rendering already checks `isMinimized`. This should work correctly if:
- When double-clicking content and isMinimized is true → toggleState() sets isMinimized to false
- Header hidden: `{isMinimized && (...header...)}`

No additional React changes needed if state management is working correctly.

### Part 3: Fix Window Sizing to Match Screen Resolution
**File**: `electron/main/windows.js`

**Changes needed**:
1. When maximizing: Ensure `setBounds()` uses actual display dimensions from `targetDisplay.bounds`
2. Currently maximizeExternalWindow already does this ✓
3. Verify it's not being overridden by fixed dimensions

**Potential issue**: Check if anything is resetting window to 900x600 when maximized

### Part 4: Allow Window Resizing When Minimized
**File**: `electron/main/windows.js`

**Current state**: Window is set resizable during minimize
**Check**: Verify `minimizeExternalWindow()` sets `resizable: true`

## Implementation Steps

1. **Remove global dblclick from document** → Only listen on content area
2. **Add dblclick to content container** → Trigger toggleState when user double-clicks content
3. **Verify header auto-hides** → Ensure isMinimized state flows correctly
4. **Test scaling** → Verify maximized window fills entire screen properly
5. **Test free resizing** → Verify users can resize minimized window

## Expected Outcome
- ✅ Double-clicking header does nothing (just draggable)
- ✅ Double-clicking content area toggles maximize/minimize
- ✅ When maximized: no header visible, fills entire screen
- ✅ When minimized: header visible for dragging, window can be resized freely
- ✅ Window sizes to actual display resolution, not fixed dimensions

## Files to Modify
1. `src/components/ExternalDisplayWindow.tsx` - Double-click handler location
2. `electron/main/windows.js` - Verify resize settings (read-only check first)
