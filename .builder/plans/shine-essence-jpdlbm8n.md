# Hardcode QR Code Instructions Image into Slideshow

## Overview

Hardcode the POP QUIZ instructions image into the slideshow rotation so it's always present, and fix the QR code overlay alignment to be resolution-independent.

## Problem

1. When no slideshow images are added, the external display shows a blank "External Display" screen in basic mode or "No images loaded" in slideshow mode
2. The QR code overlay positioning is slightly off-center relative to the white square in the image
3. The instructions image with QR code should always be in the slideshow mix

## Approach

### 1. Embed the instructions image as a hardcoded constant in ExternalDisplayWindow.tsx

- Define a constant `QR_INSTRUCTIONS_IMAGE` at the top of the file containing the image URL (`https://cdn.builder.io/api/v1/image/assets%2Ffc9fa4b494f14138b58309dabb6bd450%2F364dace40d9a4b69b2cfd47d1ed2a9a3`)
- Add a flag/marker (e.g. `isQrInstructionsImage`) to identify this special image so we know when to show the QR overlay vs not

### 2. Inject the hardcoded image into the slideshow images array

In the `useEffect` or rendering logic in `ExternalDisplayWindow.tsx`:
- When building the effective images list for slideshow, always prepend/append the QR instructions image
- This means even if `displayData.images` is empty, there's always at least one image (the instructions image)
- If the host adds their own images, the instructions image is still included in the rotation

### 3. Conditionally render the QR overlay only on the instructions image

- Only show the QR code overlay when the currently displayed image is the hardcoded instructions image
- For user-uploaded images, don't overlay the QR code (it would look out of place)

### 4. Fix QR code overlay alignment

Instead of relying on percentage-based positioning that breaks across resolutions, use a more robust approach:
- Keep the image at `objectFit: 'cover'` so it fills the display
- Use percentage positioning but fine-tune the values based on the actual image layout
- The white square in the image is approximately at: `top: 25%`, `right: 3%`, `width: 32%`, `height: 65%`
- Add a small padding inside the overlay div so the QR code doesn't touch the edges of the white square

## Files to Modify

### `src/components/ExternalDisplayWindow.tsx`

1. **Add constant** (near top of file, before component):
   ```
   const QR_INSTRUCTIONS_IMAGE_URL = 'https://cdn.builder.io/api/v1/image/assets%2Ffc9fa4b494f14138b58309dabb6bd450%2F364dace40d9a4b69b2cfd47d1ed2a9a3';
   const QR_INSTRUCTIONS_IMAGE = { url: QR_INSTRUCTIONS_IMAGE_URL, name: 'Join Instructions', isQrInstructions: true };
   ```

2. **Modify slideshow case** (~line 1697):
   - Build an effective images array: `const effectiveImages = [...displayData.images]` then always include the QR instructions image (push it to the end)
   - Get current image from effectiveImages instead of displayData.images
   - Check if current image is the QR instructions image (`currentImage.isQrInstructions`)
   - Only render the QR overlay when it IS the instructions image
   - For other images, no QR overlay

3. **Fix the image cycling useEffect** (~line 416):
   - The cycling interval uses `displayData.images.length` - need to use the effective images length instead
   - Create a computed/memoized `effectiveImages` array that includes the hardcoded image
   - Use this in both the cycling logic and the rendering

4. **Fix alignment values** for the QR overlay:
   - Fine-tune `top`, `right`, `width`, `height` percentages
   - Add padding inside the overlay container so QR code has breathing room within the white square
