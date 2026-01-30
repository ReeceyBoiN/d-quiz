# Fix Plan: ReferenceError - Cannot access 'Tn' before initialization

## Problem Summary
The application crashes with `ReferenceError: Cannot access 'Tn' before initialization`. This is a **Temporal Dead Zone (TDZ) error** caused by callbacks and handlers referencing helper functions that are declared AFTER them, but executed BEFORE those functions are initialized.

**Root Cause:** Several `useCallback` handlers defined early in `QuizHost.tsx` reference helper functions defined much later in the same component. When these handlers execute, the referenced functions haven't been declared yet, causing the crash.

## Files Affected
- **Primary:** `src/components/QuizHost.tsx` (high priority)
- **Create:** `src/utils/quizHostHelpers.ts` (new file)

## Specific Issues Identified

### Issue 1: `handlePrimaryAction` → `getAnswerText`
- **Lines:** `handlePrimaryAction` defined at line 1340, uses `getAnswerText` from line 1803
- **Risk:** When `handlePrimaryAction` is called, `getAnswerText` is not yet initialized

### Issue 2: `handleRevealAnswer` → `getAnswerText`, `handleComputeAndAwardScores`, `handleApplyEvilModePenalty`
- **Lines:** 
  - `handleRevealAnswer` at line 2478 calls `getAnswerText` (line 1803)
  - `handleRevealAnswer` also calls `handleComputeAndAwardScores` (line 3167)
  - `handleRevealAnswer` also calls `handleApplyEvilModePenalty` (line 3239)
- **Risk:** Multiple uninitialized function references

## Chosen Solution: Extract to Separate Helper Module

### Why This Approach
- **Stability:** Import-time module resolution ensures functions are available before any code executes
- **Organization:** Large components become more readable; helpers are isolated and testable
- **Maintainability:** Future developers understand the separation of concerns
- **Zero TDZ Risk:** Module-level imports are resolved before component initialization
- **Testability:** Helper functions can be unit tested independently

### Implementation Steps

#### Step 1: Create `src/utils/quizHostHelpers.ts`
This new file will contain:
- `getAnswerText()` - Extracts correct answer from a question
- `handleComputeAndAwardScores()` - Calculate and award points to teams
- `handleApplyEvilModePenalty()` - Apply evil/punishment mode penalties

These functions need access to component state, so they'll be exported as factory functions that accept required dependencies.

#### Step 2: Modify `src/components/QuizHost.tsx`
1. Import the helper functions from `quizHostHelpers.ts` at the top
2. Remove the original `const getAnswerText = ...` and other helper declarations
3. Remove `handleComputeAndAwardScores` and `handleApplyEvilModePenalty` declarations
4. Keep them as imported functions
5. Update any useCallback dependencies to remove self-references

#### Step 3: Ensure No Circular Dependencies
- Helpers module imports only types and utilities
- QuizHost imports helpers module
- No circular imports possible (helpers won't import QuizHost)

#### Step 4: Verify All Call Sites
- `handlePrimaryAction` calls `getAnswerText` - ✓ will now work (imported at top)
- `handleRevealAnswer` calls all three helpers - ✓ will now work (imported at top)
- No other dependencies should break

## Files to Create/Modify

### New File: `src/utils/quizHostHelpers.ts`
```typescript
// Type definitions for scoring config, etc.
// Export functions as either:
// 1. Pure utility functions (for getAnswerText)
// 2. Factory functions that accept dependencies (for scoring/penalty functions)
```

### Modified File: `src/components/QuizHost.tsx`
- Add import statement at top: `import { getAnswerText, ... } from '../utils/quizHostHelpers.ts'`
- Remove original const declarations (lines ~1803, ~3167, ~3239)
- Update any useCallback dependency arrays

## Expected Outcome
- Application no longer crashes with TDZ error
- All quiz flows work smoothly (quiz pack, on-the-spot, team scoring)
- Code is better organized with helpers isolated
- No functional changes to logic, only module restructuring
- More testable architecture going forward

## Validation Checklist
- [ ] Application loads without console errors
- [ ] No TDZ or ReferenceError in console
- [ ] Quiz pack round completes without crash
- [ ] On-the-spot mode transitions work
- [ ] Question type selection works
- [ ] Answer reveals work correctly
- [ ] Team scoring displays correctly
- [ ] Timer functionality works
- [ ] All game modes (letters, numbers, multiple-choice, sequence) function properly
- [ ] Navigation and state transitions are smooth
- [ ] No console warnings about missing dependencies

## Risk Mitigation
- All changes are code organization only - no logic changes
- Helpers are extracted with their exact implementation
- Import statements ensure proper initialization order
- Testing will catch any missed references
