# Apply Image Sizing Fixes to Question-with-Timer Mode

## Problem
The image shrinks noticeably when transitioning from "Send Picture" to "Send Question" because the question-with-timer mode doesn't have the same image sizing fixes that were applied to picture mode.

**Current behavior:**
- Picture mode: Image fills available space (alignItems: 'stretch', height: '100%')
- Question mode: Image is smaller (alignItems: 'flex-start', height: 'auto')

## Root Cause
The question-with-timer case in ExternalDisplayWindow.tsx has different styling than picture mode:
- Main content row uses `alignItems: 'flex-start'` (should be `alignItems: 'stretch'`)
- Image element uses `height: 'auto'` (should be `height: '100%'`)

## Solution
Apply the same two fixes to question-with-timer mode that were already applied to picture mode:

### Change 1: Enable Full Height Stretching for Image Container
- **Location**: question-with-timer case, main content row (around line 474)
- **Current**: `alignItems: 'flex-start'`
- **Change to**: `alignItems: 'stretch'`
- **Effect**: Makes the image container stretch to full height of content area

### Change 2: Scale Image to Fill Container Height
- **Location**: question-with-timer case, image element (around line 508)
- **Current**: `height: 'auto'`
- **Change to**: `height: '100%'`
- **Effect**: Image scales vertically to fill the container while maintaining aspect ratio

## Expected Outcome
- Image maintains the same large size when transitioning from picture to question
- No visual shrinking when question text appears
- Question text appears without affecting image size/position
- Consistent sizing between the two stages

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`:
  - Line ~474: Main content row `alignItems` property (question-with-timer case)
  - Line ~508: Image element `height` property (question-with-timer case)

## Implementation Notes
- Only modify the question-with-timer/timer-with-question cases
- Picture mode already has these fixes applied
- No changes to padding/gap values needed (optional optimization)
- Image will continue to use `objectFit: 'contain'` to prevent cropping
