# Fix: Player Stuck on Buzzer Selection Screen After Confirming Buzzer

## Root Cause

Two related bugs in `src-player/src/App.tsx`:

### Bug 1: `pendingMessage` is a single slot — later messages overwrite earlier ones

When a player is on the buzzer-selection screen, incoming messages are deferred via `setPendingMessage()`. However, `pendingMessage` is a single state variable. The flow:

1. Player submits team name → screen = `buzzer-selection`, sends `PLAYER_JOIN`
2. Host auto-approves → sends `TEAM_APPROVED` with `currentGameState.currentQuestion`
3. Player receives `TEAM_APPROVED` during buzzer-selection → saves question as `pendingMessage({ type: 'QUESTION', ... })` (line 636)
4. Host broadcasts `FLOW_STATE` (sent every ~1 second) → `shouldIgnoreScreenTransition` returns true → `setPendingMessage({ type: 'FLOW_STATE', ... })` **overwrites** the saved QUESTION (line 1324)
5. Player confirms buzzer → `handleBuzzerConfirm` processes `pendingMessage` which is now `FLOW_STATE` instead of `QUESTION`

### Bug 2: FLOW_STATE processing doesn't transition the screen, but early return skips fallback

In `handleBuzzerConfirm` (line 1620-1717):
- The pending `FLOW_STATE` is processed via `applyFlowStateUpdate`
- For `flow='ready'` with `isQuestionMode=true`, `applyFlowStateUpdate` updates internal state but does **not** change `currentScreen`
- `handledPendingMessage = true` causes an early return (line 1715)
- This skips the fallback `setCurrentScreen('approval')` at line 1719
- **Result: screen stays on `buzzer-selection` forever**

## Fix

### Change 1: Priority-based pending message storage (`src-player/src/App.tsx`)

Add a priority system so that screen-transitioning messages (QUESTION, PICTURE, NEXT, END_ROUND, MUSIC_ROUND_START, APPROVAL_PENDING) cannot be overwritten by state-update messages (FLOW_STATE, DISPLAY_MODE).

Define a priority map and a helper function:
```typescript
const MESSAGE_PRIORITY: Record<string, number> = {
  'QUESTION': 10,
  'PICTURE': 10,
  'MUSIC_ROUND_START': 10,
  'NEXT': 8,
  'END_ROUND': 8,
  'APPROVAL_PENDING': 7,
  'DISPLAY_MODE': 3,
  'FLOW_STATE': 1,
};
```

Wrap `setPendingMessage` calls during buzzer selection with a priority check: only overwrite if the new message has equal or higher priority than the existing one.

### Change 2: Safety net in `handleBuzzerConfirm` (`src-player/src/App.tsx`)

After processing pending messages, if `handledPendingMessage` is true but the screen wasn't transitioned to a game/display screen (i.e., the processing only updated internal state like FLOW_STATE does), don't return early — fall through to the approval/display flow.

Replace the early return logic (lines 1714-1716) with a check:
```typescript
setPendingMessage(null);
// Only skip approval flow if the screen was actually transitioned
// FLOW_STATE updates internal state but doesn't change the screen
const screenTransitioningTypes = ['QUESTION', 'PICTURE', 'NEXT', 'END_ROUND', 'MUSIC_ROUND_START', 'APPROVAL_PENDING'];
if (handledPendingMessage && screenTransitioningTypes.includes(pendingMessage.type)) {
  return; // Screen was transitioned by the pending message handler
}
// Otherwise fall through to approval/display flow
```

## Files to Modify

- `src-player/src/App.tsx` — Both changes above (priority-based pending message + safety net in handleBuzzerConfirm)

## Impact

- Affects all game modes (quiz pack, on-the-spot, buzz-in, music round) since the pending message system is shared
- No changes needed on host side — the host already sends correct data
- No changes needed to BuzzerSelectionModal component
