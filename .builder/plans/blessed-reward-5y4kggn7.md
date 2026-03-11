# Music Round Setup Layout Rework

## Summary
Rearrange the setup phase layout in `MusicRoundInterface.tsx` so everything fits on screen without requiring page-level scrolling, and reorder the sections to match the user's preferred flow.

## Current Layout (top to bottom)
1. Header bar: "Music Round Setup" title + X close button
2. Scrollable content:
   - 2-column grid: Folder browser (left) + Tracks list (right)
   - Round Configuration card
3. Footer bar: Close button + Start Round button

## New Layout (top to bottom)
1. **Header bar**: "Music Round Setup" title (unchanged)
2. **Action bar** (Close + Start Round buttons): Moved from bottom to just under the header. This keeps the main actions always visible at the top.
3. **Round Configuration card**: Moved up from below the grid to sit right under the action bar, so settings are immediately accessible.
4. **2-column grid**: Folder browser (left) + Tracks list (right) - fills the remaining space below.
5. **Tracks list**: Constrain the inner track list to a scrollable area using `flex-1 overflow-y-auto` within its card, rather than using fixed `min-h`/`max-h` values that can push content off screen. Both the folder list and tracks list should fill available vertical space equally using flex layout.

## File Modified
- `src/components/MusicRoundInterface.tsx` — Setup phase render block only (lines ~770-980)

## Implementation Details

### Structure change in the setup `return` block:
```
<div flex-col h-full>
  <!-- 1. Header: Music Round Setup title -->
  <div header bar>...</div>

  <!-- 2. Action bar: Close + Start Round (moved from footer) -->
  <div action bar>
    <Close button />
    <Start Round button OR loading progress />
  </div>

  <!-- 3. Round Configuration (moved up) -->
  <Card> sliders + toggles </Card>

  <!-- 4. Two-column grid: Folder + Tracks (fills remaining space) -->
  <div flex-1 overflow-hidden grid cols-2>
    <Card flex flex-col>
      Folder browser with overflow-y-auto inner list
    </Card>
    <Card flex flex-col>
      Tracks list with overflow-y-auto inner list (no fixed min-h/max-h)
    </Card>
  </div>
</div>
```

### Key CSS changes:
- Remove the footer bar entirely
- The action bar uses `border-b` like the header for visual separation
- Round Configuration card gets compact padding (`p-4` wrapper, no card container needed)
- The 2-column grid uses `flex-1 min-h-0 overflow-hidden` to fill remaining vertical space
- Each card in the grid uses `flex flex-col min-h-0` with the inner list using `flex-1 overflow-y-auto`
- Remove fixed `min-h-[200px] max-h-[300px]` from both folder list and tracks list; instead let them grow to fill available space with just `overflow-y-auto`
