# Host Remote Question Preview Not Updating - Fix Plan

## Problem Statement
- **Symptom**: Host remote (controller UI) displays an outdated/placeholder question ("What is the capital of France?") and does not update when a quiz is loaded
- **Expected**: When user loads a quiz pack on the host app, the remote should immediately show the first question from that pack
- **What IS working**: FLOW_STATE messages are being received, GameControlsPanel buttons update correctly, but the question text itself doesn't display

## Root Cause Analysis
A mismatch in question field names between the host (sender) and the remote controller (receiver):

### Current Flow
1. Host (QuizHost.tsx) constructs FLOW_STATE payload with `currentQuestion` object
   - Sets: `currentQuestion.text = currentQuestion.q` (using the `text` field)
   - Example: `{ text: "What is...", options: [...], type: "multi", ... }`

2. FLOW_STATE travels via WebSocket to the remote controller

3. Player (App.tsx) receives FLOW_STATE and stores it as-is:
   - `setFlowState({ currentQuestion: message.data?.currentQuestion, ... })`
   - Result: `flowState.currentQuestion` contains `{ text: "...", options: [...] }`

4. GameControlsPanel passes to QuestionPreviewPanel:
   - `<QuestionPreviewPanel currentQuestion={flowState?.currentQuestion} />`

5. QuestionPreviewPanel tries to render the question text:
   - Code: `{currentQuestion.q || currentQuestion.question || 'No question text'}`
   - Problem: It looks for `.q` or `.question` fields, but the incoming object has `.text` field
   - Result: Shows "No question text" or displays a cached/default question

### Why This Happens
- Quiz Host's internal question objects use properties like `currentQuestion.q` or `currentQuestion.question`
- When building `currentGameState.currentQuestion` for the controller, the code maps: `text: currentQuestion.q` (changing the property name)
- QuestionPreviewPanel expects the original property names (`q` or `question`), not `text`
- This field-name inconsistency prevents the preview from displaying the actual question

## Solution Approach
**Recommended Fix: Normalize at the receiver (QuestionPreviewPanel)**

This approach is:
- **Safer**: Doesn't change the host's message format or require coordination
- **Defensive**: Handles questions from different sources that might use different field names
- **Simpler**: Single-component change vs. multiple host-side changes

### Why Not Normalize at Host?
While we could fix this at QuizHost (where currentQuestion is constructed), that would:
- Require testing multiple host code paths where FLOW_STATE is sent
- Risk breaking other parts of the host if they rely on the current shape
- Not defend against future inconsistencies

## Implementation Plan

### Step 1: Update QuestionPreviewPanel (src-player/src/components/HostTerminal/QuestionPreviewPanel.tsx)
**Change**: Expand the question text fallback chain to include `.text` field

**Current code**:
```typescript
{currentQuestion.q || currentQuestion.question || 'No question text'}
```

**New code**:
```typescript
{currentQuestion.q || currentQuestion.question || currentQuestion.text || 'No question text'}
```

**Impact**: QuestionPreviewPanel will now display question text regardless of whether it's stored as `.q`, `.question`, or `.text`

### Step 2: Verify FLOW_STATE includes currentQuestion
**Check**: Confirm that when a quiz is loaded, the FLOW_STATE message includes the currentQuestion object
- Look at logs: `[Player] ✨ flowState updated, GameControlsPanel should re-render {flow: ..., hasCurrentQuestion: true, ...}`
- Should already be working based on logs showing `hasCurrentQuestion: true`

### Step 3: Test the Fix
**Validation steps**:
1. Load host app (no quiz selected) → Remote should show "No question text" or placeholder
2. Load a quiz pack → Remote should immediately show the first question's text
3. Navigate through questions using "Send Question" / "Hide Question" → Text should update in real-time
4. Switch between quiz modes (basic, keypad, quizpack) → Question should always display correctly

## Files to Modify
- **src-player/src/components/HostTerminal/QuestionPreviewPanel.tsx** (primary fix)
- Optionally: Add logging to confirm the incoming question shape when debugging

## Success Criteria
- ✅ Quiz loaded → Remote shows the actual first question text (not placeholder)
- ✅ Question text updates when quiz state changes
- ✅ Works across all quiz modes (quizpack, keypad, basic)
- ✅ No console errors or warnings related to question rendering
- ✅ Remote buttons and question preview stay in sync

## Notes
- The "What is the capital of France?" question is from mockQuestions in QuizHost.tsx and is a default/placeholder
- Multiple places in the codebase use different field names (q, question, text) for question text - this fix handles all of them
- FLOW_STATE delivery is working correctly (confirmed by button updates) - this is purely a display issue
