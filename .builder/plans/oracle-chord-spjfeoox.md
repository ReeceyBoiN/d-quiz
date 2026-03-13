# Fix QR Code Overlay Alignment Across Aspect Ratios

## Problem

The QR instructions background image uses `objectFit: 'cover'`, which crops differently depending on the screen/window aspect ratio. The QR overlay is positioned with fixed percentages relative to the **viewport**, but the white square in the image shifts as the image gets cropped. This means the overlay and the white square never consistently align.

## Root Cause

- `objectFit: 'cover'` scales and crops the image to fill the container — the visible portion of the image changes with the container's aspect ratio
- The QR overlay percentages are relative to the full container (viewport), not the visible image content
- Result: on wide screens the image crops top/bottom, on tall screens it crops left/right — the white square moves but the overlay doesn't follow

## Fix: Aspect-Ratio-Locked Container

For the QR instructions image specifically, lock the rendering container to the image's native aspect ratio (16:9). This ensures the full image is always visible and the percentage-based overlay always maps to the same spot.

### File: `src/components/ExternalDisplayWindow.tsx`

#### Changes to the `slideshow` case (~line 1714-1766):

When `isQrInstructionsImage` is true, render a different layout:

1. **Outer container**: full width/height, black background, flexbox centered — same as now
2. **Inner container**: locked to 16:9 aspect ratio using `aspectRatio: '16/9'`, with `max-width: 100%` and `max-height: 100%` so it fits within any screen without overflow
3. **Image**: `width: 100%`, `height: 100%`, `objectFit: 'fill'` (or `contain`) inside the locked container — since the container matches the image ratio, it displays pixel-perfect
4. **QR overlay**: positioned with percentages relative to this inner container — now reliable because the container always has the same proportions as the image

For non-QR-instructions images, keep the existing `objectFit: 'cover'` full-bleed behavior unchanged.

#### Specific implementation:

```tsx
case 'slideshow': {
  const safeIndex = currentImageIndex < effectiveImages.length ? currentImageIndex : 0;
  const currentImage = effectiveImages[safeIndex];
  const isQrInstructionsImage = currentImage && (currentImage as any).isQrInstructions === true;
  return (
    <div style={{
      height: '100%', width: '100%', position: 'relative', overflow: 'hidden',
      backgroundColor: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {currentImage ? (
        isQrInstructionsImage ? (
          // Aspect-ratio-locked container for QR instructions image
          <div style={{
            position: 'relative',
            aspectRatio: '16/9',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}>
            <img
              src={currentImage.url}
              alt="Join Instructions"
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                transition: 'opacity 0.5s ease'
              }}
            />
            {qrCodeDataUrl && displayData.joinUrl && (
              <div style={{
                position: 'absolute',
                top: '23%',
                right: '3.5%',
                width: '29%',
                height: '64%',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5%'
              }}>
                <img
                  src={qrCodeDataUrl}
                  alt="Scan to join"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
        ) : (
          // Regular slideshow images - full bleed cover
          <img
            src={currentImage.dataUrl || currentImage.url || currentImage}
            alt={currentImage.name || 'Slideshow image'}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'opacity 0.5s ease'
            }}
          />
        )
      ) : (
        <div style={{ textAlign: 'center', color: 'white', ... }}>
          ...no images fallback...
        </div>
      )}
    </div>
  );
}
```

Key details:
- The inner `div` uses `aspectRatio: '16/9'` with both `maxWidth: 100%` and `maxHeight: 100%` — CSS will size it to the largest 16:9 rectangle that fits the viewport
- The image uses `objectFit: 'contain'` inside this container — since the aspect ratios match, the image fills it exactly with no cropping
- The QR overlay percentages are now relative to the aspect-locked container, so they map consistently to the white square regardless of screen size
- On ultra-wide or ultra-tall screens, black bars will appear on the sides/top-bottom (letterboxing) rather than cropping the image
- Regular user slideshow images keep their existing `objectFit: 'cover'` behavior — no change for those
