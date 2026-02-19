# Plan: Fix MCQ Options Layout Uniformity in Quiz Pack Mode

## Problem Summary
Multiple choice (MCQ) options in Quiz Pack mode are not uniformly laid out. When displaying 5 options, the 5th appears out of place. When displaying 6 options, they should be arranged as 2 rows of 3 (instead of current 4-column layout).

## Current State
- MCQ options are rendered as a vertical flex column (full-width stacked buttons) in the player QuestionDisplay
- Other question types use grid layouts (Letters: 4 columns, Numbers: 3 columns, Sequence: 2 columns)
- The external display for Quiz Pack mode may have its own rendering logic that needs investigation

## Key Insight
The user's screenshot appears to show a 4-column grid layout for MCQ options on the external/host display. This suggests there's separate rendering logic on the host side (likely in QuizHost.tsx or a display component) that renders options differently than the player-side QuestionDisplay.

## Solution Approach
Implement dynamic, responsive grid layout for MCQ options on the external display based on option count:
- **4 options**: Keep 4 columns (current layout)
- **5 options**: Use 2-3 grid (2 options in first row, 3 in second row, centered)
- **6 options**: Use 3 columns × 2 rows (uniform 2×3 grid)
- **Other counts**: Extend pattern (3 cols for 6-9, 4 cols for 4-8, etc.)

## Implementation Strategy
1. Identify where external display renders MCQ options (likely in QuizHost.tsx in the DISPLAY_UPDATE or socket broadcast logic)
2. Implement logic to calculate optimal grid columns based on option count:
   - Count options
   - Dynamically apply appropriate grid-cols-X class from Tailwind
3. For 5 options specifically, ensure the grid layout creates a 2-3 arrangement (likely grid-cols-2 or grid-cols-3 with proper wrapping)
4. Update the external display rendering to use this dynamic grid layout

## Scope
- **External display only**: Changes apply to what players see on their connected devices
- **No player-side changes**: The host's player QuestionDisplay will not be modified

## Files to Modify
- `src/components/QuizHost.tsx` - Find where MCQ options are rendered for the external display and implement dynamic grid layout based on option count

## Implementation Details
1. Search for where options are sent to the external display (look for DISPLAY_UPDATE messages with options array)
2. Add logic to calculate grid columns:
   ```
   - optionCount 1-2: grid-cols-2
   - optionCount 3-4: grid-cols-4 (or grid-cols-3/grid-cols-2 depending on desired look)
   - optionCount 5: grid-cols-2 or grid-cols-3 to achieve 2-3 layout
   - optionCount 6+: grid-cols-3
   ```
3. Pass calculated grid class to the options rendering on external display
4. Test with 4, 5, and 6 option MCQ questions to verify layout uniformity
