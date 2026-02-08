# Fix Non-Picture Question Layout with Conditional Alignment

## Problem
The `alignItems: 'stretch'` fix applied to question-with-timer mode is breaking non-picture questions (multiple choice, etc.). The questions are being stretched and centered instead of appearing at the top-left in a standard layout. Options (A, B, C, D, etc.) don't display properly below the question.

## Root Cause
The main content row uses `alignItems: 'stretch'` unconditionally:
- This works great when there's a picture (image fills available height)
- This breaks non-picture questions (stretches the question column and affects layout)

## Solution
Make alignment conditional based on whether an image is present:

### Change 1: Create hasImage Constant
At the start of the question-with-timer case, add:
```javascript
const hasImage = Boolean(displayData.data?.imageDataUrl);
```

### Change 2: Conditional alignItems on Main Content Row
Change the main content row alignment from static `'stretch'` to conditional:
```javascript
alignItems: hasImage ? 'stretch' : 'flex-start'
```
- When image present: Use `'stretch'` (allows image to fill height)
- When no image: Use `'flex-start'` (question aligns to top)

### Change 3: Conditional justifyContent on Left Column (Optional)
Also change the left column's vertical alignment:
```javascript
justifyContent: hasImage ? 'center' : 'flex-start'
```
- When image present: Keep centered (looks good with picture on right)
- When no image: Align to top (standard form layout)

### Change 4: Update Image Conditional Rendering
Update the image container conditional to use hasImage:
```javascript
{hasImage && (
  <div style={{...}}>
```

## Expected Outcome
- **Picture questions**: Image fills available space, stays large and impactful
- **Non-picture questions**: Question and options appear at top-left in standard layout
- **Multiple choice options**: Display properly below the question text
- **Overall**: Best of both worlds - optimized layout for each question type

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (question-with-timer case, around lines 420-520)
  - Add hasImage constant definition
  - Make alignItems conditional in main content row
  - Make justifyContent conditional in left column
  - Update image rendering to use hasImage

## Implementation Details
- All changes are in the same case block (question-with-timer/timer-with-question)
- Changes are minimal and localized
- No changes needed to picture mode
- No changes to padding/gap values
