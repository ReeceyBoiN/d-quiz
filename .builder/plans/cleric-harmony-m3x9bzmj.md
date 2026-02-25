# Plan: Add Question Type Selection to Host Remote

## Problem Statement
The host remote (controller app running on separate device) doesn't display a "Select Question Type" screen in on-the-spot mode, while the keypad (local host UI) does show this screen with four options: Letters Question, Multiple Choice Question, Numbers Question, and Sequence Question.

## Current State
- **Keypad (KeypadInterface.tsx)**: Has full question type selection with all 4 types (letters, multiple-choice, numbers, sequence)
- **Host Remote (src-player/)**: Has `QuestionTypeSelector.tsx` component and API methods, but the UI isn't being displayed in the flow
- **Host Validation (QuizHost.tsx)**: Currently only accepts letters, numbers, and multiple-choice from remote commands (needs to accept sequence)
- **UI Mismatch**: Remote only defines 3 types in QUESTION_TYPES, missing Sequence

## Root Causes Identified
1. **Visibility Issue**: The `QuestionTypeSelector` component exists but may not be triggered/rendered in the host remote's main flow component
2. **Missing Sequence Support**: Remote's QUESTION_TYPES array doesn't include 'sequence'
3. **Server-Side Validation**: QuizHost.tsx admin command handler doesn't accept 'sequence' as a valid type
4. **Feature Parity**: Remote keypad UI (HostRemoteKeypad, AnswerInputKeypad) may need updates to handle sequence answers

## Implementation Approach

### Phase 1: Display Question Type Selection Screen
1. **Identify the flow component** that controls what screen is shown on the host remote when in on-the-spot idle mode
2. **Check condition for showing QuestionTypeSelector**: Verify that the component is being conditionally rendered based on:
   - In on-the-spot mode (flowState.flow === 'idle')
   - No question selected yet (flowState.selectedQuestionType === undefined/null)
3. **Add/Fix the render logic** if the QuestionTypeSelector isn't being shown
4. **Test that the screen appears** when the remote is in the correct state

### Phase 2: Add Sequence Type Support to Remote UI
1. **Update QuestionTypeSelector.tsx**:
   - Add 'sequence' to the QUESTION_TYPES array
   - Add a fourth button/card for "Sequence Question" matching the keypad's design
   - Ensure labels and descriptions match the keypad UI exactly

2. **Verify sendAdminCommand integration**:
   - Confirm that selecting 'sequence' calls sendAdminCommand('select-question-type', { type: 'sequence' })
   - Test the command path from remote to host

### Phase 3: Add Server-Side Sequence Support
1. **Update QuizHost.tsx admin command handler**:
   - Modify the 'select-question-type' case to accept 'sequence' alongside 'letters', 'numbers', 'multiple-choice'
   - Ensure getTotalTimeForQuestion() handles 'sequence' type correctly
   - Verify sendFlowStateToController sends selectedQuestionType back to all remotes

2. **Verify state compatibility**:
   - Check that flowState.HostFlow type definition supports selectedQuestionType: 'sequence'
   - Update TypeScript types if needed

### Phase 4: Ensure Remote Answer Input Handles Sequence
1. **Check HostRemoteKeypad.tsx**:
   - Verify it can render the correct input UI when selectedQuestionType is 'sequence'
   - Check if sequence needs special handling (like shuffled options display)

2. **Check AnswerInputKeypad.tsx**:
   - Ensure fallback keypad works with sequence type
   - Verify the expected-answer submission works for sequence

3. **Add sequence-specific UI if needed**:
   - If sequence requires different input handling than other types, implement it in the remote keypad components

### Phase 5: Testing & Validation
1. Test the full flow on host remote:
   - Open host remote in on-the-spot mode
   - Verify "Select Question Type" screen appears
   - Click each of the 4 buttons (Letters, Multiple Choice, Numbers, Sequence)
   - Verify host receives the selection and updates its state
   - Verify players receive the correct question type on their keypads
   - Verify answering works correctly for each type via remote

## Key Files to Modify
1. **src-player/src/components/HostTerminal/QuestionTypeSelector.tsx** - Add Sequence button and type
2. **src/components/QuizHost.tsx** - Update admin command handler to accept 'sequence'
3. **src/state/flowState.ts** - Verify Sequence type support in type definitions (if needed)
4. **src-player/src/components/HostTerminal/HostRemoteKeypad.tsx** - Verify sequence handling
5. **src-player/src/components/HostTerminal/AnswerInputKeypad.tsx** - Verify sequence handling
6. **Host remote flow controller** - Ensure QuestionTypeSelector is rendered in the correct flow state (TBD after code review)

## Design Considerations
- UI styling and layout should match the keypad exactly (3+ color-coded cards)
- Icons/symbols should match: T for Letters, chart for Multiple Choice, # for Numbers, sequence icon
- Descriptions should match: "Answer with letters A-Z", "Choose from multiple options", "Answer with numbers 0-9", and sequence description
- The screen should only appear when: on-the-spot mode is active AND no question type is yet selected

## Success Criteria
✅ Host remote displays "Select Question Type" screen in on-the-spot idle mode  
✅ All 4 question types are available (Letters, Multiple Choice, Numbers, Sequence)  
✅ Clicking a type sends the selection to the host  
✅ Host accepts all 4 types and broadcasts to players  
✅ Remote can submit answers for all 4 types  
✅ UI matches the keypad's visual design and layout  
