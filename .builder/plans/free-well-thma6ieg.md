# External Display Maximization - Root Cause Fix Plan

## Problem Summary
Double-clicking the header bar doesn't toggle minimize/maximize, and the window doesn't go fullscreen with header hidden. The taskbar remains visible.

## Root Cause Analysis

### 1. **Double-Click Handler is Broken** (PRIMARY ISSUE)
**Location:** `src/components/ExternalDisplayWindow.tsx` lines ~176–196

**Problem:** The code uses a manual timestamp-based double-click detection:
```javascript
const now = Date.now();
if (now - lastClickTime > 300) {
  setLastClickTime(now);
  return;  // <-- Returns on FIRST click, does nothing
}
// Only continues on SECOND click within 300ms
```

This requires **TWO dblclick events** within 300ms to actually trigger the toggle. A normal double-click (which fires a single `dblclick` event) doesn't work at all.

**Impact:** `window.api.externalDisplay.toggleState()` is never called, so:
- External window doesn't maximize/minimize
- Header never receives state change notification
- Window stays in minimized state with header always visible

### 2. **Event Propagation Blocked** (SECONDARY ISSUE)
**Location:** `src/components/ExternalDisplayWindow.tsx` content div

**Problem:**
```javascript
<div
  onDoubleClick={(e) => {
    e.stopPropagation();  // <-- Blocks document-level listener
  }}
>
```

Even if the document listener is attached, this `stopPropagation` prevents the `dblclick` event from reaching it. Depending on React event ordering, the document listener may never fire.

### 3. **Race Condition in State Synchronization** (TERTIARY ISSUE)
**Location:** `electron/main/main.js` lines ~272–283

**Problem:**
```javascript
router.mount('external-display/toggle-state', async () => {
  const result = toggleExternalWindowState();  // <-- Not awaited!
  // Immediately sends state without waiting for window bounds to apply
  global.externalWindow.webContents.send('external-display/state-changed', {
    isMinimized: externalWindowState.isMinimized
  });
});
```

The `toggleExternalWindowState()` function in `windows.js` includes a 100ms delay to let Electron apply bounds/z-order changes. But since main.js doesn't `await`, the renderer is notified **before** the window is actually resized/positioned. This can cause:
- Header hiding before window finishes expanding
- Race conditions on state visibility
- Inconsistent behavior across systems

## Solution Overview

### Fix #1: Repair Double-Click Handler
**File:** `src/components/ExternalDisplayWindow.tsx`

**Change:** Remove the broken manual timestamp logic. A native `dblclick` event already represents a double-click — no manual detection needed.

**Implementation:**
- Remove `lastClickTime` state variable (only used for this broken logic)
- Remove the timestamp check from `handleDoubleClick`
- Keep only the toggle call in the `dblclick` listener
- Remove the `lastClickTime` dependency from the effect

**Result:** A normal double-click will correctly invoke the toggle IPC.

### Fix #2: Allow Event Propagation
**File:** `src/components/ExternalDisplayWindow.tsx`

**Change:** Remove `e.stopPropagation()` from the content div's `onDoubleClick` handler, or better yet, let the document-level listener handle all double-clicks without interference from child elements.

**Implementation:**
- Remove or comment out the `onDoubleClick={(e) => { e.stopPropagation(); }}` from the content div
- Allow the document-level `dblclick` listener to fire normally

**Result:** Double-click events properly reach the document-level listener.

### Fix #3: Fix State Synchronization Race Condition
**File:** `electron/main/main.js`

**Change:** Await `toggleExternalWindowState()` before sending the state-changed notification to the renderer. This ensures the 100ms delay in `toggleExternalWindowState()` is respected.

**Implementation:**
```javascript
router.mount('external-display/toggle-state', async () => {
  try {
    const result = await toggleExternalWindowState();  // <-- ADD await
    if (global.externalWindow && global.externalWindow.webContents) {
      global.externalWindow.webContents.send('external-display/state-changed', {
        isMinimized: result.isMinimized  // Use returned state
      });
    }
    return { ok: true, isMinimized: result.isMinimized };
  } catch (err) {
    // ... error handling
  }
});
```

**Result:** Renderer receives state notification **after** window bounds/z-order are fully applied, eliminating race conditions.

## Expected Outcomes After Fixes

✅ Single double-click on header or window → toggles minimize/maximize  
✅ On maximize → window fills entire screen covering taskbar  
✅ On maximize → header hides by default, reveals on mouse hover to top  
✅ On minimize → window returns to 900x600, header always visible  
✅ No race conditions or timing issues  
✅ Consistent behavior across platforms and system configurations

## Files to Modify

1. **src/components/ExternalDisplayWindow.tsx**
   - Remove `lastClickTime` state variable
   - Fix `handleDoubleClick` to remove timestamp check
   - Remove `e.stopPropagation()` from content div's onDoubleClick
   - Update effect dependencies to remove `lastClickTime`

2. **electron/main/main.js**
   - Add `await` to `toggleExternalWindowState()` call
   - Use returned state in the `webContents.send()` call

3. **electron/main/windows.js** (already correct)
   - No changes needed; `toggleExternalWindowState()` is already async with 100ms delay

## Implementation Order

1. Fix the double-click handler in ExternalDisplayWindow.tsx (Fix #1)
2. Fix event propagation in ExternalDisplayWindow.tsx (Fix #2)
3. Fix state sync in main.js (Fix #3)
4. Rebuild exe
5. Test: double-click header → window should maximize to fullscreen covering taskbar, header should hide
6. Test: double-click again → window should minimize to 900x600, header should show
7. Test: mouse hover to top when maximized → header should reveal
