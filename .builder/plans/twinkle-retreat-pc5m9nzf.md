# Fix Music Round Active View - Boxes Getting Cut Off

## Problem
The three panels (Target Selected, Playback, Buzzes) in the active Music Round view grow based on their content and extend behind the bottom navigation bar. The "Play Music" button and volume slider in the Playback card are hidden off-screen. There's no way to scroll within each card to see all content.

## Root Cause
In `src/components/MusicRoundInterface.tsx`, the main content area at line 1163 uses `flex-1 overflow-auto` but the inner `grid grid-cols-3` container and its Card children have no height constraints. The cards grow to fit their content, pushing the bottom controls off-screen.

## Fix

### File: `src/components/MusicRoundInterface.tsx`

**1. Make the grid fill available height instead of growing unbounded:**
- Change the content wrapper (line 1163) from `flex-1 overflow-auto p-4` to `flex-1 min-h-0 p-4 flex flex-col`
- Change the grid container (line 1164) from `grid grid-cols-3 gap-4` to `grid grid-cols-3 gap-4 flex-1 min-h-0`

**2. Constrain each Card to fill its grid cell without overflowing:**
- Add `flex flex-col min-h-0 max-h-full overflow-hidden` to each of the three Card elements (lines 1166, 1232, 1242)
- Add `flex-1 min-h-0 overflow-y-auto` to each CardContent so the content scrolls within the card

This ensures:
- The grid fills exactly the available space between the header and the bottom nav bar
- Each card fills its grid cell height
- Card content scrolls internally when it overflows
- The Play Music button and volume slider remain visible in the Playback card
