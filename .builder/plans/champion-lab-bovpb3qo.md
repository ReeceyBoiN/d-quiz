# Fix: Buzzer sound not playing during on-the-spot buzz-in mode

## Problem

When a player buzzes in during on-the-spot buzz-in mode (`showBuzzInMode`), their team's buzzer sound doesn't play on the host. The buzz is received (logs show `PLAYER_ANSWER` with `answer: 'buzzed'`), but no audio plays.

## Root Cause

There are two disconnected systems for buzz-in:

1. **Quiz Pack buzz-in** (`isBuzzinPackMode`) — Has a reactive `useEffect` at `QuizHost.tsx:1409` that watches `teamAnswers` for `'buzzed'` entries and calls `playFastestTeamBuzzer(team.buzzerSound)`. Works correctly.

2. **On-the-spot buzz-in** (`showBuzzInMode`) — Uses `BuzzInDisplay` component which has its own `handleBuzzIn()` method, but this is only triggered by manual UI clicks on team buttons. When a network player sends `PLAYER_ANSWER` with `'buzzed'`:
   - `QuizHost.handleNetworkPlayerAnswer` updates `teamAnswers` state
   - But the buzz detection effect at line 1409 skips it (checks `isBuzzinPackMode` only)
   - `BuzzInDisplay` never receives the network buzz (no `teamAnswers` prop)
   - No buzzer sound is played

## Fix

### Part 1: Pass network buzzes to BuzzInDisplay (`BuzzInDisplay.tsx`)

Add a `networkBuzzTeamId` prop that QuizHost can set when a network buzz comes in. Add a `useEffect` that reacts to this prop and triggers `handleBuzzIn` for the matching team.

**File:** `src/components/BuzzInDisplay.tsx`
- Add `networkBuzzTeamId?: string | null` and `onNetworkBuzzHandled?: () => void` to `BuzzInDisplayProps`
- Add `useEffect` watching `networkBuzzTeamId`: when it changes to a non-null value, find the matching team in `displayTeams`, call `handleBuzzIn(team)`, then call `onNetworkBuzzHandled()` to clear it

### Part 2: Detect on-the-spot buzzes and play buzzer sound (`QuizHost.tsx`)

Add a new state `buzzInModeNetworkBuzzTeamId` and a `useEffect` that watches `teamAnswers` when `showBuzzInMode` is true. When a `'buzzed'` answer appears:
1. Play the team's buzzer sound via `playFastestTeamBuzzer`
2. Set `buzzInModeNetworkBuzzTeamId` to the team ID so BuzzInDisplay picks it up
3. Pass these as props to the `BuzzInDisplay` render at line 6861

**File:** `src/components/QuizHost.tsx`
- Add state: `const [buzzInModeNetworkBuzzTeamId, setBuzzInModeNetworkBuzzTeamId] = useState<string | null>(null)`
- Add `useEffect` similar to the existing buzz detection at line 1409, but for `showBuzzInMode` instead of `isBuzzinPackMode`:
  - Watch `teamAnswers` for new `'buzzed'` entries
  - Track which buzzes have already been handled (use a ref)
  - When new buzz detected: play buzzer sound, set `buzzInModeNetworkBuzzTeamId`
- In the `BuzzInDisplay` render (~line 6861), pass:
  - `networkBuzzTeamId={buzzInModeNetworkBuzzTeamId}`
  - `onNetworkBuzzHandled={() => setBuzzInModeNetworkBuzzTeamId(null)}`

## Files to Modify

1. `src/components/BuzzInDisplay.tsx` — Add `networkBuzzTeamId` prop and reactive effect
2. `src/components/QuizHost.tsx` — Add buzz detection for on-the-spot mode, play buzzer, pass prop
