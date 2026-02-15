# UX Improvement: Show Default Buzzer Folder Path & File Dialog Hint

## User Request
Improve the buzzer folder selection UX by:
1. Show the actual filepath of the default buzzer folder (instead of "using default buzzers folder")
2. When file explorer dialog opens, start in the default buzzer folder location (hints to users where to put custom buzzers)

## Current State
- Default buzzer folder: `Documents/PopQuiz/Resources/Sounds/Buzzers`
- Composed from: `getResourcePaths().sounds + 'Buzzers'` (electron/utils/buzzerConfig.js)
- File dialog opens with no default directory hint
- UI shows generic text "Using default buzzers folder" with no filepath

## Recommended Approach

### 1. Create IPC Endpoint to Expose Default Buzzer Path
**File**: `electron/main/main.js`
- Add new IPC route: `files/get-default-buzzer-path`
- Returns the full path to the default buzzer folder
- Call `getDefaultBuzzerFolder()` from buzzerConfig.js

### 2. Expose via Preload API
**File**: `electron/preload/preload.js`
- Add to `window.api.files` object:
  - `getDefaultBuzzerPath: () => invoke('files/get-default-buzzer-path')`

### 3. Update File Dialog to Start in Default Path
**File**: `electron/ipc/handlers/buzzerHandler.js`
- Modify `handleSelectBuzzerFolder()` to use default buzzer path as starting directory
- Get default buzzer path via `getDefaultBuzzerFolder()`
- Pass as `defaultPath` to `dialog.showOpenDialog()` options
- This opens the file dialog starting in the buzzers folder (hints to user where to put custom buzzers)

### 4. Update Frontend to Show Relative Path Format
**Files**: `src/components/Settings.tsx` and `src/components/BuzzersManagement.tsx`

**Path Display Format**: Show as relative path from Documents
- Example: `Documents\PopQuiz\Resources\Sounds\Buzzers`

**In BuzzersManagement.tsx**:
- Add state: `defaultBuzzerPath` (loaded on mount via IPC)
- When no custom folder selected, display:
  - "Using default: Documents\PopQuiz\Resources\Sounds\Buzzers"
- Parse the full path returned from IPC to show relative format

**In Settings.tsx**:
- Same implementation
- Keeps both UI entry points consistent

### 5. User Experience Flow
1. User clicks "Select Folder" button
2. File explorer opens in `Documents/PopQuiz/Resources/Sounds/Buzzers` folder
3. User sees this is the "default" location and can:
   - Browse to a subfolder within Buzzers for custom buzzers
   - Navigate elsewhere if they have a different custom location
4. When no custom folder selected, UI shows:
   - "Using default: Documents\PopQuiz\Resources\Sounds\Buzzers"
5. When custom folder selected, displays that path instead

## Implementation Steps

1. Add `files/get-default-buzzer-path` IPC endpoint in main.js
2. Update preload.js to expose via `window.api.files.getDefaultBuzzerPath()`
3. Modify buzzerHandler.js to use default path as dialog starting point
4. Update Settings.tsx to fetch and display default buzzer path
5. Update BuzzersManagement.tsx to fetch and display default buzzer path
6. Test both UI entry points show path and file dialog starts in correct location

## Files to Modify
- electron/main/main.js (add IPC endpoint)
- electron/preload/preload.js (expose API)
- electron/ipc/handlers/buzzerHandler.js (file dialog default path)
- src/components/Settings.tsx (show path + load default)
- src/components/BuzzersManagement.tsx (show path + load default)

## Technical Details
- Default path is obtained from: `getDefaultBuzzerFolder()` (electron/utils/buzzerConfig.js)
- This evaluates to: `path.join(getResourcePaths().sounds, 'Buzzers')`
- Which resolves to: `Documents/PopQuiz/Resources/Sounds/Buzzers`
- Can be displayed as Windows or Unix format depending on platform
