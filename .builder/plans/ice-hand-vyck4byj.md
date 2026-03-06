# Fix: NearestWins "No submissions!" bug + results flow

## Root Cause

`NearestWinsInterface` maintains its own internal `submissions` state (initialized with `submitted: false` for all teams). When network players submit answers, `QuizHost.handleNetworkPlayerAnswer` stores them in `QuizHost.teamAnswers` state (which is why the sidebar shows "89"), but **`teamAnswers` is never passed to `NearestWinsInterface`**. So `submissions.filter(s => s.submitted)` is always empty, producing "No submissions!".

Compare with `KeypadInterface` which receives `teamAnswers={teamAnswers}` as a prop (line 6385).

## Fix

### Change 1: Pass `teamAnswers` to NearestWinsInterface (QuizHost.tsx ~line 6537)

Add the `teamAnswers` prop when rendering NearestWinsInterface:

```jsx
<NearestWinsInterface
    teams={quizzes}
    teamAnswers={teamAnswers}           // ADD THIS
    onTeamAnswerUpdate={handleTeamAnswerUpdate}  // already in props interface, just not passed
    ...
```

### Change 2: Add `teamAnswers` prop type to NearestWinsInterface (NearestWinsInterface.tsx ~line 11)

Add to the props interface:
```ts
teamAnswers?: {[teamId: string]: string};  // Network player answers from QuizHost
```

And destructure it in the component (rename the internal `teamAnswers` state to `localTeamAnswers` to avoid collision).

### Change 3: Sync incoming `teamAnswers` prop into internal `submissions` state (NearestWinsInterface.tsx)

Add a `useEffect` that watches the parent `teamAnswers` prop and updates the internal `submissions` array:

```ts
useEffect(() => {
    if (!teamAnswers || Object.keys(teamAnswers).length === 0) return;
    
    setSubmissions(prev => prev.map(s => {
        const val = teamAnswers[s.id];
        if (val !== undefined && String(val).trim() !== '') {
            const guessNum = parseInt(String(val).trim(), 10);
            if (!isNaN(guessNum)) {
                return { ...s, guess: guessNum, submitted: true };
            }
        }
        return s;
    }));
}, [teamAnswers]);
```

This ensures that as network answers arrive, they're reflected in the internal submissions used for results calculation.

### Change 4: Rename internal `teamAnswers` state to avoid prop collision (NearestWinsInterface.tsx)

The component has an internal state `const [teamAnswers, setTeamAnswers] = useState<{[teamId: string]: number}>({})` on line 183. Rename it to `localTeamAnswers` / `setLocalTeamAnswers` throughout the file to avoid shadowing the new prop.

### Change 5: QuizPack nearest wins flow - verify it works

The QuizPack flow in `handleRevealAnswer` (QuizHost.tsx ~line 4836) already reads from `QuizHost.teamAnswers` directly, so it should correctly find submissions. However, we need to verify the flow transitions are correct:

- QuizPack nearest wins questions should follow the flow: config (winner points slider) → sent-question → running (timer) → timeup → revealed (show closest team) → next
- The `handleRevealAnswer` already computes nearest wins scoring for quizpack mode (lines 4836-4889)
- The "Closest Team" label should appear instead of "Fastest Team" for nearest wins questions in QuizPack mode too

### Change 6: QuizPack flow - ensure "Closest Team" label shows for nearest wins

In `QuestionNavigationBar.tsx` and `FastestTeamDisplay.tsx`, nearest wins questions from QuizPack should show "Closest Team" instead of "Fastest Team". Check the existing logic handles `nearestwins` AND `nearest` question types from quiz packs.

## Files to modify

1. **`src/components/QuizHost.tsx`** - Pass `teamAnswers` and `onTeamAnswerUpdate` props to NearestWinsInterface
2. **`src/components/NearestWinsInterface.tsx`** - Accept `teamAnswers` prop, rename internal state, add sync useEffect
3. **`src/components/QuestionNavigationBar.tsx`** - Verify "Closest Team" label for quizpack nearest wins
4. **`src/components/FastestTeamDisplay.tsx`** - Verify displayMode handles quizpack nearest wins
