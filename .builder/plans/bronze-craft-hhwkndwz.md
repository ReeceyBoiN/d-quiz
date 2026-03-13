# Add QR Code for Player Connection on External Display

## Overview

Generate a QR code from the dynamically-detected local IPv4 address + port (e.g. `http://192.168.0.103:4310`) and display it on the external display / livescreen. The IP is already detected at boot by the backend's `getLocalIPAddress()` in `electron/backend/server.js` and served via `/api/host-info`.

## Approach

### 1. Install `qrcode` library (host app)

Add `qrcode` package to the root `package.json`. This library can generate QR codes as data URLs directly in the browser — no server-side rendering needed.

```
npm install qrcode
```

Also install types: `npm install -D @types/qrcode`

### 2. Pass the join URL through to ExternalDisplayWindow

**File: `src/components/QuizHost.tsx`**

- In `updateExternalDisplay()`, add a `joinUrl` field to `messageData` constructed from the already-known host info. The host info can be fetched once on mount from `/api/host-info` (or derived from `window.location` when running in Electron since the backend already knows the IP).
- Add a state variable `joinUrl` that's set on mount by calling `/api/host-info` and constructing `http://${localIP}:${port}`.
- Include `joinUrl` in every `messageData` sent to the external display.

### 3. Render QR code on the External Display

**File: `src/components/ExternalDisplayWindow.tsx`**

- Import `QRCode` from `qrcode` library.
- Store `joinUrl` from incoming display data in `displayData` state.
- In the `case 'basic'` rendering (the POP QUIZ splash screen), add a QR code in the corner with a label like "Scan to Join" and the URL text below it.
- In the `case 'slideshow'` — currently this falls through to `default`. Add a proper `case 'slideshow'` that renders the cycling images AND overlays the QR code in a corner.
- Generate the QR code as a data URL using `QRCode.toDataURL(joinUrl)` in a useEffect, and render it as an `<img>`.

### 4. QR Code Display Design

- Position: bottom-right or bottom-left corner of the external display
- Size: ~150-200px, semi-transparent background panel
- Show on: `basic` mode and `slideshow` mode (the idle/waiting screens where teams would be joining)
- Label: "Scan to Join" with the URL text below in small font
- The QR code should NOT appear during active question/timer/answer modes to avoid visual clutter

## Files to Modify

1. **`package.json`** — add `qrcode` dependency
2. **`src/components/QuizHost.tsx`** — fetch join URL on mount, pass to external display
3. **`src/components/ExternalDisplayWindow.tsx`** — receive join URL, generate and render QR code on basic/slideshow modes

## Key Details

- The IP is already dynamically detected in `electron/backend/server.js:70-80` via `os.networkInterfaces()`
- The `/api/host-info` endpoint (line 118) already returns `{ localIP, port, wsUrl, httpUrl }`
- No changes needed to the backend — the frontend just needs to fetch this info and pass it through
- The QR code will automatically update if the IP changes on restart since it's fetched fresh each time the app loads
