# Team Photo Submission Issue - Diagnosis and Fix Plan

## Problem Summary
Team photos uploaded by players are not appearing in the host application's "Team Photos" tab or in the team detail view (double-click on team in team list). However, photos DO show locally on the player device, indicating the local upload is working. The issue is in the network transmission from player device to host.

## Expected User Flow
1. Player uploads team photo on player device → photo displays locally on player device ✅ (WORKING)
2. Photo is transmitted to host app via WebSocket/network
3. Host receives photo and can see it in "Team Photos" tab for approval ❌ (NOT WORKING)
4. If **auto-approve is ON**: photo displays on external display when that team answers fastest
5. If **auto-approve is OFF**: host manually approves/declines photo in Team Photos tab
6. Host can also see photo in team detail view (when double-clicking team in teams list)
7. On "Empty Lobby" button, session resets and all team photos are cleared

## Current Implementation (As Discovered)
### Player Side (src-player/)
- **Upload**: SettingsBar.tsx reads file as base64 via `FileReader.readAsDataURL()` and calls `updateTeamPhoto()`
- **Storage**: Photo stored in localStorage via usePlayerSettings.ts as `teamPhoto: string`
- **Transmission**: Photo included in PLAYER_JOIN message sent to host via WebSocket
- **Message format**: `{ type: 'PLAYER_JOIN', teamName, teamPhoto: base64String, ... }`
- **Status**: Photo shows on player device locally ✅

### Host/Server Side (electron/backend/)
- **Reception**: server.js WebSocket endpoint should receive PLAYER_JOIN and store photo in `networkPlayers` map
- **Storage**: `networkPlayers.set(deviceId, { ..., teamPhoto })`
- **Broadcast**: server.js includes teamPhoto in broadcasted PLAYER_JOIN message to other clients
- **IPC**: Host UI calls `network/all-players` to fetch stored player data including teamPhoto
- **Status**: NOT RECEIVING/SHOWING photos ❌

### Host UI Components Involved
- **Team Photos Tab**: Should display pending/approved photos for host to review (location: bottom navigation bar "Team Photos" tab)
- **Team Detail View**: When double-clicking team in teams list, should show team photo in placeholder box
- **External Display**: Should show team photo when team answers fastest (if auto-approve enabled)

## Key Files That Need Investigation
**Player Side:**
- src-player/src/components/SettingsBar.tsx (upload handler - working)
- src-player/src/hooks/usePlayerSettings.ts (storage - working)
- src-player/src/App.tsx (PLAYER_JOIN transmission - needs verification)

**Host/Server/UI:**
- electron/backend/server.js (WebSocket reception - needs verification)
- src/components/QuizHost.tsx (team approval logic)
- **Team Photos Tab Component** (needs to be found - displays pending photos) ⚠️
- Team detail view component (double-click behavior - needs to be found) ⚠️
- src/network/wsHost.ts (broadcast helpers)

## Most Likely Root Causes
1. **Server not receiving teamPhoto in PLAYER_JOIN**: WebSocket message arrives without teamPhoto field (player not sending it, or field is undefined)
2. **Server storing but not exposing**: Photo stored in networkPlayers but IPC endpoint 'network/all-players' not returning it
3. **Team Photos Tab not listening**: Host UI component for "Team Photos" tab not connected to receive/display pending photos from players
4. **Data validation issue**: teamPhoto field being rejected/filtered out somewhere in the pipeline

## Diagnostic Approach
### Phase 1: Verify Player Transmission
- Check if teamPhoto is actually included in PLAYER_JOIN payload sent by player
- Add logging to src-player/src/App.tsx to confirm teamPhoto is in the join message before sending
- Verify message is actually sent to WebSocket (check WebSocket status)

### Phase 2: Verify Server Reception
- Check server.js logs when PLAYER_JOIN is received - is teamPhoto field present?
- Add console.log in server.js when storing teamPhoto to networkPlayers
- Verify teamPhoto is successfully stored in memory

### Phase 3: Verify Host IPC Retrieval
- Check if IPC 'network/all-players' returns teamPhoto in player objects
- Add logging in QuizHost.tsx when fetching all-players to see what data is returned

### Phase 4: Verify Team Photos Tab
- Locate the Team Photos tab component
- Verify it's listening for new photos from server
- Check if it's supposed to listen to WebSocket messages or poll IPC

### Phase 5: Implement Fixes
Based on findings:
- Add missing console.log statements throughout the chain for debugging
- Ensure teamPhoto is properly included in PLAYER_JOIN before team name validation
- Ensure server properly stores and broadcasts teamPhoto
- Connect Team Photos tab to receive photo updates
- Add error handling for missing photos
- Possibly add photo size validation/compression before transmission

## Success Criteria
- Team photo selected on player device is transmitted to host via WebSocket
- Photo appears in host's "Team Photos" tab within seconds of upload
- Photo can be approved/declined by host in Team Photos tab
- Photo displays in team detail view (double-click team)
- Photo displays on external display when team answers fastest (if auto-approve ON)
- Console logs show photo being sent, received, and stored at each step
