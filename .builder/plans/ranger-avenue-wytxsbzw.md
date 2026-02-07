# Maximize Image Size - Implementation Plan

## Problem
The image is currently too small with empty space around it. The user wants the image as large as possible while:
- Keeping the entire image visible (no cropping)
- Minimizing empty space around the image
- Not having excessive margins

Current setup is too conservative with `max-h-full max-w-full` constraints.

## Goal
Find the optimal balance between:
- Original approach: `h-full w-full object-cover` (100% - fills screen but crops image)
- Current approach: `max-h-full max-w-full object-contain` (~50% - no crop but too much empty space)
- Target: ~75% - maximize image size while preventing any cropping

## Current State
- Overlay: `fixed inset-0` (covers full viewport)
- Container: `flex items-center justify-center w-full h-full` (fills overlay)
- Image: `max-h-full max-w-full object-contain` (too restrictive)

## Recommended Change

### File: `src-player/src/components/QuestionDisplay.tsx`

**Change image sizing to allow full container utilization**
- Current: `className="max-h-full max-w-full object-contain"`
- New: `className="w-full h-full object-contain"`

**Rationale:**
- The `max-` constraints are too limiting and prevent the image from scaling to the container size
- Changing to `w-full h-full` allows the image to fill the flex container
- `object-contain` on a full-size container will scale the image to be as large as possible while preserving aspect ratio and preventing any cropping
- The flex container centering will keep the image centered with minimal empty space only where necessary (when image aspect ratio doesn't match viewport)
- This achieves the desired "75%" zoom - between filling the screen with cropping and being too small

## How This Works
1. Flex container fills the viewport with `fixed inset-0` on parent
2. Image with `w-full h-full` tries to fill that container
3. `object-contain` scales the image proportionally to fit the container without cropping
4. Result: Maximum image size with no cropping, minimal margins only where aspect ratios don't align

## Implementation Steps
1. Update image className from `max-h-full max-w-full object-contain` to `w-full h-full object-contain`
2. Test with various image aspect ratios to verify no cropping
3. Verify tap-to-dismiss still works

## Files to Modify
- `src-player/src/components/QuestionDisplay.tsx` (line ~446)

## Expected Outcome
- Image displays as large as possible
- No cropping of image content
- Minimal empty space around image
- Tap-to-dismiss functionality preserved
