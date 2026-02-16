# Team Photos Workflow Stabilization Plan

## Executive Summary
The team photos approval workflow suffers from multiple race conditions and state management issues causing:
- Visual flicker and UI instability
- Inconsistent approvals requiring 1-3 clicks instead of 1
- Excessive overlapping polling and state updates

**Root Cause**: `photoStatuses` is unconditionally reset to 'pending' on every fetch, overwriting the locally-set 'approved' status, causing the UI to flicker back and requiring re-clicks.

## Root Causes (Prioritized by Impact)

### 1. **CRITICAL: photoStatuses Reset on Every Fetch** 
- `fetchPendingPhotos()` unconditionally reinitializes photoStatuses to 'pending' for all devices (lines 601-606 in BottomNavigation.tsx)
- User clicks approve → `handleApprovePhoto` sets `photoStatuses[deviceId] = 'approved'`
- A scheduled fetch (300ms later, or triggered by events) runs `fetchPendingPhotos`, resetting status back to 'pending'
- UI flickers: approved → pending → requires another click
- **This is the PRIMARY cause of multi-click approval bug**

### 2. **Race Condition: Multiple Overlapping Scheduled Refreshes**
- TEAM_PHOTO_UPDATED → setTimeout(fetchPendingPhotos, 100ms)
- PLAYER_JOIN → setTimeout(fetchPendingPhotos, 150ms)
- Approve → setTimeout(fetchPendingPhotos, 300ms)
- Decline → setTimeout(fetchPendingPhotos, 800ms)
- Periodic polling → every 3000ms
- With only 200ms throttle, these create unpredictable overlapping fetches
- Frontend may see stale backend state

### 3. **Inconsistent IPC Response Shapes**
- `fetchPendingPhotos` expects response as `{ ok: true, data: [...] }` (line 561)
- Actual response might be raw array or differently wrapped
- If shape doesn't match, pendingPhotos doesn't update
- `handleApprovePhoto` accesses `approvalResponse?.photoApprovedAt` but response might be wrapped as `{ ok: true, data: { photoApprovedAt, ... } }`

### 4. **Aggressive 3-Second Polling Creates Race Windows**
- Too frequent for stable state management
- Increases chance of seeing transitional states
- High backend load

## Solution (6 Phases)

### Phase 1: Fix photoStatuses Merge Logic (CRITICAL)
**Objective**: Preserve approved/declined status across fetches instead of resetting

**Changes in fetchPendingPhotos**:
- Replace unconditional `setPhotoStatuses(statuses)` init (line 606)
- Use merge logic that only sets to 'pending' if status doesn't already exist:
```javascript
setPhotoStatuses(prev => {
  const newStatuses = { ...prev };
  dedupedPhotos.forEach(p => {
    if (!(p.deviceId in newStatuses)) {
      newStatuses[p.deviceId] = 'pending';
    }
  });
  // Clean up devices no longer in pending list
  Object.keys(newStatuses).forEach(id => {
    if (!dedupedPhotos.some(p => p.deviceId === id)) {
      delete newStatuses[id];
    }
  });
  return newStatuses;
});
```

**Impact**: Eliminates the multi-click bug immediately. Status persists across fetches.

### Phase 2: Consolidate Refresh Operations
**Objective**: Eliminate overlapping scheduled fetches

**Changes**:
1. Create single `schedulePhotoRefresh(delayMs = 300)` helper that:
   - Cancels previous timeout via `photoRefreshTimeoutRef`
   - Schedules new fetch with 300ms delay
   - Coalesces rapid events into single fetch

2. Replace all setTimeout refresh calls:
   - TEAM_PHOTO_UPDATED: `schedulePhotoRefresh(300)` (was 100ms)
   - PLAYER_JOIN: `schedulePhotoRefresh(300)` (was 150ms)
   - handleApprovePhoto: `schedulePhotoRefresh(300)` (already 300ms)
   - handleDeclinePhoto: `schedulePhotoRefresh(300)` (was 800ms)

3. Increase throttle window from 200ms to 400ms minimum in fetchPendingPhotos

**Impact**: Eliminates overlapping fetches, more predictable state updates.

### Phase 3: Normalize DeviceId Handling
**Objective**: Ensure consistent deviceId keys in dedup and status maps

**Changes**:
- In fetchPendingPhotos dedup step (lines 581-586): compute normalizedDeviceId once
- Store normalized ID in photo object: `photo.normalizedDeviceId = deviceId.trim()`
- When initializing photoStatuses, use `p.normalizedDeviceId` instead of `p.deviceId`
- In UI, render keys using normalizedDeviceId

**Impact**: Prevents deviceId mismatch bugs in status lookups.

### Phase 4: Normalize IPC Response Handling
**Objective**: Handle inconsistent response shapes gracefully

**Changes in fetchPendingPhotos**:
- Replace strict check: `result?.ok && Array.isArray(result.data)`
- With flexible parsing:
```javascript
let players = [];
if (Array.isArray(result)) {
  players = result;
} else if (result?.ok && Array.isArray(result.data)) {
  players = result.data;
} else if (result?.data && Array.isArray(result.data)) {
  players = result.data;
}
```

**In handleApprovePhoto**:
- Normalize response access: `approvalResponse?.data?.photoApprovedAt ?? approvalResponse?.photoApprovedAt`
- Or ensure main.js always returns flat structure

**Impact**: Robustness against response shape variations.

### Phase 5: Reduce Polling Aggressiveness
**Objective**: Lower backend load, reduce race windows

**Changes**:
- Increase polling interval from 3000ms to 10000ms in useEffect (line 903)
- Polling becomes safety net only; rely on event-driven refreshes for real-time updates

**Impact**: Less backend load, fewer overlapping operations.

### Phase 6: Optimize Approve Confirmation
**Objective**: Ensure approval response always provides complete information

**Changes in electron/main/main.js (network/approve-team handler)**:
- Always return consistent object shape:
```javascript
return {
  approved: boolean,
  photoApprovedAt: timestamp | null,
  photoUrl: string | null,
  timestamp: currentTime
};
```
- Even if approval partially failed, return complete structure so frontend code doesn't have to check multiple paths

**Impact**: Frontend can trust response structure and avoid fallback fetches.

## Expected Outcomes

**After Phase 1-2 (Quick Win)**:
- ✅ Single-click approval works consistently
- ✅ No visual flicker
- ✅ Pending photo updates without races
- ✅ Fewer re-renders

**After all phases**:
- ✅ Stable, robust photo approval workflow
- ✅ Reduced backend load
- ✅ Predictable state management

## Implementation Order

1. **Do First** (High Impact, Low Risk): Phase 1 + Phase 2
   - ~80 lines of code changes
   - Fixes the multi-click bug entirely
   
2. **Do Second** (Robustness): Phase 3 + Phase 4
   - ~50 lines of code changes
   - Handles edge cases

3. **Do Third** (Polish): Phase 5 + Phase 6
   - ~20 lines of code changes
   - Reduces backend load

## Key Code Locations

**src/components/BottomNavigation.tsx**:
- Lines 541-614 (fetchPendingPhotos): Merge photoStatuses logic, normalize deviceId
- Lines 616-712 (handleApprovePhoto): Use schedulePhotoRefresh
- Lines 743-876 (event handlers): Use schedulePhotoRefresh
- Lines 883-911 (polling interval): Change 3000 to 10000

**electron/main/main.js**:
- Lines 246-367 (network/approve-team): Ensure complete response structure

**electron/backend/server.js**:
- Lines 1300-1623 (approveTeam): Already correct, no changes needed
