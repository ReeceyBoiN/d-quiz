# Fix: Host Remote send-question Command Not Executing

## Problem Identified
The host app receives the `send-question` command from the host remote, but fails to execute it because when `handlePrimaryAction` runs, it sees `loadedQuizQuestions.length: 0`, even though the quiz was loaded with 20 questions.

Meanwhile, the `hide-question` command works because it doesn't depend on accessing the questions array.

### Root Cause
**Stale closure reference bug** in the admin command handler (src/components/QuizHost.tsx:3215-3400):

1. The admin command listener is registered with an **empty dependency array** (line 3215) to prevent infinite re-registration
2. Inside the handler (defined within that effect), it calls `handlePrimaryAction()`
3. `handlePrimaryAction` is a `useCallback` that depends on `loadedQuizQuestions` (line 2399)
4. When the effect registers the handler on mount:
   - `handlePrimaryAction` is captured in the handler's closure at mount time (when `loadedQuizQuestions` is empty `[]`)
   - Even though `handlePrimaryAction` is later recreated as a new function when `loadedQuizQuestions` changes (due to useCallback deps)
   - The `handleAdminCommand` function still has the OLD version of `handlePrimaryAction` from mount in its closure
5. When the admin command runs and calls `handlePrimaryAction()`, it's calling the stale version that has empty questions

## Console Log Evidence
From the provided logs:
- `[QuizHost] ✅ Setting loadedQuizQuestions with 20 questions` - Quiz loads successfully
- Later: `[QuizHost] handlePrimaryAction called` then `[QuizHost] - loadedQuizQuestions.length: 0` - The stale version is called
- The `hide-question` command works because it doesn't call `handlePrimaryAction`

## Solution
Add `handlePrimaryAction` to `adminListenerDepsRef` so the handler always accesses the current version.

This follows the same pattern already used for `authenticatedControllerId`, `hostControllerEnabled`, etc.

### Changes Required
**File: src/components/QuizHost.tsx**

1. **Line 707-712**: Add `handlePrimaryAction` to initial `adminListenerDepsRef` object
2. **Line 716-721**: Add `handlePrimaryAction` to the dependency update effect
3. **Line 722**: Add `handlePrimaryAction` to the dependency array of the effect  
4. **Line 3269**: Update the call from `handlePrimaryAction()` to `deps.handlePrimaryAction()`

### Why This Works
By storing `handlePrimaryAction` in the ref and updating it whenever it changes, the admin handler can access the current version that has the right closure values for `loadedQuizQuestions`.

The ref update effect will trigger whenever `handlePrimaryAction` changes (which happens when its dependencies change, including `loadedQuizQuestions`), ensuring the handler always has the latest version.
