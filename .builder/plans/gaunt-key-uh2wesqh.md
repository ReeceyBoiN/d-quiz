# Plan: Adapt Buzzin Pack Mode to SpeedQuizzing Flow

## Summary

The current buzzin pack implementation is functional but basic. This plan upgrades it to match the full SpeedQuizzing flow including: **lockout after first buzz**, **team buzzer sound on buzz**, **permanent lockout for wrong teams**, **re-buzz for remaining teams**, **Advanced mode agree/disagree voting**, **animated external display support**, and **proper player-side feedback**.

## User Choices

- **Advanced mode voting**: Included — after a team answers, other teams vote agree/disagree for bonus points
- **Re-buzz rules**: Only un-buzzed teams can re-buzz. Teams who buzzed wrong are permanently locked out for that question.
- **Live screen style**: Animated + prominent — large team name with color flash, pulsing animation, "BUZZED IN!" text

## Current State vs Target

| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| Player buzz button | ✅ Works | ✅ | None |
| First buzz detection | ✅ Auto-detects fastest | ✅ | None |
| Host CORRECT/WRONG buttons | ✅ Works | ✅ | None |
| **Lockout after first buzz** | ❌ All teams can still buzz | First buzz locks everyone else | **Critical** |
| **Buzzer sound on buzz** | ❌ No sound plays | Team's buzzer sound plays | **Critical** |
| **Re-buzz after WRONG** | ⚠️ Clears locally, no player broadcast | Wrong team locked permanently, others re-enabled | **Critical** |
| **Locked-out teams tracking** | ❌ None | Teams who answered wrong stay locked for the question | **Critical** |
| **External display / live screen** | ❌ No buzz-in view | Animated team name flash, waiting state, results | **Important** |
| **Player lockout feedback** | ❌ Just shows "Answer Submitted" | "Team X buzzed first - Wait...", "Locked Out", etc. | **Important** |
| **Advanced mode (voting)** | ❌ None | Agree/disagree voting with bonus points after buzz answer | **New feature** |

## Implementation Plan

### 1. Add Buzz-In Network Messages

**File:** `src/network/wsHost.ts`

Add to `NetworkMessageType`:
- `'BUZZ_LOCKED'` — broadcast when a team buzzes first (locks everyone)
- `'BUZZ_RESET'` — broadcast when buzz reopens after wrong (with locked-out team list)
- `'BUZZ_RESULT'` — broadcast correct/wrong result
- `'BUZZ_VOTE_START'` — broadcast to start voting phase (Advanced mode)
- `'BUZZ_VOTE_RESULT'` — broadcast voting results and scores

Add helper functions:
```ts
sendBuzzLockedToPlayers(buzzedTeamName: string, buzzedTeamId: string)
sendBuzzResetToPlayers(lockedOutTeamIds: string[])
sendBuzzResultToPlayers(teamName: string, correct: boolean)
sendBuzzVoteStartToPlayers(buzzedTeamName: string) 
sendBuzzVoteResultToPlayers(results: { correct: boolean, agreeCount: number, disagreeCount: number })
```

These all use `broadcastMessage` internally via IPC, same pattern as existing helpers like `sendTimeUpToPlayers`.

### 2. Host-Side Buzz State Machine

**File:** `src/components/QuizHost.tsx`

**New state:**
```ts
const [buzzLockedOutTeams, setBuzzLockedOutTeams] = useState<Set<string>>(new Set());
const [buzzWinnerTeamId, setBuzzWinnerTeamId] = useState<string | null>(null);
const [buzzVotePhase, setBuzzVotePhase] = useState(false);
const [buzzVotes, setBuzzVotes] = useState<Record<string, 'agree' | 'disagree'>>({});
```

**Buzz detection effect** — fires when `teamAnswers` changes during buzzin pack mode:
- Filters out locked-out teams from `buzzLockedOutTeams`
- If a new valid buzz is detected and `buzzWinnerTeamId` is null:
  - Set `buzzWinnerTeamId`
  - Play team's buzzer sound via existing `playFastestTeamBuzzer(team.buzzerSound)`
  - Broadcast `BUZZ_LOCKED` to all players
  - Send animated display update to external window

**`handleBuzzCorrect` (updated):**
- If Advanced mode enabled → enter vote phase first (see section 7)
- Else → award points, play applause, broadcast `BUZZ_RESULT(correct: true)`, clear buzz state, send "CORRECT" to external display, clear teamAnswers for this question

**`handleBuzzWrong` (updated):**
- If punishment enabled → deduct points
- Play fail sound
- Add wrong team to `buzzLockedOutTeams` (permanent for this question)
- Clear only wrong team's answer from `teamAnswers`
- Set `buzzWinnerTeamId = null`
- Broadcast `BUZZ_RESET` with locked-out team IDs list
- Send "WRONG" feedback to external display, then return to "waiting for buzz"
- Check if ALL teams are now locked out → if so, auto-advance or show "no correct answer"

**Question change cleanup** (in existing question-change effect ~line 1096):
```ts
setBuzzLockedOutTeams(new Set());
setBuzzWinnerTeamId(null);
setBuzzVotePhase(false);
setBuzzVotes({});
```
Also broadcast `BUZZ_RESET` with empty locked-out list so all players start fresh.

**Reset paths** — add cleanup in:
- `closeAllGameModes()`
- `handleEndRound()`
- `handleTabChange()` (home tab)
- `handleQuizPackClose()`

### 3. Player-Side Buzz Lockout & Feedback

**File:** `src-player/src/App.tsx`

Add new state:
```ts
const [buzzLockedBy, setBuzzLockedBy] = useState<string | null>(null); // team name that locked us
const [buzzLockedOut, setBuzzLockedOut] = useState(false); // permanently locked for this Q
const [buzzVoteActive, setBuzzVoteActive] = useState(false); // voting phase
const [buzzVoteBuzzerName, setBuzzVoteBuzzerName] = useState<string | null>(null);
```

Add message handlers in WebSocket switch:

**`BUZZ_LOCKED`:** 
- Set `buzzLockedBy` to the buzzer team name
- If this player's team name matches → show "YOU BUZZED!" (already submitted)
- If not → disable buzz button, show "Team X buzzed first - Wait..."

**`BUZZ_RESET`:**
- If this player's team ID is NOT in `lockedOutTeamIds` → clear `buzzLockedBy`, reset `submitted` state, re-enable buzz button
- If this player's team IS in the locked-out list → set `buzzLockedOut = true`, keep disabled

**`BUZZ_RESULT`:**
- Show brief correct/wrong feedback overlay (1-2 seconds)
- Clear `buzzLockedBy`

**`BUZZ_VOTE_START`:**
- Set `buzzVoteActive = true`, `buzzVoteBuzzerName` to the buzzing team
- Show agree/disagree buttons (only for non-buzzing teams)

**`BUZZ_VOTE_RESULT`:**
- Clear vote state, show score feedback briefly

**Reset on new question (`QUESTION` message):**
- Clear all buzz state: `buzzLockedBy`, `buzzLockedOut`, `buzzVoteActive`

**File:** `src-player/src/components/QuestionDisplay.tsx`

Add new props: `buzzLockedBy?: string`, `buzzLockedOut?: boolean`, `buzzVoteActive?: boolean`, `buzzVoteBuzzerName?: string`, `onBuzzVote?: (vote: 'agree' | 'disagree') => void`

Update the buzz-in button section:
- **Normal**: Show "BUZZ IN" button (existing)
- **Submitted (you buzzed)**: Show "YOU BUZZED! Waiting for host..." in green
- **Locked by other team**: Show "{buzzLockedBy} buzzed first - Wait..." in orange, button disabled
- **Locked out permanently**: Show "Locked Out" in red, button disabled
- **Vote phase** (Advanced): Show agree/disagree buttons with the buzzer team name: "Do you agree with {buzzVoteBuzzerName}'s answer?" → [AGREE] [DISAGREE]

### 4. External Display — Animated Buzz-In Views

**File:** `src/components/ExternalDisplayWindow.tsx`

Add rendering for new display modes in the message handler:

**`buzzin-waiting`**: 
- Large "BUZZ IN" text with pulsing Zap icon
- Orange theme, animated border glow

**`buzzin-team`**:
- Full-screen team name in their team color
- "BUZZED IN!" text with scale-up + pulse animation
- Zap icons flanking the name
- Team color background with radial gradient

**`buzzin-correct`**:
- Green overlay with "CORRECT!" in large text
- Team name below
- Checkmark animation
- Auto-fades after 2 seconds

**`buzzin-wrong`**:
- Red overlay with "WRONG!" in large text
- X animation
- Auto-fades after 1.5 seconds, returns to waiting

**`buzzin-vote`** (Advanced):
- Show "VOTING..." with a progress indicator
- Team name + "Agree or Disagree?" prompt
- Live vote count bars updating in real-time

### 5. Buzz Detection Effect

**File:** `src/components/QuizHost.tsx`

Add a `useEffect` to reactively detect first buzz (replaces the inline render computation):

```ts
useEffect(() => {
  if (!isBuzzinPackMode || !flowState.isQuestionMode || buzzWinnerTeamId || buzzVotePhase) return;
  
  const validBuzzes = Object.entries(teamAnswers)
    .filter(([, answer]) => answer === 'buzzed')
    .filter(([teamId]) => !buzzLockedOutTeams.has(teamId))
    .map(([teamId]) => ({ teamId, time: teamResponseTimes[teamId] || Infinity }))
    .sort((a, b) => a.time - b.time);
  
  if (validBuzzes.length === 0) return;
  
  const firstTeamId = validBuzzes[0].teamId;
  const team = quizzes.find(q => q.id === firstTeamId);
  
  setBuzzWinnerTeamId(firstTeamId);
  
  // Play team's buzzer sound
  if (team?.buzzerSound) {
    playFastestTeamBuzzer(team.buzzerSound);
  }
  
  // Broadcast lockout to all players
  broadcastMessage({ 
    type: 'BUZZ_LOCKED', 
    data: { teamName: team?.name, teamId: firstTeamId } 
  });
  
  // Update external display with animated buzz-in view
  sendToExternalDisplay({ 
    type: 'DISPLAY_UPDATE', 
    mode: 'buzzin-team', 
    data: { 
      teamName: team?.name, 
      teamColor: team?.backgroundColor,
      responseTime: validBuzzes[0].time
    } 
  });
}, [teamAnswers, teamResponseTimes, isBuzzinPackMode, flowState.isQuestionMode, 
    buzzWinnerTeamId, buzzLockedOutTeams, buzzVotePhase, quizzes]);
```

### 6. Host UI Updates for Buzz Panel

**File:** `src/components/QuizHost.tsx` (question mode render, ~line 6609)

Update the buzzed team panel to use `buzzWinnerTeamId` state instead of inline computation:
- Show the buzzed team from `buzzWinnerTeamId` (looked up in `quizzes`)
- Show locked-out teams count: "X of Y teams locked out"
- When all teams are locked out, show "All teams locked out — no correct answer" with a SKIP button
- During vote phase, show vote progress instead of CORRECT/WRONG buttons

### 7. Advanced Mode — Agree/Disagree Voting

**File:** `src/components/QuizHost.tsx`

**Config**: The buzzin pack config screen already has all modifiers. Add a new toggle: "Advanced Mode (Voting)" checkbox in the QuizPackDisplay config. Store this in a new state `buzzinAdvancedMode`.

**Vote flow (triggered from handleBuzzCorrect when advanced mode is on):**
1. Instead of immediately awarding points, enter vote phase:
   - `setBuzzVotePhase(true)`
   - Broadcast `BUZZ_VOTE_START` to players with the buzzer team name
   - Show "Voting in progress..." on host UI
2. Listen for `PLAYER_ANSWER` messages during vote phase — answers of `'agree'` or `'disagree'` are stored in `buzzVotes`
3. After a configurable timeout (5 seconds) or when all non-locked-out teams have voted:
   - Host clicks "CONFIRM RESULT" or it auto-confirms
   - Host marks CORRECT or WRONG (they already saw the answer)

**Scoring (Advanced mode):**

If host marks **CORRECT**:
- Buzzing team: +full points (e.g., 10)
- Teams that voted **agree**: +half points (e.g., 5)
- Teams that voted **disagree**: 0

If host marks **WRONG**:
- Buzzing team: -full points (if punishment enabled)
- Teams that voted **disagree**: +half points (e.g., 5)
- Teams that voted **agree**: 0

Broadcast `BUZZ_VOTE_RESULT` with breakdown to players and external display.

**File:** `src/components/QuizPackDisplay.tsx`

Add "Advanced Mode" toggle to the buzzin pack config screen (only visible when `isBuzzinPack` is true):
- Checkbox with Brain icon
- Description: "After a team buzzes and answers, other teams vote agree/disagree for bonus points"

**File:** `src-player/src/components/QuestionDisplay.tsx`

During vote phase, replace the buzz button with:
```
"{BuzzerTeamName} answered!"
Do you agree?
[AGREE ✓]  [DISAGREE ✗]
```
- Only show for non-buzzing, non-locked-out teams
- The buzzing team sees "Waiting for votes..."
- Locked-out teams see "Locked Out"

### 8. Network Message Flow for Votes

**File:** `src-player/src/App.tsx`

When player taps AGREE or DISAGREE during vote phase:
- Send `PLAYER_ANSWER` with `answer: { answer: 'agree' }` or `answer: { answer: 'disagree' }`
- Mark as submitted so they can't vote twice

**File:** `src/components/QuizHost.tsx`

In the `handleNetworkPlayerAnswer` handler (~line 4756), detect vote answers:
- If `buzzVotePhase` is true and answer is 'agree'/'disagree':
  - Store in `buzzVotes` state
  - Don't update normal `teamAnswers` (votes are separate)

## Files Modified

| File | Change |
|------|--------|
| `src/network/wsHost.ts` | Add 5 new message types (`BUZZ_LOCKED`, `BUZZ_RESET`, `BUZZ_RESULT`, `BUZZ_VOTE_START`, `BUZZ_VOTE_RESULT`) and helper functions |
| `src/components/QuizHost.tsx` | Buzz state machine (4 new state vars), buzz detection effect, updated handlers with lockout/voting, external display updates, cleanup in all reset paths, vote processing in answer handler |
| `src/components/QuizPackDisplay.tsx` | Add "Advanced Mode" toggle to buzzin config screen |
| `src-player/src/App.tsx` | Handle 5 new message types, add buzz lockout/vote state, reset on new question |
| `src-player/src/components/QuestionDisplay.tsx` | New props for buzz state, lockout UI, vote UI (agree/disagree buttons) |
| `src/components/ExternalDisplayWindow.tsx` | Add 5 new display modes (buzzin-waiting, buzzin-team, buzzin-correct, buzzin-wrong, buzzin-vote) with animations |

## Complete Flow (Classic)

```
1. Host loads .sqb buzzin file → config screen with "BUZZ-IN ROUND" header
2. Host clicks START ROUND → question broadcast as type "buzzin"
3. Players see big BUZZ IN button
4. Host reads question aloud
5. FIRST TEAM BUZZES:
   a. Host detects first valid buzz (ignoring locked-out teams)
   b. Plays team's buzzer sound
   c. Broadcasts BUZZ_LOCKED → all others disabled, see "Team X buzzed first"
   d. External display: animated team name flash with "BUZZED IN!"
   e. Host sees team name + CORRECT / WRONG buttons
6. HOST JUDGES:
   a. CORRECT → points, applause, BUZZ_RESULT(correct), external "CORRECT!" animation
   b. WRONG → fail sound, team permanently locked out for this Q
      → BUZZ_RESET sent (wrong team in locked list)
      → Other un-buzzed teams' buttons re-enabled
      → External display: "WRONG!" flash then back to waiting
7. Repeat 5-6 until correct or all teams locked out
8. If all teams locked out → show "No correct answer" + SKIP button
9. Next question → all lockouts cleared
```

## Complete Flow (Advanced / Voting)

```
Steps 1-5 same as Classic
6. After buzz, enter VOTE PHASE:
   a. Broadcast BUZZ_VOTE_START → other teams see AGREE / DISAGREE buttons
   b. Buzzing team sees "Waiting for votes..."
   c. External display shows "VOTING..." with live vote counts
7. After timeout or all votes in:
   a. Host marks CORRECT or WRONG
   b. If CORRECT: buzzer gets full points, agree voters get half points
   c. If WRONG: buzzer loses points (if punishment), disagree voters get half points
   d. Broadcast BUZZ_VOTE_RESULT with score breakdown
8. If WRONG → same re-buzz flow as Classic (locked out team, others re-enabled)
9. Next question → all state cleared
```
