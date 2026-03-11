# Fix Tracks List Overflow + Remove Drag Reorder From Setup Screen

## Problem 1: Tracks list extends behind the bottom navigation bar

The MusicRoundInterface's setup phase content overflows behind the StatusBar (bottom nav) because the wrapper chain between `renderTabContent()` and the MusicRoundInterface doesn't properly constrain height through the flex hierarchy.

### Root cause

In `QuizHost.tsx` (line ~6787), the music round is wrapped in:
```jsx
<div className="flex-1 relative min-h-0">
  <div className="flex-1 overflow-hidden">
    <MusicRoundInterface />
  </div>
</div>
```

The outer div is a flex child (of `flex-1 flex flex-col` parent), so `flex-1` works. But it's **not a flex container** itself, so the inner div's `flex-1` does nothing — it has no effect outside a flex parent. The inner div grows unconstrained, pushing below the StatusBar.

### Fix (QuizHost.tsx ~line 6789)

Change the wrapper to be a proper flex column so the height constraint chains through:

```jsx
<div className="flex-1 relative min-h-0 flex flex-col">
  <div className="flex-1 overflow-hidden min-h-0">
    <MusicRoundInterface />
  </div>
</div>
```

Also, in `MusicRoundInterface.tsx` (line 772), the setup phase outer div uses `h-full` which is fine, but just to be safe, ensure it also has `min-h-0` to prevent flex overflow:

```
<div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
```
This is already correct — `overflow-hidden` clips content. No change needed here.

## Problem 2: Remove drag-to-reorder from setup track list

On the setup screen, tracks should just be a read-only list (with preview buttons). The drag reorder handles (`GripVertical` icon + `draggable` + `cursor-grab`) confuse users into thinking they should reorder here, when reordering belongs in the gameplay phase's playlist-ready step.

### Fix (MusicRoundInterface.tsx ~lines 946-969)

In the setup phase track list, remove:
- `draggable` attribute from each track row
- `onDragStart`, `onDragOver`, `onDragEnd` handlers
- `GripVertical` icon
- `cursor-grab active:cursor-grabbing` classes
- The conditional `bg-accent/50` based on `dragIndex`

Also remove the "Shuffle" button from the setup tracks header (line ~931), since reordering isn't relevant at setup — tracks just show what's in the folder.

The track rows become simple non-interactive list items with just: number, file icon, name, and preview button.
