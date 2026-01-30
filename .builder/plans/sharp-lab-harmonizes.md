# Plan: Debug and Fix Countdown Audio Loading Issue

## Problem Summary
Countdown audio files fail to load with `ERR_FILE_NOT_FOUND` error. Browser shows malformed path.
- Audio files are located at: `C:\PopQuiz\d-quiz\resorces\sounds\Countdown`
- This is a local file path that needs to be converted to `file://` URL for browser Audio API

## User Requirements
1. Audio files stay in `C:\PopQuiz\d-quiz\resorces\sounds\Countdown` (relative to app)
2. Future feature: Allow users to select different audio files at runtime
3. Must work across all game modes (keypad, buzz-in, nearest wins, wheel spinner)
4. Must be stable with no conflicts between game modes

## Root Cause Analysis
The `pathToFileUrl()` function is converting Windows filesystem paths to file:// URLs, but there's likely an issue with:
1. How `encodeURI()` handles the path
2. The final URL format not being compatible with browser Audio API
3. Possible path format issues from Electron

## Recommended Solution: OPTION A - Improve pathToFileUrl()

### Implementation Strategy
1. **Add comprehensive debug logging** in `countdownAudio.ts`:
   - Log raw path from `getCountdownAudioPath()`
   - Log after pathToFileUrl() conversion
   - Log the final URL passed to Audio()
   - Log any errors from Audio API

2. **Review and fix pathToFileUrl() function**:
   - Verify Windows paths use correct file:// format: `file:///C:/path/to/file`
   - Ensure proper URL encoding (especially for spaces)
   - Handle both Windows backslash and forward slash formats
   - Add comment documenting the expected behavior

3. **Test thoroughly**:
   - Verify audio plays in on-the-spot keypad mode
   - Verify audio plays in other game modes (buzz-in, nearest wins, wheel spinner)
   - Check that silent countdown also works
   - Verify fallback paths work in non-Electron environments

4. **Future-proof for audio selection**:
   - Current implementation already supports `isSilent` parameter
   - Structure allows easy extension for user-selected audio files
   - Logging will help debug audio selection issues later

## Files to Modify
- `src/utils/countdownAudio.ts`
  - Add detailed console logging for debugging
  - Verify/improve `pathToFileUrl()` logic
  - Ensure proper URL formation for Windows absolute paths

## Expected Outcome
- Countdown audio loads successfully without ERR_FILE_NOT_FOUND
- Works across all game modes without conflicts
- Logging helps diagnose any future audio-related issues
- Foundation is ready for future audio file selection feature
