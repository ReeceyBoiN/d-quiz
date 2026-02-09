# Photo Update Communication Plan

## Overview
Currently, team photos are only sent during initial PLAYER_JOIN. If a player updates their photo after connecting, that change is NOT communicated to the host. This plan implements live photo update messaging so changes are captured and handled by the approval workflow.

## User Requirement
When a player changes their photo after connecting:
1. The new photo must be communicated to the host app
2. If **auto-approval** is enabled in Team Photos settings → new photo auto-approves without re-triggering approval
3. If **manual approval** is required → team reverts to pending status and requires re-approval

## Current State
- ✅ Photo upload works locally (saved to player localStorage via usePlayerSettings)
- ❌ Photo changes after join are NOT sent to host
- ✅ TEAM_PHOTO_UPDATE message type EXISTS (declared but unused) in `src-player/src/types/network.ts`
- ✅ Backend has saveTeamPhotoToDisk() function ready to reuse
- ✅ Host approval workflow exists via IPC endpoints
- ❌ No mechanism to react to photo updates in real-time

## Implementation Approach

### Phase 1: Player App - Send Photo Updates
**File: `src-player/src/components/SettingsBar.tsx`**
- After photo upload completes (in reader.onload callback), send TEAM_PHOTO_UPDATE message to host
- Requires access to WebSocket → use context from App or useNetworkConnection hook
- Message payload:
  ```json
  {
    type: 'TEAM_PHOTO_UPDATE',
    playerId: string,
    deviceId: string,
    teamName: string,
    photoData: base64_string,
    timestamp: number
  }
  ```

**Implementation Strategy:**
- Option A (Preferred): Expose sendPhotoUpdate function via NetworkContext so SettingsBar can call it
- Option B: Pass onPhotoUpdate callback to SettingsBar component
- Includes enhanced logging to track when updates are sent

### Phase 2: Backend Server - Handle Photo Updates
**File: `electron/backend/server.js`**
- Add handler in `ws.on('message')` for `TEAM_PHOTO_UPDATE` message type
- Reuse existing `saveTeamPhotoToDisk(photoData, deviceId)` function
- Update `networkPlayers.get(deviceId).teamPhoto` with new path
- **Critical Logic**: Determine if photo update should trigger status change:
  - Check if team is already approved
  - Check auto-approval setting (will need to pass from host or store on backend)
  - If auto-approval enabled: keep status='approved', silently update photo
  - If auto-approval disabled: revert status='pending', require re-approval
- Broadcast TEAM_PHOTO_UPDATED message to all connected clients (host app)
- Include logging at each step (received, saved, updated status, broadcast)

### Phase 3: Host App - React to Photo Updates
**File: `src/components/QuizHost.tsx`**
- Register handler for TEAM_PHOTO_UPDATED message type in onNetworkMessage
- When photo update received:
  - If team is in quizzes (already approved): update teamPhoto in state
  - If team is pending: either auto-approve or keep pending (based on auto-approval setting)
  - Refresh Team Photos panel UI if open

**File: `src/components/BottomNavigation.tsx`**
- When TEAM_PHOTO_UPDATED message is received: trigger pendingPhotos refresh
- Allows host to see updated photo in Team Photos popup in real-time

**File: `src/network/wsHost.ts`**
- Add 'TEAM_PHOTO_UPDATE' to NetworkMessageType union
- Ensure message is properly typed and routed to QuizHost

### Phase 4: Auto-Approval Setting Integration
**Dependency**: The Team Photos tab must have an "auto-approval" toggle setting
- This setting should be stored and accessible to the backend
- Backend needs to know: when photo update arrives, should it auto-approve pending teams?
- Consider: 
  - Store setting in backend config/state
  - Pass setting value when needed
  - Or: Always require re-approval (simpler, but less user-friendly) and let host see + approve immediately in Team Photos popup

**Recommended Approach**: 
- If setting exists, use it to determine auto-approval behavior
- If setting doesn't exist yet, implement simpler version: photo updates always revert pending teams back to pending status (requires re-approval)

## Critical Files to Modify

1. **src-player/src/components/SettingsBar.tsx** - Add photo update message sending
2. **src-player/src/App.tsx** or new context - Expose sendPhotoUpdate or create helper
3. **electron/backend/server.js** - Add TEAM_PHOTO_UPDATE handler
4. **src/components/QuizHost.tsx** - Handle TEAM_PHOTO_UPDATED message
5. **src/components/BottomNavigation.tsx** - Refresh UI on photo update
6. **src/network/wsHost.ts** - Add TEAM_PHOTO_UPDATE to message types

## Message Flow Diagram

```
Player uploads photo change
    ↓
SettingsBar.handlePhotoUpload() sends TEAM_PHOTO_UPDATE
    ↓
Backend receives, saves file, updates networkPlayers
    ↓
Backend broadcasts TEAM_PHOTO_UPDATED to host
    ↓
Host receives, decides approval action:
  - If auto-approval ON: update photo + keep approved
  - If auto-approval OFF: revert to pending + show in Team Photos
    ↓
Host UI updates to show new photo
```

## Logging Strategy
Add detailed logging at each stage:
- Player: `[SettingsBar] Sending TEAM_PHOTO_UPDATE for team: ...`
- Backend: `[TEAM_PHOTO_UPDATE] Received update for device ${deviceId}`, `[TEAM_PHOTO_UPDATE] Saved new photo to ...`, `[TEAM_PHOTO_UPDATE] Broadcasting update to host`
- Host: `[QuizHost] TEAM_PHOTO_UPDATED received for team: ...`, `[QuizHost] Photo update action: (auto-approved|revert-to-pending)`

## Implementation Order
1. Backend: Add TEAM_PHOTO_UPDATE handler (simplest, no UI dependencies)
2. Player: Add photo update message sending
3. Host: Add listener and update logic
4. Test: Verify flow works end-to-end

## Success Criteria
- Player uploads photo change → message sent with logging
- Backend receives, saves photo → logging shows save location
- Host receives message → logging shows photo was updated
- If auto-approval enabled: photo updates silently without affecting approval status
- If manual approval: team reverts to pending, host sees in Team Photos tab
