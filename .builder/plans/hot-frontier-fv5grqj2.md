# Audit: Timer Reset to Full Duration After Wrong Buzz-In

## Summary of Changes Already Made

Two files were modified to reset the timer to full duration (instead of resuming from remaining time) when a team buzzes in and answers incorrectly:

### 1. `src/components/QuizHost.tsx` — `handleBuzzWrong` (line ~6202)
- **Before:** Called `timer.resume()` and `sendTimerResumeToPlayers(remaining)` with the leftover time
- **After:** Calls `timer.stop()` → `timer.start(fullDuration)` using `flowState.totalTime`, resets `gameTimerStartTime` to `Date.now()`, updates `flowState.timeRemaining`, sends full duration to players, and restarts countdown audio

### 2. `src/components/BuzzInDisplay.tsx` — `handleWrongAnswer` (line ~128)
- **Before:** Called `setTimerPaused(false)` and `sendTimerResumeToPlayers(timeRemaining)` with remaining
- **After:** Sets `timeRemaining` to `gameModeTimers.buzzin` (full duration), then unpauses and sends full duration to players

## Audit Findings — No Issues Detected

### Timer Hook (`useTimer.ts`) — Safe
- `start()` has an `if (isRunning) return;` guard
- When timer is paused, `isRunning` is already `false` (set by `pause()` at line 99)
- So calling `stop()` → `start(fullDuration)` works correctly: `stop()` clears the interval/state, `start()` sees `isRunning=false` and proceeds
- No memory leak risk: both `stop()` and `start()` properly clear intervals before creating new ones

### Player-Side (`src-player/src/App.tsx` line 865) — Compatible
- `TIMER_RESUME` handler simply calls `setTimerPaused(false)` and `setTimeRemaining(resumeSeconds)`
- It doesn't distinguish between "resume from remaining" vs "restart from full" — it just sets whatever value is sent
- Sending the full duration works perfectly: player timer resets and counts down from the full amount

### Player Buzz-In Button — Already Large
- Button is `h-[50vh]` (50% viewport height) with `text-4xl` to `text-6xl` sizing (line 969)
- When locked out or another team buzzed, appropriate states are displayed

### Remote Controller — No Changes Needed
- The remote controller doesn't have independent buzz correct/wrong commands
- All buzz judging happens through the host UI buttons (QuizHost.tsx lines 6833/6839 and QuizPackDisplay.tsx lines 857/863)
- The remote controller receives flow state updates and can start/stop timers, but doesn't judge buzz answers
- `sendTimerResumeToPlayers` also broadcasts via IPC (`api.network.broadcastMessage`) so LAN-connected players get the message too

### Countdown Audio — Safe
- `playCountdownAudio()` internally calls `stopCountdownAudio()` before starting new audio (line 158 of countdownAudio.ts)
- No risk of overlapping audio when timer is restarted

### BuzzInDisplay Timer (`useEffect` at line 143) — No Memory Leak
- Uses `setTimeout` (not `setInterval`) with proper cleanup via `return () => clearTimeout(timer)`
- Setting `timeRemaining` to the full duration and `timerPaused` to `false` triggers the countdown effect correctly

### Dependency Arrays — Updated
- `handleBuzzWrong` in QuizHost: added `flowState.totalTime` to deps
- `handleWrongAnswer` in BuzzInDisplay: added `gameModeTimers.buzzin` to deps

## Conclusion

All changes are correct and safe. The implementation properly handles:
1. Resetting the host timer to full duration after wrong buzz-in (both QuizHost for quiz pack mode and BuzzInDisplay for on-the-spot mode)
2. Communicating the full duration to player devices via `sendTimerResumeToPlayers`
3. Restarting countdown audio from the full duration
4. Resetting `gameTimerStartTime` for accurate response time calculations
5. No memory leaks in timer intervals/timeouts
6. No communication issues between host, players, or remote controller

**The changes are ready for rebuild and testing.**
