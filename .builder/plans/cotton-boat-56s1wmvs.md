# Leaderboard Reveal: Scores with Each Team + Simplified Host UI + Joint Positions

## Summary
Three changes:
1. **Show scores alongside each team reveal** on the external display — currently scores ARE shown in the table, but positions need to account for ties
2. **Simplify the host-side leaderboard UI** — currently overly complex with large cards, teleprompter-style prompts, and lots of visual noise
3. **Handle tied scores** — teams with the same score should be labelled "Joint 3rd" / "Joint 2nd" etc. instead of sequential unique positions

## Current State

### Host UI (`LeaderboardReveal.tsx`)
- Has 3 states: initial "GET READY" screen, mid-reveal with "NEXT TO ANNOUNCE" card + current status, and "ALL TEAMS REVEALED" final screen
- Each state is a large, heavily styled card with teleprompter prompts ("Say: In Xth place...")
- Buttons: Next Team, Export Image, Reset — spread in header
- Progress indicator: badge showing X / Y
- ~500 lines total (most is image export canvas code)

### External Display (`PopoutDisplay.tsx` + `ExternalDisplayWindow.tsx`)
- PopoutDisplay has a `leaderboard-reveal` case showing a table with Position, Team Name, Score columns — scores are already displayed
- ExternalDisplayWindow does NOT have `leaderboard-reveal` or `leaderboard-intro` cases — they fall through to the default "External Display" text
- Positions are currently calculated as simple sequential numbers (no tie handling)

### Position Calculation (the core issue)
- In `LeaderboardReveal.tsx`, `actualPosition` is calculated as `sortedTeams.length - index` — purely index-based, no tie detection
- In `PopoutDisplay.tsx`, fallback position uses `revealedTeams.filter(t => t.score > team.score).length + 1` — this DOES handle ties but only for the fallback path

## Changes Required

### 1. Add Tie-Aware Position Calculation (`LeaderboardReveal.tsx`)
- Create a helper function `calculatePositions(sortedTeams)` that assigns positions accounting for ties
- Teams sorted ascending by score. When building `revealedTeamsWithPositions`, calculate actual position by counting how many teams in the FULL sorted list have a higher score, +1
- This means two teams both with 50 points would both be "3rd" if two teams have more points
- Add a `isJoint` boolean flag to each team entry when another team shares their score
- Update the position label format to show "Joint 3rd" when `isJoint` is true

### 2. Simplify Host UI (`LeaderboardReveal.tsx`)
Replace the current 3-state card-based layout with a cleaner, more compact design:
- **Top bar**: Title "Leaderboard Reveal", Next Team button (prominent), Reset and Export buttons (smaller/outline)
- **Main area**: A simple scrollable table/list showing ALL teams, with revealed teams visible and unrevealed teams hidden/greyed out
  - Each row: position (with joint indicator), team name, score
  - The currently-revealing team row is highlighted
  - Unrevealed teams show as "???" or dimmed placeholder rows
- **Bottom**: Small progress text "Revealed 3 of 8 teams"
- Remove the verbose teleprompter prompts ("Say: In Xth place...")
- Remove the large "GET READY TO ANNOUNCE" intro card
- Remove the oversized "ALL TEAMS REVEALED" celebration card — just show the completed table with a small "Complete" indicator
- Keep the spacebar shortcut for Next Team

### 3. Add Leaderboard Cases to `ExternalDisplayWindow.tsx`
Currently `leaderboard-intro` and `leaderboard-reveal` fall through to the default case. Add:
- **`leaderboard-intro`**: Full-screen "AND THE SCORES ARE..." display (matching what PopoutDisplay shows)
- **`leaderboard-reveal`**: Table showing revealed teams with position, name, score — with the currently-revealed team highlighted. Include joint position labels.
- Use `displayData.data` to access the leaderboard reveal data (team, position, totalTeams, isLast, revealedTeamsWithPositions)

### 4. Update `PopoutDisplay.tsx` Leaderboard Reveal
- Update position display in the table to show "Joint" prefix when applicable
- Use the same tie-aware position data from the host

## Files to Modify
1. **`src/components/LeaderboardReveal.tsx`** — Tie calculation, simplified host UI
2. **`src/components/ExternalDisplayWindow.tsx`** — Add leaderboard-intro and leaderboard-reveal rendering cases with tie-aware display
3. **`src/components/PopoutDisplay.tsx`** — Update leaderboard-reveal to show joint positions
