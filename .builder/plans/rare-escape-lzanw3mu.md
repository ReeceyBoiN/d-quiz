# Bidirectional Stage Sync Between Host App and Host Remote

## Problem
Currently, syncing only works in one direction:
- **Remote → Host**: ✅ Works. Remote selects question type, host app updates and advances to game screen
- **Host → Remote**: ❌ Broken. Host app selects question type, remote doesn't update to show answer entry interface

The remote receives FLOW_STATE messages but with `hasCurrentQuestion: false`, preventing it from displaying the answer entry screen.

## Root Cause
When the host **remote** sends a `select-question-type` command:
1. Host receives ADMIN_COMMAND
2. QuizHost creates a **placeholder question** and sets `flowState.currentQuestion`
3. flowState change triggers `sendFlowStateToController` 
4. Remote receives complete FLOW_STATE with currentQuestion data
5. Remote displays answer entry interface ✅

When the host **app** selects a question type locally (via KeypadInterface UI button):
1. KeypadInterface calls `onSelectQuestionType(type)`
2. QuizHost likely updates `keypadCurrentScreen` but may **not set currentQuestion**
3. flowState change may not include valid currentQuestion data
4. Remote receives FLOW_STATE with `hasCurrentQuestion: false`
5. Remote can't display answer entry interface ❌

## Solution: Unify Question Type Selection Logic

### Key Insight
Both paths should produce identical state updates. When a question type is selected (from either remote OR local UI), QuizHost should:
1. Set `flowState.selectedQuestionType`
2. Set `flowState.currentQuestion` with a placeholder question
3. Update `keypadCurrentScreen` to match the game mode
4. Let the existing useEffect send FLOW_STATE to remote

### Files to Modify

**1. src/components/QuizHost.tsx** 
   - Find the `handleSelectQuestionType` function (called when user clicks question type button locally)
   - Ensure it creates a placeholder question similar to the ADMIN_COMMAND handler
   - Verify it sets both flowState AND keypadCurrentScreen
   - Confirm the existing FLOW_STATE sending useEffect is in the dependency array

**2. src/state/flowState.ts** (if needed)
   - Review placeholder question creation logic
   - Consider extracting placeholder creation to a helper function for code reuse

### Implementation Approach

#### Step 1: Extract Placeholder Question Creator
- Create a helper function in `src/state/flowState.ts` or `src/components/QuizHost.tsx` to generate placeholder questions
- This ensures both the admin handler AND local selection use identical logic
- Signature: `createPlaceholderQuestion(type: string, selectedType: string, options?: string[])` → returns a question object

#### Step 2: Update Local Question Type Selection Handler
In QuizHost.tsx, find and update the local question selection handler:
- When user clicks a question type button, call the new helper
- Set flowState with: `{ selectedQuestionType, currentQuestion, flow: 'sent-question', isQuestionMode: true, totalTime }`
- Update keypadCurrentScreen to the appropriate game screen

#### Step 3: Update Admin Command Handler for Consistency
- Verify the 'select-question-type' admin handler also uses the same placeholder creator
- Ensures both paths are identical

#### Step 4: Verify Dependencies
- Confirm the useEffect that calls `sendFlowStateToController` includes all relevant dependencies:
  - `flowState.flow`
  - `flowState.isQuestionMode`
  - `flowState.selectedQuestionType`
  - `keypadCurrentScreen`
  - Any other state that changes on question type selection

#### Step 5: Test Remote State Reception
- Verify remote receives FLOW_STATE with:
  - `currentQuestion` present (hasCurrentQuestion: true)
  - `selectedQuestionType` set correctly
  - `keypadCurrentScreen` matching the selected type
- Remote HostTerminal should then render the appropriate answer entry interface

## Expected Behavior After Fix

### Scenario: Host App Selects Question Type
1. User clicks "Letters Question" button on host app
2. QuizHost updates flowState: `{ selectedQuestionType: 'letters', currentQuestion: {...}, ... }`
3. useEffect triggers, calls `sendFlowStateToController`
4. Remote receives FLOW_STATE with valid currentQuestion
5. Remote HostTerminal renders the letters answer entry interface
6. Remote and host app are synchronized

### Scenario: Remote Selects Question Type (already working, verify stays intact)
1. Remote sends ADMIN_COMMAND 'select-question-type'
2. Host receives command, creates placeholder, sets flowState
3. sendFlowStateToController sends updated state to remote
4. Remote receives FLOW_STATE and renders interface
5. Both stay synchronized (no regression)

## Stability Considerations

1. **No Infinite Loops**: The existing useEffect-driven approach (flowState → sendFlowStateToController) prevents feedback loops
2. **Deduplication**: Remote ignores duplicate FLOW_STATE messages (already implemented based on explorer findings)
3. **Consistent Payload**: Both paths must send identical data to remote
4. **Dependency Arrays**: Critical to ensure all state changes that affect remote are in useEffect dependencies

## Validation Checklist

- [ ] Placeholder question creation is extracted to a reusable helper
- [ ] Local question type selection uses the same placeholder logic as admin handler
- [ ] Both flowState AND keypadCurrentScreen are updated together
- [ ] sendFlowStateToController dependency array includes selectedQuestionType and keypadCurrentScreen
- [ ] Remote receives FLOW_STATE with hasCurrentQuestion: true when host app selects question type
- [ ] Remote displays correct answer entry interface for the selected type
- [ ] Remote selecting question type still works (no regression)
- [ ] No console errors on either host app or remote
- [ ] Screen transitions are smooth and synchronized
