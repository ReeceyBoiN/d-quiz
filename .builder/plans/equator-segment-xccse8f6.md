# Fix: Tracks list overflowing behind bottom navigation bar

## Problem
In the Music Round Setup screen, the "Tracks" card on the right extends below the visible area, behind the bottom StatusBar. Users cannot scroll to see all tracks in the list.

## Root Cause
The two-column layout (folder browser + tracks list) uses CSS Grid (`grid grid-cols-2`) at line 851 of `MusicRoundInterface.tsx`. CSS Grid rows default to `auto` height, which means the row grows to fit the tallest content (the tracks list). Even though the grid container has `flex-1 min-h-0`, the grid row itself isn't constrained.

## Fix

### File: `src/components/MusicRoundInterface.tsx` (line 851)

**Change the grid container** to explicitly constrain the grid row height:

```
// Before:
<div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 grid grid-cols-2 gap-4">

// After:
<div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 grid grid-cols-2 grid-rows-[1fr] gap-4">
```

Adding `grid-rows-[1fr]` forces the single grid row to take exactly the available space (constrained by the parent's `flex-1 min-h-0`), instead of growing to fit content. The Cards inside already have `min-h-0 overflow-hidden` and the inner track list already has `overflow-y-auto`, so scrolling will work once the height is properly constrained.

This is a single-line CSS class change.
