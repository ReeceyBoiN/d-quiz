# Device-to-Team Persistent Binding for Seamless Reconnection

## Problem Statement
When a player device connects, enters a team name, and then disconnects (network loss, app crash, page refresh, etc.), they must re-enter their team name upon reconnection. Currently, this results in:
- A brand new team being created (duplicate)
- Loss of all points and progress from the previous session
- Duplicate teams cluttering the host interface
- Poor user experience during typical network hiccups

## Root Cause Analysis
**Why duplicates are created:**
1. Player joins: `PLAYER_JOIN` sent with deviceId and team name
2. Host receives `PLAYER_JOIN` and creates a new team in `quizzes` (no check if deviceId already exists)
3. Player disconnects (network issue, page refresh, etc.)
4. Player reconnects and re-enters team name (now has different `playerId` due to app state reset)
5. Host sees new `playerId` → creates another team with same name
6. Result: duplicate teams, lost points

**Secondary issue:**
- Code inconsistency: Some places use `deviceId` as team ID, others use `playerId`, causing deduplication logic to fail

## Solution Overview
Implement persistent device-to-team binding using **server-side validation** as the primary mechanism:

1. **Server-Side**: Track approval status by `deviceId` - once approved, server knows this device is "bound" to a team
2. **Host-Side**: When receiving `PLAYER_JOIN`, check if `deviceId` already in `quizzes` (approved team) - if yes, update existing team instead of creating new
3. **Player-Side**: Smart fallback - if app state survives (WS reconnect without page refresh), auto-send `PLAYER_JOIN`; otherwise user re-enters name once and gets existing team back

## Why This Solution is Better Than Alternatives

### Why NOT pure localStorage-based approach:
- ❌ Incognito/private mode: localStorage cleared after session
- ❌ Browser cache clear: user loses binding, creates duplicate
- ❌ Multiple devices: requires app-level tracking
- ❌ Less secure: relies entirely on client-side storage

### Why this server-centric approach is best:
- ✅ Server is source of truth (approvedAt, approval status)
- ✅ Works across page refreshes (server remembers approved deviceIds)
- ✅ More secure (server validates, prevents hijacking)
- ✅ Handles incognito mode gracefully (user just re-enters once)
- ✅ No complex localStorage dependencies
- ✅ Simpler client logic (less chance of bugs)

## Implementation Details

### Architecture: Three-Layer Validation

1. **Server Layer** (`electron/backend/server.js`):
   - Track `approvedAt` timestamp when team is approved
   - When PLAYER_JOIN arrives, check if `deviceId` was previously approved
   - If yes: mark as "reconnection", update ws reference, allow team name change
   - If no: treat as new join

2. **Host Layer** (`src/components/QuizHost.tsx`):
   - Use consistent ID scheme: **always use `deviceId` as `team.id`**
   - When PLAYER_JOIN received, check: `quizzes.find(q => q.id === deviceId && q is approved)`
   - If found: update existing team (name, connection status) - **don't modify score**
   - If not found: add to pendingTeams or auto-approve (normal flow)

3. **Player Layer** (`src-player/src/App.tsx`):
   - On WS reconnect: if `teamName` is still in state (app not refreshed), auto-send PLAYER_JOIN
   - If page refreshed: teamName state is cleared, show TeamNameEntry
   - When TEAM_APPROVED: optionally cache team name in localStorage as hint for next session
   - When TEAM_DECLINED: clear cached data

### Expected User Experience

**Case 1: WiFi Drop (Common)**
1. Player answers question, submits answer
2. WiFi drops for 5 seconds
3. useNetworkConnection auto-reconnects
4. App still has teamName in state
5. Auto-sends PLAYER_JOIN with same deviceId and team name
6. Server sees deviceId was approved: treats as reconnection
7. Host finds team by deviceId, updates ws ref, marks connected
8. **Result**: Seamless, no duplicate team ✅

**Case 2: Page Refresh/Browser Close**
1. Player in approved state, exploring team settings
2. Accidentally refreshes page (or closes browser)
3. App re-mounts, teamName state cleared
4. App shows TeamNameEntry
5. Player re-enters team name "Alpha" (deviceId same from localStorage)
6. Server sees deviceId "Alpha" was approved: treats as reconnection
7. Host finds team by deviceId, updates existing team, keeps 100 points
8. **Result**: One-time re-entry, then seamless rejoin ✅

**Case 3: Host Deletes Team**
1. Player approved as "Team Alpha" (100 points), then disconnects
2. Host deletes "Team Alpha" from quizzes
3. Player reconnects, re-enters team name
4. Server: deviceId was approved ✓, but host has no team with this deviceId
5. Host treats as new team (fresh "Team Alpha", 0 points)
6. **Result**: Fresh start as requested ✅

**Case 4: Multiple Devices**
1. Player opens app on phone (deviceId_A) → "Team Alpha" (100 points)
2. Player later opens app on tablet (deviceId_B)
3. Different deviceIds, so they're separate teams
4. **Result**: Two "Team Alpha" entries per spec ✅

## Files to Modify

### Priority 1: Server Validation (Foundation)
**File: `/electron/backend/server.js` (lines ~107-120)**

**Current code problem:**
```javascript
networkPlayers.set(deviceId, {
  ws, playerId, teamName, status: 'pending',
  timestamp: Date.now(),
  teamPhoto: data.teamPhoto || null
});
// Broadcasts immediately without checking if deviceId was previously approved
```

**Changes:**
1. Add `approvedAt` field to track approval timestamps:
   ```javascript
   networkPlayers.set(deviceId, {
     ws, playerId, teamName, status: 'pending',
     approvedAt: null,  // Set when team is approved
     timestamp: Date.now(),
     teamPhoto: data.teamPhoto || null
   })
   ```

2. When PLAYER_JOIN arrives, check for prior approval:
   ```javascript
   const existingPlayer = networkPlayers.get(deviceId);
   if (existingPlayer?.approvedAt) {
     // Reconnection - allow team name update
     existingPlayer.teamName = data.teamName;
     existingPlayer.ws = ws; // Update WS reference
     existingPlayer.playerId = data.playerId;
     console.log(`[Reconnection] Device ${deviceId} rejoining, name: ${data.teamName}`);
   } else {
     // New join - treat normally
     networkPlayers.set(deviceId, { ... });
   }
   ```

3. When team is approved (via IPC approveTeam handler), set approvedAt:
   ```javascript
   // In approveTeam IPC handler:
   const player = networkPlayers.get(deviceId);
   if (player) {
     player.status = 'approved';
     player.approvedAt = Date.now();
   }
   ```

**Why:** Server becomes source of truth for approved teams. Future PLAYER_JOINs from same deviceId can be recognized as reconnections.

### Priority 2: Host Deduplication (Prevention)
**File: `/src/components/QuizHost.tsx`**

**Problem 1: ID inconsistency (lines ~2418-2438)**
```javascript
// Currently uses playerId as team.id:
const newTeam: Quiz = {
  id: playerId,  // ❌ WRONG - inconsistent with handleApproveTeam
  name: teamName,
  // ...
};
```

**Problem 2: Answer lookup by teamName (line ~2461)**
```javascript
const matchingQuiz = quizzes.find(q => q.name === teamName); // ❌ Unreliable
```

**Changes:**
1. Fix `handleNetworkPlayerJoin` to use `deviceId` consistently:
   ```javascript
   // Extract deviceId from data
   const { deviceId, playerId, teamName } = data;
   
   // Check if team with this deviceId already exists
   const existingTeam = quizzesRef.current.find(q => q.id === deviceId);
   
   if (existingTeam) {
     // Reconnection - update existing team
     setQuizzes(prev => prev.map(q => 
       q.id === deviceId 
         ? { ...q, name: teamName, disconnected: false }
         : q
     ));
   } else {
     // New team
     const newTeam: Quiz = {
       id: deviceId,  // ✅ Use deviceId consistently
       name: teamName,
       type: 'test',
       score: 0,
       icon: '📱',
     };
     setQuizzes(prev => [...prev, newTeam].sort((a, b) => (b.score || 0) - (a.score || 0)));
   }
   ```

2. Fix `handleNetworkPlayerAnswer` to lookup by `deviceId` first:
   ```javascript
   const deviceId = data.deviceId || data.playerId;
   const matchingQuiz = quizzes.find(q => q.id === deviceId) || quizzes.find(q => q.name === teamName);
   const teamId = matchingQuiz?.id || deviceId;
   ```

**Why:** Consistent ID scheme prevents duplicates; deduplication logic actually works.

### Priority 3: Smart Client-Side Fallback
**File: `/src-player/src/App.tsx`**

**Current behavior:**
- useNetworkConnection auto-reconnects WS
- But App doesn't auto-send PLAYER_JOIN on reconnect
- Forces user to re-enter team name every time

**Changes:**
1. Track when team has been approved:
   ```javascript
   const [isApproved, setIsApproved] = useState(false);
   
   // On receiving TEAM_APPROVED:
   setIsApproved(true);
   // Optionally cache for recovery: localStorage.setItem('popquiz_last_team_name', teamName);
   ```

2. When WS reconnects and app is still running, auto-send PLAYER_JOIN if approved:
   ```javascript
   // In useEffect that listens for WS connection:
   if (isConnected && isApproved && teamName && !isReEnteringTeamName) {
     // WS reconnected and we still have team info → auto-rejoin
     ws.send(JSON.stringify({
       type: 'PLAYER_JOIN',
       playerId,
       deviceId,
       teamName,
       timestamp: Date.now(),
       teamPhoto: settings.teamPhoto || null
     }));
   }
   ```

3. On page refresh, try to recover team name from localStorage:
   ```javascript
   useEffect(() => {
     const recoveredTeamName = localStorage.getItem('popquiz_last_team_name');
     if (recoveredTeamName && isConnected && !teamName) {
       // Show hint: "Rejoin as Team Alpha?" with ability to change
       setTeamName(recoveredTeamName);
       // Or show in TeamNameEntry as pre-filled with confidence
     }
   }, []);
   ```

**Why:** Handles common case (brief disconnects) seamlessly; graceful fallback for page refreshes.

### Priority 4: Optional UX Enhancement
**File: `/src-player/src/components/TeamNameEntry.tsx`** (optional)

**Change:**
- Add prop `suggestedTeamName?: string | null` (passed from App if localStorage had cached name)
- Show pre-filled value with message: "Rejoin as [name]?" letting user confirm or change

**Why:** Gives players visual confidence they're reconnecting, not creating new team.

## Implementation Order

1. **Server validation** - add `approvedAt` tracking, so host can recognize reconnections
2. **Host deduplication** - fix ID inconsistency, check deviceId before creating new team
3. **Client auto-rejoin** - detect WS reconnect while app is running, auto-send PLAYER_JOIN
4. **UX polish** - optional team name recovery and UI hints

## Testing Checklist

**Functional Tests:**
- [ ] Team joins and gets approved → no duplicate on same deviceId PLAYER_JOIN
- [ ] WS disconnects 10s, reconnects automatically → same team, score preserved
- [ ] Page refreshes → user re-enters name → joins existing team (not new team)
- [ ] Team deleted on host → player reconnects → new team with 0 points
- [ ] Two devices with same team name → separate teams (different deviceIds)
- [ ] PLAYER_ANSWER from reconnected device → correctly maps to existing team

**Edge Cases:**
- [ ] Rapid reconnects (WiFi on/off) → no duplicate teams
- [ ] Two tabs open simultaneously → both use same deviceId, second tab causes issue? (document behavior)
- [ ] Incognito mode → localStorage empty, but server still recognizes deviceId (if cleared then reopened)
- [ ] Browser crashes mid-PLAYER_JOIN → no orphaned pending teams

## Risk Assessment

**Low Risk Changes:**
- Server-side: Only adds fields, doesn't remove anything - backward compatible
- Host: Deduplication by deviceId won't affect existing approved teams
- Client: Auto-rejoin is opt-in (only if isApproved && teamName)

**Medium Risk Changes:**
- ID consistency fix: Changes `playerId` → `deviceId` as team.id in one place (handleNetworkPlayerJoin)
  - **Mitigation:** Add migration logic to ensure existing teams by playerId aren't lost
  - **Test:** Verify old teams still appear and score correctly

**Security Considerations:**
- ✅ Prevents duplicate teams via approval status check
- ✅ Server validates (not trusting client)
- ⚠️  TODO: Could add deviceId signature/hash to prevent spoofing (future enhancement)

## Why This Solution is Safe for Existing Features

1. **Score tracking**: Unchanged - still uses quizzes[].score
2. **Answer submission**: Fixed - now correctly maps by deviceId
3. **Broadcasting**: Unchanged - PLAYER_JOIN message still includes all data
4. **Approval workflow**: Unchanged - approveTeam IPC still works, just adds approvedAt timestamp
5. **Team deletion**: Unchanged - host can still delete teams, reconnections won't resurrect deleted teams
6. **Display modes**: Unchanged - all display types receive same team data
7. **Response timing**: Unchanged - timestamp calculation still the same
8. **External display**: Unchanged - host still sends same broadcast messages
