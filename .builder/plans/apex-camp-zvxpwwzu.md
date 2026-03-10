# Fix Music Round Navigation & Bottom Bar Issues

## Problems Found

### 1. Home button doesn't close the Music Round
In `QuizHost.tsx` `handleTabChange` (line ~3248-3282), when `tab === "home"`, it explicitly closes every game mode interface — but `setShowMusicRoundInterface(false)` was never added to that list. So clicking Home does nothing while the music round is open.

### 2. END ROUND button wrongly appears in the bottom navigation bar
The END ROUND button condition in `BottomNavigation.tsx` (line ~1060) includes `showMusicRoundInterface`, so it shows on the bottom bar. But since `getCurrentGameMode()` returns `null` for the music round, the bottom bar renders END ROUND **alongside the home screen controls** (buzzers, team photos, settings, etc.) — which looks broken.

The music round already has its own Close button inside the interface. It doesn't need END ROUND in the bottom bar at all — it's a file browser, not a timed scoring round like Keypad or Buzz-In.

## Fixes

### File 1: `src/components/QuizHost.tsx`
- In `handleTabChange`, add `setShowMusicRoundInterface(false)` to the block that closes all interfaces when navigating home (~line 3265).

### File 2: `src/components/BottomNavigation.tsx`
- Remove `showMusicRoundInterface` from the END ROUND button visibility condition (~line 1060). The music round uses its own Close button instead.
