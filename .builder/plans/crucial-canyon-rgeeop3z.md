# Implement Sound Effects for Reveal Answer Trigger

## Problem Statement
When "Reveal Answer" is triggered in either Quiz Pack mode or On The Spot keypad mode, the system should play audio feedback:
- **Applause sound** (random file from `C:\PopQuiz\d-quiz\resorces\sounds\Applause`) if ANY team answered correctly
- **Fail sound** (random file from `C:\PopQuiz\d-quiz\resorces\sounds\Fail Sounds`) if NO teams answered correctly

## Current State
1. **Quiz Pack Mode** (QuizHost.tsx):
   - `handleRevealAnswer()` at line 2507 determines if teams answered correctly
   - `teamsAnsweredCorrectly` state tracks this (line 475)
   - "Reveal Answer" button triggers via `onReveal()` callback (line 4053)

2. **On The Spot Mode** (KeypadInterface.tsx):
   - `handleRevealAnswer()` at line 984 determines correct teams
   - `onTeamsAnsweredCorrectly()` callback notifies parent of result (line 1564)
   - The handler already knows which teams answered correctly

## Solution Approach

### Step 1: Create Audio Utility with Electron IPC
Create `src/utils/audioUtils.ts` with:
- Function to use existing `window.api.files.listDirectory()` IPC to list audio files
- Function to select random file from returned list
- Function to play audio using Web Audio API or HTMLAudioElement
- Silent fallback if files can't be loaded (no error display)
- Handles Windows file paths correctly

### Step 2: Leverage Existing IPC
- Use existing `window.api.files.listDirectory(path)` from preload.js (line 38)
- No new IPC handlers needed - already available in the app
- Pass folder path: `C:\PopQuiz\d-quiz\resorces\sounds\Applause` or `C:\PopQuiz\d-quiz\resorces\sounds\Fail Sounds`

### Step 3: Integrate into Quiz Pack Mode
Modify `QuizHost.tsx`:
- Import audio utility
- Update `handleRevealAnswer()` to:
  - Check if `teamsAnsweredCorrectly` is true or false
  - Call audio utility with appropriate folder path
  - Play random sound file

### Step 4: Integrate into On The Spot Mode
Modify `KeypadInterface.tsx`:
- Import audio utility
- Update `handleRevealAnswer()` to:
  - Determine if any teams answered correctly (using correctTeamIds.length > 0)
  - Call audio utility with appropriate folder path
  - Play random sound file

## Key Integration Points
1. **QuizHost.tsx:2507** - `handleRevealAnswer()` for Quiz Pack mode
2. **KeypadInterface.tsx:984** - `handleRevealAnswer()` for On The Spot mode
3. Both handlers have access to correct team information

## Implementation Details
- Audio playback should be synchronous/fire-and-forget (no blocking)
- Play sound once per reveal (not looping)
- Handle missing files gracefully (silent fallback if audio can't load)
- Use absolute file paths: `C:\PopQuiz\d-quiz\resorces\sounds\Applause` and `C:\PopQuiz\d-quiz\resorces\sounds\Fail Sounds`
- Support both MP3 and WAV audio formats
- Use HTMLAudioElement or Web Audio API for playback (HTMLAudioElement is simpler and supports both formats)

## Files to Create/Modify
- **Create**: `src/utils/audioUtils.ts`
- **Modify**: `src/components/QuizHost.tsx` (handleRevealAnswer)
- **Modify**: `src/components/KeypadInterface.tsx` (handleRevealAnswer)
- **Create**: Backend route for file listing (if needed)
