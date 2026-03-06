# Nearest Wins - Complete Reveal & Closest Team Flow

## Problem
Nearest wins mode is missing key behaviors that other modes (keypad/buzzin) have:
1. **No REVEAL broadcast** to player devices in on-the-spot mode — players never see the answer
2. **No applause sound** on reveal in either on-the-spot or quizpack mode
3. QuizPack nearest wins awards points but doesn't play applause sound

## Changes Required (3 functions, ~12 lines added)

### Change 1: NearestWinsInterface.handleRevealResults() — Broadcast REVEAL to players
**File**: `src/components/NearestWinsInterface.tsx` (line 657)

After setting `answerRevealed = true` and calling `onFlowStateChange('revealed')`, add a broadcast of the REVEAL message to player devices. This mirrors what `broadcastAnswerReveal()` does in QuizHost for quizpack mode.

```ts
// After onFlowStateChange('revealed') at line 663, add:
if (correctAnswer !== null) {
  try {
    (window as any).api?.network?.broadcastReveal({
      answer: String(correctAnswer),
      type: 'nearestwins',
      selectedAnswers: []
    });
    console.log('[NearestWins] Broadcasted REVEAL to players:', correctAnswer);
  } catch (err) {
    console.error('[NearestWins] Error broadcasting reveal:', err);
  }
}
```

**Why**: Player app's REVEAL handler (src-player/src/App.tsx ~line 826) already processes REVEAL messages for all question types. This wires up the missing broadcast so players see the correct answer highlighted on their devices.

### Change 2: QuizHost.handleNearestWinsAwardPoints() — Add applause sound
**File**: `src/components/QuizHost.tsx` (line 5779)

Add `playApplauseSound()` call inside the award function. Always applause (never fail) because nearest wins questions are inherently difficult.

```ts
// Inside the if block at line 5781, before awarding points:
playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
```

Also add `playApplauseSound` to the dependency array at line 5788.

**Why**: This handles the on-the-spot nearest wins mode. `handleComputeAndAwardScores` only plays sound for `gameMode === 'keypad'`, so nearest wins needs its own sound trigger.

### Change 3: QuizHost.handleRevealAnswer() nearest wins section — Add applause sound
**File**: `src/components/QuizHost.tsx` (line 4862)

After finding closest team(s) and before awarding points, add applause sound:

```ts
// After line 4866 (correctTeamIds computed), before line 4868 (awarding points):
playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
```

**Why**: This handles the quizpack nearest wins mode. The existing `broadcastAnswerReveal()` call at line 5074 already broadcasts REVEAL to players for quizpack mode, but no sound was being played.

## What Already Works (Verified)
- **QuizPack REVEAL broadcast**: `broadcastAnswerReveal()` at line 5074 already broadcasts for ALL question types including nearest wins
- **Closest Team display**: `handleFastestTeamReveal()` at line 3176 already shows overlay, plays buzzer, broadcasts FASTEST, and updates external display
- **External display**: Renders `nearest-wins-results` view correctly with answer and top 3 teams
- **Player REVEAL handler**: Processes REVEAL message and shows answer highlighting for all types
- **Host remote commands**: Admin commands (start-normal-timer, reveal-answer, show-fastest) already route correctly
- **Flow state transitions**: sent-question → running → timeup → revealed → fastest all work

## Files Modified
1. `src/components/NearestWinsInterface.tsx` — Add REVEAL broadcast (~8 lines)
2. `src/components/QuizHost.tsx` — Add applause in 2 places (~2 lines each)
