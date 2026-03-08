# Plan: Fix Picture Question Answer Clearing + Fastest Team Display Duration

## Issue 1: Answer cleared on player device during picture question flow

### Root Cause

The quiz pack picture question flow has 3 host steps:
1. **"Send Picture"** → sends `PICTURE` to players (host transitions `ready` → `sent-picture`)
2. **"Send Question"** → sends `QUESTION` to players (host transitions `sent-picture` → `sent-question`)
3. **"Start Timer"** → sends `TIMER_START` to players (host transitions `sent-question` → `running`)

The problem is at **step 2**. When the `QUESTION` message arrives on the player (`src-player/src/App.tsx:777-780`), it unconditionally clears the answer selection:
```js
setAnswerRevealed(false);
setCorrectAnswer(undefined);
setSelectedAnswers([]);  // <-- clears visual answer
```

However, `submittedAnswer` and `submittedAnswerRef` are NOT cleared — so the host still has the answer. But the player's UI visually resets, making the team think their answer was lost. They may then re-submit a different answer, which overwrites the original on the host.

The `PICTURE` handler (`App.tsx:944-959`) does NOT clear answers, so the player can answer during the picture-only phase. Then when the question text arrives, their visual selection disappears.

### Fix

In the player's `QUESTION` handler (`src-player/src/App.tsx`), check if the player already submitted an answer for the current question before clearing `selectedAnswers`. If `submittedAnswerRef.current` is not null AND the player is already on the `'question'` screen (meaning this is a follow-up QUESTION for the same picture question, not a brand new question), preserve `selectedAnswers` and skip clearing.

**File: `src-player/src/App.tsx` ~line 777-780**

Change:
```js
// Reset reveal state
setAnswerRevealed(false);
setCorrectAnswer(undefined);
setSelectedAnswers([]);
```
To:
```js
// Reset reveal state
setAnswerRevealed(false);
setCorrectAnswer(undefined);
// Only clear selected answers if the player hasn't already submitted for this question
// This preserves answers submitted during the picture-only phase of picture questions
if (!submittedAnswerRef.current) {
  setSelectedAnswers([]);
}
```

This also needs to be applied to the pending QUESTION handler (`App.tsx:~1417-1419`) with the same guard.

---

## Issue 2: Fastest team display duration (5s → 30s, with immediate clear on flow advance)

### Current Behavior

In `src-player/src/App.tsx:129-153`, a `useEffect` sets a 5-second timeout when `showFastestTeam` becomes true, then hides the overlay after 5 seconds.

### Required Change

1. **Change timeout from 5000ms to 30000ms** in the `useEffect` (`App.tsx:145`)

2. **Clear fastest team immediately when NEXT, END_ROUND, QUESTION, or PICTURE arrives.** Currently:
   - `NEXT` handler calls `resetQuestionState()` which already clears fastest team state ✅
   - `END_ROUND` handler calls `resetQuestionState()` which already clears fastest team state ✅
   - `QUESTION` handler does NOT clear fastest team state ❌
   - `PICTURE` handler does NOT clear fastest team state ❌

   Add fastest team clearing to the `QUESTION` and `PICTURE` handlers so that when the host moves to a new question (which sends QUESTION or PICTURE), the fastest team overlay disappears immediately.

### Files to Modify

**File: `src-player/src/App.tsx`**

| Location | Change |
|----------|--------|
| Line 145 | Change `5000` to `30000` |
| Lines 130, 132, 139 | Update log messages from "5-second" to "30-second" |
| QUESTION handler (~line 741) | Add fastest team clearing: `setShowFastestTeam(false)` + cancel timer ref |
| PICTURE handler (~line 944) | Add fastest team clearing: `setShowFastestTeam(false)` + cancel timer ref |
| Pending QUESTION handler (~line 1409) | Add fastest team clearing |
| Pending PICTURE handler (~line 1439) | Add fastest team clearing |

---

## Summary of All Changes

| File | What |
|------|------|
| `src-player/src/App.tsx` | Guard `setSelectedAnswers([])` in QUESTION handler with `submittedAnswerRef.current` check |
| `src-player/src/App.tsx` | Same guard in pending QUESTION handler |
| `src-player/src/App.tsx` | Change fastest team timeout from 5000 → 30000 + update logs |
| `src-player/src/App.tsx` | Add fastest team clearing to QUESTION + PICTURE handlers (both live and pending) |
