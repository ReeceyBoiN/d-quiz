## Goal
Ensure player devices reliably exit the question input screen and return to the default display when the host is on Home by guaranteeing FLOW_STATE broadcasts reach all approved players and are acted upon.

## Recommended approach
1. **Confirm host → player FLOW_STATE broadcast path**
   - Add/verify a dedicated player broadcast helper in `src/network/wsHost.ts` that sends FLOW_STATE to local listeners and calls Electron IPC for remote players.
   - Replace direct `broadcastMessage` usages for FLOW_STATE in `src/components/QuizHost.tsx` (end round + periodic sync) with the helper so remote players receive updates.

2. **Add IPC + backend broadcast for FLOW_STATE**
   - Expose `broadcastFlowState` in `electron/preload/preload.js`.
   - Mount `network/broadcast-flow-state` in `electron/main/main.js` to call the backend.
   - Implement `broadcastFlowState` in `electron/backend/server.js` to send FLOW_STATE to all approved player sockets (with backpressure checks).

3. **Player handling (already present) validation**
   - Update the FLOW_STATE handler in `src-player/src/App.tsx` to exit immediately on `flow=idle` (no grace delay) and apply any pending display mode so the question screen clears as soon as idle is received.

4. **Verification**
   - Confirm host logs show `broadcastFlowState` calls when idle and in the 1s periodic sync.
   - Confirm player logs show `FLOW_STATE message received` and then `Idle grace period elapsed - exiting question view`.

## Key files to modify
- `src/components/QuizHost.tsx`
- `src/network/wsHost.ts`
- `electron/preload/preload.js`
- `electron/main/main.js`
- `electron/backend/server.js`
- `src-player/src/App.tsx`

## Rationale
The logs show FLOW_STATE was being broadcast locally but not guaranteed to traverse the Electron IPC/backend to remote player sockets. Wiring a dedicated broadcast path for FLOW_STATE ensures the 1s safety-net sync actually reaches players, allowing their idle-exit logic to clear stale question input screens.
