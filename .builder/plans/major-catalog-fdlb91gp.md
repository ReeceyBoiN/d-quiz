# Fix: Numbers vs Nearest Wins Question Type Display

## Problem
When a quiz pack round is loaded, all questions with `user_view="numbers"` are being assigned type `"nearest"` in the parser. This causes the UI to display "Numbers" (via `getQuestionTypeLabel`) but triggers Nearest Wins scoring/behavior logic (via `isNearestWinsQuestion` checks throughout the codebase).

The actual distinction is:
- **Numbers questions**: Regular questions where the answer is a number. `user_view="numbers"` in the XML, and the round `<game>` is NOT "Nearest Wins".
- **Nearest Wins questions**: The round `<game>` element is "Nearest Wins". Players guess a number and the closest guess wins.

## Root Cause
In both `quizLoader.js:69` and `src/utils/quizLoader.ts:63`:
```js
else if (userView === "numbers") type = "nearest";  // BUG: always sets to "nearest"
```
This unconditionally sets all `numbers` user_view questions to `"nearest"` type, regardless of whether the round is actually a Nearest Wins round.

## Fix

### 1. Fix parsers: `quizLoader.js` and `src/utils/quizLoader.ts`

Change the type assignment for `userView === "numbers"` to be conditional on the round game:

```js
else if (userView === "numbers") type = roundGame === "Nearest Wins" ? "nearest" : "numbers";
```

This ensures:
- Numbers questions in a "Nearest Wins" round → type `"nearest"` (triggers nearest wins scoring)
- Numbers questions in any other round → type `"numbers"` (standard numeric answer)

### 2. Fix label display: `src/components/QuizPackDisplay.tsx`

Update `getQuestionTypeLabel` (line 251-268) to distinguish the types:

```js
case 'numbers':
  return 'Numbers';
case 'nearest':
case 'nearestwins':
  return 'Nearest Wins';
```

Currently both map to `'Numbers'`, which is incorrect for actual nearest wins questions.

### 3. No other changes needed

The rest of the codebase already correctly handles the distinction:
- `isNearestWinsQuestion` checks (QuizPackDisplay, QuizHost, QuestionNavigationBar) all check for `type === 'nearest' || type === 'nearestwins'` — these will correctly NOT match `"numbers"` type after the fix.
- `getPlayerInputType` in QuizHost maps both `'numbers'` and `'nearest'` to the `'numbers'` player input — this is correct since both types use a numeric keypad on player devices.
- `KeypadInterface` already handles both `'numbers'` and `'nearest'` types for the keypad display.

## Files to Modify
1. **`quizLoader.js`** — line 69: conditional type assignment
2. **`src/utils/quizLoader.ts`** — line 63: same conditional type assignment  
3. **`src/components/QuizPackDisplay.tsx`** — lines 257-260: separate label for nearest vs numbers
