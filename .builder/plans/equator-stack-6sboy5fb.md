# Player Connection Stability - Investigation & Fix Plan

## Current Status
✅ **Primary Issue RESOLVED**: Player successfully receives TEAM_APPROVED and transitions through screens
- Player enters team name → receives approval → transitions to approval screen → display screen
- WebSocket connection stays intact during team name entry (thanks to refs fix)

## Secondary Issue: INVESTIGATION COMPLETE ✓

### Critical Finding: Heartbeat Timing Bug is Root Cause
**The player disconnects every 5-7 seconds due to a heartbeat timeout configuration error:**

```
HEARTBEAT_INTERVAL = 6000 ms  (ping sent every 6 seconds)
HEARTBEAT_TIMEOUT = 3000 ms   (mark stale if no pong for 3 seconds)
STALE_CHECK_INTERVAL = 2000 ms (check every 2 seconds)
```

**The Problem**: TIMEOUT (3s) < INTERVAL (6s) = Race condition
- Stale checker runs every 2s and checks: `if (timeSinceLastPong > 3000ms)`
- But pings only sent every 6s
- Result: Between pings, the timer naturally hits 3s without a pong, causing false "stale" detection
- Player gets marked stale and disconnected even though connection is healthy
- Player reconnects, resends PLAYER_JOIN, gets re-approved, then same cycle repeats

**Evidence from Logs:**
```
[Player] ⚠️  [Player] Disconnected from host
[Player] Close code: 1000, Reason: Heartbeat timeout
[Player] 📍 [Player] Scheduling reconnect in 1000ms (attempt 1/15)
```
Pattern repeats every 5-7 seconds consistently.

### Secondary Issue: PLAYER_DISCONNECT Missing deviceId

**Root Cause**: Close handler at line 823 has a guard that skips disconnect broadcast if deviceId is falsy
```javascript
if (deviceId && networkPlayers.has(deviceId)) {  // Line 823
  // Only broadcasts if deviceId exists
  const disconnectMessage = JSON.stringify({
    type: 'PLAYER_DISCONNECT',
    data: { deviceId, playerId, teamName: player.teamName }
  });
}
```

**When deviceId is missing:**
- Socket closes before PLAYER_JOIN is received (no deviceId set in scope)
- Guard condition fails, disconnect not broadcast
- Host logs show: `PLAYER_DISCONNECT missing deviceId`
- Host UI warning appears (lines 2543-2545 of QuizHost.tsx)

**Additional Issue**: Duplicate disconnects possible
- Stale-check broadcasts PLAYER_DISCONNECT at lines 934-943
- Close handler also broadcasts at lines 828-846
- If stale-check calls `ws.close()`, both handlers can fire → duplicate messages

## Fix Strategy

### Fix 1: Correct Heartbeat Timing (HIGH PRIORITY - Fixes Main Issue)
**File**: `electron/backend/server.js` lines 99-101

Change from:
```javascript
const HEARTBEAT_INTERVAL = 6000;  // 6 seconds
const HEARTBEAT_TIMEOUT = 3000;   // 3 seconds (TOO SHORT!)
const STALE_CHECK_INTERVAL = 2000; // 2 seconds
```

Change to:
```javascript
const HEARTBEAT_INTERVAL = 5000;  // 5 seconds
const HEARTBEAT_TIMEOUT = 8000;   // 8 seconds (must be > INTERVAL)
const STALE_CHECK_INTERVAL = 2000; // 2 seconds (ok as-is)
```

**Rationale**: Timeout must be longer than the ping interval to avoid false positives

### Fix 2: Handle Missing deviceId in Close Handler
**File**: `electron/backend/server.js` lines 823-864

Current code:
```javascript
if (deviceId && networkPlayers.has(deviceId)) {
  // broadcasts disconnect...
}
// If no deviceId, broadcast is skipped - PROBLEM!
```

Fix options:
1. **Fallback to fallback identifier**: Broadcast with available data (playerId if present)
2. **Lookup by ws reference**: Search networkPlayers to find entry by ws reference when deviceId missing
3. **Track ws references**: Add reverse map of ws → deviceId for fast lookup

**Recommended**: Use fallback + optional lookup
- Always broadcast PLAYER_DISCONNECT with best available data
- Include playerId as backup identifier for host to track
- Host UI handles missing deviceId gracefully (currently logs warning and ignores)

### Fix 3: Prevent Duplicate Disconnects
**File**: `electron/backend/server.js` lines 924-963 (stale-check)

When stale-check calls `ws.close()`, the close handler will fire and broadcast again.

**Fix**: Add a flag or deduplication logic:
- Option A: Only broadcast disconnect in close handler, remove from stale-check
- Option B: Add `playerClosed` flag to player object to prevent double broadcast
- Option C: Remove the manual broadcast from stale-check since close handler will handle it

**Recommended**: Remove manual broadcast from stale-check (lines 934-955)
- Stale check still calls `ws.close()` 
- Close handler broadcasts the disconnect
- Simpler and more reliable

## Implementation Plan

### Phase 1: Fix Heartbeat Timing (5 minutes)
1. Open `electron/backend/server.js`
2. Update lines 99-101 with corrected timeout values
3. Test: Player should stay connected indefinitely without disconnects

### Phase 2: Fix Missing deviceId (10 minutes)
1. Modify close handler (lines 823-864) to handle missing deviceId
2. Add fallback broadcast with available identifiers
3. Test: Host should receive disconnect for all players (with deviceId or playerId)

### Phase 3: Remove Duplicate Disconnects (5 minutes)
1. Remove manual PLAYER_DISCONNECT broadcast from stale-check (lines 934-955)
2. Keep `ws.close()` call which triggers close handler
3. Test: No duplicate disconnect messages in host logs

## Expected Results After Fixes
✅ Player maintains continuous connection without timeout disconnections
✅ No more "Heartbeat timeout" errors
✅ No more frequent reconnection cycles
✅ PLAYER_DISCONNECT always includes proper identifiers
✅ No duplicate disconnect broadcasts
✅ Connection only breaks on actual network failure
✅ Player stays on display screen without interruption

## Files to Modify
- `electron/backend/server.js` (3 changes: heartbeat config, close handler, stale-check)

## Testing Checklist
- [ ] Start host app
- [ ] Connect player device
- [ ] Enter team name and get approved
- [ ] Player transitions to display screen
- [ ] Player stays connected for 5+ minutes without disconnect
- [ ] No "Heartbeat timeout" messages in logs
- [ ] Multiple players can connect simultaneously without issues
- [ ] Verify host receives clean PLAYER_DISCONNECT when manually disconnecting player
