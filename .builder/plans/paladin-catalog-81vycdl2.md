# Fix: Nearest Wins Player Keypad — Re-submission After Timer & Missing Answer Reveal

## Bug 1: Player can re-submit answer after timer ends

### Root Cause

In `src-player/src/App.tsx:807-810`, the `TIMEUP` handler does:
```js
setCurrentQuestion((prev) => ({
  ...prev,
  imageUrl: undefined,  // Clear image when timer ends
}));
```

This creates a **new object reference** for `currentQuestion`. In `src-player/src/components/QuestionDisplay.tsx:124-131`, there's a useEffect that resets all input state when `question` changes:
```js
useEffect(() => {
    setNumberSubmitted(false);  // ← This unlocks the keypad!
    setTimerEnded(false);       // ← This also unlocks!
    // ... other resets
}, [question]);
```

So the sequence is:
1. Player submits → `numberSubmitted = true` → keypad locked
2. Timer ends → `TIMEUP` → `setCurrentQuestion({...prev, imageUrl: undefined})` → new object reference
3. Reset useEffect fires → `numberSubmitted = false`, `timerEnded = false` → **keypad unlocked**
4. 1 second later, `timerEnded` set to `true` again, but there's a window where the player can type and submit

### Fix

**File: `src-player/src/App.tsx`** — In the `TIMEUP` handler, don't mutate `currentQuestion` to clear the image. Instead, either:
- Only clear `imageUrl` if it actually exists (avoid creating new reference unnecessarily), OR
- Better: preserve `numberSubmitted` state across TIMEUP by not resetting it in the useEffect when only `imageUrl` changed

The cleanest fix: In `QuestionDisplay.tsx`, change the reset useEffect to use a **question identity key** (like `question?.q` or a combination of question text + type) instead of the entire question object reference. This way, cosmetic updates to the question object (like clearing imageUrl) don't trigger a full state reset.

**File: `src-player/src/components/QuestionDisplay.tsx`**
- Change `[question]` dependency to `[question?.q, question?.type, question?.text]` so the reset only fires on actual question changes, not metadata updates

## Bug 2: Correct answer not shown on player device after reveal

### Root Cause

The `REVEAL` handler in `App.tsx` correctly sets `answerRevealed = true` and `correctAnswer`. For letters/multiple-choice, `QuestionDisplay.tsx` shows green/red flashing buttons. But for the **numbers keypad**, there's no reveal display — the code only checks `timerEnded || numberSubmitted` for disabling buttons. It never shows the correct answer number.

### Fix

**File: `src-player/src/components/QuestionDisplay.tsx`** — In the numbers section (`isNumbers &&`):

1. When `answerRevealed` is true, show a prominent "Correct Answer" display above the keypad showing the target number
2. Show whether the player's guess was correct/wrong and by how much (difference)
3. Grey out / disable the entire keypad (it already does this via `numberSubmitted` but reinforce with `answerRevealed`)
4. Keep this display until the question changes (which happens on NEXT or new QUESTION message)

The correct answer display should persist until the "closest team" is triggered. Looking at the flow:
- REVEAL → show correct answer on player device
- FASTEST → show fastest/closest team overlay (already handled by `FastestTeamOverlay`)
- NEXT → reset everything

The correct answer display naturally stays because `answerRevealed` remains `true` until a new QUESTION resets it (`setAnswerRevealed(false)` in QUESTION handler line 763). The FASTEST overlay shows on top without clearing the answer.

### Implementation

Add a reveal section in the numbers keypad area:
```jsx
{isNumbers && answerRevealed && correctAnswer !== undefined && (
  <div className="correct-answer-display">
    <p>Correct Answer: {correctAnswer}</p>
    {submittedAnswer && (
      <p>Your guess: {submittedAnswer} (off by {Math.abs(Number(submittedAnswer) - Number(correctAnswer))})</p>
    )}
  </div>
)}
```

Also ensure all number buttons check `answerRevealed` in their disabled state alongside `timerEnded || numberSubmitted`.

## Files to Modify

1. **`src-player/src/components/QuestionDisplay.tsx`**
   - Fix reset useEffect dependency to use question identity, not object reference
   - Add correct answer reveal display for numbers keypad
   - Add `answerRevealed` check to number button disabled states

2. **`src-player/src/App.tsx`**
   - No changes needed — the TIMEUP handler's `setCurrentQuestion` is fine once QuestionDisplay handles the dependency correctly
