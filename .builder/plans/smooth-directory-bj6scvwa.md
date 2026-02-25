# Fix Feedback Loop Between KeypadInterface and QuizHost

## Problem Summary
The host remote and host app are oscillating between two screens (`config` and `question-types`) with constant FLOW_STATE broadcasts. This creates a bidirectional feedback loop with no origin guard to prevent echoes.

## Root Cause
1. **KeypadInterface** → notifies parent when local `currentScreen` changes via `onCurrentScreenChange` callback
2. **QuizHost** → broadcasts FLOW_STATE (including `keypadCurrentScreen`) to the controller whenever state changes
3. **HostTerminal (remote)** → sends ADMIN_COMMAND (e.g., `select-question-type`) based on its state
4. **QuizHost admin handler** → processes command, updates `flowState` and calls `setKeypadCurrentScreen`
5. **KeypadInterface** → receives updated `externalCurrentScreen` prop, updates local screen, calls `onCurrentScreenChange` again
6. **No origin guard** → parent can't tell if the change came from local UI or external admin command, so it re-broadcasts and creates a loop

## Exact Mechanism
- KeypadInterface has TWO effects:
  - Effect 1: `useEffect(() => onCurrentScreenChange(currentScreen), [currentScreen])`
  - Effect 2: `useEffect(() => { if (externalCurrentScreen !== currentScreen) setCurrentScreen(externalCurrentScreen) }, [externalCurrentScreen])`
  
- When Effect 2 runs (external screen change), it calls setCurrentScreen → Effect 1 triggers → onCurrentScreenChange called → parent broadcasts FLOW_STATE → this can trigger admin commands from remote → which updates externalCurrentScreen prop again → Effect 2 runs → loop continues

## Recommended Fix: Origin Flag Approach (Minimal & Precise)

### Strategy
Add an origin guard to prevent echoes: when QuizHost applies an external screen change (from admin command), set a ref flag. KeypadInterface checks this flag and skips notifying parent when the change is internal/echoed back.

### Files to Modify

#### 1. `src/components/KeypadInterface.tsx`
**Change**: Add logic to skip echoing external screen changes back to parent

- Add a ref to track when an external screen change is being applied:
  ```typescript
  const externalScreenChangeRef = useRef<string | undefined>(undefined);
  ```

- Modify the externalCurrentScreen effect to set this flag:
  ```typescript
  useEffect(() => {
    if (externalCurrentScreen && externalCurrentScreen !== currentScreen) {
      externalScreenChangeRef.current = externalCurrentScreen;
      setCurrentScreen(externalCurrentScreen);
    }
  }, [externalCurrentScreen, currentScreen]);
  ```

- Modify the currentScreen effect to skip notification if change originated externally:
  ```typescript
  useEffect(() => {
    if (onCurrentScreenChange) {
      // Skip notify if this change was just applied from externalCurrentScreen
      if (externalScreenChangeRef.current === currentScreen) {
        externalScreenChangeRef.current = undefined;
        return;
      }
      onCurrentScreenChange(currentScreen);
    }
  }, [currentScreen, onCurrentScreenChange]);
  ```

**Rationale**: When KeypadInterface receives an externalCurrentScreen change, it marks that value in the ref before updating local state. When the currentScreen effect runs, it checks if the new value matches the externally-applied value. If yes, it's an echo from the parent's broadcast-and-resend cycle, so it skips the notification.

#### 2. `src/components/QuizHost.tsx`
**Change**: Ensure admin handlers don't trigger unnecessary state updates

In the `select-question-type` admin command handler (around line 3785):

- Verify that `setKeypadCurrentScreen` is only called when the value actually changes:
  ```typescript
  case 'select-question-type': {
    const selectedType = payload.type;
    const newFlowState = {
      flow: 'sent-question' as const,
      isQuestionMode: true,
      totalTime: BASE_QUESTION_TIME,
      currentQuestion: placeholderQuestion,
      answerSubmitted: false,
      selectedQuestionType: selectedType,
    };
    
    deps.setFlowState(newFlowState);
    const screenName = selectedType === 'sequence' ? 'sequence-game' : `${selectedType}-game`;
    
    // Only call setKeypadCurrentScreen if the value actually changes
    if (deps.keypadCurrentScreen !== screenName) {
      deps.setKeypadCurrentScreen?.(screenName);
    }
    success = true;
  }
  ```

**Rationale**: Add defensive equality check to prevent unnecessary re-renders and state updates even if admin command is processed multiple times.

#### 3. `src/network/wsHost.ts`
**Optional**: Consider if FLOW_STATE broadcast needs to include `keypadCurrentScreen`

Current useEffect at line 4027 includes `keypadCurrentScreen` as a dependency. Since `keypadCurrentScreen` is an implementation detail of the KeypadInterface UI (not core game flow), consider whether it should trigger FLOW_STATE broadcasts.

**Options**:
- *Option A (Conservative)*: Keep as-is (current approach) + rely on origin guard above
- *Option B (Reduce broadcasts)*: Remove `keypadCurrentScreen` from dependency list and only include in payload for initial handshake

For this fix, recommend **Option A** with the origin guard, as it's safer and more explicit about intent.

## Implementation Steps

1. **Modify KeypadInterface.tsx**:
   - Add `externalScreenChangeRef` ref
   - Update externalCurrentScreen effect to set the ref before state change
   - Update currentScreen effect to check ref and skip notification if echo

2. **Modify QuizHost.tsx (select-question-type handler)**:
   - Add equality check before calling `setKeypadCurrentScreen`
   - Verify the handler doesn't have other unguarded state updates

3. **Test the fix**:
   - Console should no longer show oscillating "config" ↔ "question-types" logs
   - FLOW_STATE broadcasts should only occur on actual meaningful state changes
   - Remote and host should stay synchronized without bouncing

## Verification Checklist
- [ ] No rapid oscillation between config/question-types screens in console
- [ ] FLOW_STATE broadcasts occur only for actual state changes, not echoes
- [ ] Select question type on remote still works correctly
- [ ] Host and remote stay synchronized
- [ ] Timer and other commands still function properly
