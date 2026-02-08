# Fix Image Position Shift Between Picture and Question Modes

## Problem
The image moves between "Send Picture" stage and "Send Question" stage because the width allocation differs:
- **Picture mode**: Left column 30%, image 70%
- **Question-with-timer mode**: Left column 50%, image 50%

When transitioning from picture to question, the left column expands from 30% to 50% and the image shrinks from 70% to 50%, causing the image to shift and resize.

Additional issue: Different padding/gap values between modes (picture uses 12-20px, question-with-timer uses 20-40px desktop).

## Requirements
1. Image must NOT move between picture and question stages
2. Image must be as large as possible on the right side only
3. Image must NOT be cropped (no width or height clipping)
4. Left side must not be used for image display
5. Image should maintain same size and position when question text appears

## Solution
Keep the 50/50 width split in both picture and question-with-timer modes, but maximize image size within the 50% right column by reducing padding/gap.

This ensures:
- Image stays in same position when transitioning (both modes use 50/50)
- Image is as large as possible within the right 50% space
- Question text appears in left 50% without moving the image
- No part of image is cropped

### Approach
1. **Update picture mode to use 50/50 split** (instead of 30/70):
   - Change left column from `flex: '0 1 30%'` to `flex: '0 1 50%'`
   - Change left column from `maxWidth: '30%'` to `maxWidth: '50%'`
   - Change image container from `flex: '0 0 calc(70% - 20px)'` to `flex: '0 0 calc(50% - 20px)'`

2. **Reduce padding/gap in picture mode to maximize image space**:
   - Desktop: padding `20px` → `12px`, gap `20px` → `12px`
   - Mobile: padding `12px` → `8px`, gap `10px` → `6px`
   - This gives image container more available space while keeping proportions

3. **Keep question-with-timer as is** (already 50/50):
   - No changes needed to question-with-timer layout
   - Image will stay in same position and size when transitioning

### Key Implementation Details
- Only modify the flex/width values when `displayData.data?.imageDataUrl` exists (image is present)
- Questions without images keep using the current layout (left column wider for more text space)
- Image still uses `objectFit: 'contain'` to prevent cropping
- Image container height: '100%' ensures it scales to available vertical space

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`: picture case (lines ~563-612)
  - Left column: `flex: '0 1 30%'` → `flex: '0 1 50%'` and `maxWidth: '30%'` → `maxWidth: '50%'`
  - Image container: `flex: '0 0 calc(70% - 20px)'` → `flex: '0 0 calc(50% - 20px)'`
  - Padding: Desktop `'20px'` → `'12px'`, Mobile `'12px'` → `'8px'`
  - Gap: Desktop `'20px'` → `'12px'`, Mobile `'10px'` → `'6px'`

## Expected Outcome
- Image stays in exact same position and size when transitioning from picture to question (both modes use 50/50)
- Image is noticeably larger due to reduced padding/gap
- No cropping or clipping occurs
- Question text appears on the left side (50% space) without moving or resizing the image
- Layout remains consistent between picture-only and question+picture stages
