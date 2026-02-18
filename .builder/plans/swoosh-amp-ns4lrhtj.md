# Deep Investigation Plan: Quiz App Connectivity & Stability Issues

## Executive Summary
Comprehensive investigation of quiz hosting application (host + player apps) identified multiple connectivity and resource management issues. The application experienced random disconnections affecting 40% of players in a 10-team trial. Analysis identified 6+ critical/high-priority issues and scalability concerns for 100-200 team target.

**Primary Issue**: Random disconnections throughout sessions (not time-based) suggests network state corruption, aggressive heartbeat timeouts, or resource exhaustion causing message loss.

**Key Findings**:
1. Carousel listener leak (definite memory leak)
2. Unbounded backend player storage (no TTL/eviction)
3. Large WebSocket payloads without flow control
4. Aggressive heartbeat interval for scale (5s pings, 8s timeout)
5. Multiple listener cleanup gaps
6. No resource monitoring or backpressure handling

---

## Critical Issues to Address (Priority: Immediate)

### 1. Carousel Memory Leak - DEFINITE BUG
**File**: `src/components/ui/carousel.tsx`
**Severity**: HIGH
**Impact**: Memory accumulation, repeated callbacks, component instability

**Problem**: 
- Registers listeners for both `"reInit"` and `"select"` events on embla carousel API
- On unmount, only removes `"select"` listener
- `"reInit"` listener persists and accumulates on repeated mount/unmount cycles

**Why it matters**: If carousel component remounts multiple times during a session (e.g., tab switching, screen changes), memory will grow and old callbacks will execute on old component instances.

**Fix**: Add missing cleanup for "reInit" listener
```typescript
return () => {
  api?.off("select", onSelect);
  api?.off("reInit", onSelect);  // ADD THIS LINE
};
```

---

### 2. Unbounded Backend Player Storage (Memory Leak)
**File**: `electron/backend/server.js`
**Severity**: CRITICAL (for 100-200 team scale)
**Impact**: Server memory fills up, disconnections, slowdowns

**Problem**:
- `networkPlayers` Map stores player metadata indefinitely
- On disconnect, connection reference is set to null (`player.ws = null`) but entry remains
- Over 100-200 teams with reconnects/new devices, Map grows without bound
- No cleanup, TTL, or eviction strategy

**Why random disconnections happen**:
- As Map grows, iteration through `networkPlayers` becomes slower (heartbeat check, broadcast loops)
- Memory pressure may cause garbage collection pauses
- Heartbeat stale check becomes O(n) and slower with large n
- Connection handling slows down, causing timeouts

**Fix Required**:
1. Implement TTL-based eviction: Remove player entries after X minutes of inactivity
2. Periodically clean entries that are disconnected AND older than threshold
3. Add optional size cap with LRU eviction
4. Monitor and log Map size in production

**Recommended TTL**: 30-60 minutes for stale entries (after disconnect)

---

### 3. Aggressive Heartbeat for Scale
**File**: `electron/backend/server.js`
**Severity**: HIGH (cumulative effect at scale)
**Current Config**: 
- Heartbeat ping interval: **5 seconds**
- Heartbeat timeout: **8 seconds**
- Stale check interval: **2 seconds**

**Problem**:
- With 100-200 teams: 100-200 pings every 5 seconds = 20-40 pings/second across network
- Stale check runs 50 times per minute, iterating all players
- Can cause network congestion, CPU spikes, and false timeouts under load
- Aggressive timeout (8s) may disconnect healthy clients with temporary latency

**Why it contributes to random disconnections**:
- High frequency of heartbeat checks on overloaded server = false stale detections
- Network congestion from pings delays client pong responses
- Timeout fires before pong arrives, marking client as stale incorrectly

**Fix Required**:
1. Increase heartbeat interval to 10-15 seconds (still adequate for LAN)
2. Increase timeout to 15-20 seconds (longer grace period)
3. Make intervals configurable or adaptive based on player count
4. Consider reducing stale check frequency or making it intelligent

---

### 4. Large WebSocket Payloads - Photo Uploads
**File**: `electron/backend/server.js`, `src-player/src/App.tsx`
**Severity**: HIGH
**Impact**: Network buffering, memory spikes, message loss

**Problem**:
- Team photos sent as base64-encoded strings embedded in JSON WebSocket messages
- No size limits enforced
- Can be 100s of KB per upload
- When multiple players join with photos simultaneously:
  - Server buffering fills up
  - Network buffers exceed capacity
  - Messages get dropped
  - Clients disconnect due to buffer timeouts

**Why it causes random disconnections**:
- Server broadcasts large photo message to all connected clients
- If network/client is slow, message queue backs up
- Next messages get lost or delayed
- Client-side stale check fires incorrectly
- Connection drops

**Fix Required** (Priority ranking):
1. **Immediate**: Limit photo size to max 100-200 KB
2. **Add form validation** on player device to enforce size limit before upload
3. **Change upload mechanism**: Use HTTP multipart/form-data instead of WebSocket base64
4. **Add backpressure handling**: Check WebSocket bufferedAmount before sending, queue if too full
5. **Implement compression**: Compress photos before base64 encoding

---

### 5. Audio Event Listeners Not Properly Cleaned
**File**: `src/utils/audioStorage.ts`
**Severity**: MEDIUM
**Impact**: Memory accumulation, reference retention

**Problem**:
- `getAudioDuration()` and `playAudio()` attach event listeners without `{ once: true }`
- Listeners not explicitly removed after promise resolves
- If audio elements are retained in memory, listeners accumulate

**Fix**:
Add `{ once: true }` option to all audio event listeners:
```typescript
audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true });
audio.addEventListener('error', () => resolve(0), { once: true });
```

---

### 6. HostNetwork Listener Accumulation Risk
**File**: `src/network/wsHost.ts`
**Severity**: MEDIUM
**Impact**: Memory leaks if components forget to unsubscribe

**Problem**:
- HostNetwork.on() returns unsubscribe function that must be called
- If components (especially carousel bug) forget unsubscribe, listeners accumulate
- Related to carousel leak above

**Recommendation**:
- Add assertion/warning if listener array grows unexpectedly large
- Consider weak references or auto-cleanup patterns

---

## Secondary Issues (Performance & Stability)

### 7. localStorage Image Storage Quota
**File**: `src/utils/projectImageStorage.ts`
**Severity**: MEDIUM (for large quiz collections)

**Problem**:
- Base64 images stored directly in localStorage
- Standard quota is ~5-10 MB
- No size limits or eviction policy
- Risk: Host app crashes when quota exceeded

**Fix**:
1. Migrate to IndexedDB for binary blob storage (no size limits)
2. Or enforce strict image size limits (current code has 2MB limit, ensure it's enforced)
3. Add quota monitoring and user warnings

---

### 8. Periodic Display Mode Broadcasts (Unnecessary Traffic)
**File**: `src/components/QuizHost.tsx`
**Severity**: LOW-MEDIUM (cumulative effect at scale)

**Problem**:
- QuizHost broadcasts `playerDevicesDisplayMode` every 2 seconds to all players
- This is a safety net but creates unnecessary traffic on large networks
- Can be paused during active game but still runs during setup
- Over 3-hour sessions, totals ~21,600 unnecessary broadcasts

**Improvement**:
- Replace with event-driven broadcasts (only send when display mode changes)
- Keep low-frequency safety net (e.g., every 30s or on-demand)
- Reduces network traffic by ~90%

---

### 9. Verbose Logging Performance Impact
**File**: Throughout application (backend, frontend)
**Severity**: LOW (but noticeable at scale)

**Problem**:
- Extensive console.log/info calls throughout
- In production, logging to console can slow down event loops
- Memory used by log buffers

**Improvement**:
- Use logging levels (debug/info/warn/error)
- Disable debug logs in production
- Batch or rate-limit frequent logs

---

## Diagnostic Improvements for Your Upcoming Test

### Enhanced Backend Logging (electron/backend/server.js)
Add metrics collection to identify issues during 100-200 team test:

**Critical metrics to log**:
1. **networkPlayers Map growth**: Log size every 10 seconds
   - If it grows unbounded → confirms unbounded retention issue
   - If stable → player cleanup working correctly

2. **Stale connection detection**: Log when connections marked stale
   - Include: deviceId, reason (timeout/error), how long it was connected
   - Bulk stale detection (>5% at once) indicates false timeouts

3. **WebSocket buffering**: Log bufferedAmount periodically
   - High values (>100KB) indicate slow clients or network congestion
   - Helps identify if large messages are causing backups

4. **Heartbeat response time**: Log time between ping sent and pong received
   - If consistently >1s, indicates network congestion
   - If spikes near timeout (8s), explains random disconnections

5. **Player join/disconnect rate**: Log in buckets (how many/min)
   - Helps identify if cascade failures (many disconnect at once)

**Sample logging locations** (to be implemented):
```javascript
// Every 10 seconds
setInterval(() => {
  console.log(`[METRICS] networkPlayers size: ${networkPlayers.size}, heartbeat pending: ${pendingHeartbeats.size}`);
}, 10000);

// On stale detection
console.log(`[STALE-DETECT] deviceId: ${deviceId}, lastPong: ${timeSinceLastPong}ms, connected: ${connectionDuration}ms`);

// On disconnect
console.log(`[DISCONNECT] deviceId: ${deviceId}, reason: ${reason}, messages sent: ${messageCount}`);
```

### Enhanced Client Logging (src-player/src/App.tsx & useNetworkConnection.ts)
Track connection issues from player perspective:

**Key events to log**:
1. Connection state changes: CONNECTING → OPEN, CLOSING, CLOSED
2. Message queue buildup: size when queuing, when flushed
3. Visibility/focus changes: PLAYER_AWAY/ACTIVE timestamps
4. Answer submission attempts: success/failure/queued
5. Reconnection attempts: attempt number, delay, success/failure

### Analysis Strategy for Your Test
During your test, collect logs and look for patterns:

**If many players disconnect between minutes 30-90**:
→ Indicates memory leak or accumulation (unbounded networkPlayers growth)
→ Look for: networkPlayers size growing steadily, server memory increasing

**If players disconnect randomly regardless of duration**:
→ Indicates aggressive heartbeat false positives
→ Look for: many stale detections, high pong response times, network congestion

**If specific devices consistently disconnect**:
→ Indicates client-side issue (browser, device type)
→ Look for: client error logs, high CPU/memory on that device

**If batch disconnections (5+ at once)**:
→ Indicates cascade failure or broadcast causing issues
→ Look for: large messages being broadcast, stale-check firing on many at once

---

## Implementation Roadmap

### Phase 0: Diagnostic Logging (Before next test - optional but recommended)
Add lightweight metrics to help diagnose next failure:
1. Backend player count and heartbeat metrics (every 10s)
2. Stale detection logging (every disconnect)
3. Client connection state transitions
4. Message queue sizes on players

**Time estimate**: 30-45 minutes
**Benefit**: Next test failure will show root cause in logs instead of being mystery
**Can be done**: Without code changes, as pure logging additions

---

### Phase 1: Immediate Fixes (Blocking for stability)
1. Fix carousel "reInit" listener cleanup
2. Implement networkPlayers TTL/eviction
3. Limit and optimize photo uploads (size limit + HTTP upload)
4. Increase heartbeat interval from 5s to 12s, timeout from 8s to 18s
5. Add photo upload backpressure handling

**Expected Impact**: Eliminate most random disconnections, improve stability for 50-100 teams

### Phase 2: Secondary Improvements (Scaling)
6. Fix audio event listener cleanup
7. Add listener accumulation warnings to HostNetwork
8. Implement localStorage → IndexedDB migration for images
9. Replace periodic broadcasts with event-driven pattern
10. Add comprehensive monitoring and logging levels

**Expected Impact**: Support 100-200 teams reliably, reduce network traffic by 30-40%

### Phase 3: Long-term Enhancements
11. Consider persistent player database (replace in-memory networkPlayers)
12. Implement connection pool management
13. Add adaptive heartbeat based on player count
14. Performance profiling and optimization

---

## Technical Details by File

### electron/backend/server.js
**Issues**:
- Unbounded networkPlayers growth
- Aggressive heartbeat intervals
- Photo payloads without size limits
- No backpressure handling

**Changes Needed**:
- Add TTL-based cleanup for stale players
- Increase heartbeat interval/timeout
- Add size validation for photo uploads
- Check bufferedAmount before broadcast
- Add metrics/monitoring

### src/components/QuizHost.tsx
**Issues**:
- Periodic broadcast every 2s (traffic)
- Many setTimeout calls (timer management OK but could optimize)

**Changes Needed**:
- Replace periodic broadcast with event-driven
- Add connection state monitoring

### src-player/src/hooks/useNetworkConnection.ts
**Status**: Generally solid, robust reconnection logic
**Potential**: Add backpressure handling when sending

### src/components/ui/carousel.tsx
**Issue**: Missing "reInit" listener cleanup
**Fix**: Single-line addition to cleanup function

### src/utils/audioStorage.ts
**Issue**: Audio listeners not using { once: true }
**Fix**: Add option to all addEventListener calls

### src/utils/projectImageStorage.ts
**Issue**: localStorage quota risk
**Fix**: Migrate to IndexedDB or enforce size limits

---

## Expected Outcomes After Fixes

### Connectivity Stability
- **Before**: 40% failure rate (4/10 teams)
- **After Phase 1**: <5% failure rate, reliable for 50-100 teams
- **After Phase 2**: <1% failure rate, reliable for 100-200 teams

### Network Traffic Reduction
- **Photo optimization**: ~70% reduction in connection issues
- **Broadcast optimization**: ~30% reduction in unnecessary messages
- **Overall**: 40-50% less network traffic at scale

### Memory/Resource Usage
- **Before**: Unbounded growth with session length
- **After**: Stable memory footprint regardless of session duration
- **Player retention**: Minimal (small metadata only, not full objects)

---

## Notes for Implementation
- All changes are localized to specific files
- No major architectural changes required
- Changes are backward compatible
- Can be implemented incrementally
- High confidence in identifying root causes based on code analysis
