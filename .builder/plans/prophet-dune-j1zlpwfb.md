# Fix QR Code Flickering and Alignment

## Root Cause Analysis

### QR Code Flickering

The QR code disappears and reappears because of two interacting issues:

1. **`currentImageIndex` resets to 0 on every `DISPLAY_UPDATE` message** (line 436-438): The useEffect watches `displayData.images` and resets the index to 0 whenever it changes. But `displayData.images` gets a **new array reference** on every single `DISPLAY_UPDATE` — even when the content is identical — because the data is serialized/deserialized via `postMessage` or IPC (`[] !== []` by reference).

2. **The QR instructions image is appended at the END of the array** (line 424): So when the index resets to 0, it jumps to the first user image (no QR overlay). The cycling interval eventually advances to the last slide (QR instructions), showing the QR, but then another DISPLAY_UPDATE arrives and resets the index to 0 again — hiding the QR.

This creates a loop: QR appears → DISPLAY_UPDATE resets index → QR disappears → interval advances → QR appears → repeat.

### QR Code Alignment

The overlay positioning values (`top: 24.5%`, `right: 3%`, `width: 30.5%`, `height: 66%`) don't perfectly match the white square in the background image. The QR code appears slightly misaligned relative to the white placeholder area.

## Fix

### File: `src/components/ExternalDisplayWindow.tsx`

#### 1. Prepend QR instructions image instead of appending (line 424)

Change from appending to prepending so the QR instructions image is always at index 0. This way, even if the index resets, it resets TO the QR instructions image:

```tsx
// Before:
return [...userImages, QR_INSTRUCTIONS_IMAGE];

// After:
return [QR_INSTRUCTIONS_IMAGE, ...userImages];
```

#### 2. Fix the `currentImageIndex` reset to only trigger on meaningful changes (lines 436-438)

Replace the naive reference-based useEffect with one that compares actual content (image URLs/count), preventing false resets:

```tsx
// Before:
useEffect(() => {
  setCurrentImageIndex(0);
}, [displayData.images]);

// After:
const imagesKey = React.useMemo(() => {
  const imgs = displayData.images || [];
  return imgs.length + ':' + imgs.map((img: any) => img.url || img.dataUrl || '').join(',');
}, [displayData.images]);

useEffect(() => {
  setCurrentImageIndex(0);
}, [imagesKey]);
```

This creates a stable string key from the images' URLs and count. The index only resets when the actual image content changes (images added/removed), not on every DISPLAY_UPDATE message.

#### 3. Fine-tune QR overlay alignment (lines 1731-1739)

Adjust positioning values to better match the white square in the background image. Based on the screenshot, the QR needs to be nudged slightly:

- `top: 24.5%` → `top: 23%`
- `right: 3%` → `right: 3.5%`  
- `width: 30.5%` → `width: 29%`
- `height: 66%` → `height: 64%`
- `padding: 2%` → `padding: 1.5%`

These will need visual verification after applying — exact values may need further tuning.
