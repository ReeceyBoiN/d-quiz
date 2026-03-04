## Goal
Reduce the size of the host "Correct Answer" input box in Nearest Wins (the box showing the 0) to be moderately smaller while keeping it readable and centered.

## Recommended approach
1. **Adjust the host answer box container sizing**
   - In `src/components/NearestWinsInterface.tsx`, update the container around the answer input (currently `max-w-md`, `p-6`) to a slightly smaller width and padding (e.g., `max-w-sm`, `p-4`). This will reduce the visible box size without changing layout logic.

2. **Reduce the input text size slightly**
   - In the same file, reduce the numeric font size on the input from `text-6xl` to `text-5xl` (or similar) to make the number visually smaller while still prominent.

3. **Verify no layout regressions**
   - Confirm the keypad and surrounding layout still align correctly and the input remains centered.

## Files to modify
- `src/components/NearestWinsInterface.tsx` — update the answer input container classes and the input font size.

## Notes
- This change only affects the host Nearest Wins screen (as requested), not the player display or left sidebar badges.
