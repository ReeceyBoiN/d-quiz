# Quiz Timer Issues - Fix Plan

## Issues Identified

### Issue 1: Timer Duration Mismatch (20s set, but plays for 30s)
**Root Cause**: `customDuration` is being passed as an object instead of a number to `handleStartTimer`
- Logs show: `[KeypadInterface] handleStartTimer called with customDuration: r` where `r` is an object
- This causes: `[CountdownAudio] Invalid timerDuration received: Object`
- Result: Audio playback fails, and the countdown may fall back to default 30 seconds

**Where it happens**: 
- `src/components/QuizHost.tsx` - `handleNavBarStartTimer()` method is passing the wrong data type
- Likely location: Where `customDuration` is extracted/passed from flowState

### Issue 2: Extra Blue Progress Bar in Host App
**Root Cause**: The CountdownTimer component is rendering and displaying as expected, but due to the audio failure and timer logic issues, it appears as an "extra" or unwanted element
- `src/components/CountdownTimer.tsx` renders the blue progress bar (styled with `.progress-bar-fill`)
- The bar is being rendered in `KeypadInterface.tsx` whenever a timer is running
- This may be necessary for the UI but needs verification

**Why it appears "extra"**: 
- The timer animation is running visibly
- The audio isn't playing (due to the invalid duration error)
- Creates a visual mismatch with what should be happening

## Implementation Steps

### Step 1: Fix customDuration Type Issue
**Files to modify**: `src/components/QuizHost.tsx`
- Find the `handleNavBarStartTimer` method
- Locate where `customDuration` is extracted or prepared
- Ensure the value passed to `gameActionHandlers.startTimer()` or `KeypadInterface` is a **number**, not an object
- May need to extract a numeric value from an object property (e.g., if it's `{duration: 20}`, extract `duration`)

### Step 2: Verify Timer Flow State
**Files to inspect**: 
- `src/components/QuizHost.tsx` - Check `flowState.totalTime` when setting question type
- `src/components/KeypadInterface.tsx` - Verify `handleStartTimer` receives correct numeric duration
- Ensure the 20-second setting from `gameModeTimers.keypad` flows correctly through the system

### Step 3: Test Audio Playback
**Files to verify**: `src/utils/countdownAudio.ts`
- Once the duration type is fixed, audio should play correctly
- The audio should play the last `(timerDuration + 1)` seconds of the countdown audio file
- For 20 seconds: should play the last 21 seconds of the audio

### Step 4: Review Progress Bar Necessity (Optional)
**Files to review**: 
- `src/components/KeypadInterface.tsx` - Where CountdownTimer is rendered
- `src/components/CountdownTimer.tsx` - The progress bar component itself
- Determine if this component should be displayed in the host app, or if it was added in error
- May need to add conditional rendering to hide it if not needed

## Key Files to Modify
1. **src/components/QuizHost.tsx** - Fix customDuration type issue (PRIMARY)
2. **src/components/KeypadInterface.tsx** - Verify timer handling
3. **src/utils/countdownAudio.ts** - May need defensive checks for object inputs

## Expected Outcomes After Fix
- ✅ Timer duration respects the 20-second setting from settings
- ✅ Countdown audio plays for the correct duration (20 seconds)
- ✅ Timer animation counts down correctly (20 seconds, not 30)
- ✅ No "extra" progress bar appearing unexpectedly
- ✅ Host remote timer control works without errors
