# Music Round UI Restructure

## Problem
1. The "Play Music" button and volume slider are in the Playback (center) card — user wants them in the Target Selected (left) card instead.
2. The dedicated "Buzzes" card (right column) should be removed entirely.
3. Buzz feedback (correct tick / wrong X) should appear next to team names in a teams list panel, replacing the old Buzzes card.

## Changes

### File: `src/components/MusicRoundInterface.tsx`

**1. Change from 3-column to 2-column layout**
- Change `grid grid-cols-3` to `grid grid-cols-2` (line ~1164)

**2. Move playback controls into the Target Selected card**
- In the left card's `CardContent`, after the target info / clip list, add the Play Music button, Skip/Stop controls, progress bar, and volume slider directly (currently rendered by `renderCenterPanel()`).
- Inline the relevant parts of `renderCenterPanel()` into the left card based on `gameplayStep`:
  - `playlist-ready`: Show playlist order list + Play Music button + volume slider below the target info
  - `playing`: Show playlist + progress + Skip/Stop + volume below the target info
  - `reveal-answer`, `fastest-team`, `next-round`: Show the corresponding action buttons (Reveal Answer, Show Fastest Team, Next Target) below the target info

**3. Remove the center Playback card entirely**
- Delete the `{/* Center: Playback control */}` Card block (lines ~1231-1239)
- The `renderCenterPanel()` function can be kept for organization but its output will be rendered inside the left card instead

**4. Replace the Buzzes card with a Teams list card**
- Remove the `{/* Right: Buzz tracking */}` Card block (lines ~1241-1279)
- Add a new "Teams" card in the right column that:
  - Lists all teams from the `teams` prop
  - Shows a green check icon next to a team's name if that team has a valid buzz (`validBuzzes`)
  - Shows a red X icon next to a team's name if that team has an invalid buzz (`invalidBuzzes`)
  - Shows no icon if the team hasn't buzzed yet
  - Scrolls internally if many teams

### Summary of layout after changes:
```
| Target Selected + Playback Controls | Teams (with buzz indicators) |
```
