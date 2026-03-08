# Plan: Fix Issues Found in PRECACHE + FastestTeamOverlay Implementation

## Review Summary

Reviewed all 8 modified files across the full stack. The FastestTeamOverlay UI changes look correct. However, the PRECACHE system has **1 critical bug** and **2 coverage gaps** that need fixing.

---

## Issue 1 (Critical Bug): `broadcastPrecache` in server.js doesn't convert `file://` URLs

**Problem:** When precaching team photos, `QuizHost.tsx` sends `team.photoUrl` which is typically a `file://` URL (e.g. `file:///C:/Users/host/AppData/.../team_photo.png`). Player devices on other machines **cannot access** `file://` URLs over the network.

The existing `broadcastFastest` function already handles this — it runs `convertPhotoUrlToHttp()` to convert to an HTTP URL like `http://192.168.1.100:4310/photos/team_photo.png`. But `broadcastPrecache` does not do this conversion.

This means:
- The `new Image().src = fileUrl` on player devices will fail silently (can't load a file:// URL from another machine)
- The browser HTTP cache won't have the image when FASTEST arrives with the HTTP-converted URL
- Team photo precaching is effectively broken for all network players

**Fix:** In `electron/backend/server.js`, modify `broadcastPrecache` to apply `convertPhotoUrlToHttp()` to `imageUrl` before sending. This ensures the precached URL matches the URL that `broadcastFastest` will later send.

---

## Issue 2 (Coverage Gap): Nav bar timer bypasses team photo precache

**Problem:** There are two ways to start the timer in quiz pack mode:
1. The flow state machine (`handlePrimaryAction` → `sent-question` case) — **has precache** ✅
2. The nav bar buttons (`handleNavBarStartTimer` / `handleNavBarSilentTimer`) — **no precache** ❌

When the timer is started via the nav bar (path 2), it calls `executeStartNormalTimer`/`executeStartSilentTimer` directly and transitions straight to `flow: 'running'`, bypassing the `sent-question` case where team photo precaching was added.

**Fix:** Add team photo precaching to `handleNavBarStartTimer` and `handleNavBarSilentTimer` in `QuizHost.tsx`, before the timer is started. Same logic: iterate teams with photos and call `sendPrecacheToPlayers`.

---

## Issue 3 (Coverage Gap): On-the-spot mode timer has no team photo precache

**Problem:** In on-the-spot mode (KeypadInterface, NearestWinsInterface), the timer is started via `gameActionHandlers.startTimer()` which is managed by the game mode components, not the flow state machine. This path never hits the `sent-question` case, so team photos aren't precached.

**Fix:** Add team photo precaching to the on-the-spot branch of `handleNavBarStartTimer` (the `else if (showKeypadInterface || showNearestWinsInterface || showBuzzInMode)` block), right before calling `gameActionHandlers.startTimer()`.

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/backend/server.js` | Add `convertPhotoUrlToHttp()` call in `broadcastPrecache` for the `imageUrl` field |
| `src/components/QuizHost.tsx` | Add team photo precache calls to `handleNavBarStartTimer`, `handleNavBarSilentTimer`, and the on-the-spot timer branch |

## What's Already Correct (No Changes Needed)

- **FastestTeamOverlay.tsx** — Layout, animation, and styling are correct
- **Player types (network.ts)** — `PRECACHE` added correctly to `HostMessageType`
- **Host types (wsHost.ts)** — `PRECACHE` type, `sendPrecache()` method, and `sendPrecacheToPlayers()` export all correct
- **Electron IPC (main.js, preload.js)** — Handler and API exposure are correct
- **Player App.tsx** — `imageCacheRef`, `PRECACHE` handler with `new Image()` preload, picture question cache lookup, cache clearing on NEXT/END_ROUND all correct
- **Picture question precache** — Uses base64 data URLs (not file:// URLs), so no conversion needed; works correctly
- **FASTEST handler** — Correctly uses photo URL from the message (relies on browser HTTP cache from precache, not the map)
