# Plan: Debug Question Type Selector Not Showing on Host Remote

## Problem Summary
When the host app displays "Select Question Type" buttons in on-the-spot mode, the host remote shows "No Round Loaded" / "Ready to Start" (Game Controls panel) instead of showing the same question type selector buttons.

## Root Cause Analysis

### Display Logic Flow
The QuestionTypeSelector **should** be visible when:
```
showQuestionTypeSelector = isOnTheSpotMode && isInIdleState && flowState?.isQuestionMode

Where:
- isOnTheSpotMode = flowState?.isQuizPackMode === false (explicitly false)
- isInIdleState = flowState?.flow === 'idle'
- flowState?.isQuestionMode = true
```

**Critical requirement**: `isQuizPackMode` must be explicitly `false`, not `undefined` or `null`.

### Communication Path
1. Host (QuizHost.tsx) sets flowState to:
   ```
   flow: 'idle'
   isQuestionMode: true
   isQuizPackMode: false
   selectedQuestionType: undefined
   ```

2. Host calls `sendFlowStateToController()` via IPC or HTTP to transmit to authenticated remote controller

3. Remote (App.tsx) receives FLOW_STATE message and updates local flowState

4. HostTerminal re-evaluates the condition and renders QuestionTypeSelector

### Likely Failure Points (in order of probability)

#### 1. **Host Not Sending FLOW_STATE**
- deviceId or authenticatedControllerId not set when sendFlowStateToController called
- Logs: `[wsHost] ❌ NO DEVICE ID - cannot send FLOW_STATE`

#### 2. **FLOW_STATE Message Not Reaching Remote**
- IPC send failed and HTTP fallback not attempted (missing __BACKEND_URL__)
- Logs: `[wsHost] ❌ No backendUrl provided and __BACKEND_URL__ not set`
- HTTP request failed silently

#### 3. **FLOW_STATE Message Missing Required Fields**
- `isQuizPackMode` not included in payload (must be explicitly false, not undefined)
- `flow` or `isQuestionMode` undefined
- Remote rejects: `[Player] ❌ FLOW_STATE missing required fields`

#### 4. **Remote Received Correct FLOW_STATE But Condition Evaluates False**
- flow is not 'idle' (could be 'sent-question', 'ready', etc.)
- isQuestionMode is false or undefined
- isQuizPackMode is true or undefined (needs explicit false)
- Logs: `[HostTerminal] FlowState and visibility conditions:` will show which condition failed

## Diagnostic Investigation Plan

### Step 1: Verify Host Sends FLOW_STATE
**Look for these logs in host console:**
- `[QuizHost] - On-the-spot mode, sending next question` (when next-question triggered)
- `[wsHost] 🚀 sendFlowStateToController called`
- `[wsHost] 📦 FLOW_STATE payload ready`
- `[wsHost] 📤 Attempting to send FLOW_STATE via IPC...` or `📤 Attempting to send FLOW_STATE via HTTP API...`
- `[wsHost] ✅ FLOW_STATE sent via IPC successfully` or `HTTP API successfully`

**If missing**: sendFlowStateToController not being called or deviceId not available

### Step 2: Verify Remote Receives FLOW_STATE
**Look for these logs in remote console (Electron DevTools or browser):**
- `[Player] 📥 FLOW_STATE message received!`
- Check the logged values: `flow`, `isQuestionMode`, `hasCurrentQuestion`
- `[Player] ✅ FLOW_STATE conditions met, updating local state` OR
- `[Player] ❌ FLOW_STATE missing required fields`

**If "conditions met"**: Message received but local condition may still be false  
**If "missing required fields"**: Message incomplete (flow or isQuestionMode undefined)

### Step 3: Verify Remote's flowState Values
**Look for in remote console:**
- `[HostTerminal] FlowState and visibility conditions:`
- Check the logged values:
  - `flowState.flow` (should be 'idle')
  - `flowState.isQuestionMode` (should be true)
  - `flowState.isQuizPackMode` (should be false - NOT undefined)
  - `isOnTheSpotMode` (should be true)
  - `isInIdleState` (should be true)
  - `showQuestionTypeSelector` (should be true)

**If showQuestionTypeSelector is false**: One of the three conditions failed

### Step 4: Check Backend URL Configuration
If IPC not available:
- Verify `window.__BACKEND_URL__` is set on host app
- Check if HTTP fallback is being used
- Verify backend `/api/send-to-player` endpoint is accessible

## Files Involved

### Host (Main App)
- `src/components/QuizHost.tsx` - Sets flowState for question type selector, calls sendFlowStateToController
- `src/network/wsHost.ts` - sendFlowStateToController function (IPC → HTTP fallback)
- `src/state/flowState.ts` - Flow state types and initial values

### Remote (Player App)
- `src-player/src/App.tsx` - FLOW_STATE message handler
- `src-player/src/components/HostTerminal/index.tsx` - showQuestionTypeSelector condition and diagnostic logging
- `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx` - Component guard (returns null if !shouldShow)

## Investigation Steps

1. **Reproduce the issue:**
   - Connect host remote (authenticate as controller)
   - On host app: Switch to on-the-spot mode (Keypad)
   - Click "Next Question" or trigger question type selection
   - Open both host and remote consoles side-by-side

2. **Check host console for FLOW_STATE send:**
   - Look for `[wsHost]` logs indicating sendFlowStateToController was called
   - Verify payload includes `isQuizPackMode: false`

3. **Check remote console for FLOW_STATE receive:**
   - Look for `[Player] 📥 FLOW_STATE message received!`
   - Verify the received flow and isQuestionMode values
   - Look for `[HostTerminal]` diagnostic logs

4. **Compare flowState values:**
   - Expected: `{ flow: 'idle', isQuestionMode: true, isQuizPackMode: false, ... }`
   - Actual: Check the diagnostic logs

5. **If FLOW_STATE not received:**
   - Check if IPC available: Look for `[wsHost] 📤 Attempting to send FLOW_STATE via IPC...`
   - Check if HTTP fallback: Look for `[wsHost] 📤 Attempting to send FLOW_STATE via HTTP API...`
   - Check for errors: `[wsHost] ❌` messages

## Next Steps After Diagnosis

Once root cause identified:
- If host not sending: Fix sendFlowStateToController call sites (verify authenticatedControllerId is set)
- If message not received: Check IPC availability and backend URL configuration
- If missing fields: Ensure payload includes all required fields (especially isQuizPackMode)
- If condition false: Trace which of the three boolean checks is failing and why
