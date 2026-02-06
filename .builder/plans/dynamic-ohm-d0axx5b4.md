# Plan: Spacebar Shortcut for Primary Button Progression

## Objective
Ensure spacebar consistently triggers whatever primary/blue button is shown on screen, enabling smooth progression through quiz questions and game modes without mouse clicks across the entire application.

## User Requirements
- Spacebar should trigger the current primary blue action button (visible on screen at bottom/navigation bar)
- This should work in **all modes and states** throughout the software
- Keep spacebar disabled during active timers (current behavior)
- Each component handles its own spacebar (multi-component approach, not centralized)
- Only one blue button shows at a time, so minimal conflict risk

## Current Status
✅ **JUST IMPLEMENTED**: QuestionNavigationBar.tsx (lines 99–123, 266–289)
- `getSpacebarHandler()` now dynamically maps current button label to correct action
- Spacebar calls: `onReveal`, `onRevealFastestTeam`, `onNextAction`, or `onStartTimer` based on button state
- This is working correctly for quiz pack and on-the-spot modes

## Key Findings from Code Exploration

### Components with Spacebar Handlers (8 total)
All these components register `keydown` listeners for `Space` key:

1. **QuestionNavigationBar.tsx** (✅ FIXED)
   - Lines 99–123: Spacebar handler calls `getSpacebarHandler()`
   - Lines 266–289: Maps button label → handler function
   - Coverage: Quiz pack main flow (ready → running → revealed → fastest)
   - Status: Working correctly after just-implemented fix

2. **KeypadInterface.tsx**
   - Lines 1454–1508: Spacebar routes based on `currentScreen` and timer state
   - Coverage: On-the-spot game flow (letters/multiple-choice/numbers/sequence/results screens)
   - Calls: `handleStartTimer()`, `handleRevealAnswer()`, `handleRevealFastestTeam()`, `handleNextQuestion()`
   - Status: Already correctly mapped to progression buttons — **VERIFY no changes needed**

3. **QuizHost.tsx** (Two separate handlers)
   - **Handler 1** (Lines 1339–1415): `handlePrimaryAction()` - main quiz host flow control
     - Drives: send question/picture, start timer, reveal answer, fastest team, next question
     - Status: This is the canonical flow function — **should be working**
   - **Handler 2** (Lines 2293–2311): Spacebar during fastest-team display
     - Action: `setShowFastestTeamDisplay(false)` + increment `keypadNextQuestionTrigger`
     - Status: Specific use case for fastest-team screen — **should be working**

4. **PopoutDisplay.tsx**
   - Lines 99–109: Spacebar calls `onNext()` when `stage !== "timer"`
   - Coverage: External display / player-facing display progression
   - Status: Already correctly wired — **VERIFY no changes needed**

5. **QuizController.tsx**
   - Lines 196–206: Spacebar calls `nextStage()` when `currentStage !== "timer"`
   - Coverage: Demo / mini controller interface
   - Status: Already correctly wired — **VERIFY no changes needed**

6. **WheelSpinnerInterface.tsx**
   - Lines 137–153: Spacebar triggers `spinWheel()` if not already spinning
   - Coverage: Wheel spinner game mode
   - Status: Primary action for wheel interface — **VERIFY no changes needed**

7. **LeaderboardReveal.tsx**
   - Lines 95–111: Spacebar triggers `handleNext()` to reveal next team
   - Coverage: Team leaderboard progression
   - Status: Primary action for leaderboard reveal — **VERIFY no changes needed**

8. **NearestWinsInterface.tsx**
   - Lines 515–539: Spacebar triggers `handleStartTimer()` or reveal/next based on screen
   - Coverage: Nearest Wins game mode
   - Status: Already correctly mapped — **VERIFY no changes needed**

### Potential Issues Identified
- **Multiple listeners, low conflict risk**: Since only one main UI component is visible at a time (quiz host, leaderboard, wheel, etc.), conflicts are unlikely
- **Double-trigger possibility**: If two related components are both mounted and both conditions are met, spacebar could trigger both handlers
  - Example risk: KeypadInterface and QuestionNavigationBar both active during on-the-spot mode with answer reveal available
- **Guard checks**: All handlers already exclude INPUT/TEXTAREA elements and check visibility/timer state — these are solid

### Consolidated Review Checklist
| Component | Status | Required Action |
|-----------|--------|-----------------|
| QuestionNavigationBar | ✅ FIXED | None (just implemented) |
| KeypadInterface | ✅ Review | Read lines 1454–1508; verify getSpacebarHandler() logic matches |
| QuizHost (primary action) | ⚠️ Review | Check if `handlePrimaryAction` is wired correctly to main button |
| QuizHost (fastest display) | ⚠️ Review | Verify fastest-team spacebar does NOT conflict with regular flow |
| PopoutDisplay | ✅ Review | Verify `onNext()` wiring matches progression logic |
| QuizController | ✅ Review | Verify `nextStage()` called correctly |
| WheelSpinnerInterface | ✅ Review | Verify `spinWheel()` triggered correctly |
| LeaderboardReveal | ✅ Review | Verify `handleNext()` logic correct |
| NearestWinsInterface | ✅ Review | Verify screen-based routing logic matches buttons |

## Recommended Approach

### Phase 1: Verify Current Implementation Works
1. Read KeypadInterface.tsx (lines 1454–1508) to confirm spacebar handler correctly maps to button actions
2. Read QuizHost.tsx (lines 1339–1415 and 2293–2311) to verify both handlers are correct
3. Spot-check PopoutDisplay, WheelSpinnerInterface, LeaderboardReveal, NearestWinsInterface for correctness
4. Confirm all handlers prevent default (`e.preventDefault()`) and check timers/visibility before acting

### Phase 2: Identify Any Gaps
- Look for any UI modes/screens where a primary button exists but spacebar doesn't trigger it
- Check for race conditions or edge cases (e.g., rapid spacebar presses)
- Verify guard conditions match actual visibility (e.g., `isVisible` check in QuestionNavigationBar)

### Phase 3: Fix Any Issues Found
- If a component's spacebar handler doesn't match its primary button, update it
- If double-triggers are found and problematic, add debounce guards or conditional logic
- If a mode has no spacebar handler but has a primary button, add one

### Phase 4: Test
- Manual test in each major mode (quiz pack, on-the-spot, wheel, leaderboard, etc.)
- Verify spacebar triggers only the visible primary button
- Verify spacebar doesn't trigger during timers
- Verify no duplicate actions or conflicts

## Why This Approach
- **Respects existing architecture**: Each component handles its own keyboard input (user's preference)
- **Low risk**: Only one main button visible at a time; conflicts minimal
- **Comprehensive**: Covers all 8 components that handle spacebar
- **Verifiable**: Can confirm each component's spacebar → button mapping is correct

## Files to Review/Modify (if needed)
1. `src/components/KeypadInterface.tsx` (lines 1454–1508)
2. `src/components/QuizHost.tsx` (lines 1339–1415, 2293–2311)
3. `src/components/PopoutDisplay.tsx` (lines 99–109)
4. `src/components/WheelSpinnerInterface.tsx` (lines 137–153)
5. `src/components/LeaderboardReveal.tsx` (lines 95–111)
6. `src/components/NearestWinsInterface.tsx` (lines 515–539)
7. `src/components/QuizController.tsx` (lines 196–206)
8. `src/components/PrimaryControls.tsx` (lines 82–93) — verify tooltip/UI indicates spacebar support
