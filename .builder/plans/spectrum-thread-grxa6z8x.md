# Fix Audio Sound Effects Not Triggering

## Problem Summary
Sound effects are not playing when "Reveal Answer" is triggered in either Quiz Pack or On The Spot modes, despite the code being correctly wired and executed.

## Root Causes Identified

### 1. **IPC Response Shape Mismatch (PRIMARY BUG)**
- **Location**: `src/utils/audioUtils.ts:18-24` (listAudioFiles function)
- **Issue**: The function assumes `window.api.files.listDirectory()` returns a simple array of filenames
- **Reality**: The Electron IPC wrapper returns `{ ok: true, data: { entries: [{name, path, isDirectory}, ...] } }`
- **Impact**: listAudioFiles returns an empty array, so no audio files are ever selected for playback
- **Evidence**:
  - electron/main/main.js:225-230 returns entries as objects with `{name, path, isDirectory}`
  - electron/ipcRouter.js wraps this as `{ok: true, data: result}`
  - fileBrowser.ts:76-79 correctly handles this format: `res.data.entries`
  - audioUtils incorrectly treats raw result as array

### 2. **Hard-Coded Paths with Typo and Wrong Location (SECONDARY BUG)**
- **Location**: `src/utils/audioUtils.ts:103-111` (playAppauseSound and playFailSound)
- **Current paths**:
  - `C:\PopQuiz\d-quiz\resorces\sounds\Applause` (typo: "resorces" → "resources")
  - `C:\PopQuiz\d-quiz\resorces\sounds\Fail Sounds`
- **Actual resource structure**: `Documents/PopQuiz/Resources/Sounds/` (per pathManager.ts)
- **Impact**: Even if file listing worked, these directories likely don't exist
- **Solution**: Use `pathManager.getSoundsPath()` which returns correct platform-specific path

### 3. **Function Name Typo**
- **Location**: `src/utils/audioUtils.ts:103` 
- **Issue**: Function named `playAppauseSound()` (should be `playApplauseSound()`)
- **Impact**: Minor but inconsistent with pathManager.getAppauseAudioPath() naming

### 4. **Case-Sensitive Answer Comparison (TERTIARY ISSUE)**
- **Location**: `src/components/KeypadInterface.tsx:1006-1010`
- **Issue**: Uses strict equality (===) for answer comparisons without normalization
- **Context**: QuizHost.tsx normalizes answers (toLowerCase, trim) but KeypadInterface doesn't
- **Risk**: Correct answers might not be detected if case/whitespace differs

## Solution Approach

### Step 1: Fix IPC Response Handling
**File**: `src/utils/audioUtils.ts:11-29`
- Import and use `listDirectory` helper from `src/utils/fileBrowser.ts`
- Parse IPC response correctly: extract `res.data.entries` array
- Map entry objects to file paths and filter for audio extensions

**Before**:
```typescript
const files = await window.api.files.listDirectory(folderPath);
return (files || []).filter((file: string) => {...});
```

**After**:
```typescript
const entries = await listDirectory(folderPath);
const audioFiles = entries
  .map(e => e.path)
  .filter(path => audioExtensions.some(ext => path.toLowerCase().endsWith(ext)));
return audioFiles;
```

### Step 2: Replace Hard-Coded Paths with Dynamic Resource Paths
**File**: `src/utils/audioUtils.ts:103-111`
- Import `getSoundsPath()` from pathManager
- Replace hard-coded paths with dynamic computation
- Make playAppauseSound and playFailSound async to support async pathManager calls

**Before**:
```typescript
export function playAppauseSound(): void {
  playRandomSound('C:\\PopQuiz\\d-quiz\\resorces\\sounds\\Applause', 1);
}
```

**After**:
```typescript
export async function playAppauseSound(): void {
  const soundsPath = await getSoundsPath();
  playRandomSound(`${soundsPath}/Applause`, 1);
}
```

### Step 3: Update Audio Playback Function (Optional Enhancement)
**File**: `src/utils/audioUtils.ts:44-60`
- Current pathToFileUrl is adequate for file:// URLs
- No change needed here unless CSP blocks playback
- If CSP issues occur, can be addressed separately via:
  - Reading file as blob via IPC → createObjectURL
  - OR adjusting CSP to allow file:// for media-src

### Step 4: Normalize Answer Comparisons in KeypadInterface (Optional)
**File**: `src/components/KeypadInterface.tsx:1004-1010`
- Add trim() and toLowerCase() normalization before comparison
- Match QuizHost.tsx behavior for consistency

### Step 5: Update Call Sites
**Files**: 
- `src/components/QuizHost.tsx:2624-2627`
- `src/components/KeypadInterface.tsx:1114-1117`
- Change calls from `playAppauseSound()` and `playFailSound()` to async awaits

**Before**:
```typescript
playAppauseSound();
```

**After**:
```typescript
playAppauseSound().catch(err => console.warn('Failed to play sound:', err));
```

## Expected Results After Fix
1. **handleRevealAnswer** will be called (already confirmed)
2. **listAudioFiles** will correctly receive and parse IPC response
3. **Audio files** from correct resource path will be discovered
4. **Sound will play** when Reveal Answer is triggered based on correct teams

## Testing Strategy
1. Open dev console (F12 → Console)
2. Trigger Reveal Answer with teams connected
3. Verify:
   - No console warnings about "Failed to list audio files"
   - Audio files are discovered from correct path
   - Sound plays with applause (teams correct) or fail sound (teams wrong)
4. Test both Quiz Pack mode and On The Spot (Keypad) mode

## Files to Modify
1. **src/utils/audioUtils.ts** - Fix IPC handling and paths (HIGH PRIORITY)
   - Line 11-29: Fix listAudioFiles() IPC response handling
   - Line 103-111: Use pathManager.getSoundsPath() instead of hard-coded paths
   - Add async/await support

2. **src/components/QuizHost.tsx** - Update call sites (MEDIUM)
   - Line 2624-2627: Handle async playAppauseSound/playFailSound

3. **src/components/KeypadInterface.tsx** - Update call sites (MEDIUM)
   - Line 1114-1117: Handle async playAppauseSound/playFailSound
   - Optional: Normalize answer comparisons at line 1006-1010

## Implementation Order
1. Fix audioUtils.ts (IPC handling + paths)
2. Update QuizHost.tsx call sites
3. Update KeypadInterface.tsx call sites
4. Test and verify sound playback

## Detailed Code Changes Reference
- IPC response format: electron/main/main.js:225-230
- Correct wrapper usage: src/utils/fileBrowser.ts:76-79
- Correct paths: src/utils/pathManager.ts (getSoundsPath, getAppauseAudioPath)
- Current buggy implementation: src/utils/audioUtils.ts
