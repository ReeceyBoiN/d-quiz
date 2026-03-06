# Fix: Nearest Wins "Closest Team" Display — Player Devices & External Display

## Issues Found

### Issue 1: External Display shows "N/A" for all positions (CRITICAL)
**File:** `src/components/ExternalDisplayWindow.tsx` (lines 1177-1238)

The `nearest-wins-results` case reads from `resultsData.closest`, `resultsData.secondClosest`, `resultsData.thirdClosest` — but those properties **don't exist** in the data being sent. Both NearestWinsInterface and QuizHost send results with properties: `winner`, `winners`, `runnerUp`, `submissions`. So the external display always renders "N/A" for all three podium positions.

Additionally, the external display doesn't show each team's guess or how far away they were — just names.

**Fix:** Update the `nearest-wins-results` case in ExternalDisplayWindow to read from the correct properties (`submissions[0]`, `submissions[1]`, `submissions[2]` from the sorted submissions array) and display each team's guess and difference.

### Issue 2: No "Closest Team" broadcast to player devices (MISSING FEATURE)
**File:** `src/components/NearestWinsInterface.tsx` (lines 658-729)

`handleRevealResults` broadcasts `REVEAL` (correct answer) to players — this part works, players see the correct answer. But it **never broadcasts a `FASTEST` message** with the closest team info. So players never see who the closest team was.

Compare with QuizHost's quizpack flow (line 2655-2666) which does call `broadcastFastest`.

**Fix:** In `handleRevealResults`, after awarding points, broadcast a `FASTEST` message to player devices with the winning team's name and photo. This triggers the existing `FastestTeamOverlay` on player devices.

### Issue 3: Player FastestTeamOverlay doesn't show guess/difference
**File:** `src-player/src/components/FastestTeamOverlay.tsx`

The overlay only displays `teamName` and `teamPhoto`. For nearest wins, it would be useful to also show the winning team's guess and how far off they were.

**Fix:** Add optional `guess` and `difference` props to FastestTeamOverlay. When provided, display them below the team name. Update the FASTEST broadcast in NearestWinsInterface to include this data.

### Question 2+ Analysis
The `handleNextRound` function properly resets all state and re-sends `nearest-wins-question` to the external display, and `handleRevealResults` re-sends `nearest-wins-results` each round. So once the data mapping is fixed (Issue 1), subsequent questions will display correctly on the external display.

For player devices, the REVEAL broadcast happens fresh each round (line 667-677), so the correct answer display works for all questions. The missing FASTEST broadcast (Issue 2) affects all questions equally.

## Fix Plan

### Step 1: Fix ExternalDisplayWindow data mapping
**File: `src/components/ExternalDisplayWindow.tsx`** (~lines 1194-1234)

Change the results grid to read from `resultsData.submissions` (sorted array) instead of nonexistent `closest`/`secondClosest`/`thirdClosest`:
- 1st place: `resultsData.submissions?.[0]` or `resultsData.winner`
- 2nd place: `resultsData.submissions?.[1]`  
- 3rd place: `resultsData.submissions?.[2]`

For each card, show:
- Team name
- Their guess
- Difference from correct answer (e.g. "off by 3")

### Step 2: Add FASTEST broadcast to NearestWinsInterface
**File: `src/components/NearestWinsInterface.tsx`** (in `handleRevealResults`)

After the REVEAL broadcast and point awarding, add:
```ts
// Broadcast closest team to player devices
if (calculatedResults.winner) {
  const winnerTeam = teams.find(t => t.id === calculatedResults.winner.id);
  try {
    (window as any).api?.network?.broadcastFastest({
      teamName: calculatedResults.winner.name || winnerTeam?.name || 'Unknown',
      teamPhoto: winnerTeam?.photoUrl || null,
      guess: calculatedResults.winner.guess,
      difference: calculatedResults.winner.difference
    });
  } catch (err) {
    console.error('[NearestWins] Error broadcasting closest team:', err);
  }
}
```

### Step 3: Update FastestTeamOverlay to show guess/difference
**File: `src-player/src/components/FastestTeamOverlay.tsx`**

- Add optional `guess?: number` and `difference?: number` props
- When provided, display below the team name: "Guessed: {guess} (off by {difference})"

**File: `src-player/src/App.tsx`**
- Store guess/difference from FASTEST message data
- Pass them to FastestTeamOverlay component

## Files to Modify

1. **`src/components/ExternalDisplayWindow.tsx`** — Fix data property mapping in nearest-wins-results case
2. **`src/components/NearestWinsInterface.tsx`** — Add FASTEST broadcast to handleRevealResults
3. **`src-player/src/components/FastestTeamOverlay.tsx`** — Add guess/difference display
4. **`src-player/src/App.tsx`** — Pass guess/difference from FASTEST message to overlay
