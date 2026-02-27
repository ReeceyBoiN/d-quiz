# Plan to Fix Host/Remote Synchronization and Timer Issues

I've investigated the codebase and found the root causes of the issues you're experiencing with the host app and host remote synchronization, especially around the "Home" state and the timer mismatch.

## 1. Remote "Stuck" on Last Stage When Host Goes Home
**Root Cause**: 
When you navigate to the Home screen on the host app (e.g., clicking "Home" in the navigation), the host's `activeTab` changes to `"home"` and the UI closes the game interfaces, but the underlying `flowState` (the state machine that controls the game progression like 'idle', 'sent-question', 'running', etc.) is not fully reset to `'idle'`. Since the remote relies entirely on `flowState` updates to render its UI, it never receives the signal that the host went back to the home screen.

**Implementation Fix**:
- Update `handleTabChange` and `handleKeypadClose` in `src/components/QuizHost.tsx` to properly reset the `flowState` when the user navigates to the "home" tab.
- Specifically, we will set `flow: 'idle'`, `isQuestionMode: false`, and clear any active `currentQuestion` or `selectedQuestionType`.
- This state change will trigger the existing WebSocket broadcast (`sendFlowStateToController`), ensuring the remote instantly transitions back to the "Waiting for Game" standby screen.

## 2. Timer Duration Mismatch (30s vs 5s)
**Root Cause**:
The settings (including `gameModeTimers` which dictates the 5s timer) are managed in `src/utils/SettingsContext.tsx`. Currently, the context starts with hardcoded default values (30 seconds) and loads the saved `localStorage` values asynchronously in a `useEffect` after the component mounts. 
Because the host app initializes very quickly, the `flowState.totalTime` for a question is often derived from the 30-second default *before* the 5-second setting finishes loading. When the host remote triggers `start-normal-timer`, it falls back to this incorrectly initialized 30-second value.

**Implementation Fix**:
- Update `src/utils/SettingsContext.tsx` to read the settings from `localStorage` **synchronously** during its initial state setup instead of waiting for `useEffect`. 
- This guarantees that when the `QuizHost` component mounts, the correct 5-second timer setting is already active and applied to any initialized `flowState.totalTime`.

## 3. Remote Commands "Bomb Proofing"
**Root Cause**:
The remote's communication via `useHostTerminalAPI.sendAdminCommand` has no robust fallback if the payload lacks duration or goes out of sync. When `start-normal-timer` is clicked on the remote, it passes `flowState.totalTime` down to the host. If out of sync, it defaults to 30.

**Implementation Fix**:
- By guaranteeing `SettingsContext` loads correctly and `flowState.totalTime` is perfectly synchronized when navigating or opening game modes, the duration passed from the remote will precisely match the host's settings. 
- The existing validation in `QuizHost.tsx` (`validateTimerDuration`) is solid, but it relies on getting accurate values from `flowState`. By fixing the state sync as described above, the commands naturally become fully robust.

---
### Files to Edit
1. `src/utils/SettingsContext.tsx` - Sync initial load.
2. `src/components/QuizHost.tsx` - Ensure `flowState` is completely reset on Home navigation.
