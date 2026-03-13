# Fix: Points Not Syncing Between Slider and Bottom Nav in Buzz-In (On-The-Spot) Mode

## Root Cause

The points slider in **BuzzInInterface** and the points arrows in **BottomNavigation** write to and read from **two completely separate state sources**:

| Control | Reads from | Writes to |
|---|---|---|
| BuzzInInterface slider | `gameModePoints.buzzin` (SettingsContext) | `updateGameModePoints('buzzin', value)` (SettingsContext) |
| BottomNavigation arrows | `currentRoundPoints` (QuizHost state) | `setCurrentRoundPoints(points)` (QuizHost state) |

These two states are never synced during on-the-spot buzz-in mode. The only sync point is `handleBuzzInStart` which copies the slider value to `currentRoundPoints` once when the round starts — but during setup (before clicking START ROUND), the two controls are completely disconnected.

In **quiz pack mode**, this works because the quiz pack flow manages `currentRoundPoints` directly and both the bottom nav and the quiz pack display read from it consistently.

## Fix Approach — Two-Way Sync in QuizHost.tsx

### Change 1: Bottom Nav → Slider sync (`src/components/QuizHost.tsx`)
In `handleCurrentRoundPointsChange`, when in buzz-in mode (`showBuzzInInterface || showBuzzInMode`), also update `gameModePoints.buzzin` via `updateGameModePoints('buzzin', points)`.

This ensures that when the user clicks the arrows in the bottom nav, the slider in BuzzInInterface updates too.

### Change 2: Slider → Bottom Nav sync (`src/components/QuizHost.tsx`)
Add a `useEffect` that watches `gameModePoints.buzzin` and updates `currentRoundPoints` when buzz-in interface is showing (`showBuzzInInterface || showBuzzInMode`).

This ensures that when the user drags the slider, the bottom nav points display updates too.

### Loop Prevention
Both directions have built-in guards:
- `updateGameModePoints` has: `if (gameModePoints[gameMode] === points) return;`
- React's `useEffect` only fires when the dependency value actually changes
- So setting the same value won't trigger re-renders or infinite loops

## Files to Modify

1. **`src/components/QuizHost.tsx`** — Two changes:
   - Modify `handleCurrentRoundPointsChange` to also call `updateGameModePoints('buzzin', points)` when in buzz-in mode
   - Add a `useEffect` to sync `gameModePoints.buzzin` → `currentRoundPoints` when buzz-in interface is active
