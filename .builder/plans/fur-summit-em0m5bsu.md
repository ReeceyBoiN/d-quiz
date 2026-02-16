# Team Duplicate Display Bug - Investigation & Fix Plan

## Problem Statement
When a new team tries to join a quiz that's already in progress (with existing teams that have points), the team name appears **3 times** in the pending approval list instead of once. However, when the host approves one copy, all 3 disappear and the single team joins correctly.

## Root Cause IDENTIFIED

### The Issue
In `src/components/QuizHost.tsx`, the `handleNetworkPlayerJoin` function **has no deduplication logic** when adding teams to the pending approval list:

```javascript
// Current code (line ~2731):
setPendingTeams(prev => [...prev, { deviceId, playerId, teamName, timestamp: Date.now() }]);
```

This means every PLAYER_JOIN message for the same `deviceId` gets appended as a new entry, creating duplicates.

### Why Multiple PLAYER_JOIN Messages Arrive
The player app (`src-player/src/App.tsx`) intentionally sends multiple PLAYER_JOIN messages:
1. **Initial join** - when team submits name and photo
2. **Join with buzzer** - when player selects a buzzer sound
3. **Join with photo** - when team photo is uploaded

Each message is handled independently by the host, resulting in 3 pending entries for 1 team.

### Why Approval Still Works
When the host clicks approve, the code filters out **all** entries with that `deviceId`:
```javascript
setPendingTeams(prev => prev.filter(t => t.deviceId !== deviceId));
```
So all 3 duplicates are removed at once, and the team joins correctly.

## Solution Approach

Add simple deduplication logic to prevent duplicate pending entries from being added:

**File to modify**: `src/components/QuizHost.tsx`
- Function: `handleNetworkPlayerJoin` (around line 2730)
- Change: Check if team already exists in pending list before adding
- Implementation: One-line guard with `prev.some()` check

**Pseudo-code**:
```javascript
// Instead of appending unconditionally:
setPendingTeams(prev => {
  // Only add if team not already pending
  if (prev.some(t => t.deviceId === deviceId)) return prev;
  return [...prev, { deviceId, playerId, teamName, timestamp: Date.now() }];
});
```

**Benefits**:
- ✅ Teams appear only once in pending list
- ✅ Minimal code change (3 lines)
- ✅ No impact on approval/decline flows (they already work correctly)
- ✅ No performance issues (small array size)

## Alternative Considerations

### Option A: Normalize deviceId (whitespace handling)
Add `const normalizedDeviceId = deviceId?.trim();` and compare trimmed values. Good practice but may not be necessary if backend already normalizes.

### Option B: Debounce multiple joins
If multiple PLAYER_JOIN for same team arrive within short time window (e.g., < 500ms), treat as single join. More complex but handles network timing issues.

### Recommended: Option A + Main Fix
Combine deduplication with trimmed comparison for robustness.

## Files to Modify
1. **src/components/QuizHost.tsx** 
   - Location: `handleNetworkPlayerJoin` function, around line 2731
   - Change: Add deduplication guard in `setPendingTeams` call

## Success Criteria
- ✅ Team appears only once in pending approval list
- ✅ Buzzer selection does NOT create duplicate entries
- ✅ Photo upload does NOT create duplicate entries
- ✅ Approving one copy still approves the team
- ✅ No visual duplicates in "PENDING APPROVAL" section of UI
