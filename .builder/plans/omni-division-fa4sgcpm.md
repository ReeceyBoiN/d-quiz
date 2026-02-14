# Fix Buzzer Audio Playback via Local File Paths (IPC)

## Problem
Audio playback fails in BuzzersManagement.tsx and TeamWindow.tsx with CSP error:
```
Refused to load media from 'http://172.20.10.2:4310/...' because it violates CSP directive
Note that 'media-src' was not explicitly set, so 'default-src' is used as a fallback.
```

Current code tries to load via HTTP backend (`http://172.20.10.2:4310/api/buzzers/...`) but CSP blocks it because `media-src` defaults to `default-src 'self'`.

## Solution Overview
Use **local file:// URLs via Electron IPC** for host app audio playback. This is more efficient than HTTP and avoids CSP issues since the file:// protocol is already allowed for local resources in Electron apps.

### Approach:
1. Add new IPC endpoint `audio/get-buzzer-path` to return the full file path for a buzzer
2. Update `src/utils/api.ts` to add `getBuzzerPath()` function that uses IPC
3. Update `src/components/BuzzersManagement.tsx` to use file:// URLs via IPC
4. Update `src/components/TeamWindow.tsx` to use file:// URLs via IPC
5. Handle CSP if needed (file:// should be allowed by default in Electron, but may need verification)

## Key Files to Modify

### 1. electron/ipc/handlers/audioHandler.ts (NEW)
- Create new handler with IPC route `audio/get-buzzer-path`
- Takes `{ buzzerName: string }` and returns `{ filePath: string }` or error
- Validates buzzer name (prevent path traversal)
- Returns full file path to the buzzer in Documents/PopQuiz/Resources/Sounds/Buzzers

### 2. electron/main/main.js
- Import audioHandler
- Mount the IPC router for audio endpoints (if not already done with generic router)

### 3. src/utils/api.ts
- Add new function `getBuzzerFilePath(buzzerSound: string)` that:
  - Calls `window.api.ipc.invoke('audio/get-buzzer-path', { buzzerName: buzzerSound })`
  - Returns the file path as a file:// URL using `pathToFileUrl()` helper
  - Falls back to HTTP URL if IPC fails (graceful degradation)
  - Includes console logging for debugging

### 4. src/components/BuzzersManagement.tsx
- Import `getBuzzerFilePath` from api.ts
- Modify `playBuzzerSound()` function:
  - Try to get file path via IPC using `getBuzzerFilePath()`
  - Use file:// URL if IPC succeeds
  - Fall back to HTTP URL if IPC fails
  - Keep existing error handling and logging

### 5. src/components/TeamWindow.tsx
- Same changes as BuzzersManagement.tsx for buzzer playback consistency

## Implementation Details

### IPC Handler Structure (audioHandler.ts)
```
- Function: handleGetBuzzerPath(buzzerName)
- Validation: Check buzzer name doesn't contain '..' or path separators
- Security: Verify resolved path is within Buzzers directory
- Return: { filePath: string } or throw error
```

### File URL Conversion
- Use existing `pathToFileUrl()` from `src/utils/audioUtils.ts` if available
- Or create helper: `const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')`

### Fallback Logic
```javascript
try {
  const filePath = await getBuzzerFilePath(buzzerSound);
  audioRef.current.src = filePath;  // file:// URL
} catch (error) {
  console.warn('IPC file path failed, falling back to HTTP', error);
  const audioUrl = getBuzzerUrl(hostInfo, buzzerSound);  // HTTP URL
  audioRef.current.src = audioUrl;
}
```

## Testing Checklist
- [ ] Verify IPC endpoint returns correct file path
- [ ] Verify file:// URL is formed correctly (file:///C:/Users/...)
- [ ] Test audio playback in BuzzersManagement "Play Buzzer" button
- [ ] Test audio playback in TeamWindow (if add play button there)
- [ ] Test buzzer selection dropdown in both components
- [ ] Verify no CSP errors in console
- [ ] Verify fallback to HTTP works if IPC fails
- [ ] Test path traversal protection (try malicious buzzer names)

## Expected Outcome
- Audio plays directly from host machine file system via file:// URLs
- No more CSP media-src errors
- More efficient than HTTP requests
- Graceful fallback to HTTP if IPC unavailable
- Secure path validation prevents access to files outside Buzzers directory
