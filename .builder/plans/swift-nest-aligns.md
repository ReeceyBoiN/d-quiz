# Plan: Fix Audio Metadata Timeout Warning

## Problem Summary
The countdown audio is working correctly in all modes, but a warning is logged when audio metadata doesn't load within 2000ms:
```
[CountdownAudio] Audio metadata loading timed out after 2000ms
```

This happens because:
1. The audio metadata wait timeout **resolves** (continues) instead of rejecting when metadata doesn't load within 2000ms
2. When metadata doesn't load, `audio.duration` becomes `NaN`
3. Setting `audio.currentTime = NaN` is invalid
4. The audio still plays because the background load completes before `.play()` is called

## Root Causes Identified

### 1. **Timeout Resolves Instead of Rejecting**
- Line ~145: `setTimeout(() => { ... resolve(); }, 2000)`
- When the 2000ms timeout fires, it resolves the Promise anyway, allowing execution to continue
- This masks the fact that metadata didn't load properly

### 2. **NaN Duration Not Guarded**
- Line ~160: `const audioDuration = audio.duration;`
- When metadata hasn't loaded, `audio.duration` is `NaN`
- Line ~165: `const startTime = Math.max(0, audioDuration - (timerDuration + 1));`
- `Math.max(0, NaN - number)` = `NaN`
- Line ~168: `audio.currentTime = NaN;` ← Invalid, should prevent this

### 3. **Fallback Path Typo**
- Lines 6-7: `'../../resorces/...'` should be `'../../resources/...'`
- Typo prevents fallback from working correctly in non-Electron contexts

## Recommended Solution

### Fix #1: Guard Against NaN Duration (CRITICAL)
Add a validity check before computing startTime:
```typescript
// Safely handle cases where metadata didn't load (duration would be NaN)
const audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
```

This prevents attempting to set `currentTime = NaN` and ensures playback starts from beginning if duration is unknown.

### Fix #2: Fix Fallback Path Typo
Change:
- `'../../resorces/sounds/...'` 
- `'../../resorces/sounds/...'`

To:
- `'../../resources/sounds/...'`
- `'../../resources/sounds/...'`

### Fix #3: Improve Timeout Handling (OPTIONAL BUT RECOMMENDED)
Instead of silently resolving on timeout, consider one of:
- **Option A**: Reject the timeout as an error (caller can handle it)
- **Option B**: Increase timeout from 2000ms to 3000-4000ms (for slower file systems)
- **Option C**: Keep resolve but log more context (audio URL, currentPlayer state)

**Recommendation**: Use Option A (Reject) or Option C (Log more context) to surface the issue properly instead of silently continuing.

### Fix #4: Better Timeout Logging
Include the audio URL in the timeout warning:
```typescript
console.warn('[CountdownAudio] Audio metadata loading timed out after 2000ms', {
  audioUrl: audio.src,
  duration: audio.duration,
  readyState: audio.readyState
});
```

This helps debugging by showing what URL was being loaded when it timed out.

## Implementation Decision

**Implementing ALL 4 fixes** to ensure robust, future-proof audio handling:

| Priority | Fix | Impact | Effort | Status |
|----------|-----|--------|--------|--------|
| **CRITICAL** | Guard NaN duration | Prevents invalid currentTime | 1 line | ✅ Implement |
| **HIGH** | Fix fallback path typo | Fixes non-Electron fallback | 2 lines | ✅ Implement |
| **MEDIUM** | Better timeout logging | Improves debugging | 3 lines | ✅ Implement |
| **LOW** | Improve timeout handling | Surfaces issues better | ~10 lines | ✅ Implement |

**Rationale**: All fixes are defensive and non-breaking. They prevent edge cases and future conflicts without affecting current working behavior.

## Files to Modify
- **src/utils/countdownAudio.ts** - All fixes apply here

## Expected Outcome
- ✅ No more timeout warnings (audio loads successfully before timeout)
- ✅ If metadata does timeout, proper handling prevents NaN currentTime errors
- ✅ Non-Electron fallback uses correct path
- ✅ Better debugging info in console logs
- ✅ Audio continues to play correctly in all modes

## Implementation Notes
- Changes are defensive and non-breaking
- Audio functionality will not change (audio already works, this is just better error handling)
- All changes fit in ~15-20 lines of code
