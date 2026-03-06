# Fix Nearest Wins: Greyed-out Reveal, Missing Closest Team button, No Applause

## Issue 1: "Reveal Answer" button greyed out for 5-10 seconds after timer finishes

### Root Cause
When NearestWinsInterface starts its timer, it notifies QuizHost via `onGameTimerStateChange(true)`, which sets `flowState.flow = 'running'`. This triggers the QuizHost useEffect at line 1236 to start QuizHost's **own** `useTimer` (`timer.start(flowState.totalTime)`). So **two timers run simultaneously**: NearestWins' internal timer and QuizHost's `useTimer`.

When NearestWins' timer finishes first, it sets `flowState.flow = 'timeup'`. But QuizHost's `useTimer` is NOT stopped (line 1245 explicitly excludes `'timeup'` from the stop condition). QuizHost's timer keeps running and:
- Its `onTick` callback updates `flowState.timeRemaining` every second, causing re-renders
- Its `onEnd` callback eventually fires, calling `sendTimeUpToPlayers()` again (the duplicate TIMEUP in logs)
- Until QuizHost's timer finishes, the repeated `[QuizHost] Timer starting` logs and re-renders may interfere with state propagation

### Fix
**File: `src/components/QuizHost.tsx` line ~1236**

Add a guard so QuizHost's `useTimer` does NOT start when NearestWinsInterface is managing its own timer:

```ts
if ((flowState.flow as any) === 'running' && !showNearestWinsInterface) {
```

NearestWinsInterface already handles its own timer, broadcasts, and timeup notifications. QuizHost's timer is only needed for quiz pack mode and keypad on-the-spot mode.

---

## Issue 2: After "Reveal Answer", nav shows "Next Question" instead of "Closest Team"

### Root Cause
The nav bar's `getOnTheSpotFlowButton()` at line 185-200 shows "Closest Team" only when `hasTeamsAnsweredCorrectly` is `true`. This prop maps to `teamsAnsweredCorrectly` state in QuizHost.

`teamsAnsweredCorrectly` is set to `true` in the flow sync effect at line 1320-1324:
```ts
if (gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'revealed') {
  if (showNearestWinsInterface) {
    setTeamsAnsweredCorrectly(true);  // <-- never reached!
    setFlowState(prev => ({ ...prev, flow: 'revealed' }));
  }
}
```

But NearestWinsInterface's `handleRevealAnswer` (line 652) calls `onFlowStateChange('revealed')` which sets `flowState.flow = 'revealed'` **before** this effect runs. So when the effect evaluates `flowState.flow !== 'revealed'`, it's already `false`, and `setTeamsAnsweredCorrectly(true)` is **never executed**.

Result: `hasTeamsAnsweredCorrectly` stays `false` → nav shows "Next Question" instead of "Closest Team".

### Fix
**File: `src/components/NearestWinsInterface.tsx` line ~647 (`handleRevealAnswer`)**

Remove the `onFlowStateChange('revealed')` call from `handleRevealAnswer`. Let the flow sync effect in QuizHost handle the transition. The effect at line 1320-1324 will see `gameAnswerRevealed=true` (from `onGameAnswerRevealed(true)`) and `flowState.flow !== 'revealed'` (still 'timeup'), so it will correctly set `teamsAnsweredCorrectly=true` AND transition flow to 'revealed'.

---

## Issue 3: No applause sound when "Reveal Answer" is triggered

### Root Cause
NearestWinsInterface's `handleRevealAnswer` (stage 1, line 647-695) does not play any sound. The applause sound is only played in `handleNearestWinsAwardPoints` (QuizHost line 5846-5857), which is called during `handleRevealClosestTeam` (stage 2) when points are awarded.

### Fix
**File: `src/components/NearestWinsInterface.tsx` line ~647 (`handleRevealAnswer`)**

Import `playApplauseSound` from `../utils/audioUtils` and call it in `handleRevealAnswer` when the answer is revealed:
```ts
playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
```

---

## Summary of Changes

### File 1: `src/components/QuizHost.tsx`
- **Line ~1237**: Add `&& !showNearestWinsInterface` guard to prevent QuizHost's own timer from starting when NearestWins is active

### File 2: `src/components/NearestWinsInterface.tsx`
- **`handleRevealAnswer` (~line 651-653)**: Remove the `onFlowStateChange('revealed')` call — let QuizHost's flow sync effect handle the transition (which correctly sets `teamsAnsweredCorrectly=true`)
- **`handleRevealAnswer` (~line 648)**: Add `playApplauseSound()` call on reveal
- **Import**: Add `playApplauseSound` to imports from `../utils/audioUtils`
