# Plan: Add .sqb Buzzin Quiz Pack Mode

## Summary

The `.sqb` file is an XML quiz format with `<game>Buzzin</game>` containing pre-written questions with known answers. It needs to be loaded and played as a **buzz-in style quiz pack** — questions are displayed one-by-one, teams buzz in to answer verbally, and the host judges correct/incorrect.

**User choices:**
- **Scoring**: Auto-detect the first team to buzz in and show their name prominently, but host manually clicks correct/incorrect to award points.
- **Config**: Include all modifiers (Points, Speed Bonus, Evil Mode, Punishment) — same as regular quiz pack config.

## Current State

- **Quiz loader** (`src/utils/quizLoader.ts`): Already parses `.sqb` XML correctly. Questions without `user_view` get `type: "buzzin"`. The `game` field is set to `"Buzzin"` and `gameVariation` to `"Advanced"`.
- **Quiz loading flow** (`src/utils/useQuizLoader.ts`): Sets `isQuizPack: true` on loaded quizzes.
- **QuizHost** (`src/components/QuizHost.tsx`): Detects quiz packs and shows `QuizPackDisplay` for config, then manages flow state for question-by-question gameplay.
- **QuizPackDisplay** (`src/components/QuizPackDisplay.tsx`): Config screen already shows Points/Speed Bonus/Go Wide/Evil Mode — can be reused for buzzin packs since user wants all modifiers.
- **Player app**: Already renders a "BUZZ IN" button for `buzzin` type questions (`src-player/src/components/QuestionDisplay.tsx:931`). When a player buzzes, it sends `'buzzed'` as the answer.
- **getCurrentGameMode()** (~line 3352): Returns `"keypad"` for quiz packs by default. Doesn't handle buzzin quiz pack questions.
- **BuzzInDisplay** (`src/components/BuzzInDisplay.tsx`): Existing on-the-spot buzz-in display that shows who buzzed first with correct/incorrect buttons. This visual pattern should be reused.

## Implementation Plan

### 1. Mark Buzzin Quiz Packs in Data Model
**File:** `src/utils/QuizDataContext.tsx`
- Add `isBuzzinPack?: boolean` field to the `LoadedQuiz` interface.

**File:** `src/utils/useQuizLoader.ts`
- After loading, detect if `quiz.game.toLowerCase() === "buzzin"` and set `isBuzzinPack: true` on the quiz object.

### 2. QuizHost — Buzzin Pack State & Game Mode
**File:** `src/components/QuizHost.tsx`

- **New state**: `const [isBuzzinPackMode, setIsBuzzinPackMode] = useState(false);`
- **Quiz load effect** (~line 1036): When `currentQuiz.isBuzzinPack` is true, call `setIsBuzzinPackMode(true)`. The existing flow (show QuizPackDisplay, set isQuizPack) remains.
- **getCurrentGameMode()** (~line 3352): Add a check — when `showQuizPackDisplay` and `isBuzzinPackMode`, return `"buzzin"` instead of `"keypad"`. This ensures:
  - Correct timer duration (`gameModeTimers.buzzin`)
  - Correct scoring behavior
  - Players see BUZZ IN button
- **Buzzed team detection**: When a team sends `'buzzed'` as their answer (already captured in `teamAnswers`), detect the first team by response time (using `teamResponseTimes`). Surface this info to QuizPackDisplay.
- **Reset paths**: In `handleEndRound`, `closeAllGameModes`, `handleQuizPackClose`, and `handleTabChange` — reset `isBuzzinPackMode` to `false` alongside `isQuizPackMode`.
- **Pass props to QuizPackDisplay**: Pass `isBuzzinPack`, `teamAnswers`, `teamResponseTimes`, and team data so the display can show who buzzed.

### 3. QuizPackDisplay — Buzzin-Aware Config & Question Screen
**File:** `src/components/QuizPackDisplay.tsx`

**Config screen (when `isBuzzinPack` is true):**
- Reuse the existing config layout with all modifiers (Points, Speed Bonus, Go Wide, Evil Mode, Punishment) since user wants all options.
- Add a prominent "BUZZ-IN ROUND" header/label with Zap icon and orange accent color to distinguish it from regular quiz pack config.
- Go Wide label can note it applies to buzz-in scoring if enabled.

**Question display screen (when `isBuzzinPack` is true):**
- Change the header bar color to orange (#f39c12) with "BUZZ-IN" label and Zap icon to clearly indicate buzz-in mode.
- Add a **Buzzed Team Panel** below the question area:
  - Shows which team buzzed first (auto-detected from `teamAnswers`/`teamResponseTimes`)
  - Displays the team name prominently with their response time
  - Includes **CORRECT** (green) and **WRONG** (red) buttons for the host to judge
  - When host clicks CORRECT → award points to that team
  - When host clicks WRONG → optionally deduct points (if Evil Mode/Punishment enabled), reset buzz state so other teams can buzz
  - If no team has buzzed yet, show "Waiting for teams to buzz in..." message
- The answer remains visible at the bottom for the host to verify.
- Timer and navigation controls remain the same.

**New props needed:**
- `isBuzzinPack?: boolean`
- `teamAnswers?: { [teamId: string]: string }` — to detect who buzzed (`'buzzed'` value)
- `teamResponseTimes?: { [teamId: string]: number }` — to determine fastest buzzer
- `teams?: Array<{ id: string; name: string; color?: string }>` — to display team names
- `onBuzzCorrect?: (teamId: string) => void` — callback when host marks correct
- `onBuzzWrong?: (teamId: string) => void` — callback when host marks wrong

### 4. Scoring Integration
**File:** `src/components/QuizHost.tsx`

- Add `handleBuzzCorrect` callback: Awards points to the team that buzzed correctly using existing `handleAwardPointsWithScoring` or `handleScoreChange` infrastructure.
- Add `handleBuzzWrong` callback: If Evil Mode + Punishment is enabled, deduct points. Clear the team's buzz so other teams can try.
- After correct answer or all teams wrong → auto-advance flow state (or let host manually advance with Next).

### 5. Player App
No changes needed — the player app already:
- Shows a "BUZZ IN" button for `buzzin` type questions
- Sends `'buzzed'` as the answer when tapped
- Records response time

## Files Modified

| File | Change |
|------|--------|
| `src/utils/QuizDataContext.tsx` | Add `isBuzzinPack` to `LoadedQuiz` interface |
| `src/utils/useQuizLoader.ts` | Set `isBuzzinPack` when game is "Buzzin" |
| `src/components/QuizHost.tsx` | Add `isBuzzinPackMode` state, update `getCurrentGameMode()`, pass new props to QuizPackDisplay, add buzz correct/wrong handlers, reset in all cleanup paths |
| `src/components/QuizPackDisplay.tsx` | Add buzzin-aware config header, buzzed team panel on question screen with correct/wrong buttons, accept new props |
| `src/state/flowState.ts` | No changes needed |
| Player app | No changes needed |

## Flow Summary

1. User loads `.sqb` file → quiz loader parses XML, detects `game: "Buzzin"` → marks as `isBuzzinPack: true`
2. QuizHost sets `isBuzzinPackMode = true`, shows QuizPackDisplay config screen with all modifiers + "BUZZ-IN ROUND" header
3. Host clicks START ROUND → questions broadcast to players as type `"buzzin"` → players see BUZZ IN button
4. Host reads question aloud from the host screen
5. Teams buzz in on their devices → `teamAnswers` updated with `'buzzed'`, `teamResponseTimes` records timing
6. QuizPackDisplay auto-detects fastest buzzer, shows team name prominently with CORRECT/WRONG buttons
7. Host judges the verbal answer against the displayed answer:
   - **CORRECT** → points awarded, can advance to next question
   - **WRONG** → optionally deduct points, reset buzz for other teams to try
8. Host navigates to next question or ends round
9. `getCurrentGameMode()` returns `"buzzin"` throughout, ensuring correct timer durations and scoring
