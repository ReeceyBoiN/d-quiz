# Remove Speed Bonus from Buzz-In Quiz Pack Config

## Summary
In buzz-in quiz pack mode, the Speed Bonus card should be hidden from the config screen because buzz-in mode doesn't award speed bonus points (teams answer verbally one at a time). The Speed Bonus should remain visible for normal keypad quiz pack mode.

## File to Modify

### `src/components/QuizPackDisplay.tsx`
- **Line ~450**: Change the grid from `grid-cols-4` to `grid-cols-3` when `isBuzzinPack` is true
- **Lines ~489-541**: Wrap the Speed Bonus card `<div>` in a conditional that hides it when `isBuzzinPack` is true

This is a single-file, two-line change — conditionally adjust the grid columns and conditionally render the Speed Bonus card.
