# Music Round UI Restructure

## Problem
1. The Playback card (center) was incorrectly removed — it should stay.
2. The "Buzzes" card (right column) should be removed entirely — making it a 2-column layout.
3. Play Music button and volume slider should be added to the Target Selected (left) card.
4. Buzz indicators (green tick / red X) should appear next to team names in the **existing LeftSidebar teams list** — not in a new panel inside the music round area.

## Changes

### 1. `src/components/MusicRoundInterface.tsx` — Layout changes

**Revert to 2-column layout (Target + Playback only, no Buzzes/Teams card):**
- Left card: "Target Selected" — keeps target info, adds Play Music button + volume slider below target info (already partially done)
- Right card: "Playback" — keeps the playlist order, progress bar, skip/stop controls (restore `renderCenterPanel()` output here, but without the Play Music button and volume which move to the left card)
- Remove the new "Teams" card entirely from the music round grid

**Refactor `renderCenterPanel()`:**
- For `playlist-ready`: Show playlist order + Shuffle button only (Play Music button + volume move to left card)
- For `playing`: Show playlist + progress + Skip/Stop only (volume moves to left card)  
- For `reveal-answer`, `fastest-team`, `next-round`: Keep as-is (action buttons stay in center)
- Play Music button and volume slider render in the left card below the target info, across all steps (when a target is selected)

**Add `onBuzzUpdate` callback prop:**
- New prop: `onBuzzUpdate?: (buzzes: { teamId: string; valid: boolean; responseTime?: number }[]) => void`
- Call `onBuzzUpdate` in the `useEffect` that updates `handleBuzzRef.current` whenever `buzzes` state changes
- This sends buzz data up to QuizHost so it can forward to LeftSidebar

### 2. `src/components/QuizHost.tsx` — Pass buzz data through

- Add state: `musicRoundBuzzes` to track current buzzes from the music round
- Pass `onBuzzUpdate` callback to `MusicRoundInterface` that updates `musicRoundBuzzes`
- Clear `musicRoundBuzzes` when music round closes
- Pass `musicRoundBuzzes` to `LeftSidebar` as a new prop

### 3. `src/components/LeftSidebar.tsx` — Show buzz indicators

- Add new optional prop: `musicRoundBuzzes?: { teamId: string; valid: boolean; responseTime?: number }[]`
- In each team row, check if that team has a buzz entry:
  - If `valid === true`: show a green Check icon next to the team name
  - If `valid === false`: show a red X icon next to the team name
  - If no entry: show nothing (team hasn't buzzed yet)
- These indicators appear inline alongside existing team info (name, score, etc.)
