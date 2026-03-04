# Fix: Double Points Awarded in Quizpack Mode

## Root Cause

When the host reveals an answer in quizpack mode, the `onReveal` handler calls **two functions in sequence**:

```js
// QuizHost.tsx line 6609-6616
onReveal={() => {
  if (isQuizPackMode) {
    handleRevealAnswer();    // ← awards points (line 4781)
    handlePrimaryAction();   // ← ALSO awards points (line 2457)
  } else {
    gameActionHandlers?.reveal?.();
  }
}}
```

Both `handleRevealAnswer()` and `handlePrimaryAction()` independently call `handleComputeAndAwardScores()`, so points are applied twice. A team that should get 6 points gets 12.

This same double-call also exists in the admin command handler (`QuizHost.tsx` line 3752-3754).

**Why it doesn't affect spot keypad mode:** In spot keypad mode, the `else` branch calls `gameActionHandlers?.reveal?.()` which goes through `KeypadInterface` — scoring only happens once there.

## Fix Approach

**Remove the scoring block from `handlePrimaryAction`'s `running`/`timeup` case for quizpack mode** (lines 2440-2459).

Rationale:
- `handleRevealAnswer()` is the more complete scoring path — it handles go-wide comma-split answers, number type comparisons, evil mode penalties, and stores the fastest team for display.
- `handlePrimaryAction()`'s scoring in the `running`/`timeup` case is a simpler duplicate that doesn't handle penalties or go-wide answers properly.
- `handleRevealAnswer()` is always called before `handlePrimaryAction()` in quizpack reveal flows, so removing scoring from `handlePrimaryAction` is safe.

## Files to Modify

**`src/components/QuizHost.tsx`** — Remove the quizpack scoring block (lines ~2440-2459) inside `handlePrimaryAction`'s `case 'running'` / `case 'timeup'` branch. Keep the rest of that case (team status calculation, external display broadcasting, flow state transitions) intact.

Specifically, remove or guard this block:
```js
// Award points to teams that answered correctly in quiz pack mode
if (isQuizPackMode) {
  const correctTeamIds = Object.entries(newStatuses)
    .filter(([_, status]) => status === 'correct')
    .map(([teamId, _]) => teamId);
  if (correctTeamIds.length > 0) {
    let fastestTeamId: string | undefined;
    const correctTeamTimes = correctTeamIds
      .map(id => ({ id, time: teamResponseTimes[id] || Infinity }))
      .sort((a, b) => a.time - b.time);
    if (correctTeamTimes.length > 0) {
      fastestTeamId = correctTeamTimes[0].id;
    }
    handleComputeAndAwardScores(correctTeamIds, 'keypad', fastestTeamId, teamResponseTimes);
  }
}
```

This is a single, focused change. No other files need modification.
