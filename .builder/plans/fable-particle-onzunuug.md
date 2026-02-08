# Increase Image Size for Picture Questions

## Problem
Picture images on the external display are too small with excessive margin and spare space around them. Need to increase the visible image size without cropping any part of the image.

## Current Constraints
- Image container width: `flex: '0 0 calc(50% - 20px)'` (fixed to 50% of container width minus 20px)
- Left column: `flex: '0 1 50%'` (takes up the other 50% - currently empty in picture-only mode)
- Padding: 20-40px on all sides (desktop 40px, mobile 20px)
- Gap between columns: 20-40px
- Image scaling: Uses `maxWidth/maxHeight: 100%` with `objectFit: 'contain'` (no cropping)

## Solution Options

### Option A: Reduce Left Column Width (Recommended)
- Keep the 50/50 split but make the empty left column narrower
- Allocate more width to the image (e.g., 65-70% width)
- Advantage: Image gets more horizontal space, proportional sizing maintained
- Implementation: Change left column flex from `'0 1 50%'` to `'0 1 35%'` and image container from `calc(50% - 20px)` to match

### Option B: Reduce Padding/Gap in Picture Mode
- Use smaller padding and gap values only when displaying picture mode
- Keeps proportions but maximizes available space
- Advantage: Minimal styling changes, cleaner look
- Implementation: Reduce containerPadding and gapSize when displayData.mode === 'picture'

### Option C: Use Full Width for Image
- Make image container flex to fill available space
- Remove or significantly reduce the empty left column
- Advantage: Maximum image size
- Risk: Layout may feel unbalanced if space extends too far to the left

## Implementation: Combined Approach (Maximum Growth)
User preference: Both width allocation increase AND reduced spacing

### Step 1: Adjust Width Allocation
- Change empty left column from `flex: '0 1 50%'` + `maxWidth: '50%'` to `flex: '0 1 30%'` + `maxWidth: '30%'`
- Change image container from `flex: '0 0 calc(50% - 20px)'` to `flex: '0 0 calc(70% - 20px)'`
- Result: Image gets ~70% of available width, empty left gets ~30%

### Step 2: Reduce Padding/Gap in Picture Mode Only
- Create conditional values: if picture mode, use reduced padding (20px desktop) and reduced gap (20px desktop)
- Maintain current spacing for question-with-timer mode (consistency when question appears)
- Result: More available space for image container

### Step 3: Maintain Compatibility
- Question-with-timer mode keeps original proportions (50/50 split with current padding/gap)
- Image won't move or change size when transitioning from picture to question reveal
- No cropping - continues to use `objectFit: 'contain'` and aspect ratio preservation

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`: 'picture' case rendering (lines 569-619)
  - Adjust flex values for left/right columns
  - Optionally reduce padding/gap for picture mode only

## Expected Result
- Image displays noticeably larger
- More of the available screen space is utilized
- No part of image is cropped or cut off
- Empty left space still maintains some breathing room
- Layout remains consistent when transitioning to question reveal (question-with-timer mode)
