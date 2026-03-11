# Fix: Tracks list not scrollable — overflows behind bottom nav

## Problem
In the Music Round Setup screen, when tracks are loaded from a folder, the Tracks card grows to fit all content and extends behind the bottom navigation bar. There is no scrollbar, so the user cannot see all tracks.

## Root Cause
The height constraint chain from the QuizHost parent down to the scrollable track list is broken at two points:

1. **QuizHost wrapper** (`src/components/QuizHost.tsx:6790`): The div wrapping `MusicRoundInterface` has `flex-1 overflow-hidden min-h-0` but is **not a flex container**. This means MusicRoundInterface's `flex-1` class does nothing — only `h-full` applies. This is fragile.

2. **Round Configuration section** (`src/components/MusicRoundInterface.tsx:791`): The wrapper `<div className="px-4 pt-3 pb-2">` around the config card has no `flex-shrink-0`, meaning it could theoretically shrink, but more critically it doesn't signal to the flex layout that it has a fixed size.

For `overflow-y: auto` to produce a scrollbar, every ancestor in the chain must have a constrained height. If any ancestor defaults to content-sizing, the constraint breaks and the content just grows unbounded.

## Fix (2 files, 3 small changes)

### 1. `src/components/QuizHost.tsx` — line 6790
Make the MusicRoundInterface wrapper a flex container so the child's `flex-1` works:

```
// Before:
<div className="flex-1 overflow-hidden min-h-0">

// After:
<div className="flex-1 overflow-hidden min-h-0 flex flex-col">
```

### 2. `src/components/MusicRoundInterface.tsx` — line 791
Add `flex-shrink-0` to the Round Configuration wrapper so it keeps its natural size and doesn't compete with the grid for space:

```
// Before:
<div className="px-4 pt-3 pb-2">

// After:
<div className="px-4 pt-3 pb-2 flex-shrink-0">
```

### 3. `src/components/MusicRoundInterface.tsx` — line 851
Keep the `grid-rows-[1fr]` that was already added (this forces the grid row to use only available space rather than growing to content size).

These three changes together ensure an unbroken height constraint chain:
- QuizHost flex-col → MusicRoundInterface flex-1 gets real height
- Header/ActionBar/RoundConfig are fixed → grid gets remaining space via flex-1
- Grid row constrained to 1fr → Card constrained → CardContent constrained → inner div scrolls
