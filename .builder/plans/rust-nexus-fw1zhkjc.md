# Fix: Complete Performance Stats Implementation

## What's Already Done
1. `teamCumulativeStats` state added to `QuizHost.tsx` (~line 700)
2. Cumulative stats update after on-the-spot scoring (`setTeamCumulativeStats` at ~line 2735)
3. Cumulative stats update after Quiz Pack scoring (`setTeamCumulativeStats` at ~line 5411)

## Remaining Work

### 1. Reset cumulative stats when quiz is loaded/ended (`QuizHost.tsx`)
Add `setTeamCumulativeStats({})` at these locations where quiz state is reset:
- ~line 1073: When a new quiz is loaded (`setCurrentLoadedQuestionIndex(0)`)
- ~line 2238: When ending a round/clearing quiz questions
- ~line 2338: When starting on-the-spot keypad mode

### 2. Pass `teamCumulativeStats` prop to FastestTeamDisplay renders (`QuizHost.tsx`)
Add `teamCumulativeStats={teamCumulativeStats}` to all 4 `<FastestTeamDisplay>` JSX instances:
- ~line 7089 (quiz pack overlay)
- ~line 7179 (keypad overlay)
- ~line 7202 (standalone fastest team)
- ~line 7347 (music round overlay)

### 3. Update FastestTeamDisplay component (`FastestTeamDisplay.tsx`)
- Add `teamCumulativeStats` to the `FastestTeamDisplayProps` interface
- Accept it in the component destructuring
- Replace the `getTeamStats()` function (currently uses `Math.random()`) to read from the prop instead

### Files Modified
- `src/components/QuizHost.tsx` — reset + pass prop
- `src/components/FastestTeamDisplay.tsx` — accept prop, use real data
