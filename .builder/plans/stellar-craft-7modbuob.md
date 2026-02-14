# Host Buzzer Sound Management - Implementation Plan

## Overview
Enhance the Team Buzzer Sound dropdown in the host software to dynamically load available buzzers from the API and prevent duplicate buzzer selection across teams.

## Current State
- TeamWindow already has a "Team Buzzer Sound" dropdown (lines ~546-561)
- QuizHost manages team data with `buzzerSound` property for each team
- Player devices send PLAYER_BUZZER_SELECT messages which update host state
- Buzzer list is currently hardcoded in TeamWindow
- No validation to prevent multiple teams selecting the same buzzer
- BuzzersManagement panel already loads buzzers from `/api/buzzers/list` API

## Requirements
1. Load actual buzzer files from `/api/buzzers/list` endpoint instead of hardcoded list
2. Display which buzzers are already selected by other teams (greyed out/disabled)
3. Prevent teams from selecting buzzers already claimed by another team
4. When host changes a team's buzzer, update the team assignment so:
   - The new buzzer is marked as "selected by this team"
   - Previously selected buzzer becomes available to other teams
   - Host will use the new buzzer file when playing quiz audio
5. Keep BuzzersManagement panel separate but ensure both panels stay in sync

## Implementation Strategy

### Step 1: Update TeamWindow Component
**File**: `src/components/TeamWindow.tsx`

- Remove hardcoded `buzzerSounds` array
- Add state to fetch and store `availableBuzzers` from API endpoint `/api/buzzers/list`
- Add `useEffect` to fetch buzzer list from API on mount (similar to BuzzersManagement.tsx)
- Create helper function `isBuzzerTaken(buzzerName)` that:
  - Accepts current team's data and all teams data
  - Returns true if any OTHER team has already selected that buzzer
  - Returns false if no team has it, or if current team already has it selected
- Update the Select dropdown to:
  - Show all available buzzers
  - Disable/grey out buzzers that are taken by other teams
  - Add visual indicator showing which team took each buzzer
- Keep the `onBuzzerChange` handler callback (already passed from QuizHost)

### Step 2: Update QuizHost Component
**File**: `src/components/QuizHost.tsx`

- No changes needed to core state management (already works correctly)
- Ensure `handleBuzzerChange` is properly connected to TeamWindow:
  - When called, updates the quizzes state to set `buzzerSound` for the team
  - The state change automatically prevents other teams from selecting the same buzzer
- Verify the PLAYER_BUZZER_SELECT listener properly updates state for player-initiated selections

### Step 3: Ensure Buzzer Playback Uses Current Selection
**File**: `src/components/QuizHost.tsx` (or wherever buzzer audio is played)

- When host initiates buzzer playback, ensure it uses:
  - The current `team.buzzerSound` value from state
  - Not any previously cached value
  - The API URL: `http://{hostIP}:{port}/api/buzzers/{team.buzzerSound}`

## Key Considerations

### State Management
- Single source of truth: `quizzes[].buzzerSound` in QuizHost
- TeamWindow is read-only for the array (receives teams as props)
- Changes flow: TeamWindow dropdown → onBuzzerChange callback → QuizHost state update

### API Loading
- Reuse the pattern from BuzzersManagement.tsx for fetching `/api/buzzers/list`
- Handle loading/error states gracefully
- Cache buzzer list in state to avoid repeated API calls

### Buzzer Availability Logic
- A buzzer is "taken" if ANY team has that buzzer selected EXCEPT the current team
- When host selects a different buzzer for a team, the old one automatically becomes available
- When a player sends PLAYER_BUZZER_SELECT, it marks that buzzer as taken by that team

### UI/UX
- Show disabled state for taken buzzers (greyed out, no hover effect)
- Optional: show tooltip indicating which team took the buzzer
- Loading state while fetching buzzer list
- Error state if API call fails

## Files to Modify
1. **src/components/TeamWindow.tsx** (PRIMARY - most changes here)
   - Add buzzer list loading logic
   - Add buzzer availability checking
   - Update Select component to show/disable taken buzzers

2. **src/components/QuizHost.tsx** (MINIMAL - verify, no changes likely needed)
   - Verify state flow is correct
   - Ensure buzzer playback uses current state values

## Success Criteria
- ✓ Buzzer dropdown dynamically loads from `/api/buzzers/list`
- ✓ Buzzers selected by other teams show as unavailable/disabled
- ✓ Host can change a team's buzzer from the dropdown
- ✓ When changed, the new buzzer is assigned to that team exclusively
- ✓ Previously selected buzzer becomes available for other teams
- ✓ Buzzer playback uses the current team.buzzerSound value
- ✓ BuzzersManagement and TeamWindow remain in sync (same data source)

## Related Components
- `src/components/BuzzersManagement.tsx` - Reference implementation for API loading
- `src/network/types.ts` - PlayerBuzzerSelectMessage definition
- `src/network/wsHost.ts` - Network message handling
