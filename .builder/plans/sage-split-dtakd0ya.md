# Fix: Buzz-In Timer Behavior in Quiz Pack Mode

## Problems Identified

1. **Timer only pauses on buzz-in** — When a team buzzes in, `timer.pause()` is called (line 1422) instead of stopping. The timer continues to display and can resume unexpectedly.
2. **Timer restart after wrong uses `isPaused` check** — `handleBuzzWrong` (line 6204) checks `timer.isPaused` to restart the timer, but since we need to stop (not pause), this check never passes if we change to `timer.stop()`.
3. **Timer expiry auto-shows results summary** — When timer hits 0, the `onEnd` callback sets flow to `'timeup'`, and the effect at line 1301 auto-shows `showAnswer` + `showResultsSummary` for all quiz pack modes. In buzz-in mode, there are no team answer stats to display — instead the host needs a "Time's Up" state with a "Reveal Answer" button.
4. **No fail sound on timer expiry** — When no one buzzes in and timer runs out, no fail sound plays.
5. **No blocking of buzzes after timer expiry** — Players can still attempt to buzz after time is up.
6. **Fastest team not suppressed** — The `handlePrimaryAction` flow for `'running'`/`'timeup'` cases still goes through the fastest team display logic even for buzz-in mode.

## Changes

### File: `src/components/QuizHost.tsx`

#### 1. Buzz detection effect (~line 1420-1426): Stop timer instead of pausing

Change:
```js
if (timer.isRunning) {
  timer.pause();
  sendTimerPauseToPlayers();
  stopCountdownAudio();
}
```
To:
```js
if (timer.isRunning) {
  timer.stop();
  sendTimerPauseToPlayers(); // Still notify players to stop their timer
  stopCountdownAudio();
  // Set flow back to ready so the timer can be restarted
  setFlowState(prev => ({ ...prev, flow: 'ready' }));
}
```

#### 2. Add new state to track buzz-in timer expiry

Add a new state variable:
```js
const [buzzTimerExpired, setBuzzTimerExpired] = useState(false);
```

Clear it when question changes (in the question change effect ~line 1130 area alongside other buzz state clears):
```js
setBuzzTimerExpired(false);
```

#### 3. Timer `onEnd` callback (~line 624-633): Handle buzz-in mode specially

Update the `onEnd` callback to handle buzz-in mode:
```js
onEnd: () => {
  setFlowState(prev => ({
    ...prev,
    flow: 'timeup',
    timeRemaining: 0,
  }));
  sendTimeUpToPlayers();
  
  // For buzz-in mode: play fail sound, block buzzes, set expired flag
  if (isBuzzinPackMode) {
    setBuzzTimerExpired(true);
    playFailSound().catch(err => console.warn('Failed to play fail sound:', err));
    stopCountdownAudio();
  }
},
```

Add `isBuzzinPackMode` and `playFailSound` to the dependency array of `useTimer` (they need to be accessible in the callback).

#### 4. Auto-show results summary effect (~line 1300-1305): Skip for buzz-in mode

Change:
```js
if (flowState.flow === 'timeup' && isQuizPackMode) {
  setShowAnswer(true);
  setShowResultsSummary(true);
}
```
To:
```js
if (flowState.flow === 'timeup' && isQuizPackMode && !isBuzzinPackMode) {
  setShowAnswer(true);
  setShowResultsSummary(true);
}
```

#### 5. `handleBuzzWrong` (~line 6203-6213): Track that timer was running and start fresh

Since we now `stop()` instead of `pause()` on buzz-in, the timer state is fully cleared. We need a ref/state to track whether the timer was active when the buzz came in, so we can restart it after a wrong answer.

Add a ref:
```js
const buzzTimerWasRunningRef = useRef(false);
```

Set it in the buzz detection effect (before stopping):
```js
buzzTimerWasRunningRef.current = timer.isRunning;
```

Then in `handleBuzzWrong`, replace the `timer.isPaused` check:
```js
// Reset timer to full duration after wrong buzz-in
if (buzzTimerWasRunningRef.current) {
  buzzTimerWasRunningRef.current = false;
  const fullDuration = flowState.totalTime || 30;
  timer.stop(); // Ensure clean state
  setFlowState(prev => ({ ...prev, flow: 'running', timeRemaining: fullDuration }));
  // timer.start will be triggered by the flow state change to 'running' effect
  setGameTimerStartTime(Date.now());
  sendTimerResumeToPlayers(fullDuration);
  playCountdownAudio(fullDuration, false).catch(err => console.warn('Failed to restart countdown:', err));
}
```

Note: The flow change to `'running'` will trigger the existing effect at line 1285-1296 which calls `timer.start()`. So we should NOT call `timer.start()` manually here — the flow state effect handles it.

#### 6. Buzzed Team Panel UI (~line 6802-6853): Add timer expired state

Add a new condition before the "waiting for teams to buzz in" fallback:
```jsx
{buzzTimerExpired && !buzzWinnerTeamId ? (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <Zap className="h-8 w-8 text-red-400" />
      <p className="text-lg font-medium text-red-300">Time's Up — No one buzzed in</p>
    </div>
    <div className="flex gap-3">
      <Button
        onClick={() => {
          // Reveal answer
          setShowAnswer(true);
          // Show answer on external display
          const currentQ = loadedQuizQuestions[currentLoadedQuestionIndex];
          if (currentQ && externalWindow) {
            sendToExternalDisplay({
              type: 'DISPLAY_UPDATE',
              mode: 'buzzin-wrong',
              data: { allLockedOut: true, timerExpired: true },
            });
          }
        }}
        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg"
      >
        REVEAL ANSWER
      </Button>
      <Button
        onClick={() => {
          if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
            setCurrentLoadedQuestionIndex(prev => prev + 1);
          }
        }}
        className="px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-bold text-lg rounded-lg"
      >
        SKIP
      </Button>
    </div>
  </div>
) : /* existing conditions... */}
```

#### 7. Buzz detection effect: Block buzzes when timer expired

Add `buzzTimerExpired` to the guard at line 1397:
```js
if (!isBuzzinPackMode || !flowState.isQuestionMode || buzzWinnerTeamId || buzzTimerExpired) return;
```

This prevents new buzzes from being detected after the timer has expired.

#### 8. handlePrimaryAction `'running'`/`'timeup'` case (~line 2638-2786): Skip fastest team for buzz-in

In the quiz pack branch (line 2777-2785), add a check for buzz-in mode to skip fastest team logic:
```js
} else {
  // For quiz pack
  if (isBuzzinPackMode) {
    // No fastest team in buzz-in mode - just transition to revealed
    setFlowState(prev => ({ ...prev, flow: 'revealed' }));
  } else {
    // Normal quiz pack: Show results summary, transition to revealed
    setFastestTeamRevealTime(Date.now());
    setFlowState(prev => ({ ...prev, flow: 'revealed' }));
  }
}
```

### File: `src-player/src/App.tsx` (no changes needed)

The player already handles `TIMEUP` by setting `timerEnded = true` which disables inputs. The `BUZZ_LOCKED` message via the new IPC pipeline handles blocking. No additional player-side changes required.

## Summary of Behavior After Fix

| Scenario | What Happens |
|---|---|
| Team buzzes during timer | Timer **stops** completely, countdown audio stops, host sees CORRECT/WRONG buttons |
| Host marks WRONG | Timer **restarts from full duration**, teams can buzz again |
| Host marks CORRECT | Points awarded, move to next question |
| Timer hits 0, no buzz | Fail sound plays, buzzes blocked, host sees "Time's Up" with REVEAL ANSWER / SKIP buttons |
| Host clicks REVEAL ANSWER | Answer shown on host + external display, no fastest team |
