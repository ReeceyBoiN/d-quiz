# Plan: Fix Sync Issues for Keypad On The Spot Buttons

## Overview
Based on an in-depth investigation of all button triggers, stage transitions, and bidirectional state synchronization between the Host App and Host Remote in Keypad On-The-Spot mode, the core underlying logic (scoring, data-saving, external display syncing) is highly consistent. The primary synchronization failure occurs during the **"Next Question" transition**.

## Issue Details

### 1. Host UI "Next Question" Button Fails to Clear Host State
When the host clicks "Next Question" via the Host App's `QuestionNavigationBar`, the system triggers `gameActionHandlers.nextQuestion()`. This successfully resets the `KeypadInterface`'s internal UI state (timers, current screen, etc.). However, it **does not** explicitly clear the parent `flowState` fields for `selectedQuestionType` and `answerSubmitted`. 

Because of this, the `KeypadInterface` immediately receives the old `externalQuestionType` and restores its UI to the previously selected question type instead of remaining on the "Select Question Type" screen. Furthermore, the `sendNextQuestion()` network broadcast to players is never triggered from this specific code path.

### 2. Host Remote "Next Question" Fails to Clear Local UI State
Conversely, when the host remote triggers 'next-question' (via the admin listener), it directly wipes the host `flowState` and team answers but completely bypasses `gameActionHandlers.nextQuestion()`. This means the `KeypadInterface` is never told to reset its internal states (such as `selectedLetter`, `currentScreen`, and broadcast guards). As a result, the remote moves to 'idle', but the Host App's UI can get stuck on a stale game-playing screen.

## Recommended Fixes

### 1. Fix Host UI `onNextAction` & `onNextQuestion` (`src/components/QuizHost.tsx`)
In the `QuestionNavigationBar` component rendering inside `QuizHost.tsx`, update `onNextAction` and `onNextQuestion` (for On-The-Spot mode) to explicitly reset the relevant `flowState` fields and broadcast `sendNextQuestion()` to player devices, alongside calling the `gameActionHandlers.nextQuestion()`.
```typescript
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
```

### 2. Fix Host Remote Admin Listener `next-question` (`src/components/QuizHost.tsx`)
In the `adminListener` (the `'next-question'` case for `!deps.isQuizPackMode`), add `answerSubmitted: undefined` to the `deps.setFlowState` payload. Crucially, call `deps.gameActionHandlers?.nextQuestion?.()` to ensure the `KeypadInterface` resets its internal state perfectly symmetrically to the Host UI.
```typescript
deps.setFlowState(prev => ({
  ...prev,
  flow: 'idle',
  isQuestionMode: true,
  totalTime: defaultOnTheSpotTimer,
  selectedQuestionType: undefined,
  answerSubmitted: undefined,
}));

if (deps.gameActionHandlers?.nextQuestion) {
  deps.gameActionHandlers.nextQuestion();
} else {
  sendNextQuestion();
  setTeamAnswers({});
  setTeamResponseTimes({});
  // ... and other team reset setters
}
```

These changes ensure both devices trigger the exact same local state cleanup, host-level state reset, and network broadcasts when navigating to the next question in Keypad On-The-Spot mode. All other buttons (Reveal Answer, Show Fastest Team, Confirm Answer, Timers) correctly trigger the shared data layer logic and sync effectively.
