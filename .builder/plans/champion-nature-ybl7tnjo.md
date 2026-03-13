# Hardcode QR Code Instructions Image into Slideshow - Verification

## Status: Already Implemented

All changes from the original spec have already been applied to `src/components/ExternalDisplayWindow.tsx`:

### Verified Changes

1. **Constants** (lines 26-27): `QR_INSTRUCTIONS_IMAGE_URL` and `QR_INSTRUCTIONS_IMAGE` defined with `isQrInstructions: true` flag
2. **Effective images array** (lines 420-425): `effectiveImages` memoized array always appends the QR instructions image to user images
3. **Image cycling** (lines 427-434): Uses `effectiveImages.length` for interval cycling
4. **Slideshow rendering** (lines 1708-1761): Uses `effectiveImages`, detects `isQrInstructions`, conditionally renders QR overlay only on the instructions image
5. **QR overlay positioning** (lines 1730-1739): `top: 24.5%`, `right: 3%`, `width: 30.5%`, `height: 66%`, `padding: 2%`

### Possible Remaining Action

Fine-tune QR overlay alignment values if current positioning doesn't match the white square accurately. Original spec suggested `top: 25%`, `width: 32%`, `height: 65%` vs current `top: 24.5%`, `width: 30.5%`, `height: 66%`.

### Files

- `src/components/ExternalDisplayWindow.tsx` - All changes already present
