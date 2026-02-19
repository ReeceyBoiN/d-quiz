# Plan: Fix External Display Window Drag Jumping

## Problem Analysis
The window jumps around wildly when dragging the header because:

1. **Root Cause**: `setBounds()` is being called on **every single mousemove event** (can be 60+ times per second)
   - This causes massive IPC overhead
   - The Electron window position updates asynchronously
   - We calculate the next position based on stale cached coordinates (`windowX`, `windowY`)
   - By the time our next drag call happens, the window may have already moved to where we calculated in the previous call, causing a jump

2. **Evidence from logs**: 
   - Cursor moves smoothly but window position alternates wildly between expected and wrong values
   - Pattern shows the calculations are using old cached positions

## Solution: Throttle Window Updates

Instead of updating the window on every mousemove, we should:
1. **Throttle `setBounds()` calls** to ~16ms intervals (one screen refresh) using `requestAnimationFrame` or a simple throttle
2. This allows mousemove events to accumulate the correct delta
3. Only call the expensive IPC operation once per frame, not 60+ times per second

## Implementation Steps

### In `src/components/ExternalDisplayWindow.tsx` - Drag Handler useEffect (lines ~210-299)

1. Add a throttle/RAF approach:
   - Store `pendingDragUpdate` flag
   - In `handleMouseMove`: only update the calculated position, don't call `setBounds` immediately
   - Use `requestAnimationFrame` to batch updates and call `setBounds` once per frame
   - This ensures smooth dragging without IPC spam and position jitter

2. Alternative simpler approach:
   - Use a simple throttle timer (e.g., `lastUpdateTime`) to limit `setBounds` calls to every 16ms
   - Only call `setBounds` if enough time has passed since the last call

3. Track the most recent calculated position and use that for all IPC calls

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (lines 210-299, the drag handler useEffect)

## Expected Behavior After Fix
- ✅ Window moves smoothly without jumping
- ✅ Drag follows cursor naturally
- ✅ IPC calls reduced from 60+ per second to ~60 per second (one per frame)
- ✅ Console logs show calculated position increasing smoothly without wild jumps
