# Plan to Ensure Perfect Host/Remote Timer Sync and Prevent Feedback Loops

After a deep dive into the `QuizHost`, `KeypadInterface`, `countdownAudio.ts`, and admin command pathways, I have identified exactly how to ensure the timers are bulletproof and the remote respects the settings flawlessly. 

## 1. Strict Mid-Session Settings Sync
**Issue**: Currently, `flowState.totalTime` is only derived from `gameModeTimers` (Settings) when a question is *first initialized*. If a user alters the "Keypad Mode Timer Length" while a question is loaded but idle, the `totalTime` does not update until the *next* question. This allows the remote to use the stale duration.
**Implementation Fix**: 
- Add a new `useEffect` in `QuizHost.tsx` that actively watches `gameModeTimers`. If the game is in an active question state but the timer hasn't started (`flow !== 'running'`), it will automatically recalculate and update `flowState.totalTime` using `getTotalTimeForQuestion()`. 
- This guarantees that the instant a setting is changed, the host UI and the remote UI (via the automated `FLOW_STATE` broadcast) are instantly synchronized to the new timer length before anyone presses start.

## 2. Authoritative Host Commands (Ignoring Stale Remote Data)
**Issue**: The admin command listener allows the remote to dictate the timer duration via `commandData.seconds`. If the network is slow or the remote sends a stale duration, it can bypass the host's current settings.
**Implementation Fix**:
- Update the admin listeners for `start-normal-timer` and `start-silent-timer` in `QuizHost.tsx`. Instead of using `commandData.seconds` for standard flows, we will strictly enforce the host's own `deps.flowState.totalTime` (which is now perfectly synced to the settings).
- The Host Settings become the absolute single source of truth. The remote acts purely as a trigger, not a source of data, eliminating mismatches.

## 3. The +1 Second Audio Buffer
**Confirmation**: 
- I have reviewed `src/utils/countdownAudio.ts`. It correctly utilizes a `Math.max(0, audioDuration - (finalDuration + 1))` calculation. 
- This ensures the visual timer on the screen is perfectly accurate to the setting (e.g., exactly 5 seconds) while the audio engine gets the necessary +1 second buffer to comfortably play the "time's up" conclusion without clipping. This is working flawlessly and requires no changes.

## 4. Preventing Feedback Loops
**Issue**: Rapid commands or multiple `setFlowState` calls can cause multiple sequential `FLOW_STATE` broadcasts, making the remote UI "flicker" or jump stages.
**Implementation Fix**:
- The existing codebase uses `setFlowState(prev => ...)` carefully, but in the admin listener, there are instances where `setTimeout` is used to manually re-broadcast state right after calling a handler that *also* changes state. 
- We will rely entirely on the primary `useEffect` in `QuizHost` that watches `flowState` to handle the broadcasts automatically.
- Commands will be guarded by checking the current `flowState` (e.g., ignoring a start timer command if `deps.flowState.flow === 'running'`) to prevent rapid double-clicks from the remote from crashing the host or causing looping behaviors.

## Summary
These surgical changes make the Host's `SettingsContext` the absolute authority. The timer will always respect the exact duration chosen for Keypad or Quiz Pack modes, regardless of when it is updated, and the remote will be a pure controller that cannot throw the system out of sync.
