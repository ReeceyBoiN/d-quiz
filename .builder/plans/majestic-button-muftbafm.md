# Scramble Keypad - Review Findings & Fixes

## Critical Bug Found: Placeholder broadcasts missing `teamScrambleStates`

There are **3 places** in `QuizHost.tsx` where placeholder questions are broadcast to players via IPC (`broadcastQuestionToPlayers`), but **none of them include `teamScrambleStates`**:

1. **Line 1129-1136** - Question change effect (new question loaded)
2. **Line 1193-1200** - First question init (index 0)
3. **Line 3048-3057** - Quiz pack display question ready handler

### What goes wrong

When a placeholder question is sent without `teamScrambleStates`, the player App processes it like this:

```
teamScrambleStates = undefined → falls to legacy check → scrambled = false
```

This resets `isKeypadScrambled` to `false` for every player on every placeholder. Then when the real question arrives (which DOES include `teamScrambleStates`), it's set back to `true`. This causes:

1. **Visual flash**: The keypad briefly unscrambles then re-scrambles between placeholder and reveal
2. **Shuffle order resets**: Because `scrambled` toggles false→true, the shuffle effect fires twice, generating a NEW random order on the real question - defeating the "1 scrambled layout per question" requirement
3. **Players could briefly see the unscrambled layout**, giving them an advantage

### Fix

Add `teamScrambleStates` to all 3 placeholder broadcast locations. Build the map from current `quizzes` state the same way as the real question broadcasts do:

```js
const teamScrambleStates: Record<string, boolean> = {};
quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
```

### Files to modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/QuizHost.tsx` | 1129-1136 | Add `teamScrambleStates` to placeholder broadcast |
| `src/components/QuizHost.tsx` | 1193-1200 | Add `teamScrambleStates` to placeholder broadcast |
| `src/components/QuizHost.tsx` | 3048-3057 | Add `teamScrambleStates` to placeholder broadcast |

No other files need changes. All other flows verified correct:

- Per-team scramble toggle: builds correct map, each player looks up own team name ✓
- Global scramble toggle: applies to all teams, broadcasts full map ✓
- Shuffle persistence (placeholder → reveal): `questionRound` uses stable key (`questionType|options.length`) ✓
- Option text updates without re-shuffling: separate effect updates text in-place ✓
- Number pad 0 included in scramble: 10 digits in grid + separate CLR/Submit row ✓
- Unscrambled number pad: original 1-9 grid + CLR/0/Submit row preserved ✓
- Answer selection preserved across scramble toggle: uses original indices, not display positions ✓
