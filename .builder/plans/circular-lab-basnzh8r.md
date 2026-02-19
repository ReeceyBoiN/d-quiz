# Plan: Fix External Display Window Gaps on Right/Bottom When Maximized

## Problem Statement
When the external display window is maximized (double-click to maximize), it covers approximately 99% of the screen but leaves small gaps/borders on the bottom and right side. The window should fill 100% of the display.

## Root Cause Analysis

### Investigation Findings
1. **DPI Scaling Mismatch** (Most Likely)
   - The code doesn't account for `display.scaleFactor` 
   - If display has scaling enabled (125%, 150%), physical pixels ≠ CSS pixels
   - `setBounds()` uses display bounds which might be in physical pixels, but renderer CSS uses device-independent pixels
   - This can cause gaps on high-DPI displays

2. **useContentSize Not Set**
   - BrowserWindow created without `useContentSize: true`
   - `setBounds()` controls outer window size, not renderer content size
   - For frameless windows, small discrepancies can occur between outer bounds and content area

3. **CSS Viewport Coverage**
   - Renderer uses `100vh` and `100vw` which should cover viewport
   - But if window outer size ≠ renderer content size, gaps appear

## Solution Strategy

### Phase 1: Enable Content Size Mode
**File**: `electron/main/windows.js` - `createExternalWindow()`
- Add `useContentSize: true` to BrowserWindow config
- This ensures `setBounds()` controls the renderer content size (not outer frame)
- Eliminates frame size discrepancies

### Phase 2: Account for DPI Scaling
**File**: `electron/main/windows.js` - `maximizeExternalWindow()`
- Read `display.scaleFactor` from the target display
- Log `display.scaleFactor` and `window.devicePixelRatio` for debugging
- If mismatch detected, use `webContents.setZoomFactor()` to align renderer pixels
- Alternative: Account for scaleFactor when calculating bounds (multiply by scaleFactor)

### Phase 3: Verify CSS Full Coverage
**File**: `src/components/ExternalDisplayWindow.tsx`
- Ensure main container uses `height: 100vh, width: 100vw`
- Verify no unexpected padding/margin on top-level div
- Confirm `overflow: hidden` to prevent scrollbars

### Phase 4: Add Diagnostic Logging
**File**: `electron/main/windows.js`
- Log display bounds, scaleFactor, and renderer DPI when maximizing
- Log actual window bounds after `setBounds()` to verify they match target

## Implementation Order

1. **First**: Add `useContentSize: true` to BrowserWindow creation (simplest fix, most likely to help)
2. **Second**: Add DPI scaling logs to diagnose the exact issue
3. **Third**: If gaps persist, implement `setZoomFactor()` or bounds adjustment for DPI
4. **Fourth**: Verify CSS coverage

## Files to Modify
1. `electron/main/windows.js`
   - Line ~78 (createExternalWindow): Add `useContentSize: true`
   - Line ~145-220 (maximizeExternalWindow): Add scaleFactor logging and handling
   
2. `src/components/ExternalDisplayWindow.tsx` (verification only, likely no changes needed)

## Expected Outcome
- Window fills 100% of display including bottom and right edges
- No visible gaps or borders on any screen resolution/DPI scaling setting
- Gaps disappear after implementing useContentSize + potential DPI adjustment
