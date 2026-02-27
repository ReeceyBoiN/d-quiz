# Fix On the Spot Nearest Wins Timer Issues

## Problem Summary

The "On the Spot Nearest Wins" timer has multiple issues:
1. **No sound**: Timer sound doesn't play at all
2. **Memory leak**: Console floods with repeated "Timer starting" and "Unregistered listener" messages
3. **Silent timer broken**: Silent timer mode doesn't work
4. **Settings inconsistency**: Potential mismatch in settings key naming that could affect timer duration

## Root Causes Identified

### 1. Missing Audio Playback
**Location**: `src/components/NearestWinsInterface.tsx` - `handleStartTimer` function

The `handleStartTimer` function never calls `playCountdownAudio()`. Other game modes (Keypad, Quiz Pack) properly trigger countdown audio via the centralized `playCountdownAudio` utility from `src/utils/countdownAudio.ts`, but NearestWins skips this entirely.

### 2. Memory Leak from Duplicate State Updates
**Location**: `src/components/QuizHost.tsx` - Admin command handler (~lines 3729-3741)

When the admin command `'start-normal-timer'` is triggered:
1. It calls `deps.handleNavBarStartTimer(timerDuration)`
2. Then ALSO calls `deps.setFlowState(prev => ({ ...prev, flow: 'running', timerMode: 'normal' }))`

But `handleNavBarStartTimer` (in quiz-pack mode) already calls `executeStartNormalTimer` which updates `flowState` to `running`. This double update causes the flowState useEffect to trigger multiple times, producing repeated "[QuizHost] Timer starting" logs.

### 3. Memory Leak from Listener Re-registration  
**Location**: `src/components/QuizHost.tsx` - `handleNetworkPlayerJoin` useCallback and registration

The `handleNetworkPlayerJoin` callback has many dependencies:
```javascript
const handleNetworkPlayerJoin = useCallback((data) => { ... }, 
  [flowState, setAuthenticatedControllerId, setQuizzes, setPendingTeams, 
   currentLoadedQuestionIndex, loadedQuizQuestions, isQuizPackMode, hostInfo?.baseUrl]
);
```

When any of these frequently-changing values update, the callback identity changes. This causes the registration useEffect to:
1. Unregister the old PLAYER_JOIN listener (logs "Unregistered listener for PLAYER_JOIN")
2. Register a new one

This happens repeatedly during normal operation, flooding the console.

### 4. Silent Timer Not Working
**Location**: `src/components/NearestWinsInterface.tsx` - Timer countdown useEffect

The voice countdown/silent mode logic block is empty:
```javascript
if (voiceCountdown && newValue > 0 && newValue < nearestWinsTimer) { 
  /* empty - no implementation */ 
}
```

### 5. Inconsistent Settings Key Naming
**Location**: `src/components/QuizHost.tsx` - Admin command handler (~lines 3657-3660, 3710-3713)

Some code references `deps.gameModeTimers.nearestWins` (camelCase) while SettingsContext uses `gameModeTimers.nearestwins` (lowercase). This mismatch can cause wrong timer durations or undefined values.

## Recommended Fixes

### Fix 1: Add Audio Playback to NearestWins Timer
**File**: `src/components/NearestWinsInterface.tsx`

In the `handleStartTimer` function, add audio playback:

1. Import the countdown audio utility at the top:
   ```typescript
   import { playCountdownAudio, stopCountdownAudio } from "../utils/countdownAudio";
   ```

2. In `handleStartTimer`, before starting the timer, add:
   ```typescript
   const handleStartTimer = async () => {
     // Stop any existing countdown audio first
     stopCountdownAudio();
     
     // Play countdown audio (not silent mode by default)
     // The audio utility handles the +1 buffer automatically
     playCountdownAudio(nearestWinsTimer, false).catch(err => 
       console.error('[NearestWins] Audio playback error:', err)
     );
     
     // Existing timer start logic...
     setTotalTimerLength(nearestWinsTimer);
     setIsTimerRunning(true);
     // ... rest of existing code
   };
   ```

### Fix 2: Add Silent Timer Support
**File**: `src/components/NearestWinsInterface.tsx`

1. Add a silent mode parameter to `handleStartTimer`:
   ```typescript
   const handleStartTimer = async (isSilent: boolean = false) => {
     stopCountdownAudio();
     
     // Only play audio if not silent
     if (!isSilent) {
       playCountdownAudio(nearestWinsTimer, false).catch(err => 
         console.error('[NearestWins] Audio playback error:', err)
       );
     }
     
     // ... rest of timer start logic
   };
   ```

2. Update the action handlers exposure to support silent parameter:
   ```typescript
   useEffect(() => {
     if (onGetActionHandlers) {
       onGetActionHandlers({ 
         reveal: handleRevealResults, 
         nextQuestion: handleNextRound, 
         startTimer: handleStartTimer,
         startSilentTimer: () => handleStartTimer(true) // Add silent variant
       });
     }
   }, [onGetActionHandlers, handleRevealResults, handleNextRound, handleStartTimer]);
   ```

### Fix 3: Remove Duplicate flowState Update in Admin Handler
**File**: `src/components/QuizHost.tsx`

In the admin command handler for `'start-normal-timer'` case (~lines 3729-3741):

**Current code**:
```typescript
case 'start-normal-timer':
  const timerDuration = data.duration || deps.gameModeTimers.nearestWins || 30;
  deps.handleNavBarStartTimer(timerDuration);
  deps.setFlowState(prev => ({ ...prev, flow: 'running', timerMode: 'normal' })); // REMOVE THIS
  break;
```

**Fixed code**:
```typescript
case 'start-normal-timer':
  const timerDuration = data.duration || deps.gameModeTimers.nearestwins || 30; // Also fix key name
  deps.handleNavBarStartTimer(timerDuration);
  // Removed duplicate setFlowState - handleNavBarStartTimer handles it
  break;
```

Do the same for the `'start-silent-timer'` case.

### Fix 4: Stabilize PLAYER_JOIN Listener Registration
**File**: `src/components/QuizHost.tsx`

Make the `handleNetworkPlayerJoin` callback stable using refs:

1. Create refs for frequently changing values:
   ```typescript
   const flowStateRef = useRef(flowState);
   const quizzesRef = useRef(quizzes);
   const loadedQuizQuestionsRef = useRef(loadedQuizQuestions);
   
   useEffect(() => {
     flowStateRef.current = flowState;
   }, [flowState]);
   
   useEffect(() => {
     quizzesRef.current = quizzes;
   }, [quizzes]);
   
   useEffect(() => {
     loadedQuizQuestionsRef.current = loadedQuizQuestions;
   }, [loadedQuizQuestions]);
   ```

2. Update `handleNetworkPlayerJoin` to use refs and have minimal/empty dependencies:
   ```typescript
   const handleNetworkPlayerJoin = useCallback((data) => {
     // Use .current to access latest values
     const currentFlowState = flowStateRef.current;
     const currentQuizzes = quizzesRef.current;
     const currentLoadedQuestions = loadedQuizQuestionsRef.current;
     
     // ... existing handler logic using ref values ...
   }, []); // Empty deps - callback is stable
   ```

3. The registration useEffect will now only run once:
   ```typescript
   useEffect(() => {
     const unsubscribe = onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);
     return unsubscribe;
   }, [handleNetworkPlayerJoin]); // Won't re-run since handleNetworkPlayerJoin is stable
   ```

### Fix 5: Fix Inconsistent Settings Key Naming
**File**: `src/components/QuizHost.tsx`

Search for all occurrences of `gameModeTimers.nearestWins` (camelCase with capital W) and change to `gameModeTimers.nearestwins` (lowercase) to match the actual settings key.

Locations to update:
- Admin command handler (~line 3657-3660, 3710-3713)
- Any other references that use the incorrect capitalization

## Implementation Order

1. **First**: Fix the listener re-registration issue (Fix 4) - this will stop the console spam immediately
2. **Second**: Fix the duplicate flowState update (Fix 3) - this will stop the repeated "Timer starting" logs
3. **Third**: Add audio playback (Fix 1) - this fixes the main user-facing issue
4. **Fourth**: Add silent timer support (Fix 2) - completes the feature set
5. **Fifth**: Fix settings key naming (Fix 5) - ensures correct timer durations

## Settings Integration Verification

The timer duration is correctly pulled from `nearestWinsTimer` setting in `SettingsContext.tsx`:
- Default value: 10 seconds
- User can change to 10, 30, or custom duration in settings
- The +1 buffer for audio playback is automatically handled by `playCountdownAudio` utility

No changes needed to settings integration - it's already correct.

## Files to Modify

1. `src/components/NearestWinsInterface.tsx` - Add audio, silent timer support
2. `src/components/QuizHost.tsx` - Fix memory leaks, settings key naming
