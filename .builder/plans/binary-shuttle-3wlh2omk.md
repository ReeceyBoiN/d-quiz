# Music Round Feature - Implementation Plan

## Overview
Add a new "Music Round" game mode with a file browser UI that lets the host browse folders inside a `Documents/PopQuiz/Music Rounds/` directory. Users create sub-folders containing audio files (mp3, m4a, wav), then select a folder to "load" it as a music round. The UI follows the same layout pattern as other game modes (LeftSidebar + TopNav + StatusBar all remain visible).

## Architecture & Approach

The Music Round follows the exact same pattern as existing game modes (Keypad, Buzz-In, NearestWins, WheelSpinner):
- A boolean state `showMusicRoundInterface` in `QuizHost.tsx`
- A new `MusicRoundInterface` component rendered in `renderTabContent()`
- Integration with `closeAllGameModes()`, `getCurrentGameMode()`, and all related state management
- File system access via existing `fileBrowser.ts` utility + a new IPC route for the Music Rounds path

## Files to Modify

### 1. `electron/backend/pathInitializer.js`
- Add `'PopQuiz/Music Rounds'` to the `FOLDERS_TO_CREATE` array so the folder is auto-created on app startup

### 2. `electron/main/main.js`
- Add a new IPC route `files/music-rounds-path` (mirroring `files/question-packs-path`) that returns `Documents/PopQuiz/Music Rounds/` path, creating it if needed

### 3. `electron/preload/preload.js`
- Add `musicRoundsPath: () => invoke('files/music-rounds-path')` to the `files` API section
- Add `readFileAsBlob: (filePath) => invoke('files/read-file-as-blob', { path: filePath })` if not already present (for audio file reading)

### 4. `src/utils/fileBrowser.ts`
- Add a new `getMusicRoundsPath()` function mirroring `getQuestionPacksPath()` that calls the Electron API or falls back to browser virtual FS

### 5. `src/components/MusicRoundInterface.tsx` (NEW FILE)
- Main component for the Music Round mode
- **Left section**: Folder browser panel
  - Shows folders inside "Music Rounds" directory
  - Sorting options: Name / Newest / Oldest (radio buttons)
  - Click a folder to select it and show its audio files in the bottom pane
- **Right section**: Import panel with "Add Audio Files" button (opens file picker for mp3/m4a/wav)
- **Bottom section**: Shows contents of selected folder (audio files list)
- Style matching the attached reference screenshot (white panels, folder icons, sort options)
- Dark theme compatible using existing Tailwind/shadcn design tokens
- Includes a "Close" button to return to home
- When a folder is selected and loaded, it lists the audio files as the "round"

### 6. `src/components/QuizHost.tsx`
- Add state: `const [showMusicRoundInterface, setShowMusicRoundInterface] = useState(false);`
- Add `handleMusicRoundClick()` handler (follows pattern of handleWheelSpinnerClick)
- Add `handleMusicRoundClose()` handler  
- Update `closeAllGameModes()` to include `setShowMusicRoundInterface(false)`
- Update `getCurrentGameMode()` to include music round detection
- Add rendering in `renderTabContent()` for the music round interface
- Update the right panel visibility condition to hide when music round is active
- Pass `onMusicRoundClick` to `RightPanel`

### 7. `src/components/RightPanel.tsx`
- Accept `onMusicRoundClick` prop
- Wire up the existing "MUSIC ROUND" button (currently in "Coming Soon" section) to call this handler
- Move MUSIC ROUND button out of the "Coming Soon" section and into "GAME MODES" section (or a new section)

### 8. `src/components/BottomNavigation.tsx` (StatusBar)
- Add `showMusicRoundInterface` to props and game mode config panel conditions
- Ensure the status bar renders correctly when music round is active

## UI Design (matching reference screenshot)

The MusicRoundInterface will have:
```
┌──────────────────────────────────────────────────────┐
│  ┌─────────────────────┐  ┌─────────────────────────┐│
│  │ Select a folder      │  │ Import audio files      ││
│  │                      │  │                         ││
│  │ /Music Rounds/       │  │ [♪ Add Audio Files]     ││
│  │                      │  │ Browse your computer    ││
│  │ Order by:            │  │ for audio files         ││
│  │ ○ Name ○ Newest      │  │ (mp3, m4a or wav)       ││
│  │ ○ Oldest             │  │                         ││
│  │                      │  │                         ││
│  │ [folder list]        │  │                         ││
│  │                      │  │                         ││
│  └─────────────────────┘  └─────────────────────────┘│
│  ┌─────────────────────┐                             │
│  │ 📁 Selected folder   │                            │
│  │ [audio files list]   │                            │
│  │                      │                            │
│  └─────────────────────┘              [Close]        │
└──────────────────────────────────────────────────────┘
```

## Key Considerations
- The teams list (LeftSidebar) remains visible on the left as in all other modes
- TopNavigation and StatusBar (bottom) remain visible for consistency
- The RightPanel (mode selector) hides when music round is active (same as other modes)
- File operations use the existing `fileBrowser.ts` + Electron IPC pattern for cross-platform support
- Since we're running in a web preview (not Electron), the browser fallback in `fileBrowser.ts` will be used for development
