# Fix: Remove Target Number from Player Device in Nearest Wins

## Problem
In on-the-spot nearest wins mode, the player device shows "Target: 50" (the actual answer). This reveals the target number to players, which defeats the purpose — players are supposed to guess closest to an unknown number.

The cause is in `NearestWinsInterface.tsx` line 392. The IPC broadcast sends `text: "Target: ${targetNumber[0]}"` to all player devices. The player app displays this text directly as the question heading.

## Fix

**File**: `src/components/NearestWinsInterface.tsx` (line 392)

Change the broadcast question text from `Target: ${targetNumber[0]}` to just `Nearest Wins` (matching what `sendQuestionToPlayers` already sends on line 387). The target number should stay hidden from players.

```diff
- text: `Target: ${targetNumber[0]}`,
+ text: 'Nearest Wins',
```

This is a one-line change. The tolerance value can remain in the broadcast payload since the player app doesn't display it — it's only used for host-side scoring logic.
