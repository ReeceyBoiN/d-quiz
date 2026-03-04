## Goal
Fix cases where the player device stays on the question/answer input screen after the host returns to the home screen. Ensure player UI always resets to the correct display when a round ends or when sync messages are deferred.

## Recommended Approach
1. **Align pending message handling with immediate handlers (player app).**
   - Add a pending `END_ROUND` handler in `src-player/src/App.tsx` so a deferred END_ROUND isn’t discarded.
   - Make pending `NEXT` behave like the immediate NEXT handler: reset question state and transition to the idle display (or apply any pending display mode). This avoids leaving the player on `ready-for-question`, which still renders the input UI.
   - Ensure unknown pending messages do not short‑circuit the normal approval/display flow.

2. **Apply deferred display mode at round end consistently (player app).**
   - Reuse the existing `applyPendingDisplayMode`/`applyDisplayModeUpdate` logic from immediate handlers in the pending handlers so “display mode update while question active” is honored right after a round ends.

3. **Ensure a broadcasted flow reset reaches players (host app).**
   - Confirm that a `FLOW_STATE` (with `isQuestionMode: false`) is broadcast to all players when ending a round, not just sent to the host controller device. If it’s controller-only today, add a broadcast on round end.
   - This provides an authoritative “not in question mode” signal in case `NEXT`/`END_ROUND` are missed or deferred.

4. **Keep periodic pings, but rely on correct state transitions.**
   - The 1‑second safety‑net broadcast can remain as a fallback, but the primary fix should be correct pending handling and explicit flow reset broadcasts so the player doesn’t stay stuck.

## Key Files to Change
- `src-player/src/App.tsx`
  - Pending message switch inside `handleBuzzerConfirm` (add `END_ROUND`, adjust `NEXT`, avoid early return on unknown types).
  - Use existing `resetQuestionState`, `applyPendingDisplayMode`, and `transitionToIdleDisplay` to mirror immediate handlers.

- `src/components/QuizHost.tsx`
  - Ensure `sendFlowState` (broadcast) runs on round end (not only controller IPC), if currently only controller‑targeted.

- `src/network/wsHost.ts`
  - Confirm `sendFlowState` can be called for broadcast (no deviceId), and is used when a round ends.

## Expected Outcome
- If the host returns to home and a player is in a question screen (even due to deferred messages), the player will reliably reset to the correct display without showing stale answer input.

## Questions
- Should pending `NEXT` always return to the idle display (consistent with immediate handler), or do you want it to land on “ready-for-question” under any circumstances?
- Should we always broadcast `FLOW_STATE` to players at end‑round (recommended), even if it’s already sent to a controller device?
