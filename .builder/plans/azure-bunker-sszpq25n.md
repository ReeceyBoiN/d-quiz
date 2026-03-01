# FastestTeamDisplay Layout Restructuring

## Problem
Current layout has elements positioned awkwardly:
- Team Name occupies too much space at top (2 columns)
- Team Photo at top-right
- Stats/Performance at bottom-left (not visible during fast team reveal)
- Layout is not optimal for displaying both photo and stats

## Solution
Restructure the 2x3 grid layout by reordering elements:

### New Layout Structure
```
[Team Name (col-span-2)  ] [Score & Performance]
[Team Photo             ] [Physical Layout Grid] [Team Controls]
```

**Top Row:**
- Top-left & top-middle: Team Name (stays col-span-2)
- Top-right: Current Score & Performance (moved from bottom-left)

**Bottom Row:**
- Bottom-left: Team Photo (moved from top-right)
- Bottom-middle: Physical Layout Grid (moved from bottom-right)
- Bottom-right: Team Controls (moved from bottom-middle)

## Implementation Details

### File: `src/components/FastestTeamDisplay.tsx`

**Location**: Content Area grid container (lines 147-420)

**Actions:**
1. Remove response time badge overlay from Team Photo cell (lines 176-179)
2. Reorder the 5 grid cells to new positions by moving their div blocks:
   - Cell 1: Team Name (keep in place)
   - Cell 2: Team Stats → move to top-right position
   - Cell 3: Team Photo → move to bottom-left position
   - Cell 4: Team Controls → move to bottom-right position
   - Cell 5: Physical Layout → move to bottom-middle position

**No CSS changes needed** - the grid structure (`grid-cols-3 grid-rows-2`) stays the same, just reorder the child divs.

## Files to Modify
- `src/components/FastestTeamDisplay.tsx` - Reorder grid cells, remove response time badge overlay

## Expected Outcome
- Team name and score/performance visible at top
- Team photo and controls visible at bottom
- Better visual hierarchy and more intuitive layout
- Response time badge removed from photo (not visible when photo exists)
- Response time still shown when no photo exists (already working)
