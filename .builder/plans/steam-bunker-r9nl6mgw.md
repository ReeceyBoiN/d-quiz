# Host Remote Controller UI Redesign Plan

## Overview
Transform the Host Remote Controller (player web app) from displaying multiple static buttons to a single dynamic button that changes based on game flow state, with navigation arrows and real-time question preview.

## User Requirements
- **Single Dynamic Button**: Button label and function change based on game state
- **Question Navigation**: Left/right arrows to browse questions (always available, even during active game)
- **Full Question Preview**: Display question text, options, AND correct answer before external display shows it
- **Timer Layout**: When timer is needed, show TWO buttons side-by-side (Normal Timer: blue, Silent Timer: green)
- **Perfect Sync**: Remote controller and host app stay in sync throughout entire game

## Current State
- GameControlsPanel shows multiple collapsible sections (Timer Controls, Game Mode Controls, etc.)
- Uses flowState to determine what's available
- No question preview
- No navigation for quiz packs
- Buttons are static, not dynamically changing

## Implementation Strategy

### Phase 1: Data Flow Extension
**Goal**: Pass question data from QuizHost to the remote controller

**Files to Modify**:
- `src-player/src/App.tsx` - Add props to HostTerminal
- `src-player/src/components/HostTerminal/index.tsx` - Accept and forward props
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Accept new props

**Changes**:
1. In App.tsx, pass these props to HostTerminal:
   - `currentQuestion` - the currently loaded question
   - `currentLoadedQuestionIndex` - which question in the pack
   - `loadedQuizQuestions` - array of all questions in pack
   - `isQuizPackMode` - whether in quiz pack or on-the-spot mode

2. Forward through HostTerminal to GameControlsPanel

### Phase 2: Navigation Arrows
**Goal**: Let controller user browse questions with ← and → buttons

**Files to Modify**:
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Add arrow UI and handlers
- `src/components/QuizHost.tsx` - Add admin command handlers

**Changes**:
1. In GameControlsPanel:
   - Add two ChevronLeft and ChevronRight buttons at top of panel
   - Send ADMIN_COMMAND 'previous-question' and 'next-question'
   - Always visible; disabled only at question bounds or if not in quiz pack mode

2. In QuizHost.tsx handleAdminCommand:
   - Add case for 'previous-question': route to handleQuizPackPrevious() or gameActionHandlers.previousQuestion()
   - Add case for 'next-question': route to handleQuizPackNext() or gameActionHandlers.nextQuestion()
   - These handlers already exist; just add routing

### Phase 3: Question Preview Panel
**Goal**: Display current question before it goes to external display

**Files to Modify**:
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Add preview component

**Changes**:
1. Create inline or sub-component to display:
   - Question number (X of Y for quiz packs)
   - Question text
   - Answer options (A) B) C) D) format)
   - Correct answer highlighted
   - Image thumbnail if present

2. Use simplified admin view (not full player UI styling)

3. Update reactively as currentQuestion changes

### Phase 4: Dynamic Button Flow
**Goal**: Replace static button layout with single button that changes based on flowState

**Files to Modify**:
- `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Refactor button logic

**Button State Mapping**:
| Flow State | Button(s) | Action |
|-----------|-----------|--------|
| `ready` / `sent-picture` | Single "Send Question" (blue) | Send question to players |
| `sent-question` | Two buttons side-by-side: "Normal Timer" (blue) + "Silent Timer" (green) | Start timer |
| `running` / `timeup` | Single "Reveal Answer" (blue) | Reveal correct answer |
| `revealed` | Single "Show Fastest Team" (blue) | Show fastest team |
| `fastest` | Single "Next Question" (blue) | Go to next question |
| `idle` | "Ready to Start" (disabled) | - |

**Implementation**:
1. Create `getButtonLayout()` function that returns:
   ```
   {
     layout: 'single' | 'double-timer' | 'disabled',
     buttons: [{ label, commandType, emoji, color }],
     disabled: boolean
   }
   ```

2. Render buttons dynamically based on layout type
3. Emit ADMIN_COMMAND with appropriate commandType

### Phase 5: Ensure Synchronization
**Goal**: Remote stays in perfect sync with host app

**Already Implemented**:
- flowState sync: Host broadcasts FLOW_STATE messages when flow changes → remote updates button state
- question sync: currentQuestion state updated via message handlers → preview updates reactively
- command execution: Admin commands routed to existing QuizHost handlers

**What to Add**:
- Verify all existing QuizHost command handlers are properly wired
- Test round-trip: remote sends command → host executes → flow state updates → remote receives new state

## File Dependency Map
```
QuizHost (host app)
├── Manages: game flow, question progression, timer, answer reveal
├── Sends: FLOW_STATE, QUESTION, CONTROLLER_AUTH messages
└── Receives: ADMIN_COMMAND (from remote controller)

App.tsx (player/remote app)
├── Stores: currentQuestion, currentLoadedQuestionIndex, etc.
├── Receives: FLOW_STATE, QUESTION from host
└── Passes to: HostTerminal component

HostTerminal (player/remote app)
├── Receives: currentQuestion, quiz pack state
├── Passes to: GameControlsPanel
└── Manages: connection display, tabs (Leaderboard, Teams, Controls, Settings)

GameControlsPanel (player/remote app)
├── Displays: Navigation arrows, question preview, dynamic button(s)
├── Sends: ADMIN_COMMAND to host
└── Receives: updates via parent props
```

## Implementation Order
1. **Step 1**: Extend data flow (App → HostTerminal → GameControlsPanel)
2. **Step 2**: Add navigation arrows and handlers
3. **Step 3**: Create question preview panel
4. **Step 4**: Refactor button logic to single dynamic button
5. **Step 5**: Add QuizHost admin command routing for navigation
6. **Step 6**: Test full flow with comprehensive logging

## Success Criteria
- ✓ Navigation arrows visible and functional in quiz pack mode
- ✓ Question preview shows text, options, and answer before external display
- ✓ Single button changes label: Send → Timer → Reveal → Fastest → Next
- ✓ Two-button timer layout (Normal + Silent) when needed
- ✓ All commands execute on host and game flows correctly
- ✓ Remote and host stay synchronized throughout entire game
- ✓ Arrows disabled at question bounds
- ✓ Preview updates immediately when question changes

## Key Insights
- flowState already drives button progression → no new network messages needed for button updates
- currentQuestion already passed/synced → leverage existing message handlers for preview updates
- Navigation commands route to existing QuizHost handlers → minimal new code needed
- Admin command security validation already in place → just add new command types

## Dependencies & Notes
- Requires passing additional props through component tree (App → HostTerminal → GameControlsPanel)
- Navigation only works in quiz pack mode (isQuizPackMode check required)
- Preview should show admin view (simplified, not full player UI)
- Test thoroughly on both desktop and mobile layouts
