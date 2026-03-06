# Fix: NearestWins mode not showing number input on player devices

## Root Cause

The periodic flow state sync (every 1s) in QuizHost broadcasts `isQuestionMode: false` and `hasCurrentQuestion: false` to all player devices while NearestWinsInterface is active. This causes players to revert from the number input screen back to the "POP QUIZ!" waiting screen.

**Why it happens:** When the host opens NearestWinsInterface via `handleNearestWinsClick`, it never sets `flowState.isQuestionMode = true`. Compare with `handleKeypadClick` which explicitly does:
```
setFlowState(prev => ({ ...prev, isQuestionMode: true }));
```

The `onFlowStateChange` callback passed to NearestWinsInterface only updates the `flow` field, never `isQuestionMode`:
```
onFlowStateChange={(flow) => setFlowState(prev => ({...prev, flow: flow as any}))}
```

So while NearestWinsInterface does send the initial QUESTION message to players (which briefly shows the keypad), the next periodic FLOW_STATE broadcast (with `isQuestionMode: false`) immediately kicks players back to the waiting screen.

## Fix (2 changes in `src/components/QuizHost.tsx`)

### Change 1: Set `isQuestionMode: true` when opening NearestWins

In `handleNearestWinsClick` (~line 3039), add the same `isQuestionMode: true` that keypad uses:

```js
const handleNearestWinsClick = () => {
    closeAllGameModes();
    setCurrentRoundWinnerPoints(gameModePoints.nearestwins);
    setShowNearestWinsInterface(true);
    setActiveTab("teams");
    setFlowState(prev => ({ ...prev, isQuestionMode: true })); // ADD THIS
    handleExternalDisplayUpdate('basic');
};
```

### Change 2: Reset `isQuestionMode: false` when closing NearestWins

In `handleNearestWinsClose` (~line 3050), reset it back:

```js
const handleNearestWinsClose = () => {
    setShowNearestWinsInterface(false);
    setActiveTab("home");
    setFlowState(prev => ({ ...prev, isQuestionMode: false, flow: 'idle' })); // ADD THIS
};
```

### Change 3: Update `onFlowStateChange` callback to also set `isQuestionMode`

In the NearestWinsInterface rendering (~line 6545), update the callback so that active flow states also keep `isQuestionMode: true`:

```js
onFlowStateChange={(flow) => setFlowState(prev => ({
    ...prev,
    flow: flow as any,
    isQuestionMode: flow === 'idle' || flow === 'complete' ? false : true
}))}
```

This ensures that even if `onFlowStateChange('idle')` is called during cleanup, `isQuestionMode` gets properly reset.

## Why this fixes it

The periodic 1-second flow state sync broadcasts the current `flowState` to all players. With `isQuestionMode: true`, the periodic sync will no longer override the player's question display. The player receives the initial QUESTION message (which shows the number keypad) and subsequent FLOW_STATE syncs will confirm that question mode is active, keeping the keypad visible.
