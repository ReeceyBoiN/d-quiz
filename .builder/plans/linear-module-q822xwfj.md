# Fix Tracks List Overflowing Below Screen

## Problem
The two-column grid (folder browser + tracks list) extends below the visible screen when tracks are loaded. CSS Grid children default to `min-height: auto`, so even though the grid container has `flex-1 min-h-0`, the Card children grow based on their content rather than being constrained.

## Fix
In `src/components/MusicRoundInterface.tsx`, line 864 and the two Card elements inside it:

1. **Grid container** (line 864): Already has `flex-1 min-h-0 overflow-hidden` — this is correct.
2. **Both Card elements** (lines 866, 924): Add `overflow-hidden` alongside the existing `flex flex-col min-h-0`. This forces the cards to clip to their grid cell size rather than expanding with content.

### Specific changes:
- Line 866: `<Card className="bg-card border-border flex flex-col min-h-0">` → add `overflow-hidden`
- Line 924: `<Card className="bg-card border-border flex flex-col min-h-0">` → add `overflow-hidden`

This is a two-line CSS class change. No structural changes needed.
