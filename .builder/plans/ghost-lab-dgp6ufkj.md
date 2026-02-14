# Buzzer Selection Feature Implementation Plan

## Overview
Implement a mandatory buzzer selection system for teams connecting to the quiz. Teams will:
1. Select a buzzer audio file after entering their team name
2. Preview buzzers before selection (with play button)
3. Confirm their buzzer selection (modal popup)
4. See which buzzers other teams have selected (greyed out/disabled)
5. Change their buzzer anytime in player settings

The host will see all team buzzer selections in the existing "Buzzers" tab.

## Key Requirements
- Buzzers stored in: `C:\Users\windows1\Documents\GitHub\d-quiz\resources\sounds\Buzzers`
- Selection is mandatory before teams can participate
- Confirmation modal prevents accidental selection
- Preview functionality plays audio on player device
- Unavailable buzzers appear greyed out & disabled
- Host can see all selections in Buzzers management tab
- Selections reset each session (not persisted across sessions)
- Teams can change selection anytime in settings

## Architecture Decisions
1. **Message Flow**: Add new message types for buzzer sync between player → server → host
   - `PLAYER_BUZZ` or `PLAYER_SETTINGS_UPDATE`: player sends selected buzzer to server
   - Server broadcasts to host and other players
   
2. **State Management**:
   - Backend: Add `buzzerSound` field to networkPlayers map entries
   - Host: Update quizzes state with buzzer selection (already supports buzzerSound field)
   - Player: Store locally in usePlayerSettings hook
   
3. **Audio Serving**:
   - Create new backend endpoint `/api/buzzers` to list and serve buzzer files
   - Use existing `pathManager.ts` pattern to access buzzers folder
   - Return file list on player app startup or settings open
   
4. **UI Flow**:
   - Player sees buzzer list after entering team name (before approval screen or as part of approval)
   - Buzzer selection modal with preview buttons and confirm/cancel
   - Available buzzers clickable, unavailable ones greyed out
   - Settings bar updated to sync selection back to server

## Implementation Steps

### Phase 1: Backend Setup
1. Create backend API endpoint `/api/buzzers/list` to read buzzer folder and return available audio files
2. Update resource paths to include buzzers folder location
3. Serve buzzer audio files via `/api/buzzers/{filename}.mp3`

### Phase 2: Message Types & Server Handler
1. Add message type to `src/network/types.ts` and `src-player/src/types/network.ts`
   - Type: `PLAYER_BUZZ` with payload: `{ playerId, deviceId, buzzerSound, timestamp }`
2. Update `electron/backend/server.js` WebSocket handler:
   - Add handler for `PLAYER_BUZZ` message type
   - Update networkPlayers entry with buzzerSound
   - Broadcast `PLAYER_BUZZ` to host renderer and other approved players
3. Update networkPlayers initial entry to include `buzzerSound: null`

### Phase 3: Player App - Buzzer Selection UI
1. Create new component or modal for buzzer selection:
   - Show list of available buzzers from API `/api/buzzers/list`
   - Display greyed-out buzzers that other teams selected
   - Add preview button with audio playback for each buzzer
2. Add confirmation modal when buzzer is clicked:
   - Shows selected buzzer name
   - Play/preview button
   - "Confirm" and "Cancel" buttons
3. Update player flow (App.tsx):
   - After team name entry, show buzzer selection screen
   - Don't allow progression until buzzer is confirmed
4. Update SettingsBar component:
   - Fetch available buzzers from API
   - Allow changing buzzer selection with same confirmation modal
   - Send `PLAYER_BUZZ` message when confirmed

### Phase 4: Host App - Buzzer Management
1. Update QuizHost.tsx:
   - Add listener for `PLAYER_BUZZ` message
   - Update quizzes state with buzzer selection
2. Update existing Buzzers tab (bottom navigation):
   - Display all teams and their selected buzzers
   - Show which buzzers are available/unavailable
   - (Optional) Allow host to change team buzzer from this view
3. Ensure buzzer info displays in TeamWindow if host wants to manage per-team

### Phase 5: Audio Playback
1. Use existing `audioUtils.ts` playAudioFile or implement Web Audio approach
2. Player-side audio playback for preview (works on device, no server streaming needed initially)
3. Consider performance: cache buzzer list to avoid repeated API calls

### Phase 6: Testing & Edge Cases
1. Test empty buzzer folder (blank list)
2. Test with multiple buzzers
3. Test buzzer selection sync across multiple players
4. Verify greyed-out state updates in real-time as teams select
5. Test buzzer change from settings

## Files to Modify

### Backend (Electron)
- `electron/backend/server.js` - add PLAYER_BUZZ handler, broadcast logic
- `electron/main/main.js` - add IPC endpoints for buzzer operations if needed
- Create or update buzzer file serving (either in server.js or separate route handler)

### Shared Types
- `src/network/types.ts` - add PLAYER_BUZZ message type
- `src-player/src/types/network.ts` - add PLAYER_BUZZ message type

### Host App
- `src/components/QuizHost.tsx` - add PLAYER_BUZZ listener, update quizzes state
- `src/components/BuzzersManagement.tsx` or existing Buzzers tab - display selections
- `src/network/wsHost.ts` - if needed for new broadcast helper

### Player App
- `src-player/src/App.tsx` - integrate buzzer selection screen into flow
- `src-player/src/components/SettingsBar.tsx` - update buzzer UI, add send PLAYER_BUZZ logic
- `src-player/src/hooks/usePlayerSettings.ts` - update buzzerSound sync
- New component: `src-player/src/components/BuzzerSelectionModal.tsx` - confirmation modal

### Utilities
- `src/utils/pathManager.ts` - may need to add getBuzzersPath() helper
- `src/utils/audioUtils.ts` - verify audio playback helpers work for preview

## Data Flow Diagram

```
Player Device:
1. Team enters name → App.tsx handleTeamNameSubmit
2. Shows BuzzerSelectionModal (fetches list from /api/buzzers/list)
3. User selects buzzer (preview available)
4. Confirmation modal shows
5. User clicks Confirm → send PLAYER_BUZZ message via WebSocket
6. Receives PLAYER_BUZZ from other players, updates UI (greyed out)

Server (Electron Backend):
1. Receives PLAYER_BUZZ message
2. Updates networkPlayers[deviceId].buzzerSound
3. Broadcasts PLAYER_BUZZ to:
   - Host renderer (QuizHost)
   - All other approved players (SettingsBar receives update)

Host App:
1. Receives PLAYER_BUZZ message
2. Updates quizzes[i].buzzerSound
3. BuzzersManagement tab displays: Team Name → Selected Buzzer
4. Greyed out buzzers shown in management UI
```

## Important Notes
- Buzzer selection is mandatory (blocking UI flow)
- Selections reset each session (no persistence between sessions)
- Changes anytime feature means greying out updates dynamically as teams select
- The playback of buzzer audio should happen locally on the player device
- Use file paths properly (Windows paths need to be converted to file:// URLs for audio element)
- Consider performance: don't re-fetch buzzer list repeatedly

## Success Criteria
1. ✅ Teams cannot proceed after entering name without selecting buzzer
2. ✅ Buzzer list shows available files from Buzzers folder
3. ✅ Empty buzzer folder shows blank list
4. ✅ Preview button plays audio on player device
5. ✅ Confirmation modal prevents accidental selection
6. ✅ Selected buzzers greyed out for other players in real-time
7. ✅ Host sees all selections in Buzzers tab
8. ✅ Teams can change buzzer from settings anytime
9. ✅ Selection changes sync to all connected clients
