# Plan to Fix Bottom Navigation Bar Resizing

## Understanding the Issue
When the buttons in the bottom navigation bar change state (e.g., toggling "Change Teams Layout" to "Layout: Alphabetical" or "Layout: Random"), the text inside them changes length and word wrapping. Because the buttons currently rely on their content to determine their width, this causes:
1. The toggled button to change width.
2. Other buttons to shift left or right.
3. The vertical height of the navigation bar to jump if the text wraps to a different number of lines (e.g., changing from 3 lines to 2 lines).

## Recommended Approach
To resolve this and ensure the bottom navigation bar remains perfectly consistent, we will apply **fixed dimensions** to each button based on their maximum text content. This ensures they neither grow nor shrink when their text changes, preventing any layout jumping.

### Implementation Steps

1. **Modify `src/components/BottomNavigation.tsx`**:
   - Update the button container to handle potential overflow gracefully on smaller screens by adding `overflow-x-auto overflow-y-hidden`.
   - Update the `className` of every button in the home screen bottom navigation bar to include `justify-center` (so the content is always centered) and `flex-shrink-0` (so they don't squish on smaller screens).
   - Assign a specific, calculated fixed width (`w-[Xpx]`) to each button so it is wide enough to accommodate its longest possible text state without changing size.

2. **Calculated Fixed Widths**:
   - **Buzzers**: `w-[100px]`
   - **Empty Lobby**: `w-[110px]`
   - **Team Photos**: `w-[110px]`
   - **Pause Scores**: `w-[110px]` (Fits both "Pause Scores" and "Scores Paused")
   - **Scramble Keypad**: `w-[130px]` (Fits up to "Scramble All (10/10)")
   - **Clear Scores**: `w-[110px]`
   - **Hide Scores & Positions**: `w-[140px]` (Fits both states on 2 lines)
   - **Font Size** (Down / Label / Up): `w-[35px]`, `w-[70px]`, `w-[35px]`
   - **Change Teams Layout**: `w-[140px]` (Consistently wraps "Change Teams Layout", "Layout: Alphabetical", and "Layout: Random" to 2 lines, preventing height jumping)
   - **Host Controller**: `w-[140px]` (Fits up to "✓ Controller (1234)")

### Rationale
By setting exact `w-[...px]` values and `flex-shrink-0` on each button, we completely decouple the button's size from its current text state. The `justify-center` class keeps the icons and text nicely centered within the fixed area. This will make the UI feel much more robust and stop the distracting jumping effect when toggling modes.
