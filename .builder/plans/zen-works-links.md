# Plan: Fix Countdown Audio Loading - File Path Issue

## Problem
Countdown audio fails to load in the built application with error:
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
/C:/Users/windows1/Documents/PopQuiz/Resources/Sounds/Countdown/Countdown.wav:1
```

The audio works in dev server but fails in the actual application.

**Root Cause**: 
- Electron main process returns absolute Windows filesystem paths (e.g., `C:\Users\...\Documents\PopQuiz\Resources\Sounds`)
- countdownAudio.ts passes these raw paths to `new Audio(audioUrl)` 
- Browser treats filesystem paths as HTTP URLs, which fails with ERR_FILE_NOT_FOUND
- Paths need to be converted to `file://` URLs for browser Audio API to load them

## Solution
Convert filesystem paths to valid `file://` URLs in `src/utils/countdownAudio.ts`:

1. Add `pathToFileUrl()` helper function that:
   - Detects Windows absolute paths (C:\...) and Unix paths (/...)
   - Converts backslashes to forward slashes
   - Encodes spaces as %20
   - Returns `file:///` URLs for Windows, `file://` for Unix
   - Leaves relative paths and existing URLs unchanged

2. Update `getAudioUrl()` to:
   - Convert the path returned from `getCountdownAudioPath()` using `pathToFileUrl()`
   - Pass the converted file:// URL to `new Audio()`

3. Ensure fallback paths work (they're relative, so they pass through unchanged)

## Files to Modify
- `src/utils/countdownAudio.ts` - Add path conversion helper and use in getAudioUrl()

## Implementation Details

### Change 1: Add pathToFileUrl helper
Convert any filesystem path to a proper file:// URL that browsers can load.

### Change 2: Update getAudioUrl to use pathToFileUrl
After getting the path from Electron, convert it to a file:// URL before returning.

### Testing
- Verify countdown audio plays in quiz pack mode
- Verify countdown audio plays in on-the-spot mode (keypad, buzz-in, nearest wins)
- Verify fallback paths work in non-Electron environments
- Confirm no "Failed to load resource" errors in console

## Validation
- [ ] Audio file loads without "ERR_FILE_NOT_FOUND" error
- [ ] Countdown plays correctly (last N+1 seconds of audio based on timer duration)
- [ ] Works in all game modes (keypad, buzz-in, nearest wins, wheel spinner)
- [ ] Works in both dev server and built application
- [ ] Silent countdown option works
