# Keep Player Device Screen Awake

## Problem
Player devices (phones/tablets) dim or go to standby after a few seconds of inactivity, since the quiz player app is mostly a "watch and wait" experience with infrequent touch input.

## Approach
Use the **Screen Wake Lock API** (`navigator.wakeLock`), which is the modern browser-standard way to prevent screen dimming. It works on:
- Chrome/Edge on Android (Samsung devices included)
- Safari 16.4+ on iOS/iPadOS (Apple devices)

### Implementation
1. **Create a new hook** `src-player/src/hooks/useWakeLock.ts` that:
   - Requests a wake lock when the component mounts
   - Re-acquires the wake lock when the page regains visibility (browsers release it when a tab is hidden)
   - Releases the wake lock on unmount
   - Handles the API not being available gracefully (older browsers)

2. **Use the hook in `src-player/src/App.tsx`** — call `useWakeLock()` at the top level of the App component so the screen stays awake for the entire session.

### Key Details
- No external dependencies needed — this is a native browser API
- The wake lock is automatically released when the user navigates away or closes the tab, so there's no risk of draining battery after the quiz
- The `visibilitychange` listener re-acquires the lock if the user switches back to the tab
- Falls back silently on unsupported browsers (no errors shown to users)

## Files to Modify
- **New:** `src-player/src/hooks/useWakeLock.ts` — the wake lock hook
- **Edit:** `src-player/src/App.tsx` — import and call the hook
