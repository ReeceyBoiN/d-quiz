# Timer Reset to Full Duration After Wrong Buzz-In

## Problem
When a team buzzes in during the timer and answers incorrectly, the timer currently resumes from where it was paused. The host wants the timer to **reset to the full duration** instead, so teams get a fresh countdown window after each wrong buzz. This repeats until a timer completes fully without being interrupted by a buzz-in.

## Changes

### 1. `src/components/QuizHost.tsx` — `handleBuzzWrong` (~line 6202)
**Current:** When timer is paused (`timer.isPaused`), calls `timer.resume()` and `sendTimerResumeToPlayers(remaining)` with the remaining time.

**New:** Instead of resuming, **stop the old timer**, then **restart it from the full duration** (`flowState.totalTime`):
- Call `timer.stop()` to clear the paused timer
- Call `timer.start(flowState.totalTime)` to restart from full duration
- Update `flowState.timeRemaining` to the full duration
- Send `sendTimerResumeToPlayers(flowState.totalTime)` so players restart their countdown from full
- Restart countdown audio with `playCountdownAudio(flowState.totalTime, false)`
- Reset `gameTimerStartTime` to `Date.now()` so response time calculations are accurate for the new timer window

### 2. `src/components/BuzzInDisplay.tsx` — `handleWrongAnswer` (~line 128)
**Current:** When timer was paused, calls `setTimerPaused(false)` and `sendTimerResumeToPlayers(timeRemaining)` with the remaining time.

**New:** Reset timer to full duration instead:
- Set `setTimeRemaining(gameModeTimers.buzzin)` (full duration)
- Set `setTimerPaused(false)`
- Send `sendTimerResumeToPlayers(gameModeTimers.buzzin)` so players get the full timer

### Files Modified
1. `src/components/QuizHost.tsx` — `handleBuzzWrong` timer restart logic
2. `src/components/BuzzInDisplay.tsx` — `handleWrongAnswer` timer restart logic
