# Investigation & Fix Plan: Remote "Next Question" Button Issue (Deep Dive)

## Root Cause Found

The remote "Next Question" button fails because the admin command handler uses **stale closure variables** captured at component mount time, instead of using the up-to-date values from `adminListenerDepsRef.current`.

### Specific Problem

In the admin command handler (registered once on mount with empty dependency array), the `isQuizPackMode` variable is captured from the component closure at mount time and is **frozen at its initial value (likely false)**. This causes the handler to incorrectly branch to the on-the-spot mode instead of quiz pack mode when the remote sends the "next-question" command.

**Example of the bug:**
```javascript
// Line 3347: Uses STALE isQuizPackMode from closure (captured at mount)
console.log('[QuizHost]   - isQuizPackMode:', isQuizPackMode);

if (isQuizPackMode) {  // This is STALE - likely false at mount
  console.log('[QuizHost] - Quiz pack mode: Calling handlePrimaryAction');
  deps.handlePrimaryAction();
  success = true;
} else if (!isQuizPackMode) {  // Takes this branch incorrectly!
  console.log('[QuizHost] - On-the-spot mode, sending next question');
  // Executes on-the-spot reset instead of advancing quiz pack
  deps.setFlowState({ flow: 'idle', ... });
  setTeamAnswers({});
  // etc.
}
```

## Why This Happens

The admin command listener effect (line 3258) is registered **once on mount** with an empty dependency array:
```javascript
useEffect(() => {
  const handleAdminCommand = (data: any) => {
    // This handler closure captures component state at mount time
    // Any direct reference like 'isQuizPackMode' is FROZEN to its initial value
  };
  
  const unsubscribe = onAdminCommand('ADMIN_COMMAND', handleAdminCommand);
  return unsubscribe;
}, []);  // EMPTY DEPS - handler registered ONCE
```

Meanwhile, a separate useEffect (line 743) **keeps the ref up-to-date**:
```javascript
useEffect(() => {
  adminListenerDepsRef.current = {
    ...adminListenerDepsRef.current,
    isQuizPackMode,  // UPDATED continuously
    currentLoadedQuestionIndex,  // UPDATED continuously
    flowState,  // UPDATED continuously
    // etc.
  };
}, [isQuizPackMode, currentLoadedQuestionIndex, flowState, ...]);
```

The problem: the handler mixes usage patterns:
- ✅ Correctly uses `deps.handlePrimaryAction()` (from ref)
- ❌ Incorrectly uses direct `isQuizPackMode` (from stale closure)
- ❌ Incorrectly uses direct `loadedQuizQuestions` and `currentLoadedQuestionIndex` in some branches

## Expected Flow (Quiz Pack Mode)

1. Question displayed → flowState.flow = 'ready'
2. Answer revealed → flowState.flow = 'revealed'
3. Fastest team shown → flowState.flow = 'fastest'
4. **Next button pressed → handlePrimaryAction() called while in 'fastest' state**
   - This is the ONLY state where quiz pack advances to next question
   - Increments currentLoadedQuestionIndex
   - Calls sendNextQuestion()
   - useEffect watching currentLoadedQuestionIndex resets flow to 'ready' for new question
5. Back to step 1

## The Fix

Replace all direct references to component state variables in the admin command handler with references to `deps` (adminListenerDepsRef.current), and ensure the ref includes `isQuizPackMode`.

### Files to Modify

**src/components/QuizHost.tsx**

1. **Line 743-760**: Update the ref-update useEffect to include `isQuizPackMode`
   - Add `isQuizPackMode` to the refs being stored if not already there
   - Ensure it's in the dependency array

2. **Line 3345-3382** (the 'next-question' case): Replace stale variables with ref values
   - Change `isQuizPackMode` → `deps.isQuizPackMode || deps.showQuizPackDisplay`
   - Use `deps.flowState` instead of capturing it in closure
   - Use `deps.loadedQuizQuestions` instead of direct reference

3. **Other cases in the switch** (like 'send-picture'): Also check for similar issues
   - Line 3321: Uses `isQuizPackMode` directly
   - Line 3322: Uses `loadedQuizQuestions.length` directly
   - These should use `deps.isQuizPackMode` and `deps.loadedQuizQuestions`

4. **Line 743**: Verify `isQuizPackMode` is in the adminListenerDepsRef update useEffect

### Recommended Code Changes

**Change 1: Update ref values (line ~754)**
```javascript
// BEFORE: Check if isQuizPackMode is being stored
adminListenerDepsRef.current = {
  ...adminListenerDepsRef.current,
  isQuizPackMode,  // ADD THIS if missing
  showQuizPackDisplay,
  // ... rest of values
};
```

**Change 2: Fix 'next-question' handler (line ~3345-3382)**
```javascript
// BEFORE: Uses stale isQuizPackMode
if (isQuizPackMode) {
  deps.handlePrimaryAction();
}

// AFTER: Uses current isQuizPackMode from ref
const isCurrentlyQuizPack = deps.isQuizPackMode || deps.showQuizPackDisplay;
if (isCurrentlyQuizPack) {
  console.log('[QuizHost] - Quiz pack mode: Calling handlePrimaryAction');
  deps.handlePrimaryAction();
  success = true;
} else {
  // on-the-spot mode branch
}
```

**Change 3: Fix 'send-picture' handler (line ~3321-3335)**
```javascript
// BEFORE: Uses stale isQuizPackMode and loadedQuizQuestions
if (isQuizPackMode && loadedQuizQuestions.length > 0) {
  const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];

// AFTER: Uses ref values
if (deps.isQuizPackMode && deps.loadedQuizQuestions.length > 0) {
  const currentQuestion = deps.loadedQuizQuestions[deps.currentLoadedQuestionIndex];
```

## Why This Fix Works

1. **Ensures latest state is used**: The ref is updated every time state changes, so `deps.isQuizPackMode` always reflects the current quiz pack mode
2. **Correct branching**: Handler will correctly identify whether we're in quiz pack mode
3. **Calls the right handler**: `handlePrimaryAction()` will execute the correct state machine logic for the 'fastest' state
4. **Cascading state updates**: The state machine will properly:
   - Increment currentLoadedQuestionIndex
   - Reset team answers/times
   - Broadcast to players
   - Trigger useEffect to reset flowState to 'ready' for next question

## Secondary Consideration: Flow State Requirements

When the remote "Next Question" button is pressed, the host must be in the 'fastest' state for the advancement to work. If it's in 'running' state, a single `handlePrimaryAction()` call will only reveal the answer (transition to 'revealed'), not advance.

**Current behavior assumption**: The remote controller UI is only enabled when the host is in 'fastest' state, so this shouldn't be an issue in practice.

**If we want to support "smart next" from any state**, we'd need to add multi-step logic in the admin handler (call handlePrimaryAction multiple times until 'fastest' is reached, then advance). This is optional.

## Success Criteria

- Remote "Next Question" button correctly identifies quiz pack mode
- Handler calls `handlePrimaryAction()` with current state values
- Quiz pack advances to next question with proper state cleanup
- Flow state resets to 'ready' for the new question
- Team answers and response times are cleared
- External display updates properly
- Players receive the next question broadcast

## Files Involved

- **src/components/QuizHost.tsx**: Main file with admin handler and state refs
  - Line 743-760: Ref update useEffect
  - Line 3258-3410: Admin command handler useEffect (specifically 'next-question' case at 3345-3382)
