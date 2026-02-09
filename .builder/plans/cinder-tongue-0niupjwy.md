# Photo Upload Debug - Comprehensive Logging Plan

## Current Status
✅ Player side: Photo successfully uploaded and sent in PLAYER_JOIN message (343,638 bytes)  
❓ Backend: Unknown if photo is being received/saved  
❓ Host: Unknown if it receives player data with photo

## Root Cause Analysis

The flow is:
1. Player uploads photo → Stored in localStorage + state
2. Player sends PLAYER_JOIN WebSocket message with photo (base64)
3. **Backend WebSocket handler receives PLAYER_JOIN** → Should save photo to disk, store in networkPlayers map
4. **Backend broadcasts PLAYER_JOIN back to host** as confirmation
5. **Host app receives PLAYER_JOIN message** from backend → Should show pending player
6. Host clicks "Approve Team"
7. **Backend approveTeam endpoint called** → Should retrieve saved photo path from networkPlayers
8. Host displays player with photo

## The Problem
Without backend electron logs, we need to verify at each step by adding logging that appears in accessible console outputs:
- Host browser console (for what host receives and broadcasts)
- Console logs that the user can capture

## Solution: Add Comprehensive Logging

### Part 1: Host App Logging
**File:** `src/components/QuizHost.tsx`

When host app receives `PLAYER_JOIN` from backend:
- Log: "Received PLAYER_JOIN from backend"
- Log: Player data including presence of teamPhoto
- Log: Is teamPhoto in the received message?

When displaying pending teams:
- Log: "Pending teams:", list with photo status for each
- Log when clicking approve/decline button

### Part 2: Backend Endpoint Logging  
**Files:** `electron/backend/endpoints/quizzes.js` and `electron/backend/server.js`

In `getAllNetworkPlayers()` or endpoints that read networkPlayers:
- Log: Current players in networkPlayers map
- Log: For each player, is teamPhoto field populated?
- Log: What's the value of teamPhoto (file path if exists)

In `approveTeam()` function:
- Log: Player being approved
- Log: Does player have teamPhoto in networkPlayers? What's the value?
- Log: The data being sent back to player (including photo)

## Expected Test Flow

1. Player uploads photo + submits team name "test"
2. **Check host app logs:**
   - Do we see "Received PLAYER_JOIN from backend"?
   - Does the message include teamPhoto field?
   - Host browser console should show: `[QuizHost] Player test joined with teamPhoto: true/false`

3. Host clicks "Approve Team"
4. **Check host app logs:**
   - Host console should show: `[QuizHost] Approving team with photo: [path or null]`
   - Backend endpoint logs should show: `[approveTeam] Player has photo saved at: [path]`

## Success Criteria

After adding logging:
- If logs show photo flowing through entire pipeline → issue is in display/reading of saved files
- If logs show photo stopping at backend → issue is in saveTeamPhotoToDisk function
- If logs show photo not reaching host app → issue is in backend broadcast or host message handler

## Files to Modify
1. `src/components/QuizHost.tsx` - Add logging when receiving PLAYER_JOIN and showing pending teams
2. `electron/backend/server.js` - Add logging to getAllNetworkPlayers, approveTeam, getPendingTeams
3. `electron/backend/endpoints/quizzes.js` - Add logging to any endpoints that return player data

## Implementation Notes
- Use console.log() for outputs that appear in browser console
- Add descriptive prefixes like [QuizHost], [BackendAPI], [PhotoDebug]
- Log both successful and failed cases
- Include data values, not just boolean flags
