# 1st Place Winner: Buzzer Sound + Photo on External Display

## Summary
When revealing the 1st place team on the leaderboard, play their buzzer sound (in addition to applause), and show their team photo on the external display for a few seconds before transitioning back to the leaderboard table.

## Key Findings

- **LeaderboardReveal.tsx** uses a simplified `Quiz` interface (`id`, `name`, `score`, `scrambled`) — missing `buzzerSound` and `photoUrl`
- **Buzzer playback** is handled by `playFastestTeamBuzzer()` in `QuizHost.tsx:348-385` — uses `buzzerAudioRef` and IPC to resolve file paths. This can't be imported directly; needs a callback prop.
- **Team photos** are stored as `photoUrl` on the full Quiz type in `QuizHost.tsx:91`
- **External display** handles `"leaderboard-reveal"` in `PopoutDisplay.tsx:276` — we need a new temporary state for the winner photo overlay

## Changes Required

### 1. `src/components/LeaderboardReveal.tsx`
- **Extend the local `Quiz` interface** to include `buzzerSound?: string` and `photoUrl?: string`
- **Add prop** `onPlayTeamBuzzer?: (teamId: string) => void` to `LeaderboardRevealProps`
- **In `handleNext()`**: When revealing the last team (1st place / winner), also:
  - Call `onPlayTeamBuzzer(winnerTeam.id)` to play their buzzer
  - First send a `"leaderboard-winner-photo"` display update with the team's photo data
  - After a few seconds (e.g. 5s via `setTimeout`), send the normal `"leaderboard-reveal"` update so the display transitions back to the scoreboard

### 2. `src/components/QuizHost.tsx` (~line 6803)
- **Pass new props** to `<LeaderboardReveal>`:
  - `onPlayTeamBuzzer={(teamId) => { const team = quizzes.find(...); if (team?.buzzerSound) playFastestTeamBuzzer(team.buzzerSound); }}`
  - (quizzes already passed — just need to ensure `buzzerSound` and `photoUrl` are on the objects)

### 3. `src/components/PopoutDisplay.tsx`
- **Add `"leaderboard-winner-photo"` to the display mode type**
- **Add a new case** in the render switch that shows the winner's photo prominently (full-screen overlay with team name, "WINNER!" text, and the photo) with animated entrance
