# Scramble Keypad Feature - Implementation Plan

## Current State

The scramble keypad feature is **partially implemented** but has critical bugs that prevent it from working correctly. Here's what exists and what's broken:

### What Already Works (Host App)
- Team data has a `scrambled` property (`src/components/QuizHost.tsx:94`)
- Bottom nav bar has a global scramble toggle button (`src/components/BottomNavigation.tsx:1159`)
- TeamSettings and TeamWindow have per-team scramble toggles
- LeftSidebar shows a purple `RotateCcw` icon next to scrambled teams (`src/components/LeftSidebar.tsx:231`)
- `handleScrambleKeypad` (per-team) and `handleGlobalScrambleKeypad` (all teams) handlers exist in QuizHost

### What Already Works (Player App)
- `QuestionDisplay` accepts a `scrambled` prop and has shuffle logic for letters, numbers, and multiple-choice options
- Player `App.tsx` handles `SCRAMBLE_UPDATE` messages and stores `isKeypadScrambled` state
- Shuffle logic uses Fisher-Yates algorithm

### What Already Works (Network)
- `SCRAMBLE_UPDATE` message type exists in wsHost
- `QUESTION` message includes a `scrambled` flag
- Backend `sendToPlayer` function exists for per-device messaging

---

## Bugs to Fix

### Bug 1: Per-Team Scramble Broadcasting is Broken
**Problem:** When toggling scramble for one team, `sendScrambleUpdateToPlayers()` broadcasts a single boolean to ALL players. If Team A has `scrambled=true` and Team B has `scrambled=false`, toggling Team A sends `true` to ALL players - incorrectly scrambling Team B's keypad too.

**Root Cause:** `sendScrambleUpdate` in `wsHost.ts` uses `broadcast()` which sends to all clients. There's no per-team targeting.

**Fix:** Instead of broadcasting a single boolean, broadcast a **map of team scramble states** (e.g. `{ teamScrambleStates: { "TeamA": true, "TeamB": false } }`). Each player looks up their own team name to determine their scramble state. This approach:
- Works with the existing broadcast mechanism (no need for per-player messaging)
- Handles the global toggle case naturally
- Is simpler than per-device targeting (which would require the host to know deviceId-to-teamName mappings)

### Bug 2: Shuffle Resets When Question is Revealed
**Problem:** The `useEffect` in `QuestionDisplay` that generates shuffled layouts depends on `[scrambled, question, options.length]`. When the question transitions from placeholder to actual question data, the `question` object changes, triggering a re-shuffle. This means the option order changes between seeing "A, B, C, D" placeholders and the actual question options.

**Root Cause:** Using `question` object reference as a dependency causes re-shuffle on any question data change.

**Fix:** Use a stable question identity key (similar to the existing `questionIdentity` pattern) instead of the question object reference. Generate a `shuffleSeed` when a new question starts (based on question identity), and only re-shuffle when the question identity actually changes (not when question details like text fill in). The shuffle should happen once when the question type/index changes, and persist through the placeholder-to-reveal transition.

### Bug 3: Number Pad 0 is Not Scrambled
**Problem:** The number pad shuffles `['1','2','3','4','5','6','7','8','9']` but the `0` button is rendered separately as a fixed button in the control row (alongside CLR and Submit). When scramble is active, all digits including 0 should be in random positions.

**Fix:** When scrambled, include `0` in the shuffled numbers array (making it 10 items: 0-9), and render all 10 digits in the grid. Move CLR and Submit buttons outside the grid or into a separate row. The grid can use a layout like 4 columns x 3 rows (with CLR and Submit in a separate control row below), or keep 3x3 grid + a 3-button bottom row that includes 0 in the shuffle.

### Bug 4: QUESTION message uses only selectedQuiz's scramble state
**Problem:** When broadcasting a QUESTION, the code uses `selectedQuiz?.scrambled` which is whichever team the host currently has selected - not each team's individual state. All players receive the same scramble flag.

**Fix:** Include `teamScrambleStates` map in the QUESTION broadcast (same as the SCRAMBLE_UPDATE fix). Each player checks their own team's scramble state from the map.

---

## Implementation Steps

### Step 1: Update Network Layer to Support Per-Team Scramble States
**Files:** `src/network/wsHost.ts`

- Modify `sendScrambleUpdate()` to accept a map of `{ [teamName: string]: boolean }` instead of a single boolean
- Modify `sendQuestion()` to accept `teamScrambleStates` map instead of a single `scrambled` boolean
- Update the `SCRAMBLE_UPDATE` and `QUESTION` message payloads accordingly

### Step 2: Update Host QuizHost to Send Per-Team States
**Files:** `src/components/QuizHost.tsx`

- In `handleScrambleKeypad()`: Build a map of all teams' scramble states and broadcast it
- In `handleGlobalScrambleKeypad()`: Same approach - build full map and broadcast
- In question broadcasting (`broadcastQuestionToPlayers`): Include `teamScrambleStates` map from current `quizzes` state instead of `selectedQuiz?.scrambled`

### Step 3: Update Player App to Use Per-Team Scramble State
**Files:** `src-player/src/App.tsx`

- On `SCRAMBLE_UPDATE`: Extract `teamScrambleStates` map from message data, look up own team's scramble state using `teamName`
- On `QUESTION`: Same - look up own team's state from `teamScrambleStates` map
- Maintain backward compatibility: if message contains old-style `scrambled` boolean, use that as fallback

### Step 4: Fix Shuffle Persistence Across Question Phases
**Files:** `src-player/src/components/QuestionDisplay.tsx`

- Change the shuffle `useEffect` dependency from `question` object to a stable question identity (e.g., question type + index, or a `questionId` field)
- Generate shuffle once per question identity change, not on every question object update
- Use the existing `questionIdentity` pattern: `${question?.q || ''}|${question?.type || ''}`
  - But filter out placeholder text so placeholder → real question doesn't trigger re-shuffle
  - Better approach: use question **type** only (since type doesn't change between placeholder and reveal), and add a `questionIndex` or `questionRound` counter that increments on NEXT messages

### Step 5: Fix Number Pad to Include 0 in Scramble
**Files:** `src-player/src/components/QuestionDisplay.tsx`

- When `scrambled` is true: shuffle all 10 digits `['0','1','2','3','4','5','6','7','8','9']` together
- Render all 10 digits in the main grid area
- Keep CLR and Submit as separate control buttons below the number grid
- When `scrambled` is false: keep original layout (1-9 grid + 0/CLR/Submit row)

---

## Key Files Summary

| File | Changes |
|------|---------|
| `src/network/wsHost.ts` | Update `sendScrambleUpdate` and `sendQuestion` to use per-team state maps |
| `src/components/QuizHost.tsx` | Update scramble handlers and question broadcasting to send per-team maps |
| `src-player/src/App.tsx` | Update SCRAMBLE_UPDATE and QUESTION handlers to use per-team lookup |
| `src-player/src/components/QuestionDisplay.tsx` | Fix shuffle persistence, fix number pad 0 inclusion |

No new files needed. No host UI changes needed (host UI is already complete).
