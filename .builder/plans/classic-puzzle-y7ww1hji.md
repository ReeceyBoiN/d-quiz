# Fix QR Code Overlay Alignment — Image-Wrapping Approach

## Problem

The current code sets `width: 100%`, `height: 100%`, AND `aspectRatio: '16/9'` on the inner wrapper div. CSS ignores `aspect-ratio` when both dimensions are explicitly set. So the wrapper stretches to fill the full viewport, and `objectFit: 'contain'` on the image creates letterboxing *inside* that stretched wrapper. The QR overlay's percentage positions are relative to the full wrapper (viewport), not the visible image area — so the QR code drifts off the white square at different aspect ratios.

## Root Cause

`aspect-ratio` CSS property only works when at most ONE dimension is explicitly set. With both `width: 100%` and `height: 100%`, it's ignored entirely.

## Fix: Image-Driven Wrapper Sizing

Instead of trying to force the wrapper to a 16:9 aspect ratio with CSS, let the **image itself** determine the wrapper size. The wrapper shrinks to fit exactly around the rendered image, so percentage-based overlay positions are always relative to the actual visible image dimensions.

### File: `src/components/ExternalDisplayWindow.tsx`

#### Changes to the `slideshow` case (lines ~1724-1765):

Replace the current QR instructions image rendering with:

```tsx
isQrInstructionsImage ? (
  // Wrapper sizes itself to match the rendered image exactly
  // so QR overlay percentages are always relative to the visible image
  <div style={{
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    maxHeight: '100%',
    lineHeight: 0,
  }}>
    <img
      src={currentImage.url}
      alt="Join Instructions"
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 0px)', // Full viewport when maximized
        width: 'auto',
        height: 'auto',
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
)
```

#### How it works:

1. **Outer flex container** (already exists): `display: flex`, `alignItems: center`, `justifyContent: center` — centers the inner wrapper
2. **Inner wrapper div**: `display: inline-block` makes it shrink-wrap around its content (the image). `maxWidth: 100%` and `maxHeight: 100%` prevent overflow. `lineHeight: 0` removes any gap below the image.
3. **Image**: `width: auto`, `height: auto` preserves natural aspect ratio. `maxWidth: 100%` and `maxHeight: calc(100vh)` ensure it fits within the viewport without cropping. The browser scales it down proportionally to fit both constraints.
4. **QR overlay**: Absolutely positioned inside the wrapper div. Since the wrapper matches the image's rendered dimensions exactly, the percentage positions (`top: 23%`, `right: 3.5%`, etc.) consistently map to the same spot on the image regardless of viewport size or aspect ratio.

#### Why this works across all aspect ratios:

- **Wide viewport** (wider than 16:9): Image is constrained by height, leaving black bars on the sides. Wrapper width matches the narrower image width. QR percentages are relative to image width — correct.
- **Tall viewport** (taller than 16:9): Image is constrained by width, leaving black bars top/bottom. Wrapper height matches the shorter image height. QR percentages are relative to image height — correct.
- **Exact 16:9**: Image fills the viewport. Wrapper matches viewport. QR percentages work as before — correct.

No JavaScript, refs, or ResizeObservers needed. Pure CSS solution.
