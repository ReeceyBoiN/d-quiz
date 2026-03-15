# Exclusive Buzzer Selection (No Duplicate Buzzers)

## Problem
When a team selects and confirms a buzzer, other teams can still choose the same buzzer because:
1. Players who join **after** a buzzer was already claimed don't receive the existing buzzer state — their `selectedBuzzers` starts empty
2. There's no server-side enforcement — any player can confirm any buzzer regardless of what others have chosen

## Solution Overview
- **Server tracks all confirmed buzzer selections** and sends the full state to new players
- **Players see taken buzzers greyed out in real-time** as other teams confirm
- **Host can override** (assign any buzzer to any team, even if taken)

## Changes Required

### 1. Backend: Send existing buzzer state to new players (`electron/backend/server.js`)

When a player sends `PLAYER_JOIN`, the server should immediately respond with a `BUZZER_STATE_SYNC` message containing all currently confirmed buzzer selections from other connected players.

- After processing `PLAYER_JOIN`, gather all `buzzerSound` values from `networkPlayers` (excluding the joining player)
- Send a `BUZZER_STATE_SYNC` message back to the joining player's WebSocket:
  ```json
  {
    "type": "BUZZER_STATE_SYNC",
    "buzzerSelections": { "deviceId1": "buzzer1.mp3", "deviceId2": "buzzer2.mp3" }
  }
  ```

### 2. Player App: Handle `BUZZER_STATE_SYNC` (`src-player/src/App.tsx`)

- In `handleMessage`, add a handler for `BUZZER_STATE_SYNC` that replaces the current `selectedBuzzers` state with the full map from the server
- This ensures late-joining players see all already-taken buzzers
- Also add `BUZZER_STATE_SYNC` to the network types (`src-player/src/types/network.ts`)

### 3. Backend: Validate buzzer uniqueness on `PLAYER_BUZZER_SELECT` (`electron/backend/server.js`)

When processing `PLAYER_BUZZER_SELECT`:
- Check if the requested buzzer is already assigned to another player in `networkPlayers`
- If taken, send back a `BUZZER_REJECTED` message to the requesting player:
  ```json
  {
    "type": "BUZZER_REJECTED",
    "buzzerSound": "taken-buzzer.mp3",
    "reason": "Already selected by another team",
    "takenBy": "Team Name"
  }
  ```
- If available, proceed as normal (update `networkPlayers`, broadcast to all clients)

### 4. Player App: Handle `BUZZER_REJECTED` (`src-player/src/App.tsx`)

- When receiving `BUZZER_REJECTED`, show feedback to the player that the buzzer was already taken
- Clear the confirmed buzzer and keep the player on the buzzer selection screen
- Refresh the `selectedBuzzers` state (server will also send an updated `BUZZER_STATE_SYNC`)

### 5. Player App: Handle `BUZZER_REJECTED` in BuzzerSelectionModal (`src-player/src/components/BuzzerSelectionModal.tsx`)

- The existing `isBuzzerTaken` logic already greys out taken buzzers based on `selectedBuzzers` prop — this will work automatically once `selectedBuzzers` is properly populated from the server sync
- When a player taps a taken buzzer, show a brief toast/message saying "Already taken by [Team Name]" rather than silently ignoring the tap
- The Select button is already disabled for taken buzzers, but add a tap handler on the greyed-out row that shows the message

### 6. Backend: Keep buzzer reserved on disconnect (`electron/backend/server.js`)

- When a player disconnects, do NOT free their buzzer. Their entry stays in `networkPlayers` with the buzzer assigned, so reconnecting players keep their buzzer and other teams can't steal it.
- No `BUZZER_STATE_SYNC` broadcast needed on disconnect since nothing changes.

### 7. Host Override — No changes needed on the host side

The host manages teams through `QuizHost.tsx` and can already change a team's buzzer via the existing UI. The host operates locally and doesn't go through the `PLAYER_BUZZER_SELECT` validation. The host's buzzer assignment updates `quizzes` state directly, which is independent of the player-side enforcement.

If the host reassigns a buzzer on the host app, the existing `PLAYER_BUZZER_SELECT` broadcast mechanism will notify players. No additional override logic is needed since the host doesn't use the `BuzzerSelectionModal`.

## Files to Modify
1. `electron/backend/server.js` — Add `BUZZER_STATE_SYNC` on join, validate uniqueness on `PLAYER_BUZZER_SELECT`, sync on disconnect
2. `src-player/src/App.tsx` — Handle `BUZZER_STATE_SYNC` and `BUZZER_REJECTED` messages
3. `src-player/src/types/network.ts` — Add new message types
4. `src-player/src/components/BuzzerSelectionModal.tsx` — Minor: show rejection feedback if needed
5. `src/network/types.ts` — Add new message types (host-side type definitions)
