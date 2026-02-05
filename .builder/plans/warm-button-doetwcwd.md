# Plan: Fix Answer Reveal Highlighting in Quiz Pack Mode

## Problem
When "reveal answer" is triggered in quiz pack mode, the player devices are not properly highlighting the correct/incorrect answers with visual feedback (green for correct, red for incorrect). This works flawlessly in on-the-spot keypad mode but fails in quiz pack mode.

## Root Cause Analysis
**KeypadInterface (On-the-Spot - WORKING):**
- Uses `handleRevealAnswer()` to broadcast reveal data
- Broadcasts via IPC: `(window as any).api.network.broadcastReveal(revealData)`
- RevealData includes: `{ answer, correctIndex, type, selectedAnswers }`
- Clean separation: computes answers, calls callbacks, broadcasts reveal

**QuizHost (Quiz Pack - NOT WORKING):**
- Has multiple reveal paths:
  1. Explicit `handleRevealAnswer()` - sends reveal correctly
  2. Flow-based 'running'/'timeup' case in `handlePrimaryAction()` - also sends reveal
- Both paths attempt to broadcast reveal, but there may be timing issues or missing data when broadcasting

**Key Difference Likely:**
The KeypadInterface approach is isolated and straightforward - it does ONE thing when reveal is called. The QuizHost approach is entangled with a complex state machine flow, and the broadcast may be happening before all state is properly updated, or the reveal data format differs slightly.

## Solution Approach
**Copy the exact reveal broadcasting logic from KeypadInterface to QuizHost:**

1. **Identify the KeypadInterface.handleRevealAnswer reveal broadcasting code:**
   - The part that calls `(window as any).api.network.broadcastReveal(revealData)`
   - Ensure it includes all necessary data: answer, correctIndex, type, selectedAnswers
   - The format and structure that works for player devices

2. **Modify QuizHost's quiz pack reveal paths:**
   - Apply the SAME broadcast structure to both:
     - Explicit `handleRevealAnswer()` function
     - Flow state 'running'/'timeup' case in `handlePrimaryAction()`
   - Ensure the revealData includes:
     - `answer`: The correct answer string
     - `correctIndex`: The index of the correct answer (for highlighting)
     - `type`: The question type (letters, multiple-choice, numbers, sequence)
     - `selectedAnswers`: Empty array (matches KeypadInterface)

3. **Verify data accuracy:**
   - Confirm `getAnswerText(currentQuestion)` returns the same format as KeypadInterface's `getCorrectAnswer()`
   - Verify `currentQuestion.correctIndex` is being set correctly for quiz pack questions

## Implementation Details

**Files to Modify:**
- `src/components/QuizHost.tsx` - Update both reveal code paths:
  1. `handleRevealAnswer()` function (~line 2468)
  2. `handlePrimaryAction()` flow case 'running'/'timeup' (~line 1513)

**Changes Required:**
1. Extract broadcast logic from KeypadInterface.handleRevealAnswer
2. Apply exact same broadcast call structure to both QuizHost reveal paths
3. Ensure revealData format matches KeypadInterface exactly
4. Test that player devices receive and process the reveal correctly

## Critical Files for Reference
- `src/components/KeypadInterface.tsx` lines 1038-1102 - handleRevealAnswer with working broadcast
- `src/components/QuizHost.tsx` lines 2468-2495 - handleRevealAnswer (needs update)
- `src/components/QuizHost.tsx` lines 1513-1610 - 'running'/'timeup' case (needs update)
- `electron/backend/server.js` - Backend broadcastReveal implementation (for reference)

## Expected Outcome
After applying KeypadInterface's exact reveal broadcasting logic to QuizHost:
- Player devices receive the REVEAL message with complete data
- Player app correctly determines answer correctness
- Visual highlighting (green/red) displays correctly on player devices for both quiz pack AND on-the-spot modes
