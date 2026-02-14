# Fix IPC Buzzer Path Handler Parameter Mismatch

## Problem
The audio playback fails with error: "Buzzer name must be a non-empty string" even though the buzzer name is being correctly passed through IPC. The fallback to HTTP is then blocked by CSP.

## Root Cause
**Handler signature mismatch with IPC router expectations:**

The IPC router (`electron/ipc/ipcRouter.js`) always passes the **entire parsed payload object** to the handler function. However, `handleGetBuzzerPath()` is written to expect a **single string argument** directly.

Flow:
1. Renderer invokes: `window.api.ipc.invoke('audio/get-buzzer-path', { buzzerName: "ACDC - Back In Black.mp3" })`
2. Router validates with Zod schema: `GetBuzzerPathSchema` (expects object `{ buzzerName: string }`)
3. Router passes parsed object to handler: `handler({ buzzerName: "ACDC - Back In Black.mp3" })`
4. Handler expects string: `function handleGetBuzzerPath(buzzerName)` receives an **object** instead
5. Type check fails: `typeof { buzzerName: "..." } !== 'string'` → throws error

## Solution
**Change the handler to accept and destructure the payload object** (Option A - Recommended)

This aligns with how other IPC handlers in the codebase work (they receive payload objects, not primitive values).

## Files to Modify

### 1. `electron/ipc/handlers/audioHandler.js`
- Change function signature from `handleGetBuzzerPath(buzzerName)` to `handleGetBuzzerPath(payload)`
- Destructure buzzerName from payload: `const buzzerName = payload?.buzzerName`
- Update validation check to handle the destructured value
- Update logging to show the destructured buzzerName

**Key changes:**
```javascript
// Before:
export async function handleGetBuzzerPath(buzzerName) {
  if (!buzzerName || typeof buzzerName !== 'string') { ... }

// After:
export async function handleGetBuzzerPath(payload) {
  const buzzerName = payload?.buzzerName;
  if (!buzzerName || typeof buzzerName !== 'string') { ... }
```

## Expected Outcome
- IPC call succeeds and returns the correct `file://` URL
- Audio playback works without falling back to HTTP
- No more CSP violations for audio playback
- Consistent handler design with rest of the codebase

## Testing Steps
1. Rebuild the app
2. Click "Play Buzzer" in BuzzersManagement tab
3. Check logs show: `[Audio IPC] handleGetBuzzerPath called with: ACDC - Back In Black.mp3` (not undefined)
4. Audio should play without errors or CSP warnings
