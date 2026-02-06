# Fix Audio Playback Issues in QuizPack and Keypad Modes

## Problem Summary

### Issue 1: QuizPack Mode - Double Audio Playback
When "Reveal Answer" is triggered in QuizPack mode, fail/applause sounds play **twice**. 

**Root Cause**: Duplicate sound logic in the call chain:
1. `QuizHost.handleRevealAnswer()` calls `handleComputeAndAwardScores(correctTeamIds, 'keypad', ...)`
2. Inside `handleComputeAndAwardScores()`, it plays applause/fail sound (checks `gameMode === 'keypad'`)
3. Control returns to `QuizHost.handleRevealAnswer()`, which AGAIN plays applause/fail sound (lines 2606-2640)
4. Result: Two consecutive sounds play

**Evidence from logs**:
```
[QuizHost] Playing fail sound
[audioUtils] playRandomSound - folderPath: C:\...\Fail Sounds files found: 5
[audioUtils] Selected file: ...\Fail Sad Party Whistle.wav
[audioUtils] playRandomSound - folderPath: C:\...\Fail Sounds files found: 5
[audioUtils] Selected file: ...\Fail Toilet Flush.wav
```

### Issue 2: Keypad On-The-Spot Mode - No Audio Playback on Reveal
When "Reveal Answer" is triggered in Keypad on-the-spot mode with 0 correct teams, **no fail sound plays**.

**Root Cause**: Conditional logic in `KeypadInterface.handleRevealAnswer()`:
- Only calls `onAwardPoints()` if `correctTeamIds.length > 0` (line 1021)
- When 0 teams answer correctly, `onAwardPoints()` is never called
- Without this call, the sound-playing logic in `handleComputeAndAwardScores()` never executes
- Result: No sound plays

**Evidence from logs**: 
```
[KeypadInterface] No correct teams found, skipping onAwardPoints
[KeypadInterface] Broadcasting reveal to players...
(no [Scoring] or [audioUtils] logs - sound never triggers)
```

## Requirements from User

1. **Fail sounds should play if 0 teams answered correctly** - even with no teams connected
2. **Applause sounds should play if 1+ teams answered correctly** 
3. **Exactly 1 audio file should play per reveal action** (not 2)
4. For QuizPack mode: sound on immediate reveal button click
5. For Keypad mode: sound on immediate reveal button click (not just after timer)

## Recommended Solution

### Fix 1: Remove Duplicate Sound in QuizHost.handleRevealAnswer (QuizPack)
**Approach**: Prevent sound duplication by removing sound playback from `QuizHost.handleRevealAnswer()`. The sound is already handled inside `handleComputeAndAwardScores()` when `gameMode === 'keypad'`.

**Changes Required**:
- File: `src/components/QuizHost.tsx`
- Location: Lines 2601-2640 (the entire "Play sound effects for Quiz Pack mode" block)
- Action: Delete this block - the sound is already triggered by the `handleComputeAndAwardScores()` call on line 2545

### Fix 2: Add Sound Playback for Keypad Mode When No Correct Teams
**Approach**: Ensure sounds play even when 0 teams answer correctly by:
1. Always calling a sound-playing function from `KeypadInterface.handleRevealAnswer()`, OR
2. Modify `handleComputeAndAwardScores()` to accept an optional `forcePlaySound` flag and call it with `forcePlaySound: true` when revealing answers

**Recommended Path**: Option B (cleaner, centralizes audio logic in QuizHost)

**Changes Required**:
- File: `src/components/QuizHost.tsx` 
  - Modify `handleComputeAndAwardScores` useCallback to accept optional `forcePlaySound` parameter
  - When `forcePlaySound: true`, play sounds regardless of whether `gameMode === 'keypad'`
- File: `src/components/KeypadInterface.tsx`
  - Modify `handleRevealAnswer()` to call `onAwardPoints()` in ALL cases (whether correctTeamIds.length > 0 or 0)
  - Pass `forcePlaySound: true` to trigger sound playback

## Files to Modify

1. **src/components/QuizHost.tsx** (Priority: High)
   - Line 2545: Call site where sound should come from (no change needed)
   - Lines 2601-2640: Remove duplicate sound block (DELETE)
   - ~Line 3221-3256: `handleComputeAndAwardScores` useCallback - add optional parameter to support forced sound playback

2. **src/components/KeypadInterface.tsx** (Priority: High)
   - Lines 1021-1027: Modify conditional to always call `onAwardPoints()` when revealing, even with 0 correct teams

## Success Criteria

- QuizPack mode: Plays exactly **1 fail/applause sound** when revealing answer
- Keypad mode: Plays exactly **1 fail sound** when revealing with 0 correct teams
- Keypad mode: Plays exactly **1 applause sound** when revealing with 1+ correct teams
- No duplicate sounds in either mode
- Logs show sound triggered once per reveal action
