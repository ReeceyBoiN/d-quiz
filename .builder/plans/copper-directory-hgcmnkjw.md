# Plan: Fix Host App Timer State Bug in On-the-Spot Keypad Mode

## Problem Summary
When the host remote triggers a timer in **keypad mode** (on-the-spot), the audio plays on the host app but the flowState does not transition from 'sent-question' to 'running'. This causes:
- Start Timer / Silent Timer buttons remain visible and clickable
- Reveal Answer button stays hidden (it only shows when flowState.flow === 'running' or 'timeup')
- Host app cannot progress to the reveal stage

## Root Cause Identified
In QuizHost.tsx, the admin command handlers for 'start-normal-timer' and 'start-silent-timer' (lines 3497-3573):

1. Call `handleNavBarStartTimer(timerDuration)` or `handleNavBarSilentTimer(timerDuration)`
2. These wrappers have TWO code paths:
   - **Quiz Pack Mode**: Call `executeStartNormalTimer`/`executeStartSilentTimer` which return a `flowStateUpdate` object with `flow: 'running'`, then apply it via `setFlowState(prev => ({ ...prev, ...result.flowStateUpdate }))`
   - **Keypad Mode (On-the-Spot)**: Call `gameActionHandlers?.startTimer?.()` or `gameActionHandlers?.silentTimer?.()` - BUT do NOT update the main flowState

3. The problem is the keypad mode path **never updates the main flowState to 'running'**

4. QuestionNavigationBar.tsx has the logic (lines 231-239) that shows Reveal Answer when:
   ```javascript
   case 'sent-question':
     return null; // Timer buttons shown instead
   case 'running':
   case 'timeup':
     return {
       label: 'Reveal Answer',
       ...
     };
   ```

5. There is a useEffect (line 4055-4076) that automatically broadcasts flowState to the controller whenever `flowState.flow` changes, so once we update flowState, the broadcast happens automatically.

## Solution
Update the admin command handlers in QuizHost.tsx to also update the main flowState to 'running' when in keypad mode:

### In 'start-silent-timer' handler (around line 3529):
After calling `deps.handleNavBarSilentTimer(timerDuration)`, add:
```javascript
// Also update main flowState to 'running' so Reveal Answer button appears
// This transition will automatically trigger flowState broadcast to remote via useEffect
deps.setFlowState(prev => ({
  ...prev,
  flow: 'running',
  timerMode: 'silent'
}));
```

### In 'start-normal-timer' handler (around line 3569):
After calling `deps.handleNavBarStartTimer(timerDuration)`, add:
```javascript
// Also update main flowState to 'running' so Reveal Answer button appears
// This transition will automatically trigger flowState broadcast to remote via useEffect
deps.setFlowState(prev => ({
  ...prev,
  flow: 'running',
  timerMode: 'normal'
}));
```

## Expected Outcome
1. Remote triggers "Start Timer" → admin command sent to host
2. Host updates `flowState.flow` to 'running' (in addition to calling gameActionHandlers)
3. QuestionNavigationBar detects flow === 'running' and shows Reveal Answer button
4. useEffect detects flowState.flow change and broadcasts to remote
5. Start/Silent Timer buttons are hidden, Reveal Answer button is visible
6. Timer countdown proceeds and user can click Reveal Answer when it finishes

## Files to Modify
- **src/components/QuizHost.tsx** - Admin command handlers for 'start-normal-timer' (line 3536) and 'start-silent-timer' (line 3497)

## Files to Reference (no changes needed)
- src/components/QuestionNavigationBar.tsx - Verify button rendering logic (lines 231-239)
- src/utils/unifiedTimerHandlers.ts - Already returns proper flowStateUpdate structure
- src/network/wsHost.ts - Auto-broadcast via useEffect is already working
