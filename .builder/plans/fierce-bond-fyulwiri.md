# Plan: Fix loadedQuizQuestions Being Cleared During Quiz Pack Execution

## Problem Statement
When a quiz pack is loaded:
1. ✅ Quiz loads with 20 questions
2. ✅ useEffect sets `loadedQuizQuestions` with all 20 questions
3. ❌ **BEFORE command executes:** `loadedQuizQuestions` is cleared to empty array (length: 0)
4. ❌ Command handler returns early because there are no questions

The logs show no calls to `handleEndRound` or `handleKeypadClick`, so something else is clearing the state.

## Investigation Findings

### Current State Changes in QuizHost.tsx
Found all `setLoadedQuizQuestions` calls:
- **Line 837**: In useEffect (loads quiz) - Sets with currentQuiz.questions
- **Line 1725**: In handleEndRound - Clears to []
- **Line 1823**: In handleKeypadClick - Clears to []

### The Mystery
- Logs confirm questions ARE set in state (line 836: "Setting loadedQuizQuestions with 20 questions")
- But when command executes seconds later: loadedQuizQuestions.length = 0
- Yet no log from handleEndRound or handleKeypadClick firing
- **This means the state is being cleared by something NOT currently logged**

### Possible Hidden Culprits
1. **useEffect running again** - Maybe currentQuiz is being updated/modified, triggering the useEffect again?
2. **Another unmapped location** - There might be another place clearing it we haven't found yet
3. **Component lifecycle** - QuizPackDisplay might be unmounting/remounting and triggering clears
4. **Dependency issue** - Some other state change might be triggering a clear

## Solution: Add State Monitor Logging

### Step 1: Add useEffect to Monitor loadedQuizQuestions Changes
Insert new useEffect right after the quiz load effect (line 860) that:
- Logs every time loadedQuizQuestions changes
- Logs the length (e.g., "loadedQuizQuestions changed to 0 questions")
- Uses console.trace() to capture call stack when it becomes empty
- This will reveal EXACTLY what code is clearing it

### Step 2: Add Logging to Detect currentQuiz Changes
The quiz load useEffect has dependency [currentQuiz]. If currentQuiz is being modified after initial load:
- It would re-trigger the effect
- Might have different state on second run
- Add logging to detect if effect runs multiple times

### Step 3: Search for Other Potential Culprits
After monitoring logs, search for:
- Any other code that might call setLoadedQuizQuestions indirectly
- Component unmounts that might trigger cleanup
- State updates that depend on quiz pack transitions

## Implementation Plan

### Change 1: Add State Monitor useEffect (after line 859)
```typescript
// Monitor loadedQuizQuestions state changes to detect clearing
useEffect(() => {
  console.log('[QuizHost] 📊 loadedQuizQuestions state changed:', loadedQuizQuestions.length, 'questions');
  if (loadedQuizQuestions.length === 0 && /* some flag that we had questions before */) {
    console.log('[QuizHost] ⚠️  loadedQuizQuestions was CLEARED!');
    console.trace('[QuizHost] Stack trace for clearing:');
  }
}, [loadedQuizQuestions.length]);
```

### Change 2: Track Previous Length
Use a ref to detect transitions from populated → empty:
```typescript
const prevQuestionsLengthRef = useRef(0);
useEffect(() => {
  if (prevQuestionsLengthRef.current > 0 && loadedQuizQuestions.length === 0) {
    console.log('[QuizHost] 🚨 QUESTIONS CLEARED: from', prevQuestionsLengthRef.current, 'to 0');
    console.trace('[QuizHost] Call stack:');
  }
  prevQuestionsLengthRef.current = loadedQuizQuestions.length;
}, [loadedQuizQuestions.length]);
```

### Change 3: Add Multi-Run Detection
Log if the quiz load effect runs more than once:
```typescript
useEffect(() => {
  // At line 824 add:
  const effectRunCount = (window as any).__quizHostEffectRuns || 0;
  (window as any).__quizHostEffectRuns = effectRunCount + 1;
  console.log('[QuizHost] Quiz load effect RUN #' + ((window as any).__quizHostEffectRuns));
}, [currentQuiz]);
```

## Next Steps After Implementation
1. Load host app with new logging
2. Load quiz pack
3. Hit send-question button
4. Check console for:
   - When loadedQuizQuestions.length changes from 20 to 0
   - What code triggered the change (from console.trace)
   - If the effect runs multiple times
5. Once root cause is identified, implement targeted fix

## Expected Outcome
Will clearly identify:
- **WHEN** questions are cleared (exact timestamp)
- **WHAT CODE** clears them (stack trace)
- **WHY** they're being cleared (the purpose of that code)
- This allows us to implement fix that preserves questions while maintaining intended behavior
