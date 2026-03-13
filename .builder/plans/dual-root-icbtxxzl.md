# Overlay QR Code on Slideshow Image White Square

## Overview

The user has a custom slideshow image (the "POP QUIZ" join instructions image) that has a white square placeholder on the right side. The QR code should be positioned to fill that white square area so it looks integrated into the image design, rather than floating as a separate overlay.

## Current State

- The `case 'slideshow'` in `ExternalDisplayWindow.tsx` (line ~1697) displays slideshow images with `objectFit: 'contain'` and overlays a QR code in a dark semi-transparent panel at `bottom: 24px, right: 24px`
- This looks like a separate floating element, not integrated with the image

## Image Layout Analysis

The user's image layout (16:9 aspect ratio):
- Top ~18%: Orange header with "POP QUIZ" text
- Bottom ~82%: Dark panel with green border containing:
  - Left side: Three numbered instructions (JOIN QUIZ WI-FI, SCAN QR CODE, ENTER TEAM NAME)
  - Right side: White square placeholder for QR code

The white square is approximately:
- Horizontally: from ~62% to ~96% of image width (right-aligned with some margin)
- Vertically: from ~25% to ~90% of image height (centered in the dark instruction panel)

## Approach

### Modify `case 'slideshow'` in `ExternalDisplayWindow.tsx`

Change the QR code overlay positioning so it sits directly on top of the white square in the image:

1. **Change the image to fill the container** - Use `objectFit: 'cover'` or keep `contain` but wrap the image and QR overlay in a container that respects the image's aspect ratio
2. **Position QR code using percentage-based values** that align with the white square location in the image:
   - Use a wrapper div that covers the image area
   - Position the QR code absolutely within that wrapper using percentage values matching the white square location
   - Remove the dark background panel, border radius, and "SCAN TO JOIN" label since those instructions are already in the image itself
3. **Make the QR code fill the white square** - Size the QR code to match the white square dimensions using percentage-based width/height relative to the image

### Implementation Details

In `src/components/ExternalDisplayWindow.tsx`, modify the `case 'slideshow'` block:

- Wrap the `<img>` and QR overlay in a position-relative container that maintains the image's aspect ratio
- Position the QR code overlay using: `position: absolute; top: 27%; right: 3.5%; width: 33%; height: 63%` (approximate, may need fine-tuning)
- Remove the dark background panel, "SCAN TO JOIN" text, and URL text from the slideshow QR overlay since the image itself already has instructions
- Set the QR code `<img>` to fill its container with `width: 100%; height: 100%; objectFit: contain`
- Keep the existing bottom-right floating QR code style as a fallback for when the slideshow image is NOT this specific instructions image (or just always use the integrated positioning since any slideshow image the user adds will likely be designed with this in mind)

### Key Consideration

Since the image uses `objectFit: 'contain'`, the actual rendered image may have letterboxing (black bars) depending on the display aspect ratio. The QR overlay needs to be positioned relative to the actual rendered image bounds, not the container. To handle this correctly:

- Use `objectFit: 'cover'` with `width: 100%; height: 100%` so the image always fills the entire display area (cropping if needed), ensuring the percentage-based QR positioning stays aligned
- OR use a container div with the same aspect ratio as the image and center it, then position the QR relative to that container

The simplest approach: change to `objectFit: 'cover'` so the image fills the display, then use percentage-based absolute positioning for the QR code. This keeps the QR aligned with the white square regardless of screen size.

## File to Modify

- `src/components/ExternalDisplayWindow.tsx` - the `case 'slideshow'` block (~line 1697-1734)
