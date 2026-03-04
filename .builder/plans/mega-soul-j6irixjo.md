## Goal
Ensure player devices return to the idle display when the host is on the Home screen, even if a question end message is missed, without interrupting long-running questions.

## Recommended Approach
1. **Add idle-aware fallback in player FLOW_STATE handling.**
   - In `src-player/src/App.tsx`, extend the `FLOW_STATE` handler to treat the host as idle when `flow === 'idle'` (even if `isQuestionMode` is missing).
   - When idle is detected, schedule a **grace-period exit**: if the player is still on `question`/`ready-for-question` after the grace period and no new question arrives, then apply any pending display mode and transition to `display`.
   - Use a short grace window (e.g., 5–10 seconds) to avoid cutting off legitimate long questions, as requested.
   - Cancel the pending idle-exit timer if a new `QUESTION`, `TIMER_START`, or `NEXT/END_ROUND` arrives.

2. **Relax DISPLAY_MODE deferral only when host is idle.**
   - Keep deferral during active questions, but if the host reports idle (via `FLOW_STATE`), allow applying the pending display mode after the grace window above.
   - This aligns with “force exit on idle” while still avoiding immediate switches during long questions.

3. **Make pending display mode application safer.**
   - Update `applyDisplayModeUpdate` to return a boolean (applied/not applied).
   - Update `applyPendingDisplayMode` to only clear `pendingDisplayMode` if it was actually applied. This prevents losing the update if it was skipped (e.g., controller-only screen).

4. **Add a small idle-exit watchdog state.**
   - Track an `idleExitTimeoutRef` in `App.tsx`.
   - Start it when idle FLOW_STATE is received; clear it when gameplay resumes.
   - On timeout: reset question state + apply pending display mode or go to `display`.

## Key Files to Modify
- `src-player/src/App.tsx`
  - FLOW_STATE handler: detect idle flow and schedule grace-period exit.
  - QUESTION / TIMER_START / NEXT / END_ROUND handlers: clear the idle-exit timer.
  - `applyDisplayModeUpdate` / `applyPendingDisplayMode`: return applied status and avoid clearing pending on no-op.
  - Add `idleExitTimeoutRef` and helper functions to start/clear it.

## Notes
- This approach does not remove the existing deferral during active questions; it only overrides when the host is idle for long enough.
- Grace period duration can be made configurable if desired, but defaulting to 5–10 seconds should meet the requirement to avoid premature exits.
