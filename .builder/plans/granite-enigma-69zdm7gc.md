# Fix: Buzz-In Points Not Syncing Between Setup Slider and Bottom Nav

## Problem

When in buzz-in mode, the points slider on the setup dialog and the points control (up/down arrows) on the bottom navigation bar are not in sync. Changing one doesn't update the other.

## Root Cause

Three separate, disconnected sources of truth for buzz-in points:

1. **BuzzInModal** (setup dialog): Uses its own local `useState([4])` — hardcoded initial value, stored in `buzzInConfig.points` on start
2. **BottomNavigation**: For buzz-in mode specifically, reads/writes `gameModePoints.buzzin` from Settings context (line 146-148, 155-158 in BottomNavigation.tsx)
3. **BuzzInDisplay**: Receives `buzzInConfig.points` as a prop — frozen at the value from when the round was started

In contrast, other modes (keypad, nearest wins) use `currentRoundPoints` state as their single source of truth. The bottom nav reads from `currentRoundPoints` and writes via `onCurrentRoundPointsChange` → `setCurrentRoundPoints`. This keeps everything in sync.

## Solution

Align buzz-in with the same pattern used by other game modes: use `currentRoundPoints` as the single source of truth.

### 1. `src/components/QuizHost.tsx` — Sync points on buzz-in start

In `handleBuzzInStart` (line ~3298), after storing `buzzInConfig`, also set `currentRoundPoints` to the points value from the modal:

```
setCurrentRoundPoints(points);
```

Also pass `currentRoundPoints` to BuzzInDisplay instead of `buzzInConfig.points` (line ~6844):

```
points={currentRoundPoints ?? buzzInConfig.points}
```

### 2. `src/components/BottomNavigation.tsx` — Remove special buzz-in handling

In `GameModeConfigPanel`, remove the special case that reads/writes `gameModePoints.buzzin` for buzz-in mode. Instead, use `currentRoundPoints` like all other modes:

**Line 146-148** — Change:
```ts
const localPoints: number = gameMode === "buzzin" 
  ? (gameModePoints.buzzin ?? 0)
  : (currentRoundPoints ?? defaultPoints ?? 0);
```
To:
```ts
const localPoints: number = currentRoundPoints ?? defaultPoints ?? 0;
```

**Line 155-158** — Change:
```ts
if (gameMode === "buzzin") {
  if (num !== localPoints) {
    updateGameModePoints('buzzin', num);
  }
} else {
```
To just:
```ts
{
```
i.e., always use `onCurrentRoundPointsChange(num)` regardless of game mode.

### 3. `src/components/BuzzInModal.tsx` — Initialize slider from settings

The slider currently hardcodes `useState([4])`. It should initialize from `defaultPoints` (from Settings context) so it matches what the bottom nav will show:

- Import and use `useSettings` to get `defaultPoints`
- Initialize: `const [points, setPoints] = useState([defaultPoints]);`

## Files to Modify

1. `src/components/QuizHost.tsx` — Set `currentRoundPoints` in `handleBuzzInStart`, pass it to BuzzInDisplay
2. `src/components/BottomNavigation.tsx` — Remove special buzz-in points handling, use `currentRoundPoints` uniformly
3. `src/components/BuzzInModal.tsx` — Initialize points slider from settings `defaultPoints`
