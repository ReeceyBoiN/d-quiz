# Host Remote & Host App UI Synchronization for On-The-Spot Mode

## Problem Statement
When the host app's KeypadInterface displays the "Select Question Type" screen (or other on-the-spot mode screens), the host remote does not display the corresponding UI. This causes a mismatch between what the host sees locally and what the remote operator sees, breaking the synchronization between host app and host remote.

## Current State
- Host app (QuizHost + KeypadInterface) manages on-the-spot question type selection with its own local `currentScreen` state
- Host remote (QuestionTypeSelector in HostTerminal) relies on receiving `flowState` updates to know when to show the selector
- **Synchronization gap**: When host locally selects a question type in KeypadInterface, the global `flowState` in QuizHost is NOT updated, so `sendFlowStateToController` does not broadcast the change to the remote

### Why This Happens
1. KeypadInterface has local state `currentScreen` that determines what UI to show (question-types, letters-game, numbers-game, etc.)
2. When host user clicks a question type button, KeypadInterface.handleQuestionTypeSelect runs and:
   - Updates local `questionType` state
   - Sets local `currentScreen` to the selected game screen (e.g., 'letters-game')
   - Broadcasts placeholder question to players via IPC
   - **Does NOT update QuizHost.flowState** (no prop to communicate back)
3. Host remote watches `flowState.flow` and `flowState.isQuestionMode` to decide what to render
4. Without `flowState` updates, the remote doesn't know the host has made a selection

## Required Fixes

### Fix 1: Synchronize Local Host Selection to Global flowState
**Goal**: When KeypadInterface locally selects a question type, update QuizHost's global `flowState` so the change broadcasts to the remote.

**Location**: QuizHost.tsx - KeypadInterface prop/handler
- Add an `onSelectQuestionType` prop to KeypadInterface (or similar callback)
- In KeypadInterface.handleQuestionTypeSelect, after updating local state, call this callback with the selected type
- QuizHost's handler will:
  - Update `flowState` to: `{ flow: 'sent-question', isQuestionMode: true, selectedQuestionType: type, totalTime: <computed duration> }`
  - The existing `sendFlowStateToController` useEffect will automatically broadcast this to the remote
  - The remote will receive the FLOW_STATE update and switch from selector to answer input keypad

**Result**: Host app local selection → flowState updated → broadcast to remote → remote UI synchronizes

### Fix 2: Show QuestionTypeSelector on Host Remote During On-The-Spot Setup
**Goal**: Ensure host remote displays the QuestionTypeSelector when in on-the-spot mode waiting for type selection.

**Location**: HostTerminal/index.tsx - QuestionTypeSelector rendering
- Verify visibility condition: `isOnTheSpotMode && flowState?.flow === 'idle' && flowState?.isQuestionMode`
- Once Fix 1 is in place, when host selects locally, flowState will transition from 'idle' to 'sent-question'
- This will cause the remote's selector to disappear and keypad to appear (matching host app behavior)

**Current status**: QuestionTypeSelector should show when conditions are met. Once Fix 1 broadcasts state changes, this will work correctly.

### Fix 3: Keep Host Remote KeypadInterface Panels Visible During On-The-Spot
**Goal**: Ensure GameControlsPanel and HostRemoteKeypad are visible to match what the host operator sees.

**Location**: HostTerminal/index.tsx - Visibility conditions
- The `isInGameFlow` check should include 'sent-question' through all game states
- The keypad should be visible whenever the host app's KeypadInterface is in a game screen (letters-game, numbers-game, multiple-choice-game)
- **Note**: This fix was already applied in the previous implementation; verify it's working correctly

## Implementation Strategy

### Step 1: Add onSelectQuestionType Callback
- Modify KeypadInterface component signature to accept an `onSelectQuestionType?: (type: string) => void` prop
- In KeypadInterface.handleQuestionTypeSelect, after setting local state, call: `onSelectQuestionType?.(type)`
- Pass this prop from QuizHost with a handler that updates flowState

### Step 2: Update QuizHost Handler
- Create a handler in QuizHost that:
  - Receives the selected question type from KeypadInterface
  - Computes the timer duration for that type (using getTotalTimeForQuestion or similar)
  - Calls `setFlowState()` with the new state: `{ ...flowState, flow: 'sent-question', selectedQuestionType: type, totalTime: duration }`
  - This automatically triggers the sendFlowStateToController useEffect to broadcast to remote

### Step 3: Verify Remote UI Transitions
- When host selects a type locally:
  1. flowState updates from `{flow: 'idle', isQuestionMode: true}` to `{flow: 'sent-question', selectedQuestionType: type}`
  2. FLOW_STATE message sent to remote
  3. Remote's flowState updates
  4. QuestionTypeSelector disappears (because flow !== 'idle')
  5. GameControlsPanel and HostRemoteKeypad appear (because flow === 'sent-question')

### Step 4: Handle Both Selection Paths
- **Controller selects first**: Admin 'select-question-type' command → host updates flowState → broadcast to remote (already works)
- **Host selects first**: KeypadInterface callback → handler updates flowState → broadcast to remote (will work after Fix 1)
- **First-to-select wins**: By design, state updates are atomic; whichever happens first sets the state

## Files to Modify

### 1. src/components/KeypadInterface.tsx
- Add `onSelectQuestionType?: (type: string) => void` prop to component signature
- Call `onSelectQuestionType?.(type)` inside `handleQuestionTypeSelect` after updating local state
- Update JSDoc to document the new prop

### 2. src/components/QuizHost.tsx
- Create a handler function that receives the selected type and updates flowState
- Pass the handler to KeypadInterface as `onSelectQuestionType={handleQuestionTypeSelected}`
- Handler should compute timer duration and call `setFlowState` with updated state

### 3. Verify (no changes needed):
- src-player/src/components/HostTerminal/index.tsx - Already has correct visibility logic
- src-player/src/components/HostTerminal/QuestionTypeSelector.tsx - Already shows when conditions met
- src/network/wsHost.ts sendFlowStateToController - Already broadcasts selectedQuestionType

## Testing Checklist
- [ ] Host user selects question type in KeypadInterface → host local UI shows game screen
- [ ] Remote simultaneously receives FLOW_STATE update → remote selector disappears, keypad appears
- [ ] Remote user selects question type → host receives ADMIN_COMMAND → both in sync
- [ ] Timer starts on host → remote receives state update → timer UI shows on remote
- [ ] Answer input keypad available on remote → submission works → confirmed state shows
- [ ] Flow progression: idle → selector → sent-question → running → timeup → revealed → fastest works end-to-end

## Key Insight
The synchronization gap exists because KeypadInterface manages its own UI state independently from the global flowState. By adding a callback that syncs local selection back to the global flowState, both the host app and remote will receive the same state updates through the established sendFlowStateToController mechanism, maintaining consistency across both interfaces.
