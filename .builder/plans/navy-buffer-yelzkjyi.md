# Fix: Sequence Questions Not Marked Correct in Quiz Pack Mode

## Problem

When a player submits the correct sequence order for a sequence question in quiz pack mode, it's always marked as **wrong** even when the order is correct.

**Root Cause:** The answer comparison logic compares two incompatible formats:

- **Player submits:** A comma-separated string of all option texts in their chosen order, e.g. `"Die,Go,Arm,An,Do"` (built at `src-player/src/components/QuestionDisplay.tsx:894`)
- **Host's "correct answer"** (`getAnswerText()` in `src/utils/quizHostHelpers.ts:33`): Returns only a **single option item** from `question.options[question.correctIndex]`, e.g. just `"Die"` — not the full correct sequence.

The comparison at `src/components/QuizHost.tsx:5338-5339` compares the full comma-separated sequence against this single item, so they never match.

## How Sequence Data Works

- Sequence questions have an `options` array that is stored **in the correct order** as loaded from the quiz file
- The player sees these options **shuffled**, selects them one by one, and submits the full order as comma-separated text
- The `correctIndex` field is not meaningful for sequence questions (it's not set during loading for sequence type)
- The correct answer for a sequence question is: **all options joined in their original (correct) order**

## Fix

### File 1: `src/utils/quizHostHelpers.ts` — `getAnswerText()` function

Update the sequence case to return all options joined as a comma-separated string (matching the player's submission format) instead of a single item:

```ts
// BEFORE (line ~33):
if (question.type?.toLowerCase() === 'sequence' && question.options && question.correctIndex !== undefined) {
    return question.options[question.correctIndex] || '';
}

// AFTER:
if (question.type?.toLowerCase() === 'sequence' && question.options && question.options.length > 0) {
    return question.options.join(',');
}
```

### File 2: `src/components/QuizHost.tsx` — `getCorrectAnswer()` helper (~line 6810)

Same fix for the local helper that also returns a single item for sequence:

```ts
// BEFORE:
if (currentQuestion.type?.toLowerCase() === 'sequence' &&
    currentQuestion.options &&
    currentQuestion.correctIndex !== undefined) {
  return currentQuestion.options[currentQuestion.correctIndex] || null;
}

// AFTER:
if (currentQuestion.type?.toLowerCase() === 'sequence' &&
    currentQuestion.options &&
    currentQuestion.options.length > 0) {
  return currentQuestion.options.join(',');
}
```

### File 3: `src/components/QuizHost.tsx` — Answer comparison logic (~line 5338)

The existing sequence comparison at line 5338 already does a direct string comparison of the full comma-separated answer, which will work correctly once `getAnswerText()` returns the right value. No change needed here — but we should ensure the `isAnswerCorrect` string comparison handles potential whitespace differences (the player joins with `','` while go-wide joins with `', '`). The current `trim()` on each side handles this.

### File 4: Answer display for sequence questions

The `answerText` field from the quiz loader (set to `longAns`) should already contain the full answer text (e.g., "Diego Armando") for display purposes. The `getAnswerText()` change only affects the comparison value used for scoring. We need to verify that the results summary / correct answer display still shows the human-readable answer text rather than the comma-separated options.

Check that `src/components/QuizHost.tsx` around line 5398-5408 handles sequence display properly — if it falls through to the else case it will use the new comma-joined value. We may need to add a specific sequence case that uses `answerText` for display.
