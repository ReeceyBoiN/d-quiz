# Plan: Fix Auto-Approved Photos Not Being Assigned to Teams

## Problem
When team photos are auto-approved, they are not being assigned to the team's photo display. Manual approval works correctly because BottomNavigation broadcasts a `PHOTO_APPROVAL_UPDATED` event after approval. But auto-approval skips this broadcast, causing the photo URL to never reach the quizzes state.

## Root Cause
In `src/components/QuizHost.tsx`, the `handleApproveTeam` function:
1. Fetches the photo from the backend
2. Calls `api.network.approveTeam(...)` to approve it
3. Does NOT broadcast `PHOTO_APPROVAL_UPDATED` event
4. Relies on backend to emit the event over WebSocket (but this may not happen or be delayed)
5. Result: Photo URL is never assigned to the team in quizzes state

Meanwhile, BottomNavigation explicitly broadcasts the event after manual approval, which is why manual approval works.

## Solution Approach
After `handleApproveTeam` successfully approves a photo on the backend, broadcast the `PHOTO_APPROVAL_UPDATED` event locally (same as BottomNavigation does). This ensures the photo gets assigned to the team immediately in the quizzes state.

### Changes Required

#### `src/components/QuizHost.tsx` - `handleApproveTeam` function
After the backend approval succeeds (after `api.network.approveTeam` call):
1. Extract the photoUrl that was fetched earlier
2. If photoUrl exists, broadcast a `PHOTO_APPROVAL_UPDATED` event using the `broadcastMessage` function
3. Include the deviceId, teamName, photoUrl, and timestamp
4. This will trigger the same PHOTO_APPROVAL_UPDATED listener that handles manual approvals

**Key implementation detail:**
- Find the line where `api.network.approveTeam` is called
- After it succeeds, add code to broadcast the PHOTO_APPROVAL_UPDATED event
- Use the same broadcastMessage approach as BottomNavigation (import from '../network/wsHost')
- Include proper error handling

## Expected Outcome
✅ When a photo is auto-approved:
1. Photo is approved on the backend
2. `PHOTO_APPROVAL_UPDATED` event is broadcast locally
3. QuizHost's PHOTO_APPROVAL_UPDATED listener receives it
4. Photo URL is immediately assigned to the team in quizzes state
5. Photo appears on the host display without delay
6. Behavior matches manual approval flow

✅ No impact on manual approval (already works correctly)

## Files to Modify
- `src/components/QuizHost.tsx` - Add broadcastMessage call after backend approval in handleApproveTeam function

## Implementation Pattern to Follow
Match the pattern from BottomNavigation.tsx (lines ~741-852):
```typescript
if (photoUrl) {
  try {
    const { broadcastMessage } = await import('../network/wsHost');
    broadcastMessage({
      type: 'PHOTO_APPROVAL_UPDATED',
      data: {
        deviceId,
        teamName,
        photoUrl,
        timestamp: Date.now()
      }
    });
    console.log('[QuizHost] ✅ Broadcasted PHOTO_APPROVAL_UPDATED for auto-approved photo');
  } catch (err) {
    console.error('[QuizHost] Error broadcasting photo update:', err);
  }
}
```
