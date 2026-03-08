# Plan: Fastest Team Name Readability + Image Pre-Loading Buffer

## Problem Summary

1. **Team name unreadable on player devices**: When the fastest team is revealed, the team name appears as white text directly on top of the team photo. If the photo is light/white, the text is invisible.
2. **Images not loading simultaneously**: Picture questions and team photos arrive at different times on different devices due to network latency and image download time, causing an uneven reveal experience.

---

## Change 1: Move Team Name Above Photo in a Flashing Box

**File**: `src-player/src/components/FastestTeamOverlay.tsx`

Currently, the team name is rendered as white text with a drop-shadow positioned absolutely over the center of the team photo. This makes it unreadable on light-colored photos.

**Approach**: Restructure the overlay layout so the team name appears in a **flashing bordered box above the team photo**, similar to how `FastestTeamOverlaySimplified.tsx` (the external display version) already renders it — with a clearly visible box with a contrasting background.

Specific changes:
- Change layout from `absolute overlay on photo` → vertical flex column with **name box on top, photo below**
- Team name box: dark background (`bg-gray-800` or `bg-slate-800`), bright border (orange/amber), with a CSS flash/pulse animation
- Team photo rendered below at a constrained size (not full-screen behind text)
- Keep the "no photo" fallback (gradient with emoji) but apply the same name-above layout
- Keep the nearest-wins guess/difference display below the team name
- Add a `@keyframes` flash animation (alternating border/background brightness) via inline styles or a `<style>` tag

---

## Change 2: Image Pre-Loading / Pre-Caching System

The goal is to send image data to player devices **before** it's needed, so when the reveal signal arrives, the image is already cached and displays instantly on all devices.

### 2a: New message type `PRECACHE`

**Files**:
- `src/network/wsHost.ts` — Add `PRECACHE` to `NetworkMessageType`, add `sendPrecache()` helper
- `src-player/src/types/network.ts` — Add `PRECACHE` to `HostMessageType`
- `electron/backend/server.js` — Add `broadcastPrecache()` function
- `electron/main/main.js` — Add IPC handler for `network/broadcast-precache`
- `electron/preload/preload.js` — Expose `broadcastPrecache` in the API

The `PRECACHE` message carries:
```json
{
  "type": "PRECACHE",
  "data": {
    "cacheKey": "question-3-image" | "fastest-team-photo",
    "imageUrl": "<base64 or http url>"
  }
}
```

### 2b: Player-side image cache

**File**: `src-player/src/App.tsx`

- Add a `imageCache` ref (`useRef<Map<string, string>>`) to store pre-cached images
- Handle `PRECACHE` messages: store the image URL in the cache map, and also create a hidden `Image()` object to force the browser to download/decode it
- When `PICTURE` message arrives: check cache for a matching image and use it immediately
- When `FASTEST` message arrives: check cache for the team photo URL and use it immediately
- Clear cache entries after they've been used (or on `NEXT`/`END_ROUND`)

### 2c: Host-side pre-sending

**File**: `src/components/QuizHost.tsx`

**For picture questions:**
- When a question with an image is loaded (during `ready` state, or even when navigating to a question), pre-send the image via `PRECACHE` before the user clicks "Send Picture"
- This gives devices time to download the image before it's actually revealed

**For fastest team photos:**
- When the answer is revealed (flow transitions to `revealed`), pre-send ALL team photos (or at least the correct teams' photos) via `PRECACHE`
- By the time the host clicks "Fastest Team", the photo is already cached on all devices
- The team photo URL goes through `convertPhotoUrlToHttp` in the backend before being sent

### 2d: Timing strategy

- **Picture questions**: Pre-cache when question is loaded into `ready` state (1-2 steps before `sent-picture`)
- **Fastest team photos**: Pre-cache when timer starts (`running` state) — this gives the entire timer duration for devices to download the photos. Alternatively, pre-cache when the question is sent.

---

## Files to Modify

| File | Change |
|------|--------|
| `src-player/src/components/FastestTeamOverlay.tsx` | Restructure layout: name in flashing box above photo |
| `src-player/src/App.tsx` | Add image cache ref, handle `PRECACHE` messages, use cached images for `PICTURE` and `FASTEST` |
| `src-player/src/types/network.ts` | Add `PRECACHE` to `HostMessageType` |
| `src/network/wsHost.ts` | Add `PRECACHE` type and `sendPrecache()` helper |
| `src/components/QuizHost.tsx` | Send `PRECACHE` messages at appropriate flow stages |
| `electron/backend/server.js` | Add `broadcastPrecache()` function |
| `electron/main/main.js` | Add IPC handler for precache broadcast |
| `electron/preload/preload.js` | Expose `broadcastPrecache` in API |

## Key Considerations

- Image data (base64 strings) can be large. The pre-cache approach uses the same data that would be sent anyway — it just sends it earlier. No additional bandwidth cost, just shifted timing.
- The cache is keyed so the same image isn't re-sent unnecessarily.
- The `PRECACHE` message is silent — it doesn't change any UI state on the player device, it just quietly downloads and stores the image.
- For team photos that are served via HTTP URL (converted from `file://`), the browser pre-fetch via `new Image().src = url` ensures the image is in the browser cache by reveal time.
