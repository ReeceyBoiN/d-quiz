# Bug Fix: Points Not Added to Team in On-The-Spot Keypad and Quiz Pack Modes

## Problem Summary
Points are not being added to teams when they answer correctly in:
1. **On-the-spot Keypad mode** ✓ (working correctly)
2. **On-the-spot Buzz-In mode** ❌ (missing prop)
3. **On-the-spot Nearest Wins mode** ❌ (wrong handler)
4. **Quiz Pack mode** ❌ (missing award call)

## Root Cause Analysis

### Issue 1: BuzzInInterface Missing onAwardPoints Prop
**File**: `src/components/QuizHost.tsx:3738-3744`
- BuzzInInterface declares `onAwardPoints` prop in its interface (BuzzInInterface.tsx:23)
- But QuizHost does NOT pass the prop when rendering BuzzInInterface
- **Result**: Points are never awarded in buzz-in mode

### Issue 2: NearestWinsInterface Receiving Wrong Handler
**File**: `src/components/QuizHost.tsx:3760`
- NearestWinsInterface receives `onAwardPoints={handleScoreChange}`
- `handleScoreChange` signature: `(teamId: string, change: number) => void`
- NearestWinsInterface calls: `onAwardPoints([winnerTeamId], 'nearestwins')` (NearestWinsInterface.tsx:563)
- This passes an array as `teamId` and a string as `change`, causing the function to fail
- **Result**: Points are never added to the winner in nearest wins mode

### Issue 3: Quiz Pack Mode Missing Points Award Call
**File**: `src/components/QuizHost.tsx:1514-1627` (case 'timeup' handler)
- When answer is revealed in quiz pack mode, code calculates which teams answered correctly (lines 1523-1533)
- Updates `teamAnswerStatuses` state with 'correct', 'incorrect', 'no-answer' values (line 1536)
- But NEVER calls any function to award points to correct teams
- **Result**: Teams are marked as correct but receive no points

## Solution

### Fix 1: Pass onAwardPoints to BuzzInInterface
**File**: `src/components/QuizHost.tsx` (lines 3738-3744)

Add `onAwardPoints` and `onEvilModePenalty` props to BuzzInInterface:
```tsx
<BuzzInInterface 
  teams={quizzes}
  onStartMode={handleBuzzInStart}
  onClose={handleBuzzInClose}
  externalWindow={externalWindow}
  onExternalDisplayUpdate={handleExternalDisplayUpdate}
  onAwardPoints={handleComputeAndAwardScores}
  onEvilModePenalty={handleApplyEvilModePenalty}
/>
```

### Fix 2: Create Wrapper Handler for NearestWinsInterface
**File**: `src/components/QuizHost.tsx`

Create a new handler function that awards fixed points for nearest wins mode:
```typescript
const handleNearestWinsAwardPoints = useCallback(
  (correctTeamIds: string[], gameMode: 'nearestwins') => {
    if (gameMode === 'nearestwins' && correctTeamIds.length > 0) {
      // Award fixed points to the winner
      correctTeamIds.forEach(teamId => {
        handleScoreChange(teamId, currentRoundWinnerPoints || 0);
      });
    }
  },
  [currentRoundWinnerPoints, handleScoreChange]
);
```

Then pass this to NearestWinsInterface (line 3760):
```tsx
onAwardPoints={handleNearestWinsAwardPoints}
```

### Fix 3: Add Points Award Call in Quiz Pack Mode
**File**: `src/components/QuizHost.tsx` (after line 1536 in the 'timeup' case handler)

After determining and setting `teamAnswerStatuses`, add:
```typescript
// Award points to teams that answered correctly in quiz pack mode
if (isQuizPackMode) {
  const correctTeamIds = Object.entries(newStatuses)
    .filter(([_, status]) => status === 'correct')
    .map(([teamId, _]) => teamId);
  
  if (correctTeamIds.length > 0) {
    // Calculate fastest team among correct answers for speed bonus
    let fastestTeamId: string | undefined;
    const correctTeamTimes = correctTeamIds
      .map(id => ({ id, time: teamResponseTimes[id] || Infinity }))
      .sort((a, b) => a.time - b.time);
    if (correctTeamTimes.length > 0) {
      fastestTeamId = correctTeamTimes[0].id;
    }
    
    // Award points using the full scoring factory
    handleComputeAndAwardScores(correctTeamIds, 'keypad', fastestTeamId, teamResponseTimes);
  }
}
```

## Key Files to Modify
1. **src/components/QuizHost.tsx**
   - Line 3738-3744: Add missing props to BuzzInInterface
   - Add new `handleNearestWinsAwardPoints` function (around line 3200, after other handlers)
   - Line 3760: Change NearestWinsInterface handler to `handleNearestWinsAwardPoints`
   - After line 1536: Add points award call for quiz pack mode

## Expected Behavior After Fix
- **Keypad Mode**: Points awarded correctly ✓ (already working)
- **Buzz-In Mode**: Points awarded to winners based on full scoring rules
- **Nearest Wins Mode**: Points awarded fixed amount (currentRoundWinnerPoints) to winner
- **Quiz Pack Mode**: Points awarded to teams that answer correctly using full scoring rules
- All modes (except Nearest Wins) respect: speed bonus, evil mode, punishment mode, go-wide mode, staggered mode

## Testing Strategy
1. Test each on-the-spot mode with at least one team answering correctly
2. Verify points are awarded immediately after revealing the answer/selecting winner
3. Test with different scoring options enabled (speed bonus, evil mode, staggered) where applicable
4. Test quiz pack mode with various question types and confirm scores update
5. Verify Nearest Wins awards fixed points regardless of other settings
6. Run complete round and verify final scores are accurate
