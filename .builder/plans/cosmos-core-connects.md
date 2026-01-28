# Fix FastestTeamDisplay Not Closing on Next Question in Quiz Pack Mode

## Issue Summary
When "Next Question" is clicked in Quiz Pack mode, the FastestTeamDisplay overlay remains visible instead of closing. The next question cannot be displayed until the overlay is manually closed.

## Root Cause Analysis

The codebase has different mechanisms for closing FastestTeamDisplay depending on the game mode:

### Keypad Mode (On-The-Spot) - WORKS
- Lines 705-711 in QuizHost.tsx contain an effect that monitors `keypadCurrentScreen`
- When KeypadInterface calls `handleNextQuestion`, it sets `currentScreen` to `'question-types'`
- The effect detects this change and calls `setShowFastestTeamDisplay(false)`
- Flow: KeypadInterface state change → parent effect → fastest display closes

### Quiz Pack Mode - BROKEN
- Lines 1815-1866 handle the 'fastest' flow state and next question advancement in Quiz Pack
- The code resets team data and advances the question but **does NOT close the fastest team display**
- No effect monitors this mode transition like it does for Keypad mode
- Result: FastestTeamDisplay stays visible even though a new question loads

## Solution

Add explicit `setShowFastestTeamDisplay(false)` call in the Quiz Pack next question handler.

### Change Location
File: `src/components/QuizHost.tsx`
Lines: 1815-1832 (Quiz pack mode section in handlePrimaryAction)

### Specific Fix
In the Quiz Pack branch of the 'fastest' case, after resetting team data but before advancing the question, close the fastest team display:

**Current code (lines 1815-1832):**
```jsx
} else {
  // For quiz pack: Move to next question or end round
  if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
    // Clear team answers and statuses for next question
    setTeamAnswers({});
    setTeamResponseTimes({});
    setLastResponseTimes({});
    setTeamAnswerCounts({});
    setTeamAnswerStatuses({});
    setTeamCorrectRankings({});
    console.log('[QuizHost] ADVANCING QUESTION: Resetting gameTimerStartTime from', gameTimerStartTime, 'to null for next question');
    setGameTimerStartTime(null); // Reset timer start time for new question

    setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex + 1);
```

**Add one line after clearing team data:**
```jsx
setShowFastestTeamDisplay(false); // Close fastest team display before showing next question
```

## Expected Result
When "Next Question" button is clicked in Quiz Pack mode while FastestTeamDisplay is open:
1. Team data is reset
2. FastestTeamDisplay closes immediately
3. Next question displays cleanly without overlay obstruction
4. User workflow is uninterrupted

## Implementation Steps
1. Add `setShowFastestTeamDisplay(false);` after line 1824 in the Quiz Pack next question section
2. Verify the placement is within the `if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1)` block
3. Test by triggering fastest team display in quiz pack mode and clicking Next Question
