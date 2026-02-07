# Fix Image Cropping in Fullscreen Display - Implementation Plan

## Problem
The image questions are expanding to fullscreen but using `object-cover`, which crops/cuts off parts of the image if it's wider or taller than the screen aspect ratio. This is undesirable - the entire image should always be visible.

## Goal
Change the image display to use `object-contain` instead of `object-cover`. This ensures:
- The entire image is visible without any cropping
- The image scales to fit within the screen dimensions
- Aspect ratio is preserved
- If there's empty space around the image, that's acceptable (it won't show answer options due to z-index)

## Current State
- Image element uses: `className="h-full w-full object-cover"`
- Container uses: `className="flex items-center justify-center w-full h-full cursor-pointer"`
- Overlay covers full viewport: `fixed inset-0`

## Recommended Change

### File: `src-player/src/components/QuestionDisplay.tsx`

**Single Change: Update image sizing from object-cover to object-contain**
- Current: `className="h-full w-full object-cover"`
- New: `className="max-h-full max-w-full object-contain"`

**Rationale:**
- `object-contain` preserves the entire image and its aspect ratio
- `max-h-full max-w-full` ensures image doesn't exceed viewport dimensions
- The fixed overlay with `inset-0` and z-40 still covers the full screen and hides options behind
- The centered flex container ensures the image is centered on screen
- This is a safer approach with no cropping risk

## Implementation Steps
1. Read the current image sizing in QuestionDisplay.tsx
2. Change `object-cover` to `object-contain` 
3. Adjust sizing from `h-full w-full` to `max-h-full max-w-full` for a fail-safe
4. Verify the change displays the complete image without cropping
5. Verify tap-to-dismiss still works

## Files to Modify
- `src-player/src/components/QuestionDisplay.tsx` (line ~446)

## Expected Outcome
- Image questions display fullscreen (edge-to-edge)
- Entire image is always visible with no cropping
- Image maintains aspect ratio and is centered on screen
- Answer options remain hidden behind the overlay
- Tap-to-dismiss functionality preserved
