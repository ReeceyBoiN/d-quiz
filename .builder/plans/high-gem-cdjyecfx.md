# Plan: Fix Sequence Question Shuffling Issue

## Problem Found During Review

The sequence question changes from the previous implementation are mostly correct, but there's a **critical bug** with the shuffling logic:

### Bug: Options shown in correct order when scramble mode is OFF

In `src-player/src/components/QuestionDisplay.tsx`, the shuffling logic at lines 163-200 works like this:
- **Scramble ON** → options get shuffled via `shuffleArray()` ✅
- **Scramble OFF** → options are set in their **original index order** (0, 1, 2, 3...) ❌

For sequence questions, the original order IS the correct answer (the quiz file stores options in the order that concatenates to form `long_answer`). So when scramble mode is OFF, the player would see all options already in the correct order and could just tap them top-to-bottom to win instantly.

**Sequence questions must ALWAYS shuffle their options**, regardless of the scramble toggle. The scramble toggle is for anti-cheating on keypads (letters/numbers/MCQ), but sequence questions inherently need randomized display order.

## Fix Required

### File: `src-player/src/components/QuestionDisplay.tsx` (~lines 163-200)

In the shuffling `useEffect`:

1. **When `scrambled` is false (unscramble branch, line 189-196):** Add a check — if the question type is `sequence`, still shuffle the options instead of resetting to original order.

2. **In the options-update effect (lines 204-218):** When options arrive for a sequence question and there's no existing shuffle order (length mismatch), shuffle instead of using original order.

This ensures sequence options are always randomized for the player, while letters/numbers/MCQ still respect the scramble toggle as usual.

### Also reset `sequenceOrder` when scramble state changes

When the scramble toggle fires mid-question (which resets the options layout), the `sequenceOrder` state should also be cleared so the player's in-progress sequence isn't stale with old indices.

## Summary of Changes

| File | Change |
|------|--------|
| `src-player/src/components/QuestionDisplay.tsx` | Always shuffle options for sequence questions regardless of scramble mode; reset sequenceOrder on layout changes |
