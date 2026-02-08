# Maximize Image Size by Filling Wasted Space

## Problem
The image in picture mode has significant wasted space around it:
- Top and bottom margins (vertical unused space)
- Right side margin (horizontal unused space)

Current styling prevents the image from expanding to fill the available area within the 50% right column.

## Root Causes
1. **Vertical alignment issue**: Main content row uses `alignItems: 'flex-start'` which pins the image container to the top rather than stretching it to full height
2. **Image height constraint**: Image element uses `height: 'auto'` which prevents it from scaling vertically to fill the container

## Solution
Make two targeted changes to the picture mode styling in ExternalDisplayWindow.tsx:

### Change 1: Enable Full Height Stretching
- **File**: `src/components/ExternalDisplayWindow.tsx` (picture mode, line ~574)
- **Current**: `alignItems: 'flex-start'`
- **Change to**: `alignItems: 'stretch'`
- **Effect**: Makes the image container stretch to the full height of the content area (instead of staying at top)

### Change 2: Scale Image to Fill Container Height
- **File**: `src/components/ExternalDisplayWindow.tsx` (picture mode, lines ~595-606)
- **Current image style**: `height: 'auto'`
- **Change to**: `height: '100%'`
- **Also keep**: `maxHeight: '100%'` and `objectFit: 'contain'` to prevent cropping
- **Effect**: Image scales to fill both container dimensions while maintaining aspect ratio

## Key Details
- The image will maintain aspect ratio (no distortion or cropping)
- `objectFit: 'contain'` ensures the entire image stays visible
- Image stays within the 50% right column (no crossing into left side)
- Changes apply only to picture mode (question-with-timer mode unchanged)
- No changes needed to padding/gap values

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`:
  - Line ~574: Main content row `alignItems` property
  - Line ~601: Image element `height` property

## Expected Outcome
- Image expands to fill all available vertical space (removes top/bottom white space)
- Image expands to fill available horizontal space within 50% column (removes right white space)
- Image maintains perfect aspect ratio with no cropping
- Much larger, more impactful image display on external screen
