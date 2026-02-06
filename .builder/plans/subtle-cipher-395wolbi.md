# Plan: Fix Duplicate Fail Sound in Quiz Pack Mode

## Problem
Fail sounds play **twice** in Quiz Pack mode when revealing answers with no correct teams.

**Root Cause:** Sound logic exists in two places that both execute:
1. `handleRevealAnswer()` at lines 2633-2634 (original location)
2. Flow state machine in `handlePrimaryAction()` at lines 1598-1613 (newly added)

When the Reveal button is clicked, both are triggered, playing 2 audio files instead of 1.

## Solution
Remove sound logic from the flow state machine (`handlePrimaryAction()`) since it's already handled in `handleRevealAnswer()`.

The flow is:
- Quiz Pack reveal button calls both `handleRevealAnswer()` and `handlePrimaryAction()`
- `handleRevealAnswer()` handles the sound playback (it was designed for this)
- The flow state machine should only manage state transitions, not sound

## Implementation
**File:** `src/components/QuizHost.tsx`
- **Remove lines 1598-1614** from the 'running'/'timeup' case in `handlePrimaryAction()` 
- Keep the sound logic in `handleRevealAnswer()` (lines 2632-2635)
- No other changes needed

## Why This Works
- `handleRevealAnswer()` is called first and plays the sound
- `handlePrimaryAction()` manages the flow state transition without duplicating sound logic
- On-the-spot Keypad mode continues to work (it calls `handleRevealAnswer()` separately)
- Quiz Pack mode works correctly with single audio file playback
