# Fix: Player Joining Mid-Round Bypasses Buzzer Selection & Sees Unsent Question

## Root Cause Analysis

Two bugs in the player join flow when connecting mid-round:

### Bug 1: Buzzer Selection Screen Bypassed

**File**: `src-player/src/App.tsx`, TEAM_APPROVED handler (line 602+)

The `if/else` ordering is wrong. The check for `currentGameState?.currentQuestion` (line 623) runs **before** the check for `isInBuzzerSelection` (line 645). Since the player is on the buzzer-selection screen when TEAM_APPROVED arrives (set at line 1546 in `handleTeamNameSubmit`), the code should prioritize keeping them on buzzer selection. Instead, it immediately sets the screen to `'question'` (line 637), skipping buzzer selection entirely.

### Bug 2: Question Shown Before "Send Question" Triggered

**File**: `src/components/QuizHost.tsx`, late-joiner state (line 1805+)

The host sends `currentGameState.currentQuestion` to late joiners whenever a quiz pack is loaded (`showQuizPackDisplay && loadedQuizQuestions.length > 0`), **regardless of whether the question has been sent to players**. The flow state `flowState.flow` could be `'ready'` (meaning question is loaded but NOT yet sent), but the host still includes the question data. Other existing players correctly don't see the question because they never received a `QUESTION` message, but the late joiner gets it baked into the TEAM_APPROVED message.

## Fix Plan

### Fix 1: Reorder TEAM_APPROVED handler to prioritize buzzer selection (src-player/src/App.tsx)

In the TEAM_APPROVED handler (~line 619-724), move the buzzer selection / pin-entry check **before** the `currentGameState?.currentQuestion` check:

```
Current order:
1. if (currentGameState?.currentQuestion) → jump to question ❌
2. else if (isInBuzzerSelection || isInPinEntry) → stay on buzzer ← never reached

Fixed order:
1. if (isInBuzzerSelection || isInPinEntry) → stay on buzzer, save question as pending
2. else if (currentGameState?.currentQuestion) → jump to question (reconnecting players)
```

When on buzzer selection with a current question available:
- Save the question data and timer state as a pending message so it can be applied after buzzer confirmation
- Save the pending approval data (display mode etc.)
- Do NOT change the screen

### Fix 2: Only send question to late joiners if it's been actually sent (src/components/QuizHost.tsx)

At line 1805, add a guard to only include `currentGameState.currentQuestion` when the question has actually been sent to players. Check `flowState.questionSent` or check that `flowState.flow` is one of: `'sent-question'`, `'running'`, `'timeup'`, `'revealed'`, `'fastest'`.

When `flowState.flow === 'ready'` or `flowState.flow === 'sent-picture'` (picture sent but question not yet), the question content should NOT be included in the late-joiner state.

## Files to Modify

1. **`src-player/src/App.tsx`** (~line 619-724) - Reorder TEAM_APPROVED handler checks
2. **`src/components/QuizHost.tsx`** (~line 1804-1826) - Gate currentQuestion on questionSent state
