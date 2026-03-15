# Fix: Performance Stats (Correct, Success %) Using Random Mock Data

## Problem

The Performance panel in `FastestTeamDisplay` (showing Rank, Correct, Success %) displays randomly generated values that change on every re-render. The `getTeamStats()` function at `src/components/FastestTeamDisplay.tsx:133-147` uses `Math.random()` to generate fake data:

```js
const correctAnswers = Math.floor(Math.random() * 25) + 15;
const incorrectAnswers = Math.floor(Math.random() * 12) + 3;
```

Every time the component re-renders (which happens frequently due to timer ticks, player status changes, network broadcasts, etc.), completely new random values are generated. This causes the numbers to flash and change rapidly.

## Root Cause

This was placeholder/mock code that was never replaced with real data. The comment even says: *"Generate mock historical stats for the team (in a real app, this would come from a database)"*.

## Solution

### Approach: Add Cumulative Per-Team Answer Tracking in QuizHost

Currently, `teamAnswerStatuses` tracks correct/incorrect/no-answer **per question** (reset each new question). There is no cumulative tracking across the quiz session. We need to:

1. **Add cumulative tracking state** in `QuizHost.tsx` — a new state object that accumulates each team's correct and total answered counts across all questions in the session.

2. **Update cumulative stats** whenever scoring is applied (after answer reveal), by reading the per-question `teamAnswerStatuses` before they get cleared for the next question.

3. **Pass the cumulative stats** down to `FastestTeamDisplay` as a prop.

4. **Replace `getTeamStats()`** in `FastestTeamDisplay` to use the real cumulative data instead of `Math.random()`.

### Detailed Changes

#### File 1: `src/components/QuizHost.tsx`

1. **Add new state** near the existing team tracking state (~line 697):
   ```ts
   const [teamCumulativeStats, setTeamCumulativeStats] = useState<{
     [teamId: string]: { correct: number; incorrect: number; noAnswer: number; total: number }
   }>({});
   ```

2. **Update cumulative stats** after scoring is applied. There are two main scoring paths:
   - **Quiz Pack mode** (~line 2709-2727): After `newStatuses` is calculated and `setTeamAnswerStatuses(newStatuses)` is called, also update `teamCumulativeStats` by incrementing each team's correct/incorrect/noAnswer counts based on `newStatuses`.
   - **On-the-spot mode** scoring in `handleComputeAndAwardScores` (~line 6133): Similar update using the computed answer statuses.
   
   The key location is wherever `teamAnswerStatuses` gets populated with results — that's when we should also accumulate into `teamCumulativeStats`.

3. **Reset cumulative stats** when a new quiz is loaded or quiz is ended (same places where `setCurrentLoadedQuestionIndex(0)` is called, ~lines 1073, 2238, 2338).

4. **Pass to FastestTeamDisplay** — add `teamCumulativeStats` prop to all 4 render locations of `<FastestTeamDisplay>` (~lines 7089, 7179, 7202, 7347).

#### File 2: `src/components/FastestTeamDisplay.tsx`

1. **Add prop** `teamCumulativeStats` to the interface:
   ```ts
   teamCumulativeStats?: {
     [teamId: string]: { correct: number; incorrect: number; noAnswer: number; total: number }
   };
   ```

2. **Replace `getTeamStats()`** function (lines 133-147) to use real data:
   ```ts
   const getTeamStats = (teamId: string) => {
     const stats = teamCumulativeStats?.[teamId] || { correct: 0, incorrect: 0, noAnswer: 0, total: 0 };
     const totalAnswered = stats.correct + stats.incorrect;
     const correctPercentage = totalAnswered > 0 ? Math.round((stats.correct / totalAnswered) * 100) : 0;
     return {
       correctAnswers: stats.correct,
       incorrectAnswers: stats.incorrect,
       totalQuestions: stats.total,
       correctPercentage
     };
   };
   ```

### Files to Modify
- `src/components/QuizHost.tsx` — Add cumulative state, update on scoring, pass as prop
- `src/components/FastestTeamDisplay.tsx` — Accept prop, use real data instead of Math.random()

### What Won't Change
- Scoring logic itself (scoringEngine.ts, quizHostHelpers.ts)
- Answer validation (answerStats.ts)
- External display stats (those use their own per-question counts)
- Player-side code
