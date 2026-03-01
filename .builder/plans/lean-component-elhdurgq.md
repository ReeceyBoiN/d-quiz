# FastestTeamDisplay Layout Optimization

## Problem
Current layout has the top row with too much content (Team Name + Score + Performance + Buzzer), making it taller than necessary. The bottom row needs more vertical space for Photo and Grid display, but is currently constrained by the tall top row.

## Solution
Move Performance Stats and Buzzer Volume sections from the top-right cell to the bottom-right cell (Team Controls), leaving only the Current Score at the top-right. This creates a compact top row and gives more height to the bottom row elements.

## New Layout Structure

### Top Row:
- **Left (col-span-2):** Team Name 
- **Right (col-span-1):** Current Score only (smaller, compact)

### Bottom Row:
- **Left (col-span-1):** Team Photo (gets more vertical space)
- **Middle (col-span-1):** Physical Layout Grid (gets more vertical space)
- **Right (col-span-1):** Team Controls + Performance Stats + Buzzer Volume (stacked vertically)

## Implementation Details

### File: `src/components/FastestTeamDisplay.tsx`

**Cell 2 (Top-Right) - Team Stats - SIMPLIFY:**
- Location: Lines 158-219
- **Remove:** Performance Stats section (lines 170-194)
- **Remove:** Buzzer Settings section (lines 196-216)
- **Keep:** Score Display section only (lines 162-168)
- Result: Much more compact cell

**Cell 5 (Bottom-Right) - Team Controls - EXPAND:**
- Location: Lines 405-449
- **Keep:** Existing title "Team Controls"
- **Keep:** Existing buttons (Block Team, Scramble Keypad)
- **Add:** Performance Stats section (extracted from Cell 2)
- **Add:** Buzzer Settings section (extracted from Cell 2)
- Structure: Buttons at top, then Performance below, then Buzzer at bottom
- Can use `overflow-y-auto` if needed to handle all content

## Expected Outcome
- Top row is significantly more compact/shorter
- Bottom row elements (photo, grid) have more vertical space and breathing room
- All functionality preserved, just reorganized
- Better visual hierarchy and use of space
