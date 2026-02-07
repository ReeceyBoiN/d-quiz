# Image Questions Fullscreen Display - Implementation Plan

## Problem
When picture questions are displayed on player devices, the image is constrained within the layout and answer options (A, B, C, D) remain visible behind/around the image. This creates a confusing visual experience where the image doesn't feel like it's the focus.

## Goal
Make the image question completely fullscreen (edge-to-edge, no margins) and completely hide the answer options when the image is displayed.

## Current State
- Image is displayed in a full-screen overlay via QuestionDisplay.tsx
- Current constraints: `max-h-[90vh] max-w-full object-contain`
- Container has `max-w-4xl` width constraint which limits the image horizontally on larger screens
- Answer options remain behind the overlay (z-40) but are still visible around the edges

## Recommended Changes

### File: `src-player/src/components/QuestionDisplay.tsx`

**Change 1: Update image overlay to cover full viewport**
- Remove or reduce padding from the overlay container
- Current: `className="fixed inset-0 flex items-center justify-center z-40 px-2 sm:px-4 md:px-6 lg:px-8"`
- Adjust padding to minimal/none to allow image to expand to edges

**Change 2: Update image element sizing**
- Change image constraints from `max-h-[90vh] max-w-full object-contain`
- Update to use full viewport dimensions: `h-screen w-screen object-cover` or `max-h-screen max-w-screen`
- `object-cover` will fill the entire space (may crop image) vs `object-contain` (preserves aspect ratio but leaves empty space)
- Keep aspect ratio intact while filling screen: use `max-h-screen w-auto` or similar approach

**Change 3: Update container constraints**
- The container currently has `max-w-4xl` which limits width
- Remove or adjust this constraint to allow full-screen width

## Technical Details

### Current Code Locations
- Image overlay and sizing: `src-player/src/components/QuestionDisplay.tsx` (exact line numbers to be confirmed during implementation)
- Image element class: `className="max-h-[90vh] max-w-full object-contain"`
- Overlay container class includes `max-w-4xl` constraint

### Options for Sizing
1. **Option A: Full Fill (Crop if needed)**
   - Use `object-cover` with `h-screen w-screen`
   - Pro: Fills entire screen without gaps
   - Con: May crop image content

2. **Option B: Full Viewport with Aspect Ratio (Recommended)**
   - Use `max-h-screen max-w-screen object-contain`
   - Remove px padding from overlay
   - Pro: Preserves aspect ratio while maximizing screen usage
   - Con: May leave small gaps if image aspect ratio doesn't match screen

3. **Option C: Responsive with No Padding**
   - Update padding to `px-0` and adjust container `max-w-none`
   - Use `object-contain` to preserve aspect ratio

## Implementation Steps

1. Read QuestionDisplay.tsx to understand current structure
2. Update overlay container className to remove/minimize padding
3. Update container max-width constraint
4. Update image element sizing to use full screen dimensions
5. Test on various device sizes to ensure full coverage
6. Verify answer options are not visible when image is displayed
7. Verify tap-to-dismiss functionality still works

## Files to Modify
- `src-player/src/components/QuestionDisplay.tsx` (main change)

## Expected Outcome
- Image questions display fullscreen (edge-to-edge)
- Answer options completely hidden when image is shown
- Image maintains aspect ratio and is visible in full
- Tap-to-dismiss functionality preserved
- Works responsively across different device sizes
