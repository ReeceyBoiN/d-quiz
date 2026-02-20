# Host Remote Leaderboard - Real-time Team Data

## Problem
LeaderboardPanel displays hardcoded placeholder teams (Team A, B, C) instead of actual connected teams. Controller has no visibility into real game scores.

## Current State
- LeaderboardPanel: Hardcoded initial state with fake teams
- TeamManagementPanel: Already fetches real connected teams via GET_CONNECTED_TEAMS
- Backend: Supports GET_CONNECTED_TEAMS but doesn't provide scores
- Score broadcast: Host app can broadcast LEADERBOARD_UPDATE/SCORES but controller doesn't listen

## Solution Overview

### Phase 1: Implement Real-time Score Fetching (Backend)
1. **Extend GET_CONNECTED_TEAMS response** to include current scores
   - File: `electron/backend/server.js`
   - Modify the GET_CONNECTED_TEAMS handler to include score for each player
   - Return format: `{ id, deviceId, teamName, score, photoApprovedAt, timestamp }`

2. **Alternative: Add new GET_LEADERBOARD command** (optional, but cleaner)
   - Dedicated command for fetching leaderboard data
   - Returns array of teams sorted by score
   - More semantic and maintainable

**Recommendation**: Extend GET_CONNECTED_TEAMS with scores (simpler, reuses existing command)

### Phase 2: Update LeaderboardPanel to Fetch Real Data
1. **Replace hardcoded state** with empty initial state
2. **Add useEffect to fetch teams** on mount
   - Send ADMIN_COMMAND GET_CONNECTED_TEAMS to fetch initial team list
   - Convert backend response to LeaderboardEntry format
   - Sort by score descending, compute positions
3. **Add periodic refresh timer** (every 3 seconds)
   - Send GET_CONNECTED_TEAMS again to fetch updated scores
   - Update leaderboard state with new scores
   - Maintain position rankings
4. **Add message listener** for real-time broadcasts
   - Listen for LEADERBOARD_UPDATE/SCORES messages from host
   - Update immediately when scores change (instant feedback)
5. **Proper cleanup**
   - Clear timer on unmount
   - Remove event listener on unmount

### Phase 3: Ensure Score Broadcasts Reach Controller
- Verify host app broadcasts LEADERBOARD_UPDATE when scores change
- Ensure broadcast reaches all connected clients (including controllers)
- Current behavior: Player display already receives LEADERBOARD_UPDATE
- Need to: Confirm this also reaches controller devices or ensure it does

## Implementation Details

### Backend Changes (electron/backend/server.js)
In GET_CONNECTED_TEAMS handler, modify response to include scores:
```javascript
const teams = Array.from(networkPlayers.entries())
  .filter(([key, player]) => key !== adminDeviceId)
  .map(([key, player]) => ({
    id: key,
    deviceId: key,
    teamName: player.teamName,
    score: player.score || 0,  // ADD THIS LINE
    photoApprovedAt: player.photoApprovedAt,
    timestamp: player.timestamp,
    hasPhoto: !!player.teamPhoto
  }));
```

### Frontend Changes (src-player/src/components/HostTerminal/LeaderboardPanel.tsx)
1. Replace initial state:
   ```javascript
   const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
   ```

2. Add useEffect for fetching and periodic refresh:
   - Request GET_CONNECTED_TEAMS on mount
   - Set interval timer to refresh every 3 seconds
   - Add message listener for instant LEADERBOARD_UPDATE broadcasts
   - Cleanup timer and listener on unmount

3. Convert backend response to UI format:
   - Map teams to LeaderboardEntry shape
   - Sort by score descending
   - Assign position numbers (1, 2, 3...)

## Key Design Decisions

1. **Dual update strategy**: Periodic refresh (3s) + instant broadcasts
   - Periodic: Ensures fresh data even if broadcast missed
   - Broadcasts: Instant feedback when scores change on host
   - User won't see stale data

2. **Reuse GET_CONNECTED_TEAMS**: Don't create new command
   - Simpler implementation
   - Less backend code to maintain
   - Already works with TeamManagementPanel

3. **Controller updates independently**: Not tied to TeamManagementPanel
   - LeaderboardPanel has its own fetch/refresh logic
   - Both panels independently pull current state
   - More robust if one panel is hidden

## Files to Modify
1. **electron/backend/server.js** - Add score to GET_CONNECTED_TEAMS response
2. **src-player/src/components/HostTerminal/LeaderboardPanel.tsx** - Implement real-time fetching

## Success Criteria
- [ ] LeaderboardPanel shows actual connected teams (not Team A/B/C)
- [ ] Scores update every 3 seconds when controller is active
- [ ] Scores update instantly when host broadcasts LEADERBOARD_UPDATE
- [ ] Rankings are correct (sorted by score)
- [ ] Position numbers update correctly as scores change
- [ ] No memory leaks (timers and listeners cleaned up)
- [ ] Works when multiple teams are connected
- [ ] Works when teams disconnect (list updates)
