# Host Remote Button Implementation Plan
## Quiz Pack & On-The-Spot Modes - Complete Flow Implementation

### CRITICAL CLARIFICATION: On-The-Spot Mode is Fundamentally Different
The on-the-spot/keypad mode is NOT about sending pre-written questions. It's about:
1. **Question Type Selection** - Host picks a question type on the fly (Letters, Numbers, Multiple Choice, etc.)
2. **Timer** - Timer runs while teams answer via their keypads
3. **Reveal Answer** - Host reveals the answer after timer
4. **Show Fastest** - Show which team answered fastest
5. **Next Question** - Loop back to Question Type Selection (not a new loaded question)

This requires different UI components than quiz-pack mode.

---

## Part 1: Verification of Recent Fixes (QUIZ PACK MODE)

### Status: ✅ VERIFIED & WORKING

Both recent fixes work correctly in quiz-pack mode:
1. **reveal-answer + handlePrimaryAction** - Flow: running/timeup → revealed ✅
2. **next-question + currentLoadedQuestionIndex** - Flow: fastest → ready (new question) ✅

All button transitions work, old buttons disappear, new buttons appear correctly.

---

## Part 2: On-The-Spot Mode - Complete Redesign Needed

### Current Problem
The host remote currently has:
- ✅ Flow state buttons (Send, Timer, Reveal, Fastest, Next)
- ❌ NO Question Type Selection Screen
- ❌ NO Answer Input Keypads (Letters, Numbers, Multiple Choice)
- ❌ Incorrect flow for on-the-spot (assumes pre-written questions exist)

### Correct On-The-Spot Flow (User-Confirmed)

```
[Question Type Selection Screen]
  ↓ [Select: Letters / Numbers / Multiple Choice]
[Question Properties Screen]
  ↓ [If picture exists] Send Picture
  ↓ [start-normal-timer / start-silent-timer]
[Timer Running - Teams Answer via Their Keypads]
  ↓ [reveal-answer]
[Reveal Answer - Show Fastest Team]
  ↓ [next-question]
[Back to Question Type Selection Screen]
  ↓ repeat
```

### Missing UI Components

#### Component 1: Question Type Selection Screen
**Location**: New screen in HostTerminal when in on-the-spot mode and NOT in timer flow
**Buttons Needed**:
- Letters (A-F format)
- Numbers (numeric answers)
- Multiple Choice (A/B/C/D options)
- Sequence Mode (mentioned as NOT needed for host remote)
- Navigation Arrows (to go back if user selected wrong type)

**What happens**: User clicks a type → flowState transitions to 'ready' with that question type selected → Timer/Reveal/Fastest buttons appear

#### Component 2: Question Properties Screen (In-Between)
**Location**: After selecting question type
**Show**:
- Question Type icon/name
- If a picture is attached to this type, show "Send Picture" button
- Otherwise show Timer buttons immediately
- Cancel/Back button to return to type selection

#### Component 3: Answer Input Keypad
**Location**: During 'sent-question' state in on-the-spot
**Variations by Question Type**:
- **Letters**: A B C D E F buttons (2x3 grid) - for letters questions
- **Numbers**: 0-9 numpad - for numbers questions
- **Multiple Choice**: A B C D buttons - for multiple choice questions
- **Sequence**: NOT needed (user confirmed)

**Purpose**: Host operator enters the expected/correct answer for teams to match against

**UI Note**: This should be visible WHILE timer is running (in 'sent-question' or 'running' state)

### How On-The-Spot is Different from Quiz Pack

| Aspect | Quiz Pack | On-The-Spot |
|--------|-----------|-----------|
| Questions | Pre-loaded from quiz file | Created on-the-fly by selecting type |
| Question Display | Shows full question text + image | No pre-written question text |
| Answer Input | Teams answer via their player keypads | Teams answer via their player keypads (same) |
| Host App UI | Shows QuestionNavigationBar with question text | Shows KeypadInterface with just answer type selection |
| Host Remote UI | **QUIZ PACK**: Shows only flow buttons | **ON-SPOT**: Needs type selection + keypad input |
| Flow Return | next-question → advances to next pre-loaded question | next-question → returns to type selection screen |

### Updated Host Remote Layout for On-The-Spot

#### Tab 1: Question Type Selection (On-The-Spot Only)
```
[Question Type Selection Screen]
┌─────────────────────────────┐
│  Select Question Type       │
├─────────────────────────────┤
│  [ Letters ] [ Numbers ]    │
│  [ Multiple] [ Buzzin? ]    │
├─────────────────────────────┤
│  < Navigation Arrows >      │
└─────────────────────────────┘
```

#### Tab 2: Game Controls (Both Modes, But Flows Differ)
```
[Controls for Current Flow State]
┌─────────────────────────────┐
│  Flow: sent-question        │
├─────────────────────────────┤
│  [Send Picture] ← if exists │
│  [Normal Timer][Silent Tmr] │
├─────────────────────────────┤
│  [Or other buttons based    │
│   on current flow state]    │
└─────────────────────────────┘
```

#### Tab 3: Answer Keypad (On-The-Spot - In Timer Flow)
```
[Answer Input During Timer]
┌─────────────────────────────┐
│  Expected Answer:           │
│  [Letter/Number Keypad]     │
│  [A][B][C][D][E][F]         │
│  [Clear] [Submit]           │
├─────────────────────────────┤
│  OR                         │
│  [Numbers]:                 │
│  [1][2][3] [Clear]          │
│  [4][5][6] [Submit]         │
│  [7][8][9]                  │
│  [0]                        │
└─────────────────────────────┘
```

---

## Part 3: Implementation Plan

### Phase 0: Update GameControlsPanel Button Logic
**File**: src-player/src/components/HostTerminal/GameControlsPanel.tsx

**Goal**: Ensure current flow buttons work correctly in BOTH modes

**Actions**:
1. Verify getButtonLayout works for on-the-spot 'sent-question' state (shows timer buttons without Send Picture if no image)
2. Ensure flowState passed to GameControlsPanel includes isQuizPackMode flag
3. Verify navigation arrows show in both modes (allow going back to type selection in on-the-spot)

### Phase 1: Create Question Type Selection Screen
**File**: New component src-player/src/components/HostTerminal/QuestionTypeSelector.tsx

**Requirements**:
- Show when flowState indicates on-the-spot mode and NOT in active timer flow
- Display buttons: Letters, Numbers, Multiple Choice
- Add navigation arrows for going back/forward in type list
- On click, send command to QuizHost to start that question type

**Commands to Add**:
- 'select-question-type' with commandData { type: 'letters' | 'numbers' | 'multiple-choice' }
- 'previous-type' / 'next-type' for navigation

**Handler in QuizHost** (src/components/QuizHost.tsx):
- New case 'select-question-type': Set up on-the-spot mode question with that type, broadcast FLOW_STATE with type info
- Handler should transition flowState to 'ready' with selected type

### Phase 2: Create Answer Input Keypad Component
**File**: New component src-player/src/components/HostTerminal/AnswerInputKeypad.tsx

**Requirements**:
- Show when flowState indicates on-the-spot mode AND in 'sent-question' or 'running' state
- Dynamic keypad based on selected question type:
  - **Letters**: A-F buttons
  - **Numbers**: 0-9 numpad with Clear/Submit
  - **Multiple Choice**: A-D buttons
- Store answer in local state
- On Submit, send to QuizHost to be used for comparison

**Note**: The answer input is for the HOST OPERATOR to specify what the correct answer is/should be, NOT for team answers (those come via player keypads)

**Commands to Add**:
- 'set-expected-answer' with commandData { answer: string }

**Handler in QuizHost**:
- New case 'set-expected-answer': Store in component state for later comparison when reveal-answer is called

### Phase 3: Update HostTerminal Tab System
**File**: src-player/src/components/HostTerminal/index.tsx

**Changes**:
- For on-the-spot mode: Show tabs for "Type Selection", "Controls", "Answer Input"
- For quiz-pack mode: Show tabs for "Controls", "Questions" (existing navigation)
- Add logic to show/hide tabs based on game mode and flowState

### Phase 4: Update QuizHost to Handle On-The-Spot Commands
**File**: src/components/QuizHost.tsx

**New Admin Command Cases**:
1. **'select-question-type'**
   - Validate commandData.type is valid (letters, numbers, multiple-choice)
   - In on-the-spot mode: 
     - Set up a new question object with that type
     - Set flowState to 'ready'
     - Broadcast updated flowState
   - Return ADMIN_RESPONSE success

2. **'set-expected-answer'**
   - Store the expected answer for comparison
   - Could be used during reveal-answer to highlight correct/incorrect answers
   - Return ADMIN_RESPONSE success

**Modified Existing Cases**:
- 'next-question' in on-the-spot: 
  - Should reset flowState to 'idle', send NEXT broadcast, signal controller to show type selection again
  - Already working correctly (line 2323: handleKeypadClose, setFlowState(idle))

### Phase 5: Update Admin Listener Dependencies
**File**: src/components/QuizHost.tsx

**Add to adminListenerDepsRef**:
- setFlowState (if not already there - for select-question-type)
- Any on-the-spot-specific state setters

---

## Part 4: Integration Points

### GameControlsPanel (Existing - Minor Updates)
- ✅ Already shows correct buttons for 'sent-question' state (Timer buttons)
- ✅ Already shows correct buttons for 'running' state (Reveal Answer)
- ✅ Already shows correct buttons for 'revealed'/'fastest' states (Show Fastest, Next)
- ⚠️ Need to verify flowState passed includes isQuizPackMode
- ⚠️ May need to hide Send Picture button in on-the-spot mode (host side will reject anyway)

### New QuestionTypeSelector (New - Required)
- Shows when: flowState.flow === 'idle' AND isQuizPackMode === false
- Hides when: flowState.flow !== 'idle' (i.e., timer is running)
- Commands: 'select-question-type', 'previous-type', 'next-type'

### New AnswerInputKeypad (New - Required for Better UX)
- Shows when: flowState.flow === 'sent-question' OR flowState.flow === 'running' AND isQuizPackMode === false
- Hides when: flowState.flow === 'revealed' or 'fastest' (answer already revealed)
- Commands: 'set-expected-answer'
- Note: Current implementation may already work without this (host operator might rely on player keypad view), but adds better UX

### FLOW_STATE Broadcasting (Existing - Already Works)
- ✅ When select-question-type is processed, FLOW_STATE broadcasts with new flowState
- ✅ When start-timer is processed, FLOW_STATE broadcasts
- ✅ When reveal-answer is processed, FLOW_STATE broadcasts
- ✅ When next-question is processed (goes to idle), FLOW_STATE broadcasts
- Controller receives and updates GameControlsPanel accordingly

---

## Part 5: Command Flow for On-The-Spot Round

```
START: Question Type Selection Screen Visible
  ↓ [User clicks "Letters"]
  └→ send ADMIN_COMMAND: select-question-type { type: 'letters' }
    └→ QuizHost sets flowState = 'ready', type = 'letters'
    └→ Broadcasts FLOW_STATE with type info
    └→ GameControlsPanel receives, shows [Send Picture] (if exists) or [Timer Buttons]

TIMER SETUP: Show Timer Buttons
  ↓ [User clicks "Normal Timer"]
  └→ send ADMIN_COMMAND: start-normal-timer { seconds: 30 }
    └→ QuizHost starts timer, sets flowState = 'sent-question' (or 'running')
    └→ Broadcasts FLOW_STATE
    └→ GameControlsPanel shows [Reveal Answer] button
    └→ AnswerInputKeypad appears with Letters buttons (A-F)

TIMER RUNNING: Host Operator Can Set Answer
  ↓ [User clicks Letters or types answer]
  └→ send ADMIN_COMMAND: set-expected-answer { answer: 'A' }
    └→ QuizHost stores answer for comparison
    └→ GameControlsPanel still shows [Reveal Answer]

REVEAL: Show Answer & Fastest Team
  ↓ [User clicks "Reveal Answer"]
  └→ send ADMIN_COMMAND: reveal-answer
    └→ QuizHost: calls handleRevealAnswer + handlePrimaryAction
    └→ Sets flowState = 'fastest' (on-the-spot skips 'revealed')
    └→ Broadcasts FLOW_STATE
    └→ GameControlsPanel shows [Next Question]

ADVANCE: Back to Type Selection
  ↓ [User clicks "Next Question"]
  └→ send ADMIN_COMMAND: next-question
    └→ QuizHost: calls handleKeypadClose, sendNextQuestion()
    └→ Sets flowState = 'idle'
    └→ Broadcasts FLOW_STATE
    └→ GameControlsPanel hides, QuestionTypeSelector appears again

LOOP: Back to Type Selection
```

---

## Part 6: Files to Modify & Create

### Create (New Files)
1. `src-player/src/components/HostTerminal/QuestionTypeSelector.tsx`
   - Question type buttons (Letters, Numbers, Multiple Choice)
   - Navigation arrows
   - Send commands to QuizHost

2. `src-player/src/components/HostTerminal/AnswerInputKeypad.tsx`
   - Dynamic keypad based on question type
   - Input handling
   - Send expected-answer command

### Modify (Existing Files)
1. `src-player/src/components/HostTerminal/GameControlsPanel.tsx`
   - Verify flowState has isQuizPackMode flag
   - Verify navigation arrows show in both modes
   - Optional: Hide send-picture button in on-the-spot (or let host side reject)

2. `src-player/src/components/HostTerminal/index.tsx`
   - Add conditional tab rendering based on gameMode
   - Show QuestionTypeSelector when needed
   - Show AnswerInputKeypad when needed

3. `src/components/QuizHost.tsx`
   - Add case 'select-question-type' handler
   - Add case 'set-expected-answer' handler (optional, for better UX)
   - Add new handler functions to adminListenerDepsRef
   - Verify flowState passed to players/controller includes type info

4. `src-player/src/components/HostTerminal/useHostTerminalAPI.ts`
   - Add selectQuestionType helper
   - Add setExpectedAnswer helper
   - Add navigation command helpers if needed

### Verify (No Changes, Just Confirm)
1. `src/network/wsHost.ts` - FLOW_STATE broadcasting already works ✅
2. `electron/backend/server.js` - ADMIN_COMMAND relay already works ✅
3. `src/components/QuizHost.tsx` (existing handlers) - reveal-answer and next-question already fixed ✅

---

## Part 7: Checklist - Before Building EXE

### Quiz Pack Mode (Existing - Should Already Work)
- [ ] Send Question → Timer → Reveal Answer → Show Fastest → Next Question (loops to new question)
- [ ] Hide Question button works (goes back to ready or idle)
- [ ] Navigation arrows work (if available)
- [ ] Each button disappears after click, next button appears
- [ ] FLOW_STATE broadcasts at each transition

### On-The-Spot Mode (New Implementation)
- [ ] Question Type Selection Screen appears in idle state
- [ ] Clicking a type selects it and shows Timer buttons
- [ ] Send Picture button appears if picture exists, then Timer buttons
- [ ] Timer buttons (Normal/Silent) start the timer correctly
- [ ] Reveal Answer button appears when timer is running
- [ ] Answer Input Keypad shows with appropriate buttons (Letters/Numbers/MC)
- [ ] Reveal Answer transition to fastest state (show fastest team)
- [ ] Next Question button goes back to Type Selection Screen
- [ ] Navigation arrows work in both modes

### Command Execution & Feedback
- [ ] All admin commands execute and return ADMIN_RESPONSE
- [ ] FLOW_STATE broadcasts to controller after each command
- [ ] GameControlsPanel updates based on flowState changes
- [ ] No orphaned buttons remain after state transitions
- [ ] Timer works correctly in both modes

### Edge Cases
- [ ] Selecting wrong type then using arrows to go back works
- [ ] Changing answer during timer (if set-expected-answer implemented)
- [ ] Last question in quiz pack → next-question loops correctly
- [ ] Hide question button in on-the-spot mode (verify behavior)

---

## Summary of Changes

### Scope: MEDIUM-LARGE
- 2 new UI components (QuestionTypeSelector, AnswerInputKeypad)
- Multiple admin command handlers (select-question-type, set-expected-answer)
- Tab system updates in HostTerminal
- Integration with existing button flow

### Risk Level: LOW-MEDIUM
- Recent fixes already work
- New components isolated to on-the-spot mode
- Server/broadcast infrastructure already proven

### Build Readiness: NOT YET
- Need to implement new components first
- Need to test complete flows in both modes
- Need to verify all button transitions work correctly
