# Fix Nearest Wins Issues Found During Code Review

## Issues Found

### Issue 1: Prop name mismatch — NearestWinsInterface winner points callback (PRE-EXISTING BUG)
- **QuizHost** passes `onWinnerPointsChange={handleCurrentRoundWinnerPointsChange}` to `<NearestWinsInterface>`
- **NearestWinsInterface** expects `onCurrentRoundWinnerPointsChange` in its props interface
- Result: Winner points slider changes in NearestWinsInterface don't propagate back to QuizHost

**Fix:** In `src/components/QuizHost.tsx`, change the prop name from `onWinnerPointsChange` to `onCurrentRoundWinnerPointsChange` where NearestWinsInterface is rendered (~line 6514).

### Issue 2: flowState.getTotalTimeForQuestion doesn't handle 'nearestwins' type string
- NearestWinsInterface IPC broadcasts use type `'nearestwins'`, but `getTotalTimeForQuestion` only matches `'nearest'`
- If a question arrives with type `'nearestwins'`, it falls through to the default case and uses the keypad timer instead of the nearestwins timer

**Fix:** In `src/state/flowState.ts`, add `case 'nearestwins':` alongside `case 'nearest':` in the switch statement. Also do the same in `getQuestionTypeLabel`.

### Issue 3: getAnswerText doesn't handle 'nearestwins' type string
- Same issue — only checks for `'nearest'`, not `'nearestwins'`

**Fix:** In `src/utils/quizHostHelpers.ts`, expand the nearest check to include both: `if (type === 'nearest' || type === 'nearestwins')`

### Issue 4: "Fastest Team" label should say "Closest Team" for nearest wins questions
- `QuestionNavigationBar.tsx` always shows "Fastest Team" / "Fastest Answer" in the revealed state
- `FastestTeamDisplay.tsx` header is hardcoded to "Fastest Team" and shows response time

**Fix for QuestionNavigationBar:** 
- The component already receives `currentQuestion` prop
- In `getFlowButton()` case `'revealed'`: check if `currentQuestion?.type?.toLowerCase() === 'nearest'` and show "Closest Team" / "Closest Answer" instead
- In `getOnTheSpotFlowButton()` where it shows "Fastest Team": same check, show "Closest Team"  
- In `getActionForCurrentButton()` switch: add cases for `'Closest Team'` and `'Closest Answer'` mapping to `onRevealFastestTeam`

**Fix for FastestTeamDisplay:**
- Add an optional `displayMode?: 'fastest' | 'closest'` prop
- When `displayMode === 'closest'`: show "Closest Team" header, show guess/difference info instead of response time
- Add optional `guess?: number` and `difference?: number` to the fastestTeam prop type

**Fix in QuizHost (data wiring):**
- In `handlePrimaryAction` revealed branch (~line 2615-2650): when `currentQuestion?.type === 'nearest'`, compute the winner's guess and difference from teamAnswers and pass them alongside responseTime to `handleFastestTeamReveal`
- In `handleFastestTeamReveal`: store the extra data (guess, difference, displayMode) alongside team and responseTime
- Pass `displayMode` to `FastestTeamDisplay`

### Issue 5: QuizPackDisplay localWinnerPoints not synced from parent
- `localPoints` and `localSpeedBonus` have useEffect hooks to sync from parent props, but `localWinnerPoints` does not

**Fix:** Add a useEffect in `src/components/QuizPackDisplay.tsx` to sync `localWinnerPoints` when `currentRoundWinnerPoints` changes (matching the pattern of the other sync effects).

### Issue 6: QuizHost handleRevealAnswer nearest check should also handle 'nearestwins'
- The nearest scoring branch checks `questionType === 'nearest'` only

**Fix:** Change to `questionType === 'nearest' || questionType === 'nearestwins'` in `src/components/QuizHost.tsx` handleRevealAnswer.

### Issue 7: QuizHost external display nearest check should also handle 'nearestwins'  
- The external display section checks `currentQuestion.type?.toLowerCase() === 'nearest'` only

**Fix:** Change to check for both `'nearest'` and `'nearestwins'`.

## Files to Modify

1. **`src/components/QuizHost.tsx`**
   - Fix prop name: `onWinnerPointsChange` → `onCurrentRoundWinnerPointsChange` for NearestWinsInterface
   - handleRevealAnswer: expand nearest check to include 'nearestwins'
   - External display section: expand nearest check to include 'nearestwins'  
   - handlePrimaryAction revealed branch: pass guess/difference data for nearest wins questions
   - handleFastestTeamReveal: store displayMode/guess/difference
   - Pass displayMode to FastestTeamDisplay

2. **`src/state/flowState.ts`**
   - getTotalTimeForQuestion: add `case 'nearestwins':` 
   - getQuestionTypeLabel: add `case 'nearestwins':`

3. **`src/utils/quizHostHelpers.ts`**
   - getAnswerText: expand nearest check to include 'nearestwins'

4. **`src/components/QuestionNavigationBar.tsx`**
   - getFlowButton revealed case: show "Closest Team" for nearest wins
   - getOnTheSpotFlowButton: show "Closest Team" for nearest wins
   - getActionForCurrentButton: add 'Closest Team'/'Closest Answer' cases

5. **`src/components/FastestTeamDisplay.tsx`**
   - Add `displayMode` prop
   - Conditionally show "Closest Team" header and guess/difference instead of response time

6. **`src/components/QuizPackDisplay.tsx`**
   - Add useEffect to sync localWinnerPoints from parent prop
