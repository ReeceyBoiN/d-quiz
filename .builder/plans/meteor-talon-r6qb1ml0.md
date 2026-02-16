# Photo Auto-Approval Bug Fix Plan

## Root Cause Identified

**Issue:** After a team's first photo is manually approved (with auto-approve OFF), any subsequent photo submissions are immediately marked as approved, even though auto-approve is disabled.

**Root Cause:** In `electron/backend/server.js` PLAYER_JOIN reconnection handler (lines 356-385), the backend is NOT resetting `photoApprovedAt` when a player reconnects with a new photo. The old approval status from the previous photo persists and is carried over to the new photo.

**Evidence from logs:**
- After first photo manual approval: `Filtered to 0 pending photos` ✅
- Second photo submitted with auto-approve OFF: Frontend correctly shows `teamPhotosAutoApprove value: false` and doesn't auto-approve
- But backend still returns: `Filtered to 0 pending photos` ❌ - Photo should be pending!
- This happens because `photoApprovedAt` from the first photo was never reset during reconnection

## Solution

### Step 1: Fix Reconnection Handler in Backend
**File:** `electron/backend/server.js` (lines 356-385)

In the `existingPlayer?.approvedAt` branch:
- After updating `existingPlayer.lastPongAt = Date.now();`
- Add: `existingPlayer.photoApprovedAt = null;` 
- This resets photo approval status for new photo submissions while preserving team approval status

**Rationale:**
- Team approval (`approvedAt`) should persist across reconnections - player is still approved for gameplay
- Photo approval (`photoApprovedAt`) should NOT persist - each new photo is independent and should start as pending
- This maintains the separation between "team gameplay approval" and "photo approval"

### Step 2: Add Logging to Track the Fix
Add detailed logging around the reconnection handler:
- Log the OLD `photoApprovedAt` value before reset
- Log the NEW `photoApprovedAt` value after reset
- This ensures the fix is working and helps detect similar issues in future

### Step 3: Test the Fix
Verify the workflow:
1. Team joins and is auto-approved for gameplay (no photo approval needed yet)
2. Team submits first photo with auto-approve OFF
3. Photo shows as pending (button flashes orange)
4. Host manually approves photo
5. Photo no longer shows as pending
6. Team submits second photo with auto-approve still OFF
7. **Second photo should show as pending** ✅ (currently fails)
8. Team submits third photo with auto-approve ON
9. **Third photo should auto-approve** ✅

## Key Files to Modify
1. `electron/backend/server.js` - Fix reconnection handler lines 356-385

## Implementation Notes
- Very surgical fix - only affects reconnection handler
- Preserves all existing functionality
- No changes needed to frontend or IPC layer
- The logging we already added will confirm the fix works
