# Plan: Fix Host App Timer State Bug in On-the-Spot Keypad Mode

## Problem Summary
When the host remote triggers a timer (Start Timer or Silent Timer), the audio plays on the host app but the flowState does not transition from 'sent-question' to 'running'. This causes:
- Start Timer / Silent Timer buttons remain visible and clickable
- Reveal Answer button stays hidden (it only shows when flow === 'running' or 'timeup')
- Host app cannot progress to the reveal stage

## Root Cause Analysis (Hypothesis)
Based on code exploration, the issue is likely one of these:

1. **Admin command handler not updating flowState**: In QuizHost.tsx, the admin command switch for 'start-normal-timer' or 'start-silent-timer' may not be properly calling `setFlowState` with the returned `flowStateUpdate` object from `executeStartNormalTimer`/`executeStartSilentTimer`.

2. **flowStateUpdate not being applied**: The handler calls the timer execution function but doesn't apply the returned `{ flow: 'running', timerMode: '...' }` update to the QuizHost state.

3. **Missing state broadcast**: After updating local flowState, the host may not be broadcasting the updated FLOW_STATE back to the remote, causing a state desync.

## Investigation Steps (Phase 1: Diagnosis)

1. **Read QuizHost.tsx admin command handlers**
   - Find the 'start-normal-timer' and 'start-silent-timer' case blocks in the admin command switch
   - Check if they call `setFlowState` with the returned update from the timer handlers
   - Verify the exact code path and identify where the update is missing

2. **Verify executeStartNormalTimer/executeStartSilentTimer return values**
   - Confirm these functions return a `flowStateUpdate` object with `flow: 'running'`
   - Check if the caller is receiving and using this return value

3. **Check FLOW_STATE broadcasting**
   - After flowState updates, verify that `sendFlowStateToController` is being called
   - Ensure the remote receives the updated flow state to show matching UI

## Implementation Steps (Phase 2: Fix)

1. **Update admin command handlers in QuizHost.tsx**
   - In the 'start-normal-timer' case: call `setFlowState(prev => ({ ...prev, ...flowStateUpdate }))`
   - In the 'start-silent-timer' case: same pattern
   - Ensure the flowStateUpdate from the handler is properly merged into the current flowState

2. **Add state broadcasting after update**
   - After `setFlowState`, ensure `sendFlowStateToController` is called to broadcast the new state to remotes
   - This keeps the remote UI in sync with host state

3. **Verify timer starts in useEffect**
   - The existing useEffect in QuizHost that watches `flowState.flow` should detect the transition to 'running' and call `timer.start()`
   - This should already work once flowState is updated correctly

## Expected Outcome
Once fixed:
1. Remote triggers "Start Timer" → admin command sent to host
2. Host updates `flowState.flow` to 'running'
3. QuestionNavigationBar detects change and hides Start/Silent Timer buttons
4. Reveal Answer button becomes visible
5. Timer countdown proceeds and user can click Reveal Answer when it finishes

## Files to Modify
- **src/components/QuizHost.tsx** - Admin command handlers for 'start-normal-timer' and 'start-silent-timer'

## Files to Reference (no changes needed)
- src/utils/unifiedTimerHandlers.ts - Verify return value structure
- src/state/flowState.ts - Understand flowState shape
- src/components/QuestionNavigationBar.tsx - Verify button rendering logic (should work once flowState updates)
- src/network/wsHost.ts - For understanding FLOW_STATE broadcast mechanism
