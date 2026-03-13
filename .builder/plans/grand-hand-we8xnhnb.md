# Enhanced Buzz-In Rules, Timer Pause, and UI Tweaks

## Problem Summary
1. Currently ALL teams get permanently locked out after the first wrong buzz — teams should be allowed to re-buzz after a wrong answer (by default)
2. Timer doesn't pause when a team buzzes in during a running timer — it should pause, then resume if wrong
3. No "one guess per team" setting — need a checkbox that locks teams out after a wrong guess (optional rule)
4. Correct answer not always visible to host during buzz-in mode — host needs to see it to judge
5. Buzz-in button on player devices is too small — needs to be massive, nearly full-screen
6. These rules must apply to BOTH quiz pack buzz-in AND on-the-spot buzz-in modes

## Implementation Plan

### 1. Add `oneGuessPerTeam` Setting to SettingsContext
**File: `src/utils/SettingsContext.tsx`**
- Add `oneGuessPerTeam: boolean` to the settings interface and context
- Add `updateOneGuessPerTeam` function
- Persist to localStorage like other settings
- Default to `false` (teams CAN re-buzz after wrong answer)

### 2. Change Buzz-In Lockout Logic in QuizHost (Quiz Pack Mode)
**File: `src/components/QuizHost.tsx`**

**`handleBuzzWrong` (~line 6121):**
- Only add team to `buzzLockedOutTeams` if `oneGuessPerTeam` is enabled
- When `oneGuessPerTeam` is OFF: clear the winner, clear that team's buzz answer/time, send `BUZZ_RESET` with empty lockout list (or only currently locked teams if any), so all teams can re-buzz
- When `oneGuessPerTeam` is ON: keep current behavior (add team to locked out set)
- The "all teams locked out" check should still work when `oneGuessPerTeam` is ON

**Buzz detection effect (~line 1394) — Timer pause on buzz:**
- When a buzz is detected and `flowState.flow === 'running'` (timer is active), call `timer.pause()` to pause the host timer
- Send `TIMER_PAUSE` to players so their timer also pauses
- Stop countdown audio

**`handleBuzzWrong` — Timer resume after wrong:**
- If `timer.isPaused` (timer was paused due to buzz), call `timer.resume()` to restart the timer
- Send `TIMER_RESUME` to players with the remaining time
- Restart countdown audio

**`handleBuzzCorrect` — Timer stop on correct:**
- Call `timer.stop()` to end the timer (question is done)
- Send `TIMEUP` or stop the timer on players

### 3. Always Show Answer to Host in Buzz-In Mode
**File: `src/components/QuizHost.tsx` (~line 6765)**
- Change the `showAnswer` prop on `QuestionPanel` to always be `true` when `isBuzzinPackMode` is active
- Currently: `showAnswer={flowState.flow === 'timeup' || flowState.flow === 'revealed' || ...}`
- New: `showAnswer={isBuzzinPackMode || flowState.flow === 'timeup' || ...}`

**File: `src/components/QuizPackDisplay.tsx` (~line 770)**
- The answer is already shown at the bottom of the question display in QuizPackDisplay. Verify it's always visible when `isBuzzinPack` is true (it already appears to be — the answer display section at line 770 has no conditional hiding).

### 4. Add Timer Pause/Resume Network Messages
**File: `src/network/wsHost.ts`**
- Add `sendTimerPauseToPlayers()` function — broadcasts `TIMER_PAUSE` message
- Add `sendTimerResumeToPlayers(remainingSeconds: number)` function — broadcasts `TIMER_RESUME` with remaining time

**File: `src-player/src/App.tsx`**
- Handle `TIMER_PAUSE` message — set a `timerPaused` state, freeze the countdown display
- Handle `TIMER_RESUME` message — resume countdown from the provided remaining time

**File: `src-player/src/components/QuestionDisplay.tsx`**
- Accept `timerPaused` prop and visually indicate paused state (e.g., pulsing timer text)

### 5. Add "One Guess Per Team" Checkbox to Setup Screens

**File: `src/components/QuizPackDisplay.tsx` (config screen)**
- Add a new card or checkbox in the buzz-in pack config grid (the `grid-cols-2` section at line 454)
- Checkbox labeled "One Guess Per Team" with description "Teams that answer incorrectly cannot buzz in again for that question"
- Wire to `oneGuessPerTeam` setting from SettingsContext

**File: `src/components/BuzzInInterface.tsx` (on-the-spot setup)**
- Add the same "One Guess Per Team" checkbox to the on-the-spot buzz-in setup screen
- Place it below the mode selection cards

### 6. Apply Same Rules to On-The-Spot Buzz-In Mode
**File: `src/components/BuzzInDisplay.tsx`**
- Currently this component uses simple local state (`handleBuzzIn`, `handleCorrectAnswer`, `handleWrongAnswer`)
- It doesn't have lockout logic — `handleWrongAnswer` just resets to "waiting" state
- Need to add `oneGuessPerTeam` support: track locked-out teams locally, prevent them from buzzing again
- Timer pause: when a team buzzes in, the existing countdown timer should pause. On wrong answer, resume it.
- On correct answer, show team name prominently (already does this in "complete" state)

### 7. Make Buzz-In Button Massive on Player Devices
**File: `src-player/src/components/QuestionDisplay.tsx` (~line 936)**
- Change the buzz-in button container from `w-full max-w-sm sm:max-w-md` to full-width, full available height
- Make the button itself fill most of the screen: use `w-full` with large height classes like `h-[50vh]` or `flex-1`
- Increase text size to `text-4xl` or larger
- Remove max-width constraints so it spans the full width
- Keep the disabled/submitted/locked states but make them equally large

### 8. Show Correct Team on Player Devices and External Display (Correct Answer)
**File: `src/components/QuizHost.tsx` — `handleBuzzCorrect`**
- After awarding points, show the winning team's name and photo on player devices via `sendBuzzResultToPlayers` (already sends team name and `correct: true`)
- Trigger the FastestTeamDisplay overlay (or equivalent) to show the winning team with their photo
- External display already shows `buzzin-correct` mode with team name — enhance to include team photo

**File: `src/components/ExternalDisplayWindow.tsx`**
- Update `buzzin-correct` case to display team photo if available (pass `teamPhoto` in the data)

## Summary of Files to Modify
1. `src/utils/SettingsContext.tsx` — new `oneGuessPerTeam` setting
2. `src/components/QuizHost.tsx` — lockout logic, timer pause/resume, always show answer
3. `src/components/QuizPackDisplay.tsx` — "One Guess Per Team" checkbox
4. `src/components/BuzzInInterface.tsx` — "One Guess Per Team" checkbox  
5. `src/components/BuzzInDisplay.tsx` — lockout + timer pause for on-the-spot mode
6. `src/network/wsHost.ts` — TIMER_PAUSE/TIMER_RESUME messages
7. `src-player/src/App.tsx` — handle TIMER_PAUSE/TIMER_RESUME
8. `src-player/src/components/QuestionDisplay.tsx` — massive buzz-in button + timer paused state
9. `src/components/ExternalDisplayWindow.tsx` — team photo on buzz-in correct
