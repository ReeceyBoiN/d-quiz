# Plan: Implement Complete Quiz Flow Control for Host Remote

## Current Status
✅ **send-question command is working** - The fix to use `deps.handlePrimaryAction()` allows the admin handler to access the current version of the function with proper quiz questions data.

Flow confirmed in logs:
- `idle` → `ready` (quiz loaded) → `sent-question` (question broadcasted)
- Timer controls (start-silent-timer, start-normal-timer) are also functional

## Problem
The host remote needs to control the complete question flow in the correct order:
1. ✅ Send question (implemented & working)
2. ⏳ Send picture (for questions with images, shows before question)
3. ⏳ Reveal answer (should transition: running/timeup → revealed/fastest)
4. ⏳ Show fastest team (call handlePrimaryAction when in 'revealed' state)
5. ⏳ Next question (should advance to next question)
6. ⏳ End round (should end the game)
7. ⏳ Hide question (toggle, allows timer without showing question)

## Root Cause Analysis
The admin command handler in QuizHost.tsx (line ~3216+) has skeleton cases for all these commands, but they need to:
1. Call the correct handler functions stored in `deps` ref
2. Ensure all necessary handlers are added to `adminListenerDepsRef` 
3. Follow the same pattern as the working send-question command

## Implementation Strategy

### Phase 1: Identify All Required Functions in deps Ref
The following functions MUST be stored in `adminListenerDepsRef` to be accessible in the admin command handler:
- ✅ `handlePrimaryAction` - already added
- `handleRevealAnswer` - needed for reveal-answer command
- `handleHideQuestion` - needed for hide-question command
- `handleFastestTeamReveal` - needed for show-fastest command (shows UI only)
- `sendNextQuestion` - for next-question command (this is imported, not a state hook)
- `sendEndRound` - for end-round command (this is imported, not a state hook)
- `handleNavBarStartTimer` - needed for timer commands (can access via deps or call directly)

### Phase 2: Update adminListenerDepsRef
**Location**: src/components/QuizHost.tsx lines 707-723

**Changes needed**:
1. Add all handler functions to the initial useRef object (line 707-712)
2. Update the dependency update effect (line 715-723) to include all new dependencies
3. Keep the direct assignment of handlePrimaryAction at line 5633 for safety

### Phase 3: Update Admin Command Handler Cases
**Location**: src/components/QuizHost.tsx line ~3262+

For each command case:

#### send-picture command
- Call `deps.handlePrimaryAction()` when flowState.flow === 'ready' and current question has image
- This will transition: ready → sent-picture and broadcast the image to players
- Set `success = true`

#### reveal-answer command
- Call `deps.handleRevealAnswer()`
- Set `success = true`

#### hide-question command
- Call `deps.handleHideQuestion()`
- Set `success = true`

#### show-fastest command
- Call `deps.handlePrimaryAction()` when flowState.flow === 'revealed' (quiz-pack mode)
- This will transition: revealed → fastest and show fastest team
- Set `success = true`

#### next-question command
- Call `sendNextQuestion()` directly (it's imported at top of file)
- Set `success = true`

#### end-round command
- Call `sendEndRound()` directly (it's imported)
- Set `success = true`

#### skip-question command
- Already implemented as `sendNextQuestion()`, keep as-is

#### Existing timer commands (start-silent-timer, start-normal-timer, etc.)
- These may already work but verify they're calling the right deps functions
- May need to add `handleNavBarStartTimer` and `handleNavBarSilentTimer` to deps

## Key Insights from Flow Analysis

### Flow State Transitions by Command
```
send-question:     ready → sent-question (or sent-picture if image exists)
send-picture:      ready → sent-picture (when question has image, before send-question)
hide-question:     ready → sent-question (but questionSent: false, allows timer without showing)
start-*-timer:     sent-question → running (or sent-picture → sent-question → running)
reveal-answer:     running/timeup → revealed (quiz-pack) OR fastest (on-the-spot)
show-fastest:      revealed → fastest (quiz-pack only; calls handlePrimaryAction)
next-question:     fastest → ready (for next question) or idle (if last question)
end-round:         any → idle + closes quiz display
```

### Important: Context Matters
- `reveal-answer` behavior differs by game mode (quiz-pack vs on-the-spot)
- `show-fastest` only applies in quiz-pack mode (on-the-spot shows fastest automatically on reveal)
- The flow state determines what actions are valid

### State Functions That Need Deps Access
Functions that depend on component state (loadedQuizQuestions, flowState, currentLoadedQuestionIndex, etc.):
- `handlePrimaryAction` ✅ (already done)
- `handleRevealAnswer` - needs: loadedQuizQuestions, currentLoadedQuestionIndex, flowState, teamResponseTimes, etc.
- `handleHideQuestion` - needs: hideQuestionMode state, flowState
- `handleFastestTeamReveal` - needs: team data (may need to extract from current state)

Functions that don't need state (network calls):
- `sendNextQuestion`, `sendEndRound`, `sendTimerToPlayers` - already imported, can call directly

## Files to Modify
1. **src/components/QuizHost.tsx**
   - Line 707-723: Update adminListenerDepsRef (initial and update effect)
   - Line 3262-3400: Update admin command handler cases
   - Line 5633: Verify handlePrimaryAction assignment (already done)

## Validation Strategy
After implementation, verify via logs:
1. Each command case logs execution
2. Admin response is sent back to controller
3. FLOW_STATE changes are broadcast after command execution
4. Console shows correct function is called with correct dependencies

## Risk Assessment
- **Low risk**: The pattern is proven (send-question works)
- **Medium risk**: Ensure all handler functions have correct signatures and dependencies
- **Mitigation**: Use same ref-based approach, add comprehensive logging to each command case

## Definition of Done
- All 6 flow control commands execute successfully from host remote
- Flow state transitions occur in correct order
- FLOW_STATE broadcasts happen after each significant state change
- Console logs show proper handler invocation with correct data
- No errors in browser console
