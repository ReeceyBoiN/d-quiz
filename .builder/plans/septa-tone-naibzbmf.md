# Plan: Fix Host App and Remote Synchronization for Keypad On-The-Spot Mode

## Issue Summary
1. **Reveal Answer doesn't ping updated stage**: Clicking "Reveal Answer" on the host app doesn't tell the host remote to move to the "Next Question" stage. This is because the `QuestionNavigationBar` wrongly considers On-The-Spot mode as "Quiz Pack" mode and bypasses calling the proper `gameActionHandlers.reveal()` and doesn't sync the `flowState`.
2. **Timer Length not syncing properly**: When a timer starts in On-The-Spot mode, the remote and the progress bar animations use stale or hardcoded timer settings. The interval in `KeypadInterface` hardcodes `gameModeTimers.keypad` instead of the actual `timerLength`. Additionally, `QuizHost` doesn't capture the `duration` when the timer starts, so it cannot propagate the actual timer length to the remote controller.

## Recommended Approach

### 1. Fix `QuestionNavigationBar` Callbacks in `QuizHost.tsx`
Currently, the callbacks for the nav bar use `isQuizPackMode || flowState.isQuestionMode` to determine if they should use the state machine (`handlePrimaryAction`) or `gameActionHandlers`. Since `flowState.isQuestionMode` is true for On-The-Spot Keypad Mode, it never calls `gameActionHandlers.reveal()` or `.nextQuestion()`.

- Change the condition to just `isQuizPackMode`.
- When NOT in Quiz Pack mode, call `gameActionHandlers.xxx()` AND `handlePrimaryAction()` (which advances the `flowState` so the remote is notified).

### 2. Update `onGameTimerStateChange` to propagate duration
To ensure the remote controller knows the exact duration of the timer, we need to pass the `duration` synchronously from `KeypadInterface` to `QuizHost`.
- Update `KeypadInterfaceProps.onGameTimerStateChange` to `(isTimerRunning: boolean, duration?: number) => void`.
- Update the `useEffect` in `KeypadInterface.tsx` to pass `totalTimerLength`.
- Update `QuizHost.tsx` where it passes `onGameTimerStateChange={setGameTimerRunning}` to:
  ```tsx
  onGameTimerStateChange={(isRunning, duration) => {
    setGameTimerRunning(isRunning);
    if (isRunning && !isQuizPackMode) {
      setFlowState(prev => ({
        ...prev,
        flow: 'running',
        ...(duration !== undefined ? { totalTime: duration } : {})
      }));
    }
  }}
  ```

### 3. Sync `onGameTimerFinished`, `onGameAnswerRevealed`, and `onGameFastestRevealed` to `flowState`
When the host uses the Spacebar, `KeypadInterface` handles the actions internally and notifies `QuizHost` via callbacks. `QuizHost` needs to observe these state changes and update `flowState.flow` accordingly so the remote is updated.
- Add an effect in `QuizHost.tsx` to sync these states:
  ```tsx
  useEffect(() => {
    if (!isQuizPackMode && (showKeypadInterface || showNearestWinsInterface || showBuzzInMode)) {
      if (!gameTimerRunning && gameTimerFinished && !gameAnswerRevealed && flowState.flow === 'running') {
        setFlowState(prev => ({ ...prev, flow: 'timeup' }));
      } else if (gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'revealed') {
        setFlowState(prev => ({ ...prev, flow: 'revealed' }));
      } else if (gameFastestRevealed && flowState.flow !== 'fastest') {
        setFlowState(prev => ({ ...prev, flow: 'fastest' }));
      } else if (!gameTimerRunning && !gameTimerFinished && !gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'idle' && flowState.flow !== 'sent-question') {
        setFlowState(prev => ({ ...prev, flow: 'idle' }));
      }
    }
  }, [gameTimerRunning, gameTimerFinished, gameAnswerRevealed, gameFastestRevealed, isQuizPackMode, showKeypadInterface, showNearestWinsInterface, showBuzzInMode, flowState.flow]);
  ```
- Remove `onGameTimerFinished`'s inline `setFlowState` from Step 2, and let this unified effect handle the transitions.

### 4. Fix Hardcoded Timer in `KeypadInterface` interval
The `setInterval` inside `KeypadInterface.tsx` (`handleStartTimer` and `handleSilentTimer`) hardcodes `gameModeTimers.keypad` for `onTimerStateChange` and `onExternalDisplayUpdate`.
- Replace `gameModeTimers.keypad` with the `timerLength` variable within these interval blocks to ensure the progress bars scale correctly.

## Critical Files to Modify
- `src/components/QuizHost.tsx`
- `src/components/KeypadInterface.tsx`
- `src/components/NearestWinsInterface.tsx` (Update prop signature for `onGameTimerStateChange`)
- `src/components/QuizPackDisplay.tsx` (Update prop signature)
