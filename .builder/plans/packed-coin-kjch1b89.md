## Goal
Prevent the player app from bypassing the buzzer selection screen when FLOW_STATE messages (especially idle) arrive, while keeping the fix that returns players to the correct screen when the host is on Home.

## Recommended approach
1. **Guard FLOW_STATE during buzzer selection**
   - In `src-player/src/App.tsx`, update the `FLOW_STATE` message handler to use the existing `shouldIgnoreScreenTransition` guard (same pattern as `DISPLAY_MODE`, `QUESTION`, etc.).
   - If `currentScreen === 'buzzer-selection'`, fully defer FLOW_STATE by saving it to `pendingMessage` and return without transitioning screens. This avoids `transitionToIdleDisplay` from bypassing buzzer selection.

2. **Process deferred FLOW_STATE after buzzer confirmation**
   - Ensure `handleBuzzerConfirm` continues to process `pendingMessage` (it already does). Add handling to process a pending `FLOW_STATE` message once the buzzer is confirmed so the player state catches up immediately after selection.

3. **(Optional defensive guard)**
   - Add a safety check inside `transitionToIdleDisplay` (or `applyDisplayModeUpdate`) to refuse screen changes when `currentScreen === 'buzzer-selection'` and the buzzer isn’t confirmed. This is a last-resort protection to prevent any future path from bypassing buzzer selection.

4. **Verification**
   - Verify logs show: FLOW_STATE received → deferred during buzzer selection → processed after buzzer confirmation.
   - Confirm player remains on buzzer selection until confirmation, then transitions to display/approval as normal.

## Key files to modify
- `src-player/src/App.tsx`
  - `FLOW_STATE` handler (add buzzer-selection guard)
  - `handleBuzzerConfirm` (ensure pending FLOW_STATE is processed)
  - optional: `transitionToIdleDisplay` or `applyDisplayModeUpdate` (defensive guard)

## Rationale
The logs show FLOW_STATE messages are handled immediately and can call `transitionToIdleDisplay`, which sets the screen to `display` even when the player is still in `buzzer-selection`. Existing guards already prevent other messages (DISPLAY_MODE, QUESTION, NEXT, etc.) from bypassing buzzer selection, so applying the same pattern to FLOW_STATE will stop the bypass while preserving the new idle-sync behavior.

Player requirement: buzzer selection should only appear on first join (or when the player explicitly chooses to change buzzer from settings). That rule stays intact; we only block FLOW_STATE-driven transitions while the buzzer selection modal is active.
