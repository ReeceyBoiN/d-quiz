# Host Remote Shows Placeholder Question on Fresh Startup - Fix Plan

## Problem Statement
- **Symptom**: When the host app starts up (before any quiz pack is loaded), the host remote displays a placeholder question ("What is the capital of France?") 
- **Expected**: The remote should show a "No Round Loaded" message and no question preview until a quiz pack is actually loaded on the host
- **Current Behavior**: The mock question preview displays even though no quiz is active

## Root Cause Analysis
When QuizHost initializes, it uses `mockQuestions` as default/demo content in various places. The remote controller (Player component acting as a host terminal) receives a FLOW_STATE message that includes `currentQuestion` set to a mock question object, even though no actual quiz pack has been loaded yet.

The flow:
1. QuizHost initializes with `flowState.currentQuestion = null` (correct)
2. But somewhere in the initialization or early state updates, mockQuestions is being set to currentQuestion
3. This gets broadcast to the remote via FLOW_STATE
4. The remote's QuestionPreviewPanel receives the mock question and displays it
5. Expected: Should only show a question when a real quiz pack is loaded

## Solution Approach
**Ensure QuestionPreviewPanel explicitly handles the "no quiz loaded" state**

This is a two-part fix:

### Part 1: Update QuestionPreviewPanel to show "No Round Loaded" message
- Currently: Returns `null` when `!currentQuestion` (renders nothing)
- Should: Display a "No Round Loaded" message instead of returning null
- This gives the user clear feedback about the state

### Part 2: Ensure flowState.currentQuestion is not set to mockQuestions on startup
- Verify that QuizHost doesn't initialize flowState with mockQuestions
- Check that FLOW_STATE is only sent with actual questions (from loadedQuizQuestions)
- If mockQuestions is being used inappropriately, remove it from being broadcast to the controller

## Implementation Plan

### Step 1: Update QuestionPreviewPanel (src-player/src/components/HostTerminal/QuestionPreviewPanel.tsx)
**Change**: Instead of returning `null` when there's no question, display a "No Round Loaded" message

Current behavior:
```typescript
if (!currentQuestion) {
  return null;
}
```

New behavior:
```typescript
if (!currentQuestion) {
  return (
    <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
      <div className="text-center text-slate-400 text-sm">
        No Round Loaded
      </div>
    </div>
  );
}
```

This ensures the remote always shows feedback rather than just an empty space.

### Step 2: Verify FLOW_STATE doesn't include mockQuestions
**Check**: In QuizHost.tsx, find where FLOW_STATE is initialized and sent
- Ensure `currentQuestion` is only set from `loadedQuizQuestions` (real quiz data)
- Ensure mockQuestions is never passed to `sendFlowStateToController` or broadcast
- mockQuestions should only be used for UI demo/placeholder purposes, not for actual game control

### Step 3: Verify startup state is clean
**Check**: When host app loads with no quiz selected:
- `flowState.currentQuestion` should be `null`
- `flowState.isQuestionMode` should be `false`
- `flowState.flow` should be `'idle'`
- Remote should display "Ready to Start" button and "No Round Loaded" message

### Step 4: Test the fix
**Validation**:
1. Start host app (no quiz loaded) → Remote shows "No Round Loaded" + "Ready to Start" button
2. Load a quiz pack → Remote immediately shows first question
3. Navigate between questions → Question preview updates correctly
4. Works across all quiz modes (quizpack, keypad, basic)

## Files to Modify
- **src-player/src/components/HostTerminal/QuestionPreviewPanel.tsx** (primary fix - add "No Round Loaded" message)
- Optionally: src/components/QuizHost.tsx (verify no mockQuestions leakage)

## Success Criteria
- ✅ Fresh startup: Remote shows "No Round Loaded" + "Ready to Start"
- ✅ After loading quiz: Remote shows actual first question
- ✅ Question preview updates when navigating
- ✅ No placeholder question visible before a real quiz is loaded
- ✅ Works across all quiz modes

## Root Cause Notes
- mockQuestions is defined in QuizHost.tsx as developer/demo data
- It's used in some non-quiz-pack code paths but shouldn't appear on the controller
- The controller should only see real questions from loadedQuizQuestions
