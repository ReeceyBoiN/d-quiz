# Player Disconnect Detection Strategy

## Objective
Implement reliable player disconnection detection on the host app with 1-2 second responsiveness for mixed devices (phones, tablets, web browsers) on local WiFi/LAN.

## Current State Analysis

### What Works
- Players can **reconnect** - they send PLAYER_JOIN and host UI detects it
- Server has PLAYER_JOIN handler that maintains `networkPlayers` Map
- Host UI is ready to handle PLAYER_DISCONNECT events (has listener registered)
- TCP connection close handler exists on server but only logs, doesn't broadcast

### What's Missing
- **Server does not broadcast PLAYER_DISCONNECT on ws.on('close')**
  - Close handler exists at electron/backend/server.js but doesn't emit PLAYER_DISCONNECT
  - Without broadcast, host UI never gets disconnection events
- No heartbeat/keepalive mechanism for detecting flaky connections
- TCP close detection alone may be slow on WiFi (can take 15-30+ seconds)

## Recommended Approach: Server-to-Client Heartbeat

### Why This Approach
1. **Sub-second detection (1-2s)** - achieves your requirement
2. **Minimal network overhead** - 5-7 second intervals with ~50 bytes per ping
3. **Server-controlled** - battery efficient for mobile players
4. **Works on all devices** - WebSocket ping/pong is protocol-level, device-agnostic
5. **No accumulation logic needed** - simpler than client-side double-failure detection
6. **Handles flaky WiFi** - detects degraded connections before TCP timeout
7. **Efficient** - server controls cadence, can adjust based on load

### How It Works

**Flow:**
1. Server sends WebSocket PING frame every 5-7 seconds to each connected player
2. WebSocket protocol automatically responds with PONG (no player code needed)
3. Server tracks last PONG received timestamp for each player
4. If 2-3 seconds pass without PONG, server marks player as disconnected
5. Server broadcasts PLAYER_DISCONNECT message to host UI
6. Host UI marks team as grey (already implemented)
7. Detection window: ~2-3 seconds (meets your 1-2s target with network variance)

**Network Cost:**
- Current: No traffic when idle
- With heartbeat: ~1 ping every 5-7 seconds (50 bytes) = ~7-10 bytes/second per player
- 10 teams = 70-100 bytes/second total (negligible)

### Key Implementation Points

**File: electron/backend/server.js**

Two changes needed:

1. **Add heartbeat tracking per player:**
   - Add `lastPongAt` timestamp to networkPlayers entries (set on each PONG received)
   - Create periodic check (every 2-3 seconds) that iterates players and marks stale ones

2. **Handle close event properly:**
   - On `ws.on('close')`: broadcast PLAYER_DISCONNECT and clean up networkPlayers entry
   - Ensures immediate detection of hard closes

3. **Send heartbeat pings:**
   - Use `ws.ping()` or `ws.send()` with heartbeat message every 5-7 seconds
   - Track which players have responded

**Pseudo-code for server:**
```
// On player join - add lastPongAt
networkPlayers.set(deviceId, { 
  ws, 
  lastPongAt: Date.now(),  // NEW
  ...existing fields
});

// On ws.on('pong') or receive pong message
lastPongAt = Date.now();

// Periodic heartbeat check (every 2-3 sec)
setInterval(() => {
  networkPlayers.forEach((player, deviceId) => {
    if (Date.now() - player.lastPongAt > 3000) {  // 3 sec timeout
      // Mark as disconnected and broadcast
      broadcastMessage({ type: 'PLAYER_DISCONNECT', data: { deviceId } });
      networkPlayers.delete(deviceId);
    }
  });
}, 2000);

// Send ping to all players (every 5-7 sec)
setInterval(() => {
  networkPlayers.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.ping();  // Or custom heartbeat message
    }
  });
}, 6000);
```

**File: src/components/QuizHost.tsx**
- No changes needed - already has PLAYER_DISCONNECT handler

## Alternative: Simpler Approach (Not Recommended But Viable)

**Just broadcast on TCP close (Option A):**
- Only change: make server broadcast PLAYER_DISCONNECT in ws.on('close') handler
- Pros: Simple, one line of code
- Cons: Detection latency is 15-30+ seconds on WiFi (misses your 1-2s target)
- Would NOT meet your sub-second requirement

**Client Pinging (What You Suggested):**
- Player sends ping every X seconds, host marks as disconnected if 2 fail
- Pros: Simple, detects failures on host side
- Cons: Extra traffic, accumulation logic needed, battery drain on mobile, slower detection with double-failure wait
- Not ideal for mixed mobile/WiFi

## Trade-off Analysis

| Approach | Detection Speed | Network Cost | Complexity | Mobile Battery |
|----------|-----------------|--------------|------------|----------------|
| Heartbeat (Recommended) | 2-3 sec (1-2s goal met) | Minimal | Medium | Good |
| Client Ping (Your idea) | 10-15 sec (with 2x failure) | Moderate | Medium | Poor |
| TCP Close Only | 15-30 sec | None | Low | Good |
| Heartbeat + TCP Close | 2-3 sec | Minimal | Medium-High | Good |

## Files to Modify

1. **electron/backend/server.js** (PRIMARY)
   - Add `lastPongAt` tracking to networkPlayers entries
   - Add heartbeat sender (ping every 5-7 seconds)
   - Add disconnection checker (every 2-3 seconds)
   - Ensure ws.on('close') broadcasts PLAYER_DISCONNECT

2. **src/components/QuizHost.tsx** (NO CHANGE NEEDED)
   - Already has PLAYER_DISCONNECT handler that marks teams grey

## Implementation Strategy

**Phase 1: Immediate (High Impact, Low Effort)**
- Add PLAYER_DISCONNECT broadcast on TCP close in server
- This handles hard connection drops and cleanups immediately
- Can test right away

**Phase 2: Enhanced (Adds Sub-Second Detection)**
- Add server-side heartbeat mechanism
- Tune ping interval (5-7s) and timeout (2-3s) to hit your 1-2s goal
- Monitor network logs to ensure no excessive traffic

**Phase 3: Monitoring**
- Watch logs to see detection times in real conditions
- Adjust heartbeat interval if needed (can go faster without issue, only ~100 bytes/sec for 10 teams)
- Consider adding player-side logging to confirm PONG responses

## Expected Behavior After Implementation

1. **Player disconnects WiFi**: Server detects within 2-3 seconds, broadcasts PLAYER_DISCONNECT
2. **Team appears grey** in host's LeftSidebar with WifiOff icon
3. **Player reconnects**: Sends PLAYER_JOIN, server marks as active, team returns to normal color
4. **Hard close** (app crash): TCP close detected immediately or within heartbeat timeout
5. **Flaky WiFi**: Intermittent packets won't cause false positives (heartbeat is periodic)

## Recommended Decision
**Implement server-side heartbeat (Phase 1 + Phase 2)** because:
- Meets your 1-2 second detection target
- Handles mixed devices reliably
- Minimal network overhead
- Proactive approach before issues arise
- Can be adjusted post-launch if needed

If complexity is a concern, start with Phase 1 only (TCP close broadcast) and add heartbeat later if needed.
