# Fix: Host Remote State Synchronization

## Problem
The host remote is not staying in sync with the host app. Specifically:
1. **Early UI display**: Question Type Selector shows on remote immediately when KEYPAD is clicked, before the host app reaches the "Select Question Type" screen
2. **Stale state**: When returning from a game to home screen, the remote still shows the previous game state instead of a waiting state
3. **Stage visibility**: The remote shows controls that aren't relevant to the current screen the host app is displaying

## Root Cause
The host app sends `isQuestionMode: true` as soon as the KEYPAD button is clicked. The remote uses this flag (combined with `flow: 'idle'`) to decide whether to show the Question Type Selector. However, at this point, the host app is still on the points/settings configuration screen ('config' screen in KeypadInterface), not the question type selection screen yet.

The remote has no visibility into which **screen** the host app is actually displaying - it only knows the high-level `flow` state (idle, sent-question, running, etc.).

## Solution
Track and sync the KeypadInterface's `currentScreen` state between host app and remote:

1. **Add `keypadCurrentScreen` to FLOW_STATE payload** - Include the KeypadInterface's current screen ('config', 'question-types', etc.) in the FLOW_STATE message
2. **Update remote UI logic** - Only show Question Type Selector when `keypadCurrentScreen === 'question-types'`
3. **Show waiting state on home** - When `flow === 'idle'` and not in question mode, display a waiting message on the remote

## Implementation Steps

### Step 1: Update FLOW_STATE payload in host app
**File**: `src/components/QuizHost.tsx`
- Update the `useEffect` that sends FLOW_STATE to include `keypadCurrentScreen: keypadCurrentScreen` in the questionData payload
- This ensures every state change sends the current KeypadInterface screen

### Step 2: Update sendFlowStateToController network function
**File**: `src/network/wsHost.ts`
- Update the `sendFlowStateToController` function to include `keypadCurrentScreen` in the FLOW_STATE payload
- Extract it from questionData and add to the payload's data object

### Step 3: Update host remote's FLOW_STATE handler
**File**: `src-player/src/App.tsx`
- Update the FLOW_STATE message handler to include `keypadCurrentScreen` when updating local flowState
- Extract `message.data?.keypadCurrentScreen` and store it in the flowState state

### Step 4: Update HostTerminal UI logic
**File**: `src-player/src/components/HostTerminal/index.tsx`
- Update the condition for showing Question Type Selector:
  - From: `showQuestionTypeSelector = isOnTheSpotMode && isInIdleState && isQuestionMode`
  - To: `showQuestionTypeSelector = isOnTheSpotMode && keypadCurrentScreen === 'question-types'`
- Add a condition to show "waiting message" when `flow === 'idle'` and not in any game mode

### Step 5: Verify state is sent on all transitions
**File**: `src/components/QuizHost.tsx`
- Ensure `handleKeypadClose` properly resets state and triggers a FLOW_STATE update
- Verify that transitions between KeypadInterface screens trigger state updates

## Expected Result
- **Home screen**: Host remote shows header + "Waiting for game mode" message, no active controls
- **After clicking KEYPAD**: Host remote shows header + waiting message (points config screen on host app)
- **After clicking "Start Round"**: Host remote shows Question Type Selector (question-types screen on host app)
- **After selecting question type**: Host remote shows answer keypad and timer controls
- **After closing keypad**: Host remote returns to header + waiting message
- **State always stays in sync**: Remote matches the current screen/stage of the host app

## Files to Modify
1. `src/components/QuizHost.tsx` - Add keypadCurrentScreen to FLOW_STATE payload
2. `src/network/wsHost.ts` - Include keypadCurrentScreen in the message
3. `src-player/src/App.tsx` - Receive and store keypadCurrentScreen
4. `src-player/src/components/HostTerminal/index.tsx` - Update UI logic to use keypadCurrentScreen
5. `src-player/src/state/` (if needed) - Update flowState type to include keypadCurrentScreen

## Key Insight
The remote should think of itself as a **"view of what the host app is showing"** - it needs to know not just the abstract game state (idle/running/etc), but also which screen/stage the host app is currently displaying. By syncing `keypadCurrentScreen`, we give the remote this visibility.
