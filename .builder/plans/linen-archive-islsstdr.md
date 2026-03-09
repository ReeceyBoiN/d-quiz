# Plan: Fix Sequence Question - Remove from On-The-Spot & Fix Quiz Pack Ordering

## Problem Summary

Two issues with the sequence question type:

1. **On-the-spot mode** shows "Sequence Question" as a selectable type on the keypad question selection screen. It should NOT be available in on-the-spot mode (sequence only makes sense with pre-loaded quiz pack data).

2. **Quiz pack mode** sequence questions currently behave like single-answer multiple choice — the player taps one option and it locks in immediately. Instead, players should be able to tap ALL options in their chosen order (e.g., "tap numbers smallest to largest"), and that full ordered sequence gets submitted to the host for correctness checking.

## How Sequence Questions Work (from quiz pack data)

- `user_view: "sequence"` → `type: "sequence"`
- `options`: array of tokens to reorder (e.g., ["Die", "Go", "Arm", "An", "Do"])
- `long_answer`: the correct assembled result (e.g., "Diego Armando")
- Correct order = the order of options that, when concatenated, matches `long_answer`

## Changes Required

### 1. Remove Sequence from On-The-Spot Question Selection (Host App)

**File: `src/components/KeypadInterface.tsx`** (~line 2377-2385)
- Remove or hide the "Sequence Question" button from the question-types screen
- This is the 4th button in the flex row at the question type selection screen

**File: `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx`**
- Remove the `sequence` entry from the `QUESTION_TYPES` array (this is the host remote's on-the-spot question type selector)

### 2. Fix Sequence Question Player UI for Quiz Pack Mode

**File: `src-player/src/components/QuestionDisplay.tsx`** (~lines 799-825)

Current behavior: Sequence options use the same `handleAnswerSelect(originalIndex)` as MCQ, which submits a single answer immediately.

New behavior:
- Add new state: `sequenceOrder` (array of originalIndex values tracking tap order)
- Add new state: `sequenceLocked` (boolean, locked once all options selected and auto-submitted)
- When a player taps an option:
  - If not already in `sequenceOrder`, append it
  - Show a number badge on the option indicating its position in the sequence (1st, 2nd, 3rd...)
  - If all options are now selected, **auto-lock and auto-submit** the full sequence immediately (no confirm button)
- **Undo**: Tapping the most recently added option removes it from the sequence (last-in undo)
- **Reset button**: A "Reset" button clears all selections so the player can start fresh
- Submit format: send the ordered sequence as a comma-separated string of the option texts (e.g., `"Die,Go,Arm,An,Do"`)
- Once locked/submitted, disable all interaction (options greyed out, reset hidden)

### 3. Fix Sequence Answer Scoring on Host Side

**File: `src/components/KeypadInterface.tsx`** (getCorrectAnswer, ~line 312-317)

Current behavior for sequence in `getCorrectAnswer()`:
```ts
if (currentLoadedQuestion.type?.toLowerCase() === 'sequence' &&
    currentLoadedQuestion.options &&
    currentLoadedQuestion.correctIndex !== undefined) {
  return currentLoadedQuestion.options[currentLoadedQuestion.correctIndex] || '';
}
```
This returns a single option at `correctIndex`, which is wrong. For sequence, we need to return the correct ordered sequence of ALL options.

New behavior:
- For sequence type, compute the correct order from the options and `answerText` (which comes from `long_answer`)
- Return as a comma-separated string matching the submission format

**File: `src/components/QuizHost.tsx`** (~line 5039-5050, `isAnswerCorrect`)
- The existing string comparison logic should work if both the submitted answer and correct answer use the same comma-separated format

**File: `src/utils/quizLoader.ts`** (parseQuestion function)
- For sequence questions, store the correct order. Options in the quiz file are already in the correct order (they concatenate to form `long_answer`). Store this as `correctSequence` or use the existing `answerText` field which already gets `long_answer`.

### 4. Sequence Answer Format Convention

- **Correct answer** (from quiz data): options joined in correct order, comma-separated: `"Die,Go,Arm,An,Do"`
- **Player submission**: options joined in player-chosen order, comma-separated: `"Die,Go,Arm,An,Do"`
- **Comparison**: exact string match (case-insensitive) of the full sequence string

## Critical Files to Modify

| File | Change |
|------|--------|
| `src/components/KeypadInterface.tsx` | Remove sequence button from on-the-spot question types; fix `getCorrectAnswer()` for sequence |
| `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx` | Remove sequence from QUESTION_TYPES array |
| `src-player/src/components/QuestionDisplay.tsx` | New ordered-selection UI for sequence questions |
| `src/utils/quizLoader.ts` | Ensure sequence questions store correct answer as ordered option string |

## What Does NOT Change
- Quiz pack file parsing structure (XML format stays the same)
- Network message format (PLAYER_ANSWER still sends answer string)
- Host scoring logic in QuizHost.tsx (string comparison works with new format)
- External display rendering
- Timer behavior
