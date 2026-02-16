# Team Photos Auto-Approval Bug Fix & Orange Flash Indicator Plan

## Issue Confirmed

**Critical Bug:** When auto-approve is OFF, new team photos immediately appear as "approved" (not pending), even though the Approve/Decline buttons are available in the popup.

**Root Cause:** `photoApprovedAt` is being set to a timestamp during team approval for gameplay, despite the fix to only set it when `approvePhoto=true`.

---

## Tasks to Complete

### Task 1: Add Enhanced Logging to Find Where photoApprovedAt is Being Set

**Files to Modify:**
1. `electron/backend/server.js` - approveTeam() function
2. `src/components/BottomNavigation.tsx` - TEAM_PHOTO_UPDATED handler
3. `electron/main/main.js` - IPC route

**Logging to Add:**

**Backend (server.js):**
```
- Log the value of approvePhoto parameter received
- Log BEFORE setting photoApprovedAt: "About to set photoApprovedAt"
- Log AFTER: "photoApprovedAt now: {value}"
- Log in retry calls to confirm approvePhoto is preserved
```

**IPC Route (main.js):**
```
- Log the isPhotoApproval value from payload
- Log what gets passed to backend.approveTeam()
```

**Frontend (BottomNavigation.tsx):**
```
- Log the actual value of teamPhotosAutoApprove when TEAM_PHOTO_UPDATED arrives
- Log whether auto-approval condition is true/false
- Log what isPhotoApproval value is being passed to approveTeam call
```

---

### Task 2: Fix the Photo Approval Logic

**Suspected Issues:**
1. `photoApprovedAt` might be set somewhere in a retry path
2. Initial team approval might be passing `approvePhoto=true` by default
3. Race condition where approval happens before setting check

**Fix Strategy:**
1. Ensure `approvePhoto` parameter defaults to `false` everywhere
2. Only set `approvePhoto=true` in TWO places:
   - When manually approving photos (handleApprovePhoto)
   - When auto-approving photos (if setting is ON)
3. Verify retry calls preserve the `approvePhoto=false` state

---

### Task 3: Implement Orange Flash Indicator

**Status: Should work after Task 1 & 2 fixes**

Once photos correctly stay pending when auto-approve is OFF:
- The `hasPendingTeamPhotos` state will reflect the correct pending count
- The orange flash should activate automatically

**Verification:**
- When auto-approve OFF + photo submitted → button flashes orange
- When auto-approve ON + photo submitted → button does NOT flash (no pending)

---

### Task 4: Verify Complete Flow

Test scenarios after fixes:
1. Auto-approve OFF, submit photo → Pending, button flashes orange ✓
2. Auto-approve ON, submit photo → Auto-approved, no flash ✓
3. Toggle auto-approve while photos exist → State updates correctly ✓

---

## Implementation Approach

**Phase 1: Add Logging** (Non-breaking, debugging only)
- Add console.log and file logging in backend/IPC/frontend
- No behavior changes
- User provides new logs showing exact flow

**Phase 2: Fix Logic** (Once we understand the issue)
- Update backend/frontend to ensure photoApprovedAt only set when intentional
- Fix any conditional logic errors
- Ensure setting is properly respected

**Phase 3: Test & Verify** (Confirm fix works)
- Test both ON and OFF scenarios
- Verify orange flash works correctly
- Check for edge cases (rapid toggles, reconnects, etc.)

---

## Key Files to Modify

1. **electron/backend/server.js** - approveTeam() function (lines 1100-1378)
   - Add logging around photoApprovedAt assignment
   - Check all retry calls preserve approvePhoto flag

2. **electron/main/main.js** - network/approve-team route (lines 246-289)
   - Add logging of isPhotoApproval from payload
   - Log what's passed to backend

3. **src/components/BottomNavigation.tsx** - TEAM_PHOTO_UPDATED handler (lines 629-683)
   - Log teamPhotosAutoApprove value at handler execution
   - Log auto-approval decision and parameters

4. **src/components/BottomNavigation.tsx** - Team Photos button (lines 756-768)
   - Verify conditional `hasPendingTeamPhotos` is being used correctly
   - Confirm orange flash CSS is applied

---

## Next Step

1. Add detailed logging to trace where `photoApprovedAt` is being set
2. User provides updated logs from test scenario
3. Analyze logs to identify exact culprit
4. Fix the root cause
5. Verify orange flash indicator works correctly
