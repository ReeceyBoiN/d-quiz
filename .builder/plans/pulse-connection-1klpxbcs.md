# Keypad Scrambling Implementation Plan

## Overview
Implement real-time keypad scrambling for player devices where the host can enable/disable scrambling per team or globally. When enabled, player keypads display answer options in randomized grid positions (letters A-Z, numbers 0-9, multiple-choice options) while maintaining the same grid structure.

## Key Requirements
1. Each player device generates its own unique random scramble (not team-wide synchronized)
2. Scrambling applies immediately to current question + all future questions
3. Scrambling updates in real-time when host toggles the setting
4. Works for all input types: letters, numbers, multiple-choice, sequence

## Architecture Changes

### 1. Host → Player Communication (Server-side)
**Location:** src/network/wsHost.ts & src/components/QuizHost.tsx

**Current Flow:**
- Host broadcasts questions via `network/broadcast-question` IPC call
- Player receives QUESTION message and QuestionDisplay renders the keypad

**Required Changes:**
- Include `scrambled` flag in the QUESTION broadcast payload
- When host toggles scramble setting, send an immediate message to affected player(s) with updated scramble state

**Implementation Approach:**
- Add `scrambled: team.scrambled` to the question payload sent to players
- Create a new message type or use existing broadcast mechanism to send scramble updates
- Ensure each player device receives the scramble state for their team

### 2. Player-side Message Handling
**Location:** src-player/src/App.tsx & src-player/src/hooks/useNetworkConnection.ts

**Required Changes:**
- Extract `scrambled` flag from incoming QUESTION messages
- Store scrambled state in React state (alongside currentQuestion)
- When scrambled state changes (including from direct updates), trigger keypad re-render
- Pass scrambled flag to QuestionDisplay component

**Key State to Add:**
```
const [isKeypadScrambled, setIsKeypadScrambled] = useState(false);
// Update when receiving QUESTION message:
if (message.data?.scrambled !== undefined) {
  setIsKeypadScrambled(message.data.scrambled);
}
```

### 3. Keypad Rendering Logic (Player UI)
**Location:** src-player/src/components/QuestionDisplay.tsx

**Current Behavior:**
- Static letter grid: LETTERS_GRID with fixed positions (A-D, E-H, etc.)
- Static number pad: 0-9 in standard layout
- Multiple choice options rendered in order (A, B, C, D...)

**Required Changes for Each Question Type:**

#### Letters (Letter Grid)
- Create a shuffled copy of LETTERS_GRID when `scrambled=true`
- Use Fisher-Yates algorithm to randomize positions while maintaining grid structure (6 rows × 4 columns)
- Re-shuffle whenever scrambled flag changes OR question changes
- Keep multi-letter buttons ('QV', 'XZ', etc.) as atomic units

#### Numbers (Number Pad)
- Create shuffled array of digits 0-9 when `scrambled=true`
- Maintain same grid layout (typically 3 columns × 4 rows for 0-9 + action buttons)
- Position randomized numbers in the digit cells

#### Multiple Choice
- Shuffle the options array while preserving their index mapping (so A stays A even if position changes)
- Render buttons in new positions but keep internal answer values correct

**Shuffle Function:**
```typescript
const getShuffledGrid = (gridOrArray) => {
  // Fisher-Yates shuffle
  // Return shuffled copy while preserving grid structure
};
```

### 4. Real-time Updates When Host Toggles Scramble
**Location:** Multiple files

**Sequence:**
1. Host toggles scramble in TeamSettings / TeamWindow / BottomNavigation
2. QuizHost updates quizzes state: `quiz.scrambled = !quiz.scrambled`
3. Host sends update to player device (either via broadcast or targeted sendToPlayer)
4. Player receives message and updates `isKeypadScrambled` state
5. QuestionDisplay re-renders with new scrambled layout (if question currently shown) OR uses new setting for next question

**Implementation Options:**
- **Option A (Broadcast):** Include scrambled in every message and on state changes, send a dedicated SCRAMBLE_UPDATE message
- **Option B (Targeted):** Use existing `sendToPlayer` IPC mechanism to send team-specific scramble updates

**Recommended:** Option A - Send a dedicated update message when host toggles, ensuring immediate player feedback

### 5. Answer Submission & Reveal Logic
**Location:** src-player/src/components/QuestionDisplay.tsx

**Requirement:** 
- User selects scrambled button → internally stores correct answer regardless of position
- Answer submission must send original answer value (not position)
- Reveal overlay shows which position is correct (even if scrambled)

**No Changes Needed:** Current logic already maps button values to answers before submission via `onAnswerSubmit`

## Files to Modify

### Host App
1. **src/components/QuizHost.tsx**
   - After toggling scrambled in handleScrambleKeypad / handleGlobalScrambleKeypad, send update message to player(s)
   - Export team scrambled state when broadcasting questions

2. **src/components/KeypadInterface.tsx**
   - Add scrambled flag to broadcast-question payload
   - Include team scrambled state when sending question

3. **src/network/wsHost.ts**
   - Add handler for sending team-specific scramble updates to players
   - Ensure sendToPlayer method can target by team/deviceId

### Player App
1. **src-player/src/App.tsx**
   - Add `isKeypadScrambled` state
   - Handle QUESTION message extraction of `scrambled` flag
   - Handle new SCRAMBLE_UPDATE message type (if using Option A)
   - Pass scrambled state to QuestionDisplay

2. **src-player/src/components/QuestionDisplay.tsx**
   - Accept `scrambled` prop from parent
   - Add shuffle utility function (Fisher-Yates algorithm)
   - Modify LETTERS_GRID rendering to use shuffled grid when scrambled=true
   - Modify number pad rendering to use shuffled array when scrambled=true
   - Modify multiple-choice rendering to use shuffled options array when scrambled=true
   - Re-shuffle when: scrambled prop changes OR currentQuestion changes

3. **src-player/src/hooks/useNetworkConnection.ts**
   - Ensure SCRAMBLE_UPDATE message type is passed through to App.tsx handler

## Implementation Details

### Shuffle Algorithm
Use Fisher-Yates shuffle to maintain grid integrity:
```typescript
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleGrid(grid: string[][]): string[][] {
  const flat = grid.flat();
  const shuffled = shuffleArray(flat);
  const result = [];
  for (let i = 0; i < grid.length; i++) {
    result.push(shuffled.slice(i * grid[0].length, (i + 1) * grid[0].length));
  }
  return result;
}
```

### Deterministic Shuffle Timing
- Shuffle once when `scrambled` becomes true OR when new question arrives
- Cache shuffled layout for current question to avoid re-shuffling on every render
- Clear cache when question changes

## Message Format

### QUESTION Broadcast (Updated)
```json
{
  "type": "QUESTION",
  "data": {
    "type": "letters",
    "text": "What is...",
    "options": [...],
    "scrambled": true,  // NEW FIELD
    "timestamp": ...
  }
}
```

### SCRAMBLE_UPDATE Message (New)
```json
{
  "type": "SCRAMBLE_UPDATE",
  "data": {
    "scrambled": true,
    "timestamp": ...
  }
}
```

## Testing Scenarios
1. Host toggles scramble before question is shown → player sees scrambled keypad on next question
2. Host toggles scramble after question is displayed → player keypad immediately scrambles
3. Host sends new question while scramble is enabled → new question uses scrambled layout
4. User answers scrambled question → correct answer is recorded despite position change
5. Reveal shows correct position even if keypad was scrambled
6. Multiple players on same team with scramble enabled each see unique scrambles
7. Host toggles global scramble → all affected teams update immediately

## Risks & Mitigation
- **Risk:** Players confused by changing keypad layout mid-question
  - Mitigation: Clear visual feedback when scramble toggles (flash, highlight, message)
  
- **Risk:** Answer submission logic breaks if not correctly mapped
  - Mitigation: No changes to answer submission logic needed; values are internally stored correctly
  
- **Risk:** Performance if re-shuffling on every render
  - Mitigation: Memoize shuffled layout, only recalculate when scrambled flag or question changes
