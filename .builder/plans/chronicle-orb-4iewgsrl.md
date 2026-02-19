# Plan: Vertically Center Question Bubble on External Display

## Problem
When questions are short (like "What is 85 x 5?"), the entire dark bubble container sits at the top of the screen, creating an awkward visual imbalance. The bubble should be centered vertically on the screen for better presentation.

## Root Cause
In `ExternalDisplayWindow.tsx`, the `question-with-timer` mode uses:
```
justifyContent: hasImage ? 'center' : 'flex-start'
```

This keeps the entire question bubble at the top (`flex-start`) when there's no image. The bubble should be centered vertically in all cases.

## Solution Approach
Change the vertical alignment to center the entire bubble container:

### File: `src/components/ExternalDisplayWindow.tsx`

**Key Change:** In the `question-with-timer` case (around line 496), update the question container's `justifyContent` from conditional logic to always use `'center'`.

**Exact Change:**
- **Line 496 (current):** `justifyContent: hasImage ? 'center' : 'flex-start',`
- **Line 496 (new):** `justifyContent: 'center',`

This single change will:
- Center the entire dark bubble vertically on the screen
- Work for short questions (like "What is 85 x 5?") and long questions alike
- Maintain the existing horizontal layout (question on left, image on right if present)
- Preserve all functionality (options, timers, scrolling for long content)

## Impact Analysis
- ✅ Entire question bubble centered vertically when no image
- ✅ Visual balance for short and long questions
- ✅ Question with 4 options stays properly positioned with space
- ✅ No impact on: host app, question text alignment, options display, progress bars
- ✅ Works with all text size settings (Small/Medium/Large)

## Files Modified
- **Only:** `src/components/ExternalDisplayWindow.tsx` line 496
- **Scope:** `question-with-timer` display mode only

## Expected Visual Result
Short questions like "What is 85 x 5?" will appear in the middle of the screen vertically, creating a balanced, professional look matching the quality of the vibrant background styling.
