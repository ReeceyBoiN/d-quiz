# Fix: Players Can't Re-Buzz After Host Marks Answer Wrong

## Root Cause

The player's `QuestionDisplay.tsx` component has an **internal `submitted` state** (`const [submitted, setSubmitted] = useState(false)`) that gets set to `true` when a player taps the BUZZ IN button (line 286). This state is only reset when the question changes (line 139 via `questionIdentity` effect).

When the host marks a buzz wrong:
1. Host sends `BUZZ_RESULT` → Player's `App.tsx` clears `buzzLockedBy` 
2. Host sends `BUZZ_RESET` → Player's `App.tsx` clears `buzzLockedBy`, `buzzLockedOut`, `submittedAnswer`, and `submittedAnswerRef`

However, **none of these reset the QuestionDisplay's internal `submitted` state**. So when the component re-renders with the normal buzz button (line 964-976), the button is still `disabled={timerEnded || submitted}` where `submitted` is still `true`.

## Fix

**File: `src-player/src/components/QuestionDisplay.tsx`**

Add a `useEffect` that watches `buzzLockedBy` and `buzzLockedOut`. When both become falsy for a buzz-in question type (meaning a BUZZ_RESET was received and this team is allowed to re-buzz), reset the internal `submitted` state to `false` so the button becomes clickable again.

```tsx
// Reset internal submitted state when buzz lockout is cleared (after wrong answer reset)
useEffect(() => {
  if (isBuzzIn && !buzzLockedBy && !buzzLockedOut) {
    setSubmitted(false);
    setSubmittedAnswer(null);
  }
}, [buzzLockedBy, buzzLockedOut, isBuzzIn]);
```

This should be placed after the existing `questionIdentity` reset effect (around line 147). The `isBuzzIn` guard ensures this only affects buzz-in mode and doesn't interfere with other question types.

No other files need changes — the host-side logic in both `QuizHost.tsx` (quiz pack mode) and `BuzzInDisplay.tsx` (on-the-spot mode) already correctly sends `BUZZ_RESET` with the right locked-out team list.
