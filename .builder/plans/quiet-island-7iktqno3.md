## Goal
Ensure player devices leave the answer input UI when they lose focus or are away and correctly return to the normal display screen if the host has already exited the question round.

## Key Findings
- Visibility/focus handling only sends `PLAYER_AWAY`/`PLAYER_ACTIVE` messages; it does not change local UI state (src-player/src/App.tsx:948-1116).
- `DISPLAY_MODE`/`DISPLAY_UPDATE` is ignored when `currentScreen` is `question` or `ready-for-question`, so a host display update can be dropped if the player is stuck in a question screen while away (src-player/src/App.tsx:684-689).
- There is no buffering of `DISPLAY_MODE` messages received during a question state.

## Confirmed Behavior
- Do **not** exit the question UI immediately when a tab is hidden/blurred; keep the question UI active if the question is still running.
- Do not auto-return to the question UI on focus change (we’ll rely on the host’s normal question broadcasts).

## Recommended Approach
1. **Buffer display mode updates received during a question**
   - When `DISPLAY_MODE`/`DISPLAY_UPDATE` arrives while `currentScreen` is `question` or `ready-for-question`, store it as a pending display mode instead of discarding it.

2. **Apply pending display mode when a question ends**
   - On `NEXT` or `END_ROUND`, after clearing question state, apply the pending display mode and transition to `currentScreen = 'display'` (unless `isHostController`).
   - Clear any pending display mode timers before applying.

3. **Sync on flow-state updates**
   - When `FLOW_STATE` indicates `isQuestionMode === false` while the player is still on a question screen, apply any pending display mode and return to `display`.

4. **Keep visibility messaging as-is**
   - Continue sending `PLAYER_AWAY`/`PLAYER_ACTIVE` messages without forcing UI changes on blur/hidden.

## Files to Modify
- `src-player/src/App.tsx`
  - Visibility/focus handlers to set `isPlayerAway`.
  - `DISPLAY_MODE`/`DISPLAY_UPDATE` handler to honor `isPlayerAway` and buffer pending display mode updates.
  - Question end handlers to apply pending display mode updates if needed.

## Open Questions
- Should we force the player UI to exit the question screen immediately on blur/tab-hidden even if the question is still active?
- Do you want the player UI to re-enter the question automatically on focus return if the question is still active?
