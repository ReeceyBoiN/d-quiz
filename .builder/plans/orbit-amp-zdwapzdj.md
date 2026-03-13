# Enable Buzz-In Before "Send Question" in Buzz-In Pack Mode

## Problem
In buzz-in quiz pack mode, when a question loads, the placeholder broadcast to players uses the **original question type** (numbers, letters, multiple-choice, etc.) instead of `'buzzin'`. This means players see the original answer interface (number pad, letter grid, etc.) instead of the buzz-in button. The host reads the question aloud, so players should only see the buzz-in button — not the question text or answer options.

The same issue affects:
- The actual "Send Question" broadcast (sends original type instead of `'buzzin'`)
- Late joiners (receive the question with original type)

## Solution
In buzz-in pack mode (`isBuzzinPackMode === true`), override the question type to `'buzzin'` in ALL player-facing broadcasts. This ensures players always see the buzz-in button regardless of the underlying question type.

## File to Modify

### `src/components/QuizHost.tsx`

**1. Placeholder broadcast on question change (~line 1158)**
When `isBuzzinPackMode`, override `normalizedType` to `'buzzin'` and set `placeholderCount` to `1`. This makes players see the buzz-in button immediately when the host advances to a new question.

**2. Placeholder broadcast for first question init (~line 1235)**
Same override — when `isBuzzinPackMode`, use type `'buzzin'` and `placeholderCount = 1`.

**3. handlePrimaryAction — "Send Question" flow (~lines 2417, 2463, 2514)**
When `isBuzzinPackMode`, override the `normalizedType` to `'buzzin'` in all three send paths (picture+question, question-only, sent-picture). This prevents the player interface from switching to the original question type when the host clicks "Send Question". The host reads the question aloud — players just need the buzz-in button.

**4. Late joiner game state (~line 1805)**
When `isBuzzinPackMode`, override the question type sent to late joiners to `'buzzin'` so they also see the buzz-in button instead of the original answer interface.

**5. sendNextQuestion placeholder broadcast (~line 3218)**
When `isBuzzinPackMode`, override the `normalizedType` to `'buzzin'`.

## Summary of Changes
All changes are in `QuizHost.tsx`. Each change is a simple conditional override:
```
const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
```
And for placeholder counts, when `isBuzzinPackMode`, use `1` instead of the type-based count.

This ensures players in buzz-in pack mode always see the buzz-in button from the moment a question loads on the host screen, well before "Send Question" is triggered.
