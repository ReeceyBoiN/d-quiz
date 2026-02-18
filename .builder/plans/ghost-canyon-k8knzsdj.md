# Plan: Fix Auto-Approved Photos Not Displaying in Team Info Tab

## Problem Summary
When a team photo is **auto-approved** (via auto-approval setting or initial team join), the photo does NOT display in the team's info tab (accessed by double-clicking the team). However, manually-approved photos display correctly.

**User Observation**: 
- Auto-approved photos: Team photo area shows blank/empty
- Manually-approved photos: Team photo area displays the photo correctly

## Root Cause Analysis

### Current Flow Breakdown

**Manual Approval Flow (WORKS)**:
1. Player uploads photo → TEAM_PHOTO_UPDATED event received
2. QuizHost clears existing photoUrl (shows pending)
3. BottomNavigation (admin) clicks Approve
4. BottomNavigation calls `api.network.approveTeam()`
5. BottomNavigation broadcasts `PHOTO_APPROVAL_UPDATED` event with photoUrl
6. QuizHost's PHOTO_APPROVAL_UPDATED listener receives event
7. setQuizzes() updates team.photoUrl in state
8. TeamWindow component re-renders and displays photo ✅

**Auto-Approval Flow (BROKEN)**:
1. Player uploads photo → TEAM_PHOTO_UPDATED event received
2. QuizHost clears existing photoUrl (shows pending)
3. Auto-approval logic triggers in handleNetworkTeamPhotoUpdated()
4. Calls handleApproveTeam(deviceId, teamName)
5. handleApproveTeam broadcasts PHOTO_APPROVAL_UPDATED event (line 1309-1317)
6. BUT: The photoUrl might not be correctly passed, or the listener doesn't receive it ❌
7. setQuizzes() is NOT called, photoUrl stays undefined
8. TeamWindow shows blank area

### Likely Issues to Investigate

1. **Broadcast timing**: The auto-approval flow calls handleApproveTeam() from within an async validateAndApprove() function. The broadcast happens inside handleApproveTeam(), but the photoUrl variable might be undefined or incorrectly passed.

2. **PhotoUrl availability in auto-approval path**: In handleApproveTeam(), the `teamPhoto` variable is fetched via IPC (`network/all-players`). For auto-approved photos during TEAM_PHOTO_UPDATED, this fetch might:
   - Not complete in time before broadcast
   - Return a different format than expected
   - Have the photo path in a different field (e.g., teamPhotoPending might contain the path as a string instead of URL)

3. **Listener registration timing**: The PHOTO_APPROVAL_UPDATED listener might not be properly listening when the auto-approval broadcast fires, or the event is being broadcast to the wrong channel.

4. **Photo path format mismatch**: The photoUrl being broadcast might not match what TeamWindow/ImageWithFallback expects (file:// URL format, encoding issues, etc.)

## Investigation & Fix Approach

### Step 1: Add Detailed Logging
Add logging in QuizHost's PHOTO_APPROVAL_UPDATED listener to verify:
- Whether the event is being received
- What photoUrl value is in the event
- Whether setQuizzes() is actually being called
- What value ends up in quizzes state

### Step 2: Verify handleApproveTeam Flow for Auto-Approval
Check that:
- The IPC call to get teamPhoto succeeds
- The broadcast happens with a valid photoUrl
- The broadcast reaches the listener on the same instance

### Step 3: Compare Manual vs Auto Broadcast
Trace through both flows to ensure:
- Same broadcastMessage() function is used
- Same event type ('PHOTO_APPROVAL_UPDATED')
- Same data structure is passed

### Step 4: Validate Photo URL Format
Ensure the photoUrl being broadcast:
- Is properly formatted as a file:// URL (ensureFileUrl conversion)
- Can be loaded by ImageWithFallback
- Matches the deviceId being set in quizzes

## Key Files to Review/Modify

1. **src/components/QuizHost.tsx** (PRIMARY)
   - Lines 1300-1325: PHOTO_APPROVAL_UPDATED broadcast in handleApproveTeam()
   - PHOTO_APPROVAL_UPDATED listener (useEffect with onNetworkMessage)
   - Verify the listener is properly subscribed and updates quizzes state

2. **src/components/TeamWindow.tsx** (DIAGNOSTIC)
   - Verify team.photoUrl prop is being received correctly
   - ImageWithFallback rendering logic

3. **src/network/wsHost.ts** (if accessible)
   - broadcastMessage() implementation
   - Verify the message is actually being broadcast and received

## Expected Outcome
After fixing:
- ✅ Auto-approved photos immediately appear in team info tab (when TeamWindow is opened)
- ✅ Photo displays correctly for both auto and manually-approved cases
- ✅ No regression in manual approval workflow
- ✅ Console logs clearly show PHOTO_APPROVAL_UPDATED being received and applied

## Testing Scenarios
1. Enable auto-approval, have team submit photo, double-click team → photo should display
2. Manually approve a photo, double-click team → photo should display (regression test)
3. Submit new photo when team already has approved photo → new photo should display after auto-approval
