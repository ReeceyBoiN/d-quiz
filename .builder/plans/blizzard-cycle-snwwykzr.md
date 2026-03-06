# Fix: No Points Awarded in On-the-Spot Nearest Wins Mode

## Root Cause

This issue is **already fixed** by the change we just applied (removing `onFlowStateChange('revealed')` from `handleRevealAnswer` in `NearestWinsInterface.tsx`).

### Why points weren't being awarded

Points are awarded in `handleRevealClosestTeam` (stage 2), which is triggered when the host clicks the "Closest Team" button on the nav bar. However, "Closest Team" was never showing — the nav bar was showing "Next Question" instead.

The nav bar (`QuestionNavigationBar.tsx:185-200`) shows "Closest Team" only when `hasTeamsAnsweredCorrectly` is `true`. This prop maps to `teamsAnsweredCorrectly` in QuizHost, which is set in the flow sync effect (`QuizHost.tsx:1320-1324`):

```ts
if (gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'revealed') {
  if (showNearestWinsInterface) {
    setTeamsAnsweredCorrectly(true);  // This was never executing
    setFlowState(prev => ({ ...prev, flow: 'revealed' }));
  }
}
```

**Before our fix:** `handleRevealAnswer` called `onFlowStateChange('revealed')` which set `flowState.flow = 'revealed'` *before* this effect ran. So the condition `flowState.flow !== 'revealed'` was `false`, and `setTeamsAnsweredCorrectly(true)` was **never reached**.

Result: Nav bar showed "Next Question" → user clicked it → `handleRevealClosestTeam` was never called → no points awarded.

**After our fix:** `handleRevealAnswer` no longer calls `onFlowStateChange('revealed')`. Flow stays at `'timeup'`. The sync effect correctly detects `gameAnswerRevealed=true` and `flowState.flow !== 'revealed'` (still 'timeup'), sets `teamsAnsweredCorrectly=true`, then transitions flow to `'revealed'`. Nav bar now shows "Closest Team" → clicking it calls `handleRevealClosestTeam` → points are awarded via `onAwardPoints`.

## Verified Flow (after fix)

1. Timer ends → flow = `'timeup'`, nav shows "Reveal Answer"
2. Host clicks "Reveal Answer" → `handleRevealAnswer()` → `onGameAnswerRevealed(true)`, applause plays
3. Flow sync effect: `gameAnswerRevealed=true && flow='timeup' !== 'revealed'` → `teamsAnsweredCorrectly=true`, flow = `'revealed'`
4. Nav shows **"Closest Team"** (because `hasTeamsAnsweredCorrectly=true`)
5. Host clicks "Closest Team" → `handleRevealClosestTeam()` → `onAwardPoints(winnerTeamIds, 'nearestwins')` → `handleNearestWinsAwardPoints` → `handleScoreChange(teamId, currentRoundWinnerPoints)` → **points awarded**
6. `onGameFastestRevealed(true)` → flow = `'fastest'` → nav shows "Next Question"

## Changes Required

**None** — the fix already applied (removing `onFlowStateChange('revealed')` from `NearestWinsInterface.tsx:handleRevealAnswer`) resolves this issue. No additional code changes are needed.
