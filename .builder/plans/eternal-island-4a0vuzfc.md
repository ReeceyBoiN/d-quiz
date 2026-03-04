## Goal
Ensure player devices reliably exit the question input screen when the host returns to the Home screen, even if the question lifecycle messages are missed.

## Recommended approach
1. **Verify host-to-player FLOW_STATE delivery path**
   - Trace the host periodic flow-state sync (QuizHost) into the network layer (wsHost / IPC / backend) and confirm the FLOW_STATE payload is actually broadcast to all player WebSockets.
   - If FLOW_STATE is only sent to controllers or not forwarded by the backend, add a dedicated backend broadcast for FLOW_STATE (similar to DISPLAY_MODE) and wire it through IPC so the host’s periodic flow sync reaches all players.

2. **Align FLOW_STATE payload with player expectations**
   - Ensure the FLOW_STATE broadcast includes `flow`, `isQuestionMode`, and optionally `keypadCurrentScreen` so the player can detect idle state deterministically.
   - If any fields are missing in the current broadcast path, add them to the host broadcast and backend forwarding.

3. **Player-side idle exit + display mode deferral coordination**
   - Confirm the player applies idle exits even when DISPLAY_MODE updates are deferred during question screens.
   - Update player logic so an idle FLOW_STATE triggers an immediate exit that resets question state and then applies any pending DISPLAY_MODE (falling back to the default display screen).

4. **Add minimal logging for verification**
   - Add a concise log on the player when FLOW_STATE idle is received and when the idle-exit triggers, so it’s easy to confirm messages are arriving and that the transition happens.

## Key files to modify
- `src/components/QuizHost.tsx`
  - Periodic flow-state sync and broadcast payload assembly.
- `src/network/wsHost.ts`
  - Broadcast / IPC path for FLOW_STATE (ensure it reaches all players, not just controller).
- `electron/main/main.js` and `electron/backend/server.js`
  - IPC route and backend broadcast for FLOW_STATE if missing.
- `src-player/src/App.tsx`
  - FLOW_STATE handling and idle-exit coordination with pending DISPLAY_MODE.

## Validation
- Confirm player logs show FLOW_STATE messages arriving while host is idle.
- Verify player UI exits question input after the grace period when host is on Home.
- Confirm normal question flow still works (question arrival cancels idle-exit and continues to show inputs).
