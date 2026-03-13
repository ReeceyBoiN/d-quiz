# Fix: Buzzer Not Showing on Player Devices in On-The-Spot Buzz-In Mode

## Root Cause

When on-the-spot buzz-in mode starts, `BuzzInInterface.handleStartRound()` broadcasts a QUESTION message with type `buzzin` to player devices. The player receives it and briefly shows the buzz-in screen. **However, within 1 second, the periodic FLOW_STATE sync in QuizHost overwrites it.**

The periodic sync (every 1s at `QuizHost.tsx:5685`) broadcasts the current `flowState` which is still `{ flow: 'idle', isQuestionMode: false }`. When the player receives this FLOW_STATE with `flow: 'idle'` (`App.tsx:534`), it calls `transitionToIdleDisplay()` — sending the player back to the "POP QUIZ! Please wait for your host to get started" screen.

**Why does the flowState remain idle?** Because `BuzzInInterface` never calls the `onStartMode` prop that QuizHost passes to it. The prop isn't even declared in `BuzzInInterfaceProps`. So `handleBuzzInStart` in QuizHost is never triggered, `showBuzzInMode` stays false, and the flowState is never updated to reflect an active game.

## Changes

### 1. `src/components/BuzzInInterface.tsx` — Accept and call `onStartMode` prop

- Add `onStartMode` to `BuzzInInterfaceProps`:
  ```ts
  onStartMode?: (mode: "points" | "classic", points: number, soundCheck: boolean) => void;
  ```
- Destructure it in the component
- Call it in `handleStartRound()` before broadcasting the QUESTION:
  ```ts
  onStartMode?.("points", points[0], soundCheckEnabled);
  ```

### 2. `src/components/QuizHost.tsx` — Update flowState when on-the-spot buzz-in starts/ends

In `handleBuzzInStart` (line ~3292), after setting `showBuzzInMode = true`, also update the flowState:
```ts
setFlowState(prev => ({
  ...prev,
  flow: 'ready',
  isQuestionMode: true,
}));
```

In `handleBuzzInEnd` (line ~3300), reset the flowState back to idle:
```ts
setFlowState(prev => ({
  ...prev,
  flow: 'idle',
  isQuestionMode: false,
}));
```

### 3. Also accept remaining missing props in `BuzzInInterface`

The QuizHost passes several props (`teams`, `externalWindow`, `onExternalDisplayUpdate`, `onEvilModePenalty`) that aren't declared in `BuzzInInterfaceProps`. The `teams` prop should map to the existing `quizzes` prop. Add the missing props to prevent silent ignoring:

- Rename `quizzes` to `teams` in the interface (or add `teams` as alias) since QuizHost passes `teams={quizzes}`
- Add `onEndRound` — QuizHost already passes this via `handleBuzzInEnd` indirectly through BuzzInDisplay

## Expected Result

After fix:
1. Host starts on-the-spot buzz-in → `onStartMode` is called → QuizHost sets `showBuzzInMode = true` and flowState to `ready`/`isQuestionMode: true`
2. Periodic FLOW_STATE sync now broadcasts `flow: 'ready'` with `isQuestionMode: true`
3. Player stays on the question screen showing the BUZZ IN button
4. When round ends, flowState resets to idle, players return to waiting screen
