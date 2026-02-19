# Plan: Display Full Answer Text in Results Summary

## Problem Summary
Currently, when the correct answer is revealed in the results summary on the external display:
1. **Multiple choice questions**: Only the letter is shown (e.g., "✓ D") instead of the full option text (e.g., "✓ D: Witchfinder General")
2. **Letter questions**: Only the letter is shown (e.g., "✓ B") instead of the full answer text (e.g., "✓ B: CorrectAnswerText")

## User Requirements
- Multiple choice: Show "✓ D: (Whatever the text option was for option D)"
- Letter questions: Show the full answer text from the question's answerText field

## Current Implementation Flow
1. **QuizHost.tsx** collects question data and calls `getAnswerText()` to format the answer
2. **getAnswerText()** (in quizHostHelpers.ts) converts the correctIndex to a single letter (A, B, C, etc.) for both multi and letter question types
3. **QuizHost** sends this single-letter answer to the external display via sendToExternalDisplay()
4. **ExternalDisplayWindow.tsx** displays the results summary by showing `displayData.data?.answer` which is just the letter

## Solution Approach

### Option: Send Enhanced Answer Data from QuizHost
Modify the data payload sent from QuizHost to include both the letter AND the full answer text, then update ExternalDisplayWindow to display the enhanced format.

### Implementation Steps

#### Step 1: Modify QuizHost.tsx
When sending results to the external display, instead of sending only `answer: getAnswerText()`, send additional data:
- Add `answerLetter`: the single letter (A, B, C, etc.)
- Add `answerText`: the full answer text (option text for multi, answerText for letters)
- For multiple choice: Include `options` array so we can access the full option text
- For letter questions: Include the `answerText` from the question

Modify these sections in QuizHost.tsx:
1. **Line ~1948-1964** (Quiz Pack mode result send): Add answerText and answerLetter to the data payload
2. **Line ~3430-3440** (On-the-spot mode result send): Add answerText and answerLetter to the data payload

#### Step 2: Modify ExternalDisplayWindow.tsx
Update the resultsSummary case (line ~602-620) to:
1. Display the formatted answer using both the letter and text: "✓ D: Witchfinder General" for multi
2. For letters: "✓ B: CorrectAnswerText"
3. Fallback gracefully to just the letter if full text isn't available

## Key Files to Modify
1. **src/components/QuizHost.tsx** - Enhance the data payload sent to external display
2. **src/components/ExternalDisplayWindow.tsx** - Update how the answer is rendered in resultsSummary

## Data Structure Changes
### Current:
```javascript
{
  type: 'DISPLAY_UPDATE',
  mode: 'resultsSummary',
  data: {
    text: currentQuestion.q,
    answer: 'D',  // just letter
    correctIndex: 3,
    type: 'multi',
    ...
  }
}
```

### Enhanced:
```javascript
{
  type: 'DISPLAY_UPDATE',
  mode: 'resultsSummary',
  data: {
    text: currentQuestion.q,
    answer: 'D',  // keep for backward compatibility
    answerLetter: 'D',
    answerText: 'Witchfinder General',  // full option text or answerText
    correctIndex: 3,
    type: 'multi',
    options: [...],  // include for multi questions
    ...
  }
}
```

## Display Format
**Multiple Choice**: "✓ D: Witchfinder General"
**Letter Questions**: "✓ B: CorrectAnswerText"

## Backward Compatibility
The changes are backward compatible:
- Keep sending the existing `answer` field (single letter)
- Add new optional fields (answerLetter, answerText, options)
- ExternalDisplayWindow prefers the enhanced format but falls back to single letter if not available
