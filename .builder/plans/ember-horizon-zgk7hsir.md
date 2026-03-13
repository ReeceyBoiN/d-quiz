# Rebuild QR Instructions Screen in Pure HTML/CSS

## Problem
The QR code is overlaid on a background image, and percentage-based positioning drifts across different screen aspect ratios. No amount of tweaking percentages will reliably align the QR code to the white square in the image at all resolutions.

## Solution
Replace the background image + QR overlay approach with a **pure HTML/CSS recreation** of the instructions screen. The QR code becomes a natural part of the layout — no positioning guesswork needed.

## Design to Recreate
Based on the original image:
- **Full background**: Orange (#E8882F or similar)
- **"POP QUIZ" title**: Large white bold text with dark shadow/3D effect, centered at top
- **Instructions card**: Rounded rectangle with green (#2D8B3A) border, black (#000) fill, ~90% width, centered
- **Inside the card**: Two-column layout:
  - **Left column (~60%)**: Three instruction lines in white bold uppercase text:
    - 1. JOIN QUIZ WI-FI
    - 2. SCAN QR CODE
    - 3. ENTER TEAM NAME
  - **Right column (~35%)**: White square area containing the QR code image

## File: `src/components/ExternalDisplayWindow.tsx`

### Changes:

1. **Remove the hardcoded image constants** (lines 26-27):
   - Delete `QR_INSTRUCTIONS_IMAGE_URL` and `QR_INSTRUCTIONS_IMAGE` constants (the background image URL is no longer needed)

2. **Update `QR_INSTRUCTIONS_IMAGE`** to not reference an image URL:
   - Change it to: `const QR_INSTRUCTIONS_IMAGE = { url: '__qr_instructions__', name: 'Join Instructions', isQrInstructions: true };`
   - Keep the marker object so the slideshow cycling logic still works (it needs at least one entry in effectiveImages)
   - The `url` is a sentinel value — it won't be used as an image src

3. **Replace the `isQrInstructionsImage` rendering block** (~lines 1725-1767):
   - Instead of rendering `<img src={currentImage.url}>` with an overlay, render the full layout in JSX:

```tsx
isQrInstructionsImage ? (
  <div style={{
    width: '100%', height: '100%',
    backgroundColor: '#E8882F',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '2% 3%',
    boxSizing: 'border-box'
  }}>
    {/* POP QUIZ Title */}
    <h1 style={{
      fontFamily: "'Impact', 'Arial Black', sans-serif",
      fontSize: 'clamp(3rem, 10vw, 8rem)',
      color: 'white',
      textTransform: 'uppercase',
      textShadow: '4px 4px 0px rgba(0,0,0,0.3), 2px 2px 0px rgba(0,0,0,0.2)',
      margin: '0 0 2% 0',
      letterSpacing: '0.05em',
      lineHeight: 1
    }}>
      POP QUIZ
    </h1>
    
    {/* Instructions Card */}
    <div style={{
      width: '92%', flex: '1 1 auto',
      maxHeight: '70%',
      backgroundColor: '#000',
      borderRadius: '20px',
      border: '5px solid #2D8B3A',
      display: 'flex', flexDirection: 'row',
      alignItems: 'center',
      padding: '3% 4%',
      boxSizing: 'border-box',
      gap: '4%'
    }}>
      {/* Left - Instructions */}
      <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '100%' }}>
        {['1. JOIN QUIZ WI-FI', '2. SCAN QR CODE', '3. ENTER TEAM NAME'].map((text, i) => (
          <p key={i} style={{
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            fontSize: 'clamp(1.5rem, 5vw, 4rem)',
            color: 'white',
            textTransform: 'uppercase',
            margin: 0,
            lineHeight: 1.3
          }}>{text}</p>
        ))}
      </div>
      
      {/* Right - QR Code */}
      <div style={{
        flex: '0 0 auto',
        aspectRatio: '1/1',
        height: '90%',
        backgroundColor: 'white',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3%'
      }}>
        {qrCodeDataUrl && displayData.joinUrl ? (
          <img src={qrCodeDataUrl} alt="Scan to join" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    </div>
  </div>
)
```

### What stays the same:
- `effectiveImages` array logic — still prepends the QR instructions entry so it's always in the slideshow rotation
- `isQrInstructions` flag detection — still checks `currentImage.isQrInstructions`
- QR code generation via `QRCode.toDataURL` — still generates `qrCodeDataUrl` from `displayData.joinUrl`
- Slideshow cycling interval — unchanged
- Regular (non-instructions) slideshow images — unchanged, still render as `<img>` with `objectFit: 'cover'`

### Why this works at any resolution:
- Flexbox layout naturally adapts to any screen size
- The QR code square uses `aspectRatio: '1/1'` with `height: 90%` — it's always square and proportional
- `clamp()` font sizes scale smoothly between small and large displays
- No absolute positioning or percentage guessing needed
