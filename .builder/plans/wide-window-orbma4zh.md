# Timer Audio Duration & Input Consistency Plan

## Current Status
- **Numbers Input Issue**: ✅ RESOLVED - Host remote already supports multi-digit numbers with 10-digit max enforcement
- **Timer Audio Duration Issue**: 🔍 NEEDS TESTING - User testing to confirm behavior

## Issue 1: Start Timer Audio Duration (TBD - Pending User Test)

### Investigation Results
The duration parameter IS correctly passed through the entire chain:
1. Remote sends: `sendAdminCommand('start-normal-timer', { seconds: timerDuration })`
2. Host receives: ADMIN_COMMAND with `commandData.seconds`
3. Host validates and passes to: `handleNavBarStartTimer(timerDuration)` 
4. Unified handlers call: `playCountdownAudio(timerDuration, silent)`
5. Network broadcast includes: `sendTimerToPlayers(timerDuration, ...)`

**Likely Root Cause** (in `src/utils/countdownAudio.ts`):
- The `playCountdownAudio()` function calculates `startTime = Math.max(0, audioDuration - (timerDuration + 1))`
- If audio metadata fails to load (timeout or error), `audioDuration` becomes 0
- This causes `startTime = 0`, making the entire 30-second clip play instead of just the last N seconds

### Solution (If Issue Confirmed)

**Primary Fix**: Improve audio metadata loading robustness in `countdownAudio.ts`
1. Add better error handling for metadata loading failures
2. Add logging to debug what `audio.duration` is when audio starts
3. Consider fallback behavior if metadata fails (e.g., play silence or skip audio)
4. Test with different timer durations (5s, 10s, 30s) on both host and remote

**Secondary Check**: Verify audio file duration matches or exceeds longest timer used
- Check that `Countdown.wav` and `Countdown Silent.wav` are actually ~30+ seconds long
- If shorter, that explains why N-second playback cannot work

### Files to Investigate/Modify
- `src/utils/countdownAudio.ts` (lines 177-203) - Audio playback logic
- `src/utils/unifiedTimerHandlers.ts` - Verify timerDuration passes correctly
- Console logs in DEBUG mode to verify `audio.duration` and `startTime` values

---

## Issue 2: KeypadInterface Hardening (Input Consistency)

### Current Situation
- `HostRemoteKeypad.tsx`: ✅ Enforces 10-digit max in `handleAnswerSelect` click handler
- `KeypadInterface.tsx`: ⚠️ Has `maxLength={10}` on input element but **no max check** in programmatic `handleKeypadInput`
  - This allows keyboard button clicks to potentially exceed 10 digits
  - Inconsistency between local and remote interfaces

### Solution: Add Max-Length Guard to KeypadInterface

**Changes Required**:

1. **Modify `handleKeypadInput` in KeypadInterface.tsx** (numbers mode only)
   - Add 10-digit max check before appending
   - Current: `setNumbersAnswer(prev => prev + digit);`
   - Change to: `setNumbersAnswer(prev => { const newAnswer = (prev ?? '') + digit; return newAnswer.length <= 10 ? newAnswer : prev; });`

2. **Clamp remote answer when applying `answerSubmitted` sync** (in the useEffect that watches `answerSubmitted`)
   - When setting `setNumbersAnswer(answerSubmitted)`, ensure it doesn't exceed 10 digits
   - Current: `setNumbersAnswer(answerSubmitted);`
   - Change to: `setNumbersAnswer(answerSubmitted?.slice(0, 10) ?? '');`

3. **Verify consistency across all number input update paths**
   - Ensure any other place that modifies `numbersAnswer` also respects the 10-digit limit

### Files to Modify
- `src/components/KeypadInterface.tsx` - Add max-length guards to match HostRemoteKeypad behavior

---

## Implementation Order

1. **Test timer audio duration issue** (user does this first)
   - Confirm if audio plays full 30s or correct duration when remote clicks "Start Timer"
   - Capture logs if issue exists

2. **If timer issue confirmed**: Debug and fix `countdownAudio.ts`
   - Add logging to check `audio.duration` and `startTime` values
   - Implement fallback if metadata fails to load

3. **Add max-length guards to KeypadInterface** (separate, non-blocking)
   - Ensures parity with HostRemoteKeypad
   - Prevents any edge case where button spam could exceed 10 digits
   - Low risk, high confidence fix

---

## Testing Checklist

### Timer Audio Duration (After Fix)
- [ ] Set timer to 5 seconds in host app settings
- [ ] Click "Start Timer" on host app → audio plays ~5 seconds
- [ ] Click "Start Timer" on host remote → audio plays ~5 seconds (same duration)
- [ ] Test with 10s, 30s custom durations
- [ ] Verify player devices receive correct TIMER_START with correct seconds
- [ ] Check debug logs show correct `audio.duration` and `startTime` values

### KeypadInterface Input (After Hardening)
- [ ] Rapid digit button clicks in numbers game → max 10 digits enforced
- [ ] Backspace removes last digit correctly
- [ ] Clear resets to empty
- [ ] Confirm/submit works with multi-digit numbers
- [ ] Consistency: both host app and remote support identical input behavior

---

## Key Files Reference

**Timer Audio Duration Issue**:
- `src/utils/countdownAudio.ts` (lines 177-203) - startTime calculation
- `src/utils/unifiedTimerHandlers.ts` (lines 34-56, 93-114) - Unified timer handlers
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` (lines ~216-225) - Remote sends seconds

**Input Consistency**:
- `src/components/KeypadInterface.tsx` - Add max-length guards
- `src-player/src/components/HostTerminal/HostRemoteKeypad.tsx` - Reference implementation with max-length

---

## Notes
- Numbers input fix is already implemented; this plan focuses on ensuring consistency and the timer audio issue
- Timer audio fix depends on confirming the issue exists through testing
- Both changes are low-risk, isolated modifications with clear success criteria
