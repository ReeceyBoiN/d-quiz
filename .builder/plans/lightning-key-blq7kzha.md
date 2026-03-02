# Quiz Pack Reveal Answer - Complete Scope Fix Plan

## Problem
`Uncaught ReferenceError: correctTeamIds is not defined` in `handleRevealAnswer()` function after reveal answer is clicked.

The error occurs AFTER scoring completes, in the external display section where variables are used outside their declaration scope.

## Root Cause Analysis
In `handleRevealAnswer()` (QuizHost.tsx ~line 4687), variables are declared inside nested `if` blocks:
- Line ~4713: `const correctTeamIds = ...` declared inside `if (currentQuestion)`
- Line ~4741: `const wrongTeamIds = ...` declared inside `if (currentQuestion)`
- Line ~4749: `const noAnswerTeamIds = ...` declared inside `if (currentQuestion)`
- Line ~4799: These variables are USED in external display sending code OUTSIDE the `if` block

Variables at function scope (already fixed):
- `fastestTeamId` and `fastestTeamResponseTime` (now at function scope from previous fix)

## Solution
Move ALL team data variables to function scope in `handleRevealAnswer()`:

1. **Declare at function scope (line ~4692, with existing fastestTeam vars):**
   - `let correctTeamIds: string[] = [];`
   - `let wrongTeamIds: string[] = [];`
   - `let noAnswerTeamIds: string[] = [];`

2. **Update assignments inside `if (currentQuestion)` block:**
   - Change `const correctTeamIds = ...` to `correctTeamIds = ...`
   - Change `const wrongTeamIds = ...` to `wrongTeamIds = ...`
   - Change `const noAnswerTeamIds = ...` to `noAnswerTeamIds = ...`

3. **External display section can now use these variables:**
   - Lines ~4810-4815 use these variables to build results summary
   - All external display calls use them for data

4. **Verify flow:**
   - Scoring uses `correctTeamIds` ✅ (line ~4758)
   - Evil mode penalties use team IDs ✅ (line ~4762)
   - External display sending uses team IDs ✅ (lines ~4810-4815)
   - All references now work with proper scope

## Files to Modify
- `src/components/QuizHost.tsx` - `handleRevealAnswer()` function

## Expected Outcome
- Reveal Answer button will complete without ReferenceError
- Flow transitions properly to 'revealed' state
- External display receives correct results summary
- All subsequent buttons (Fastest Team, Next Question) work correctly
