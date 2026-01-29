# Fix Team Duplication on Initial Player Connection

## Problem Statement
When a player device connects for the first time and auto-approval is triggered (quiz hasn't started), the team is added to the teams list **twice** instead of once. However, on reconnection, the team is correctly updated (including both duplicate entries).

**User Report**: "on the first connect there is now 2 teams added with the same name in the teams list it should only add the team once not twice. the good thing is when the user re-connects it does update the team names (both of them) just need to get rid of the team duplication on the first initial connect"

## Root Cause Analysis

### Why Duplication Occurs
This is a **closure/state timing issue** in `src/components/QuizHost.tsx`:

1. **handleNetworkPlayerJoin** (defined in `useEffect` with empty deps, runs once at mount):
   - Calls `setQuizzes(prev => [...prev, newTeam])` to add the team
   - Then calls `setTimeout(() => handleApproveTeam(deviceId, teamName), 0)` for auto-approval

2. **handleApproveTeam** (captured by the effect with stale closure):
   - Contains a stale reference to the `quizzes` state variable from mount time
   - Performs existence check: `if (!quizzes.find(q => q.id === deviceId))`
   - Because `quizzes` is stale (from mount), the check evaluates to `true` even though team was just added
   - Calls `setQuizzes(prev => [...prev, newTeam])` again, adding duplicate

### Why This Didn't Happen Before
The previous code (before auto-approval) didn't add teams in `handleNetworkPlayerJoin` - it only added them in `handleApproveTeam`. Now both functions try to add, causing the conflict.

### Why Reconnection Works Correctly
Reconnection uses `quizzesRef.current.find()` to detect existing teams, which properly detects the (duplicate) team and updates both instances instead of adding more.

## Solution

### Recommended Approach: Use `quizzesRef` for Existence Check

Change the existence check in `handleApproveTeam` from using stale `quizzes` to using `quizzesRef.current` (which is always kept in sync with state).

**Rationale**: 
- Minimal change, least invasive
- Leverages existing `quizzesRef` pattern already used in `handleNetworkPlayerJoin` for reconnection detection
- Avoids closure staleness issue by reading from a ref instead of state variable

### Implementation Steps

#### Step 1: Modify handleApproveTeam existence check
In `src/components/QuizHost.tsx` at line ~895, change:
```typescript
// FROM:
if (!quizzes.find(q => q.id === deviceId)) {
  setQuizzes(prev => [...prev, newTeam]);
  console.log('Added team to quizzes');
}

// TO:
if (!quizzesRef.current.find(q => q.id === deviceId)) {
  setQuizzes(prev => [...prev, newTeam]);
  console.log('Added team to quizzes');
}
```

This ensures the function checks against the **current** team list (from the ref), not a stale closure value.

### Alternative Approach (if needed)
If the above doesn't fully resolve it, centralize team addition:
- Remove the `setQuizzes([...prev, newTeam])` from `handleNetworkPlayerJoin` when auto-approving
- Let only `handleApproveTeam` add teams (single source of truth)

However, the ref-based approach should be sufficient.

## Expected Result
- ✅ Player connects → team added **once** to teams list
- ✅ Team receives TEAM_APPROVED message
- ✅ Player transitions from waiting room → approval → display
- ✅ Reconnection still works (existing team updated, score preserved)
- ✅ Manual approval during active quiz still works (added to pending)

## Files to Modify
- `src/components/QuizHost.tsx`: Line ~895 in `handleApproveTeam`

## Testing Criteria
1. Connect player when quiz hasn't started → team appears once in list
2. Approve second player → also appears once
3. Reconnect player → still one entry, updated with new name
4. Start quiz, connect third player → added to pending (not auto-approved)
