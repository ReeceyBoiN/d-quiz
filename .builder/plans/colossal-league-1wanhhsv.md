# Host Remote Controller Redesign Plan

## User Request Summary
Replace the single dynamic button with a full remote control interface that mirrors the host app's button progression and includes question navigation arrows. The remote must always stay in perfect sync with the host app, showing question information one step before it appears on the external display.

## Current State
- **GameControlsPanel**: Single primary button that changes label based on flowState
- **Data available**: flowState (flow + isQuestionMode) only
- **No question preview**: currentQuestion not passed to remote controller
- **No navigation arrows**: No way to browse or navigate quiz pack questions
- **Sync mechanism**: FLOW_STATE messages keep controller updated on game progress

## Proposed Solution

### Phase 1: Extend Data Flow to Remote Controller
**Goal**: Pass question data to GameControlsPanel so it can preview questions and enable navigation

1. **Update src-player/src/App.tsx**
   - Add currentQuestion to the HostTerminal component props
   - Also pass: currentLoadedQuestionIndex, loadedQuizQuestions (for quiz pack mode), and isQuizPackMode
   - These enable the remote to know what question is currently loaded and navigate within the pack

2. **Update src-player/src/components/HostTerminal/index.tsx**
   - Accept new props: currentQuestion, currentLoadedQuestionIndex, loadedQuizQuestions, isQuizPackMode
   - Forward these to GameControlsPanel

3. **Update src-player/src/components/HostTerminal/GameControlsPanel.tsx Props**
   - Add: currentQuestion, currentLoadedQuestionIndex, loadedQuizQuestions, isQuizPackMode
   - This gives the preview panel all necessary context

### Phase 2: Implement Navigation Arrows
**Goal**: Allow controller user to navigate questions just like the host app

1. **In GameControlsPanel**, add navigation handler functions:
   - `handlePreviousQuestion()`: Send ADMIN_COMMAND 'previous-question'
   - `handleNextQuestion()`: Send ADMIN_COMMAND 'next-question'
   - Add UI buttons (ChevronLeft / ChevronRight arrows) at the top of the controls panel
   - Disable arrows when not in quiz pack mode or at bounds (first/last question)

2. **In src/components/QuizHost.tsx**, add admin command handlers:
   - Add case 'previous-question' in handleAdminCommand
   - Add case 'next-question' in handleAdminCommand
   - Wire them to the same logic as the host app's navigation:
     - Quiz pack mode: handleQuizPackPrevious / handleQuizPackNext
     - On-the-spot mode: gameActionHandlers.previousQuestion / .nextQuestion
   - These already exist in QuizHost; just add the admin command routing

### Phase 3: Multi-Button Layout Based on Flow State
**Goal**: Replace single button with contextual button groups that match host app flow progression

1. **Update getNextActionButton() logic** to return a button layout object instead of a single button:
   ```
   {
     layout: 'navigation' | 'single' | 'timer' | 'progression',
     buttons: [{ label, commandType, disabled, emoji, style }],
     preview: currentQuestion // for display
   }
   ```

2. **Button layouts by flow state**:
   - **ready / sent-picture**: Single large blue button "Send Question" (emoji: 📝)
   - **sent-question**: Two buttons side-by-side:
     - Left: "Start Timer" (normal) - blue (emoji: ⏱️)
     - Right: "Silent Timer" - green (emoji: 🔇)
   - **running / timeup**: Single large button "Reveal Answer" (emoji: 🔍)
   - **revealed**: Single large button "Show Fastest Team" (emoji: ⚡)
   - **fastest**: Single large button "Next Question" (emoji: ➡️)
   - **idle**: Disabled "Ready to Start" (emoji: ⏸️)

3. **Render button layout in JSX**:
   - Check layout type and render appropriate button groups
   - Apply conditional styling (blue for primary, green for silent timer)
   - Keep buttons disabled during timer to match host app behavior

### Phase 4: Render Question Preview
**Goal**: Show question content above the buttons, updating in real-time

1. **Create PreviewPanel sub-component** (or inline in GameControlsPanel):
   - Display currentQuestion text/options/answer in simplified admin view
   - Show image thumbnail if present
   - Show question number (X of Y in quiz pack mode)
   - Keep preview compact (not full player UI)
   - Update reactively as currentQuestion changes

2. **Layout structure**:
   ```
   ┌─────────────────────────────┐
   │ Navigation arrows (← →)     │ (quiz pack mode only)
   ├─────────────────────────────┤
   │ Question Preview:           │
   │  [Q text]                   │
   │  A) [option 1]              │
   │  B) [option 2]              │
   │  Answer: [answer]           │
   │  [image thumbnail if any]   │
   ├─────────────────────────────┤
   │ Primary Action Button(s)    │
   │ Send Question / Start Timer │
   ├─────────────────────────────┤
   │ Timer Controls (collapsible)│
   └─────────────────────────────┘
   ```

### Phase 5: Ensure Synchronization
**Goal**: Remote and host always stay in sync; remote sees info before external display

1. **Existing flow state sync** (already implemented):
   - QuizHost sends FLOW_STATE messages whenever flow changes
   - Controller receives and updates its flowState
   - This drives button progression ✓

2. **Question data sync** (new):
   - Host already broadcasts QUESTION messages to all players
   - Player app stores in currentQuestion state
   - We're passing currentQuestion down through HostTerminal → GameControlsPanel
   - Preview updates immediately when question changes ✓

3. **Answer reveal sync** (already handled):
   - flowState includes current flow (ready, sent-question, running, timeup, revealed, fastest, idle)
   - When flow → 'revealed', button changes to show correct answer preview
   - When flow → 'fastest', button shows fastest team info

### Phase 6: Wire Admin Commands
**Goal**: Ensure all remote commands execute correctly on host

1. **Navigation commands** ('previous-question', 'next-question'):
   - Already exist as admin command cases in QuizHost.handleAdminCommand
   - Just need to ensure they route to correct handlers:
     - Quiz pack: handleQuizPackPrevious / Next
     - On-the-spot: gameActionHandlers.previousQuestion / .nextQuestion

2. **Timer commands** (already implemented):
   - 'start-normal-timer': calls handleNavBarStartTimer()
   - 'start-silent-timer': validated and broadcasts to players
   - 'stop-timer': calls sendTimeUpToPlayers()

3. **Progression commands** (already implemented):
   - 'send-question': calls handlePrimaryAction()
   - 'reveal-answer': calls handleRevealAnswer()
   - 'show-fastest': calls handlePrimaryAction()
   - 'next-question': calls sendNextQuestion()

## Implementation Order

1. **Step 1**: Extend data flow to pass currentQuestion and quiz pack state to GameControlsPanel
2. **Step 2**: Add navigation arrow UI and handlers (send admin commands)
3. **Step 3**: Add admin command routing in QuizHost for navigation
4. **Step 4**: Refactor button layout logic to support multi-button groups
5. **Step 5**: Create question preview panel and integrate with button layout
6. **Step 6**: Test synchronization between host and remote with button progression and navigation

## Files to Modify

### Frontend (Host/Main App)
- **src/components/QuizHost.tsx**: Add 'previous-question' and 'next-question' cases in handleAdminCommand (route to existing nav handlers)

### Remote Controller (Player App)
- **src-player/src/App.tsx**: Pass currentQuestion, currentLoadedQuestionIndex, loadedQuizQuestions, isQuizPackMode to HostTerminal
- **src-player/src/components/HostTerminal/index.tsx**: Accept and forward new props to GameControlsPanel
- **src-player/src/components/HostTerminal/GameControlsPanel.tsx**: 
  - Extend props interface
  - Add navigation arrow handlers
  - Refactor button layout logic from single button to multi-button groups
  - Add question preview panel
  - Update JSX to render new layout

## Key Design Decisions

1. **Navigation only in quiz pack mode**: Arrows only show/work when isQuizPackMode=true (matches host app behavior)
2. **Simplified preview**: Admin view (text + options + answer) rather than full player UI (keeps remote clean and focused)
3. **Two timer buttons**: When flow='sent-question', show both normal and silent timer options side-by-side (matches user expectation)
4. **Reuse existing handlers**: Don't duplicate logic; route admin commands to existing QuizHost methods
5. **Sync via existing mechanisms**: Use current flowState sync + currentQuestion passing (no new network messages needed)

## Success Criteria

- ✓ Remote displays left/right navigation arrows in quiz pack mode
- ✓ Remote shows question preview (text, options, answer) that updates in real-time
- ✓ Buttons change based on game flow: Send → Timer → Reveal → Fastest → Next
- ✓ Timer options appear as two separate buttons (blue normal, green silent) when needed
- ✓ Navigation arrows are disabled when at question bounds or not in quiz pack mode
- ✓ All commands execute on host and game progresses correctly
- ✓ Remote and host stay perfectly synchronized throughout game flow
