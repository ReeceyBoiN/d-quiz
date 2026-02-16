# Team Photos Tab Orange Flash Indicator - Investigation & Fix Plan

## Problem Statement
The team photos tab on the bottom navigation bar should display an orange flash/highlight when there are team photos waiting for approval. The user reports:
- **No orange flash appears** on the team photos tab when photos arrive
- Photos **DO appear** in the popup when manually opened
- This indicates the **data is correct but the visual indicator is not updating**

## Root Cause Analysis (Hypothesis)
Since photos show up in the popup when opened, we know:
1. Backend is correctly storing photos
2. IPC `network/all-players` endpoint works
3. The filter logic `teamPhoto && !photoApprovedAt` is correct
4. The issue is that `fetchPendingPhotos()` is **not being called** (or not being called at the right time) when a photo first arrives

### Why This Happens
Looking at the code flow:
- `fetchPendingPhotos()` is called on component mount (line 537)
- `fetchPendingPhotos()` is called when popup is opened (line 531)
- `fetchPendingPhotos()` is called when TEAM_PHOTO_UPDATED event arrives (line 685)

**The issue**: When a new team joins and uploads a photo before the quiz starts, the TEAM_PHOTO_UPDATED event may:
1. Not be broadcast by the backend (missing event)
2. Arrive too early before the component is fully mounted
3. Have the wrong data shape causing the event listener to fail

**Or**: The initial `fetchPendingPhotos()` on mount (line 537) may run before any players are connected, so it runs once and never updates again.

## Solution Approach
1. **Add more aggressive photo polling** - Instead of relying only on TEAM_PHOTO_UPDATED event, poll for pending photos more frequently when quiz is starting
2. **Ensure TEAM_PHOTO_UPDATED is broadcast** - Verify backend sends this event when photos arrive
3. **Call fetchPendingPhotos on quiz start** - Add a listener for quiz state changes to refresh photos
4. **Remove throttling** - The 500ms throttle may prevent rapid photo updates from being detected
5. **Add detailed logging** - Log each step to see where the flow breaks

## Key Files to Modify
1. **src/components/BottomNavigation.tsx**
   - Add quiz state tracking to trigger photo refresh when quiz starts
   - Consider reducing throttle window or removing for photo fetches
   - Ensure TEAM_PHOTO_UPDATED listener is properly registered

2. **src/components/QuizHost.tsx**
   - Trigger photo refresh when PLAYER_JOIN event arrives
   - Ensure this happens before quiz officially starts

3. **electron/backend/server.js**
   - Verify TEAM_PHOTO_UPDATED is broadcast on photo upload
   - Verify photoApprovedAt is properly set to null for new photos

## Success Criteria
- ✅ Orange flash appears immediately when team photo arrives
- ✅ Flash is visible even when popup is closed
- ✅ Flash updates correctly when photos are approved
- ✅ No performance degradation from more frequent polling
- ✅ Existing manual approval flow continues to work

## Investigation Order
1. Check if TEAM_PHOTO_UPDATED event is broadcast by backend
2. Verify BottomNavigation component receives the event
3. Add logging to track when fetchPendingPhotos is called
4. Test if calling fetchPendingPhotos manually from QuizHost fixes the issue
5. Implement permanent fix based on findings
