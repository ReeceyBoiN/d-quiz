# Team Photo Approval Loop Bug - Root Cause & Fix Plan

## Problem Summary
When a host approves a team photo, the photo keeps reappearing in the pending photos list in a loop, requiring repeated approvals. The approval action doesn't persist.

## Root Cause Analysis

### The Bug Flow
1. Team joins with a photo → photo shows as pending (`photoApprovedAt = null`)
2. Host clicks "Approve" in Team Photos popup → calls `approveTeam` with `isPhotoApproval: true`
3. Backend sets `finalPlayer.photoApprovedAt = Date.now()` (approval recorded)
4. **Team reconnects** (player device reconnects via WebSocket) → PLAYER_JOIN event fires
5. **CRITICAL BUG**: PLAYER_JOIN handler in `server.js` **unconditionally resets** `existingPlayer.photoApprovedAt = null`
6. Photo approval is lost, photo shows as pending again
7. Cycle repeats

### Why This Happens
The PLAYER_JOIN reconnection handler has this logic (line ~356-378 in `electron/backend/server.js`):
```javascript
if (existingPlayer?.approvedAt) {
  // ... player already approved ...
  // CRITICAL FIX: Reset photo approval for new photo submissions
  // Photo approval is per-photo, not per-team. Each new photo must start as pending.
  const oldPhotoApprovedAt = existingPlayer.photoApprovedAt;
  existingPlayer.photoApprovedAt = null;  // ← UNCONDITIONAL RESET
}
```

The **intent** was valid: photo approval is per-photo (each new photo should require re-approval). 

The **implementation** is flawed: it resets `photoApprovedAt` on **every reconnection**, not just when a new photo arrives. This means:
- Approved photo remains the same
- Player reconnects (normal WebSocket disconnect/reconnect cycle)
- Approval is wiped out
- Photo appears pending again

## Solution: Conditional Reset Based on Photo Content

### Recommended Fix
Modify the PLAYER_JOIN handler to only reset `photoApprovedAt` when there's an actual **new photo** (teamPhoto data changed), not on every reconnection.

**Logic:**
1. When existing player reconnects with same photo data → preserve `photoApprovedAt` (photo was already approved, hasn't changed)
2. When existing player sends a new/different photo → reset `photoApprovedAt` to null (new photo, needs re-approval)
3. Compare photo data using hash or length/timestamp to detect changes

### Implementation Strategy

#### Selected Approach: Hash-Based Detection ✓
- Compute a hash of the teamPhoto data when it's first received
- Store the hash alongside the approval timestamp
- On reconnection, compare hashes of old and new photos
- Only reset approval if hashes differ (indicating a new photo)

**Why this approach:**
- Robust: Handles any photo change (content, encoding, etc.)
- Reliable: Hash comparison is deterministic
- Maintains intent: New photos require re-approval; same photos stay approved across reconnections

### Files to Modify
1. **`electron/backend/server.js`** - PLAYER_JOIN handler (lines ~356-378)
   - Add logic to compare photos before resetting `photoApprovedAt`
   - Preserve approval if photo hasn't changed

### Key Implementation Details

**In PLAYER_JOIN handler, replace unconditional reset with hash-based comparison:**

1. **At top of server.js**, add crypto import:
```javascript
const crypto = require('crypto');

function hashPhotoData(photoData) {
  if (!photoData) return null;
  return crypto.createHash('sha256').update(photoData, 'binary').digest('hex');
}
```

2. **When storing photo on initial join or TEAM_PHOTO_UPDATE**, add:
```javascript
player.teamPhotoHash = hashPhotoData(player.teamPhoto);
```

3. **In PLAYER_JOIN handler, replace unconditional reset with:**
```javascript
if (existingPlayer?.approvedAt) {
  // ... existing code ...

  // Hash-based photo comparison
  const oldPhotoHash = existingPlayer.teamPhotoHash;
  const newPhotoHash = hashPhotoData(payload.teamPhoto);

  if (oldPhotoHash && newPhotoHash && oldPhotoHash === newPhotoHash) {
    // Photo unchanged → preserve approval status
    console.log('[PLAYER_JOIN] 📸 PRESERVED photoApprovedAt: Photo hash unchanged');
  } else {
    // Photo is new or missing → reset approval to pending
    existingPlayer.photoApprovedAt = null;
    existingPlayer.teamPhotoHash = newPhotoHash;
    console.log('[PLAYER_JOIN] 📸 RESET photoApprovedAt: New photo detected (hash changed)');
  }
}
```

4. **In TEAM_PHOTO_UPDATE handler**, ensure photo hash is updated:
```javascript
existingPlayer.teamPhotoHash = hashPhotoData(existingPlayer.teamPhoto);
```

### Testing Strategy
1. **Test 1**: Approve a photo, verify it doesn't show as pending
2. **Test 2**: Approve a photo, trigger reconnection (close/reopen player device), verify approval persists
3. **Test 3**: Approve a photo, send a new photo from same team, verify it shows as pending again
4. **Test 4**: Test with auto-approval OFF to ensure manual approvals work
5. **Test 5**: Test with auto-approval ON to ensure auto-approvals still work

### Related Code Areas to Review
- `handleApprovePhoto` in `BottomNavigation.tsx` - ensures `isPhotoApproval: true` is sent ✓ (working correctly)
- `approveTeam` in `server.js` - ensures `photoApprovedAt` is set correctly ✓ (working correctly)
- `getAllNetworkPlayers` in `server.js` - returns `photoApprovedAt` field ✓ (working correctly)
- `fetchPendingPhotos` in `BottomNavigation.tsx` - filters based on `photoApprovedAt` ✓ (working correctly)

## Expected Outcome
After fix:
- Host approves a photo → photo shows as approved
- Team reconnects → photo remains approved (since it's the same photo)
- Team submits a NEW photo → new photo shows as pending (needs re-approval)
- No more approval loop
- Both manual and auto-approval flows work correctly
