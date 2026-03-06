# Fix: Nearest Wins Question 2 — Player device stuck on "Please wait for host"

## Root Cause

When the host clicks "Next Question" in the QuestionNavigationBar after a Nearest Wins round, **two conflicting things happen simultaneously**:

1. `gameActionHandlers?.nextQuestion?.()` calls `NearestWinsInterface.handleNextRound()`, which:
   - Sets flow to `'sent-question'`
   - Sends a `QUESTION` message to players via `sendQuestionToPlayers()` and IPC
   - Players receive QUESTION → show the number keypad ✓

2. **Immediately after**, QuizHost's `onNextAction` callback (line 6872-6882) does:
   - `setFlowState({ flow: 'idle' })` — overrides the flow back to idle
   - `sendNextQuestion()` — sends a `NEXT` message to players

The `NEXT` message hits the player and triggers `resetQuestionState()` + `transitionToIdleDisplay()`, which kicks the player back to the "Please wait for host" screen. This completely undoes the QUESTION that `handleNextRound` just sent.

The same pattern exists in `onNextQuestion` (line 6905-6915) — identical issue.

**Why Question 1 works:** Question 1 uses `handleStartRound()`, which is called from the config screen — it doesn't go through `QuestionNavigationBar` at all, so there's no conflicting `sendNextQuestion()`/`setFlowState(idle)`.

## Fix

**File: `src/components/QuizHost.tsx`** — Lines 6866-6883 and 6901-6916

For Nearest Wins on-the-spot mode, `handleNextRound` already handles everything: resetting state, sending QUESTION to players, and managing flow. The additional `setFlowState(idle)` and `sendNextQuestion()` are designed for KeypadInterface (where the host manually picks the next question and needs to reset) but are harmful for NearestWinsInterface.

### Change 1: `onNextAction` callback (~line 6866-6883)

Add a check for `showNearestWinsInterface`. When in nearest wins mode, only call `gameActionHandlers?.nextQuestion?.()` and skip the flow override and NEXT broadcast:

```tsx
onNextAction={() => {
  if (isQuizPackMode) {
    handlePrimaryAction();
  } else if (showNearestWinsInterface) {
    // NearestWins handleNextRound handles everything: resets state,
    // sends QUESTION to players, and manages flow
    gameActionHandlers?.nextQuestion?.();
  } else {
    // KeypadInterface / BuzzIn: reset flow and send NEXT
    gameActionHandlers?.nextQuestion?.();
    const defaultOnTheSpotTimer = gameModeTimers.keypad || 30;
    setFlowState(prev => ({
      ...prev,
      flow: 'idle',
      isQuestionMode: true,
      totalTime: defaultOnTheSpotTimer,
      selectedQuestionType: undefined,
      answerSubmitted: undefined,
    }));
    sendNextQuestion();
  }
}}
```

### Change 2: `onNextQuestion` callback (~line 6901-6916)

Same pattern — add nearest wins guard:

```tsx
onNextQuestion={() => {
  if (isQuizPackMode) {
    handleQuizPackNext();
  } else if (showNearestWinsInterface) {
    gameActionHandlers?.nextQuestion?.();
  } else {
    gameActionHandlers?.nextQuestion?.();
    const defaultOnTheSpotTimer = gameModeTimers.keypad || 30;
    setFlowState(prev => ({
      ...prev,
      flow: 'idle',
      isQuestionMode: true,
      totalTime: defaultOnTheSpotTimer,
      selectedQuestionType: undefined,
      answerSubmitted: undefined,
    }));
    sendNextQuestion();
  }
}}
```

## Files to Modify

1. **`src/components/QuizHost.tsx`** — Two callback changes in QuestionNavigationBar props
