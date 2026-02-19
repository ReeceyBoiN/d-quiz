# Plan: Fix External Display Window Drag Jittering

## Problem Analysis

The window is jittering during drag because we're calculating position deltas manually with async IPC calls to Electron. The window position updates lag behind the cursor, creating a disconnected feel.

## Solution: Use Electron Native Dragging

Leverage Electron's built-in `-webkit-app-region: drag` CSS property for window dragging. This delegates window movement to the OS, eliminating:
- Manual position calculations
- IPC latency
- Position synchronization issues
- Jitter and lag

## Implementation Plan

### Step 1: Remove JavaScript Drag Handler
Delete the entire drag handling useEffect from `src/components/ExternalDisplayWindow.tsx` (lines ~210-303 that handle `mousedown`, `mousemove`, `mouseup`).

### Step 2: Enable Native Dragging with CSS
Keep the existing CSS rule in the component's style tag:
```css
[data-external-display-header="true"] {
  -webkit-app-region: drag;
}
```

This single CSS rule tells Electron: "Let the OS handle dragging this element naturally."

### Why This Works
1. **OS-Level Control**: Electron delegates dragging to the OS window manager
2. **Zero Latency**: Window position updated by OS, not by async IPC
3. **Perfect Smoothness**: No manual calculations, no sync issues
4. **Native Feel**: Behaves exactly like native window dragging

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`: Remove the drag handler useEffect (~210-303)

## Expected Result
- ✅ Window drags smoothly without jitter
- ✅ Window follows cursor perfectly
- ✅ Native, responsive feel
- ✅ No lag or jumping
- ✅ No drag-related IPC calls or console logs

## Testing
1. Drag the header with mouse held down - should be perfectly smooth
2. Drag quickly and slowly - consistent smooth motion in both cases
3. Release and position should be exactly where cursor is
