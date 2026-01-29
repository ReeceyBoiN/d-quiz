# Feature: Question Navigation Arrows in Bottom Navigation Bar

## Summary
Add left and right arrow navigation buttons to the bottom navigation bar in both quiz pack mode and on-the-spot keypad mode, allowing hosts to navigate backward/forward between questions during active gameplay.

## User Requirements (Finalized)
1. **Position**: Two new buttons (left/right arrows) positioned to the LEFT of the Silent Timer button
2. **Visibility**: Only show during active gameplay (NOT on question-type selection screen)
   - Quiz pack: Show when playing a question
   - On-the-spot: Show when on game screens (letters-game, multiple-choice-game, numbers-game, sequence-game)
3. **Right arrow behavior**:
   - Moves to next question in quiz pack
   - In on-the-spot: moves to next question (resets to question-types selection)
   - Clears any submitted answers
4. **Left arrow behavior**:
   - In quiz pack: disabled on question 1 only
   - In on-the-spot: hidden completely on question-types screen, enabled only during active gameplay
   - Clears submitted answers when used
5. **Visual design**:
   - Match bottom navigation bar aesthetic (grey/transparent look)
   - Decent size, icon-only buttons
   - Greyed out and disabled when ANY timer is running (silent or normal)
   - Re-enabled when new question loads
6. **Applies to**: All question types in both quiz pack and on-the-spot keypad modes

## Technical Architecture

### Key Components
1. **QuestionNavigationBar.tsx** - Bottom navigation bar UI component
   - Currently renders: Silent Timer, Start Timer, Hide Question, Flow-dependent buttons
   - Location: /src/components/QuestionNavigationBar.tsx
   
2. **KeypadInterface.tsx** - On-the-spot keypad logic
   - Has: handleNextQuestion function
   - Missing: handlePreviousQuestion function
   - Location: /src/components/KeypadInterface.tsx (line ~1117)
   
3. **QuizHost.tsx** - Top-level coordinator
   - Wires handlers between KeypadInterface and QuestionNavigationBar
   - Has: handleQuizPackPrevious, handleQuizPackNext
   - Location: /src/components/QuizHost.tsx (line ~4150)
   
4. **QuizPackDisplay.tsx** - Quiz pack question display
   - Already has Previous/Next buttons in its own UI
   - These are separate from the QuestionNavigationBar
   - Location: /src/components/QuizPackDisplay.tsx (line ~656)

### Timer State Tracking
- Quiz pack mode: `isTimerRunning` from useTimer hook
- On-the-spot mode: `isOnTheSpotTimerRunning` from KeypadInterface
- Both passed to QuestionNavigationBar for disabling buttons

## Critical Issues Found & Fixes Required

### Issue 1: TypeScript Type Definition Mismatch
**Location**: src/components/QuizHost.tsx line 449
**Problem**: gameActionHandlers type only defines reveal, nextQuestion, startTimer, but KeypadInterface exposes silentTimer and revealFastestTeam (and will add previousQuestion)
**Fix**: Update type definition to include all handlers:
```typescript
const [gameActionHandlers, setGameActionHandlers] = useState<{
  reveal?: () => void;
  nextQuestion?: () => void;
  startTimer?: () => void;
  silentTimer?: () => void;
  revealFastestTeam?: () => void;
  previousQuestion?: () => void;
} | null>(null);
```

### Issue 2: Button Layout Restructuring
**Location**: src/components/QuestionNavigationBar.tsx line 256 & 291
**Problem**: Current flex layout uses `justify-center` + `ml-auto`, making it difficult to place left-aligned buttons alongside right-aligned buttons
**Fix**: Restructure the inner button container to use explicit left/right sections:
```typescript
<div className="flex items-center justify-between w-full h-full gap-2">
  <div className="flex items-center gap-2">
    {/* Navigation arrows go here - LEFT SIDE */}
  </div>
  <div className="flex items-center gap-2">
    {/* Existing timer/flow buttons - RIGHT SIDE */}
  </div>
</div>
```

### Issue 3: Missing Icon Import
**Location**: src/components/QuestionNavigationBar.tsx line 3
**Problem**: ChevronLeft is not imported (only ChevronRight exists)
**Fix**: Add ChevronLeft to the import from lucide-react

## Implementation Plan

### Step 1: Fix QuizHost.tsx Type Definition
**File**: src/components/QuizHost.tsx (line 449-453)

Update gameActionHandlers type to include all handlers exposed by KeypadInterface and NearestWinsInterface.

### Step 2: Update QuestionNavigationBar.tsx
**File**: src/components/QuestionNavigationBar.tsx

**2a. Add imports** (line 3):
- Add `ChevronLeft` to the lucide-react import

**2b. Add props to interface** (line 8-35):
- `onPreviousQuestion?: () => void` - callback when left arrow clicked
- `onNextQuestion?: () => void` - callback when right arrow clicked (for navigation, distinct from onNextAction)
- `showNavigationArrows?: boolean` - whether to show navigation arrows (true only during active gameplay)
- `canGoToPreviousQuestion?: boolean` - whether left arrow should be enabled

**2c. Add destructuring defaults** (line 37-64):
- Add defaults for new props

**2d. Restructure button layout** (line 256 & 291):
- Change from `ml-auto` single section to `justify-between` with left/right sections
- Place navigation arrows in LEFT section
- Place existing buttons in RIGHT section

**2e. Add navigation arrow buttons**:
- Left arrow button (icon only): ChevronLeft, calls onPreviousQuestion, disabled when timer running or canGoToPreviousQuestion is false, hidden if !showNavigationArrows
- Right arrow button (icon only): ChevronRight, calls onNextQuestion, disabled when timer running, hidden if !showNavigationArrows
- Styling: Match existing buttons (px-2, bg-slate-600, hover:bg-slate-500, disabled:bg-gray-600, same opacity/pointerEvents pattern)
- Sizing: Smaller than text buttons (icon-only), approximately h-8 w-8

### Step 3: Add handlePreviousQuestion to KeypadInterface.tsx
**File**: src/components/KeypadInterface.tsx

**3a. Create handlePreviousQuestion function** (around line 1117, mirror handleNextQuestion):
- Decrement currentQuestion by 1
- Reset all local state: selectedLetter, selectedAnswers, numbersAnswer, numbersAnswerConfirmed, timerFinished, timerLocked, timerStartTime
- Call onTimerLockChange(false) if available
- Clear team answers and status updates
- Reset answerRevealed and fastestTeamRevealed
- Set currentScreen to 'question-types' (returns to question type selection)
- Update external display with questionWaiting

**3b. Expose previousQuestion in onGetActionHandlers** (line 1187-1197):
- Add `previousQuestion: handlePreviousQuestion` to the handlers object

### Step 4: Update QuizHost.tsx to Wire Navigation
**File**: src/components/QuizHost.tsx (line 4150+)

Add props to QuestionNavigationBar:
- `onPreviousQuestion={() => { if (isQuizPackMode) handleQuizPackPrevious(); else gameActionHandlers?.previousQuestion?.(); }}`
- `onNextQuestion={() => { if (isQuizPackMode) handleQuizPackNext(); else gameActionHandlers?.nextQuestion?.(); }}`
- `showNavigationArrows={showQuizPackDisplay || (showKeypadInterface && ['letters-game', 'multiple-choice-game', 'numbers-game', 'sequence-game'].includes(keypadCurrentScreen))}`
- `canGoToPreviousQuestion={isQuizPackMode ? (currentLoadedQuestionIndex > 0) : true}`

## Implementation Details

### Button Styling & Sizing
- **Icons**: Use ChevronLeft and ChevronRight from lucide-react
- **Size**: Icon-only buttons, approximately h-8 w-8 (smaller than text buttons)
- **Padding**: px-2 py-1 (more compact than text buttons)
- **Colors**:
  - Normal: bg-slate-600 hover:bg-slate-500
  - Disabled: bg-gray-600, opacity: 0.5, cursor: not-allowed
  - pointerEvents: 'none' when disabled
- **Gap**: gap-2 between nav arrows, gap-2 to rest of buttons
- **Border**: border-0, shadow-sm (consistent with other nav buttons)

### Visibility & State Logic
- **Show navigation arrows** only when:
  - Quiz Pack Mode: `showQuizPackDisplay === true` (actively displaying question)
  - On-the-Spot Mode: Current screen is one of: 'letters-game', 'multiple-choice-game', 'numbers-game', 'sequence-game' (NOT 'question-types' or 'config')

- **Left arrow disabled when**:
  - Any timer running (isTimerRunning || isOnTheSpotTimerRunning)
  - Quiz pack mode AND on first question (currentLoadedQuestionIndex === 0)
  - On-the-spot mode: always enabled during gameplay

- **Right arrow disabled when**:
  - Any timer running (isTimerRunning || isOnTheSpotTimerRunning)
  - Quiz pack mode AND on last question (currentLoadedQuestionIndex === totalQuestions - 1)
  - On-the-spot mode: always enabled during gameplay

### State Management
- **QuestionNavigationBar**: Stateless regarding navigation, uses callbacks
- **KeypadInterface**: handlePreviousQuestion mirrors handleNextQuestion logic
- **QuizHost**: Determines show/enable state based on mode, currentScreen, question position

### Expected Behavior
| Scenario | Left Arrow | Right Arrow |
|----------|-----------|------------|
| Quiz Pack Q1, no timer | Disabled (grayed) | Enabled |
| Quiz Pack Q2, no timer | Enabled | Enabled |
| Quiz Pack Qn (last), no timer | Enabled | Disabled (grayed) |
| Quiz Pack ANY, timer running | Disabled (hidden by progress bar) | Disabled (hidden by progress bar) |
| On-the-Spot gameplay, no timer | Enabled | Enabled |
| On-the-Spot gameplay, timer running | Disabled (hidden by progress bar) | Disabled (hidden by progress bar) |
| On-the-Spot question-types screen | NOT SHOWN | NOT SHOWN |
| On-the-Spot config screen | NOT SHOWN | NOT SHOWN |

### Action Outcomes
- **Left arrow clicked**: Navigates to previous question, clears all answer state, resets timer locks
- **Right arrow clicked**: Navigates to next question, clears all answer state, resets timer locks, (in on-the-spot: goes to question-types selection)

## Files to Modify
1. `/src/components/QuizHost.tsx` - Fix type definition + wire navigation props (2 locations)
2. `/src/components/QuestionNavigationBar.tsx` - Import icon, update props, restructure layout, add buttons (3 locations)
3. `/src/components/KeypadInterface.tsx` - Add handlePreviousQuestion function + expose in handlers (2 locations)

## No Changes Needed
- QuizPackDisplay buttons remain unchanged (they're separate from QuestionNavigationBar)
- NearestWinsInterface, BuzzInMode remain unchanged
- Timer logic, external display updates, team answer tracking all remain unchanged
