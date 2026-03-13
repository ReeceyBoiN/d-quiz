# Remove Advanced Buzz-In Mode

## Summary
Remove the "Advanced" buzz-in mode (voting/agree-disagree) from both quiz pack and on-the-spot buzz-in flows. The advanced mode lets other teams vote agree/disagree after a team buzzes in and answers — this is being removed because it's too difficult to play.

## Files to Modify

### 1. `src/components/BuzzInInterface.tsx` (On-the-spot buzz-in setup)
- Remove the `advancedModeEnabled` state variable
- Remove the `hasAdvancedToggle` property from the classic mode config
- Remove the entire "Advanced mode toggle" UI section under classic mode (the Game Mode toggle with Classic vs Advanced and the toggle button)
- Remove the `actualMode` computation that maps `classic + advancedModeEnabled` → `"advanced"`
- Pass `selectedMode` directly to `BuzzInDisplay` instead of `actualMode`
- Remove `Brain` from lucide-react imports (if no longer used)

### 2. `src/components/BuzzInModal.tsx` (Legacy modal — may still be referenced)
- Remove the `"advanced"` entry from the `modes` array
- Remove `Brain` from lucide-react imports
- Update `BuzzInMode` type to `"points" | "classic"` only

### 3. `src/components/BuzzInDisplay.tsx` (Buzz-in gameplay display)
- Remove `"advanced"` from the `BuzzInMode` type
- Remove the advanced case from `getModeTitle()` and `getModeDescription()`

### 4. `src/components/QuizHost.tsx` (Host orchestration)
- Remove `buzzinAdvancedMode` state and `setBuzzinAdvancedMode`
- Remove `buzzVotePhase` state and `setBuzzVotePhase`
- Remove `buzzVotes` state and `setBuzzVotes`
- Remove the `handleBuzzVoteFinalize` callback entirely
- In `handleBuzzCorrect`: remove the `if (buzzinAdvancedMode)` branch — always use the classic/points flow (award points directly)
- Remove `buzzinAdvancedMode` and `onBuzzinAdvancedModeChange` props passed to `QuizPackDisplay`
- Remove the vote phase UI block in the buzzin pack panel (the `buzzVotePhase && buzzinWinnerTeam` conditional rendering)
- Remove the "ADVANCED" badge in the buzzin header bar
- Update `handleBuzzInStart` type signature: `"points" | "classic" | "advanced"` → `"points" | "classic"`
- Update `buzzInConfig` type similarly
- Remove `buzzVotePhase` from the useEffect dependency arrays where it appears
- Clean up all resets of `setBuzzVotePhase(false)` and `setBuzzVotes({})` (in question transitions, end round, etc.)

### 5. `src/components/QuizPackDisplay.tsx` (Quiz pack pre-game setup)
- Remove `buzzinAdvancedMode` and `onBuzzinAdvancedModeChange` props
- Remove the "Advanced Mode Toggle" UI section (the checkbox card with Brain icon)
- Remove `Brain` and `Checkbox` imports if no longer used elsewhere in this file

### 6. `src/network/wsHost.ts` (Network messages)
- Remove `'BUZZ_VOTE_START'` and `'BUZZ_VOTE_RESULT'` from the broadcast message type union
- Remove `sendBuzzVoteStartToPlayers` function
- Remove `sendBuzzVoteResultToPlayers` function

### 7. `src-player/src/App.tsx` (Player app)
- Remove `buzzVoteActive` and `buzzVoteBuzzerName` state variables
- Remove `BUZZ_VOTE_START` and `BUZZ_VOTE_RESULT` message handlers
- Remove `buzzVoteActive`, `buzzVoteBuzzerName`, and `onBuzzVote` props passed to `QuestionDisplay`
- Remove resets of these states in question transition handlers

### 8. `src-player/src/components/QuestionDisplay.tsx` (Player question UI)
- Remove `buzzVoteActive`, `buzzVoteBuzzerName`, and `onBuzzVote` props
- Remove the vote phase UI block (the agree/disagree buttons section)

## Approach
- Work through each file removing the advanced mode code
- Keep the classic and points modes fully intact
- The `BuzzInMode` type becomes `"points" | "classic"` everywhere
- No new features added — purely removal
