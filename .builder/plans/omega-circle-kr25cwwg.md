# Quiz Pack Mode Auto-Progression to Results Summary

## Problem Statement
Currently, when the timer ends in quiz pack mode, the host app does not automatically progress to a results summary page. In contrast, keypad mode auto-progresses to a results summary when the timer finishes. The results summary should display the same layout elements as keypad mode (correct/wrong/no-answer counts, user's answer, fastest team display) but remain hidden until the host clicks "Reveal Answer."

## Current Behavior Analysis
- **Keypad Mode (KeypadInterface)**: Timer ends → Local `timerFinished` state flips → `useEffect` auto-calls `handleShowResults()` → Results screen displays immediately with answer hidden (if hideQuizPackAnswers is true)
- **Quiz Pack Mode (QuizHost + QuizPackDisplay)**: Timer ends → `flowState.flow = 'timeup'` → `showAnswer = true` → Host must manually click "Reveal Answer" button → `handlePrimaryAction` processes reveal & scoring

The quiz pack mode currently skips the results summary display stage and goes directly from "running" timer to waiting for manual reveal action.

## Solution Approach
Implement automatic progression to a results summary screen in quiz pack mode when the timer finishes, while keeping the reveal/scoring action manual.

### Key Implementation Details

**1. Display Results Summary on Timer End**
- When `flowState.flow` becomes `'timeup'`, automatically trigger display of a results summary screen
- This results summary should mirror the KeypadInterface results screen layout:
  - Title: "Question {currentQuestion} Results"
  - Results counts grid (Correct / Wrong / No Answer)
  - Answer display box (showing hidden '••••••' if hideQuizPackAnswers && !answerRevealed)
  - Fastest team display (empty placeholder until revealed)
  - "Reveal Answer" button to trigger the reveal action

**2. Preserve Manual Reveal Action**
- The results summary page should still require the host to click "Reveal Answer" button
- Clicking "Reveal Answer" triggers `handlePrimaryAction('timeup')` which:
  - Reveals the correct answer
  - Triggers answer validation and scoring
  - Sends results to external display
  - Transitions to 'revealed' or 'fastest' flow state
  - Continues with normal progression (fastest team reveal, next question, etc.)

**3. Architectural Integration**
- Modify QuizHost's flow state handling to recognize when `flowState.flow === 'timeup'` and display results summary UI
- Reuse calculation logic from KeypadInterface (`calculateAnswerStats()`, `getCorrectAnswer()`) or move to shared utility
- Ensure the results summary UI integrates with existing QuizHost state management and external display updates

### Files to Modify
1. **src/components/QuizHost.tsx**
   - Add a new `showResultsSummary` state that gets set to `true` when `flowState.flow === 'timeup'`
   - Add conditional rendering to display results summary UI when in quiz pack mode and `showResultsSummary === true`
   - Ensure the "Reveal Answer" button on results summary triggers `handlePrimaryAction('timeup')`
   - Import answer statistics calculation logic (move from KeypadInterface or create shared utility)

2. **Shared Utility (Optional but Recommended)**
   - Create `src/utils/answerStats.ts` to house `calculateAnswerStats()` and `getCorrectAnswer()` logic
   - This allows both KeypadInterface and QuizHost to use the same answer calculation logic
   - Reduces code duplication and ensures consistency

### UI Layout Reference (from Keypad Mode)
The results summary should display:
- Question number and "Results" title
- Three cards showing: Correct (green), Wrong (red), No Answer (gray)
- Answer display box showing:
  - '••••••' if answer not yet revealed
  - Actual answer text after reveal
- Fastest team section (empty/placeholder until revealed)
- "Reveal Answer" button (or "Continue" after reveal)
- Navigation/progression controls

### Flow Sequence (Quiz Pack Mode)
```
Timer running
    ↓
Timer reaches 0
    ↓
flowState.flow = 'timeup' (automatic)
    ↓
showResultsSummary = true (NEW - automatic)
    ↓
Results summary displays with hidden answer
    ↓
Host clicks "Reveal Answer" button
    ↓
handlePrimaryAction('timeup') triggered
    ↓
Answer revealed, scoring calculated, external display updated
    ↓
flowState → 'revealed' or 'fastest'
    ↓
Normal progression continues (fastest team, next question)
```

## Success Criteria
- ✅ When timer ends in quiz pack mode, results summary appears automatically
- ✅ Answer remains hidden (•••••) until host clicks "Reveal Answer"
- ✅ Results summary layout matches keypad mode appearance
- ✅ Reveal action works as before (answer reveals, scoring applies, external display updates)
- ✅ Fastest team reveal still works in normal sequence
- ✅ Progression to next question works correctly
- ✅ No regression in keypad mode behavior
- ✅ Admin commands/remote controls still work for reveal and next actions
