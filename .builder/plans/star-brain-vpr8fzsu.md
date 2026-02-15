# Buzzer Folder Selection Feature Plan

## Overview
Add functionality for the host to select and change the buzzer folder, with automatic synchronization to player devices. When the folder path changes, all team buzzer selections are cleared and players are redirected to the buzzer selection screen.

## Architecture Understanding

### Current System
- **Backend**: Electron app with Express server serving buzzers from hardcoded path: `Documents/PopQuiz/Resources/Sounds/Buzzers`
- **Host App**: React app with BuzzersManagement component for per-team buzzer selection
- **Player App**: React app with BuzzerSelectionModal for individual buzzer selection
- **Communication**: WebSocket-based messaging between host and players
- **Settings**: React Settings component with tabs (general, sounds, style-themes)

### Key Files
- **Backend**: `electron/backend/endpoints/sounds.js` (serves buzzers)
- **Backend**: `electron/backend/pathInitializer.js` (manages folder structure)
- **Backend**: `electron/backend/server.js` (WebSocket communication)
- **Host Settings**: `src/components/Settings.tsx` (Sounds tab has placeholder at line 903-907)
- **Host Buzzers**: `src/components/BuzzersManagement.tsx` (team buzzer selection)
- **Player**: `src-player/src/components/BuzzerSelectionModal.tsx` (player buzzer selection)
- **Player App**: `src-player/src/App.tsx` (main player logic)

## Implementation Steps

### Phase 1: Backend - Add Folder Selection & Configuration

#### 1.1 Create Configuration Management
- **File**: Create `electron/utils/buzzerConfig.js`
- Provides functions to:
  - Get current buzzer folder path from IPC request to React app (which stores in Settings Context)
  - Validate that folder exists and is readable
  - Initialize with default path (Documents/PopQuiz/Resources/Sounds/Buzzers)
  - Handle fallback to default if folder doesn't exist
- **Note**: Path is persisted in React's SettingsContext/localStorage, not in separate config file

#### 1.2 Create IPC Handler for Folder Selection
- **File**: Create `electron/ipc/handlers/buzzerHandler.js`
- Export function `handleSelectBuzzerFolder()`
  - Opens native file dialog (dialog.showOpenDialog with folder selection)
  - Allows browsing entire filesystem (no restrictions)
  - Validates selected directory is accessible
  - Returns selected path to React app
  - React app saves to SettingsContext (like other settings)
  - When saved, React broadcasts change to players via WebSocket

#### 1.3 Register IPC Handler
- **File**: `electron/main/main.js`
- Register new IPC handler: `buzzer:selectFolder`
- Hook this into electron ipcMain

#### 1.4 Update Sounds Endpoint
- **File**: `electron/backend/endpoints/sounds.js`
- Modify `/api/buzzers/list` endpoint:
  - Import buzzerConfig.js
  - Get current buzzer path from config instead of hardcoded path
  - Serve buzzers from configurable path
- Modify `/api/buzzers/:fileName` endpoint:
  - Same change - use configurable path instead of hardcoded

#### 1.5 Update Audio Handler
- **File**: `electron/ipc/handlers/audioHandler.js`
- Modify `handleGetBuzzerPath()`:
  - Import buzzerConfig.js
  - Get current buzzer path from config instead of hardcoded path

#### 1.6 Add WebSocket Broadcast for Folder Change
- **File**: `electron/backend/server.js`
- Add new message handler that listens for folder change events
- When folder changes, broadcast `BUZZERS_FOLDER_CHANGED` message to all connected players
- Include new folder path in broadcast (for display purposes on host side)

### Phase 2: Host App - UI & Folder Selection

#### 2.1 Implement Settings Sounds Tab Button
- **File**: `src/components/Settings.tsx` (update `renderSoundsSettings` function around line 756)
- Replace placeholder button (line 905-907) with functional implementation:
  - Call new IPC handler `window.electronAPI.selectBuzzerFolder()`
  - Display current selected folder path
  - Handle success/error responses
  - Show toast notification on successful change
  - Update displayed path dynamically

#### 2.2 Add Context/State for Buzzer Folder
- **File**: `src/utils/SettingsContext.tsx`
- Add to SettingsContextType:
  - `buzzerFolderPath: string` (default: Documents/PopQuiz/Resources/Sounds/Buzzers)
  - `updateBuzzerFolderPath: (path: string) => void`
- Add to localStorage persistence in `quizHostSettings` object (alongside other settings)
- Initialize with default path if not set
- When updated, automatically broadcast to all connected players via `BUZZERS_FOLDER_CHANGED` message

#### 2.3 Update BuzzersManagement Component
- **File**: `src/components/BuzzersManagement.tsx`
- Add folder info display section (where red box is in image):
  - Show current buzzer folder path from SettingsContext
  - Add button to change folder (calls same IPC handler as Settings)
  - When folder path changes:
    - Auto-refresh buzzer list (re-call getBuzzersList)
    - Clear all team buzzer selections with confirmation dialog
    - Show success toast notification

#### 2.4 Add Folder Change Warning
- **File**: `src/components/BuzzersManagement.tsx`
- Show AlertDialog before changing folder:
  - "Warning: Changing the buzzer folder will clear all team buzzer selections"
  - Players will be redirected to re-select buzzers
  - Require user confirmation

### Phase 3: Host App - Network Communication

#### 3.1 Broadcast Folder Change to Players
- **File**: `src/network/wsHost.ts` (or relevant network file)
- Create new function: `broadcastBuzzerFolderChange(folderPath: string)`
- Sends message type: `BUZZERS_FOLDER_CHANGED` with folder path

#### 3.2 Clear Team Selections When Folder Changes
- **File**: `src/components/BuzzersManagement.tsx`
- When folder selection succeeds:
  - Call API to get new buzzer list (should auto-refresh)
  - Clear all team's `buzzerSound` property
  - Broadcast change to players
  - Update UI to show empty selections

### Phase 4: Player App - React to Folder Changes

#### 4.1 Add Network Message Handler
- **File**: `src-player/src/App.tsx` (main connection/message handling)
- Listen for `BUZZERS_FOLDER_CHANGED` message from host
- When received:
  - Clear local `confirmedBuzzer` state
  - Clear `selectedBuzzers` in BuzzerSelectionModal
  - Clear `buzzerSound` from local settings/storage
  - Redirect to buzzer selection screen if not already there
  - Show notification: "Buzzer folder changed, please select your buzzer again"

#### 4.2 Auto-Reload Buzzer List
- **File**: `src-player/src/components/BuzzerSelectionModal.tsx`
- When modal opens after folder change, buzzer list should automatically reload
- Add visual indicator that buzzers have been refreshed

#### 4.3 Update Player Join Message
- Ensure `PLAYER_JOIN` message still includes `buzzerSound` correctly
- After folder change, buzzer should not be included until re-selected

### Phase 5: Security & Validation

#### 5.1 Path Validation
- **File**: `electron/utils/buzzerConfig.js` or `buzzerHandler.js`
- Validate selected folder:
  - Must exist and be readable
  - Must be accessible by the app
  - Reject if outside allowed locations (prevent security issues)

#### 5.2 Audio File Validation
- Maintain existing validation in both endpoints for audio file types
- Only serve .mp3, .wav, .ogg, .m4a, .flac, .webm files

## Data Flow

### Folder Selection Flow
1. Host clicks "Select Folder" in Settings > Sounds OR BuzzersManagement
2. IPC calls `buzzer:selectFolder` in Electron backend
3. Native file dialog opens (browser can't access filesystem directly)
4. User selects a folder from anywhere on system
5. Electron backend:
   - Validates folder is accessible
   - Returns path to React app
6. React host app:
   - Saves path to SettingsContext.buzzerFolderPath
   - localStorage persists the path in quizHostSettings
   - Displays new path in UI
   - Shows confirmation dialog before clearing team selections
   - Clears all team buzzer selections if user confirms
   - Refreshes buzzer list from new folder
   - Broadcasts `BUZZERS_FOLDER_CHANGED` message to all players via WebSocket
7. Player apps:
   - Receive `BUZZERS_FOLDER_CHANGED` WebSocket message
   - Clear confirmedBuzzer state
   - Auto-redirect to buzzer selection screen
   - Buzzer list auto-reloads from new folder on modal open

## Critical Considerations

### Stability
- localStorage persists buzzer folder path across app restarts
- Default path fallback if path is missing/corrupted/inaccessible
- Validate folder exists before trying to serve buzzers
- Use default folder if selected folder becomes unavailable

### Player Experience
- Clear notification message when folder changes
- Auto-redirect to buzzer selection (immediate, no confirmation needed)
- Buzzer list auto-reloads when modal opens
- No manual refresh needed from player perspective
- Path stored in application settings (same as other user preferences)

### Network Reliability
- If player doesn't receive folder change message:
  - Old buzzer path still works briefly (but returns empty list if folder doesn't exist)
  - When player tries to load buzzers, they get empty list
  - Player attempts auto-resync by requesting buzzer list again
  - This triggers reload of buzzers from current path
  - Can trigger manual buzzer reload via UI if needed

## File Summary

### New Files to Create
1. `electron/ipc/handlers/buzzerHandler.js` - IPC handler for folder selection dialog

### Files to Modify
1. `src/components/Settings.tsx` - Implement Sounds tab folder button with file dialog
2. `src/utils/SettingsContext.tsx` - Add buzzer folder path state and persistence
3. `src/components/BuzzersManagement.tsx` - Add folder display and change functionality
4. `electron/backend/endpoints/sounds.js` - Get path from SettingsContext instead of hardcoded
5. `electron/ipc/handlers/audioHandler.js` - Get path from SettingsContext instead of hardcoded
6. `electron/backend/server.js` - Add folder change broadcast handler
7. `electron/main/main.js` - Register buzzer folder selection IPC handler
8. `src-player/src/App.tsx` - Handle folder change WebSocket messages
9. `src-player/src/components/BuzzerSelectionModal.tsx` - Auto-reload on folder change

### Architecture Note
- Buzzer folder path stored in React SettingsContext/localStorage (same pattern as other settings)
- Electron backend accesses path via IPC call to get current value
- No separate config file needed - leverages existing settings infrastructure

## Testing Checklist
- [ ] Select folder from Settings > Sounds
- [ ] Folder path displays correctly in both Settings and BuzzersManagement
- [ ] Team selections clear when folder changes
- [ ] Players receive notification and redirect to buzzer selection
- [ ] New buzzer list loads correctly from new folder
- [ ] Invalid folder selection is rejected
- [ ] Path persists across app restart
- [ ] Players can re-select buzzers from new folder
- [ ] Original buzzers from old folder are no longer available
