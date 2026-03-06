# Fix Scrambled Number Keypad Layout

## Problem
When scramble mode is active on a numbers question, all 10 digits (0-9) are placed into a 3-column grid. This results in 3 full rows + 1 orphan digit on a 4th row, then a 2-column control row (CLR, ✓). This looks taller and uncentered compared to the non-scrambled layout which has a clean 3x3 grid (1-9) + a 3-column control row (CLR, 0, ✓).

## Fix
Keep the scrambled number pad the same visual structure as the unscrambled one: 9 digits in a 3x3 grid + a 3-column control row with CLR, the remaining digit, and ✓.

### Changes in `src-player/src/components/QuestionDisplay.tsx`

1. **Scrambled grid rendering (~line 664-713)**: Instead of putting all 10 `shuffledNumbers` in the grid and having a separate 2-column control row, split `shuffledNumbers` into:
   - First 9 digits → 3x3 grid (same as unscrambled)
   - 10th digit → placed in the control row between CLR and ✓ (same position as 0 in unscrambled)
   - Control row becomes 3 columns: CLR, [10th digit], ✓ — matching the unscrambled layout

2. **Add `aspect-square`** to the scrambled control row buttons (CLR and ✓) so they match the unscrambled style.

## Files Modified
- `src-player/src/components/QuestionDisplay.tsx` — restructure scrambled number grid layout
