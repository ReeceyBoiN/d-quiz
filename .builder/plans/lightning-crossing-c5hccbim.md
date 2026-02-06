# Plan: Fix Duplicate Audio in On-The-Spot Keypad Mode

## Problem
After removing sound logic from `handlePrimaryAction()` to fix Quiz Pack mode, on-the-spot keypad mode now plays 2 audio clips when it should play only 1.

## Root Cause Analysis
Two places play sounds when Reveal is clicked in on-the-spot mode:
1. **KeypadInterface.tsx:1101-1130** - `handleRevealAnswer()` plays sound unconditionally
2. **QuizHost.tsx:2605-2639** - `handleRevealAnswer()` plays sound ONLY if `isQuizPackMode` is true

The issue: In on-the-spot keypad mode, BOTH locations may be triggering sound playback.

## Key Code Locations
- QuizHost `handleRevealAnswer()`: Lines 2605-2639 (only plays sound if `isQuizPackMode && loadedQuizQuestions.length > 0`)
- KeypadInterface `handleRevealAnswer()`: Lines 985-1130 (always plays sound when correct answer revealed)
- KeypadInterface `handleReveal()`: Lines 1329-1342 (calls `handleRevealAnswer()`)

## Recommended Solution
Make **QuizHost the single source of truth** for all sound playback.

### Implementation Steps:
1. **Modify QuizHost.handleRevealAnswer()** (lines 2605-2639):
   - Currently: Only plays sound if `isQuizPackMode && loadedQuizQuestions.length > 0`
   - Change: Play sound for BOTH Quiz Pack mode AND on-the-spot keypad mode
   - Use `isQuizPackMode` to determine which logic to use for scoring, but play sound in both cases

2. **Remove sound playback from KeypadInterface.handleRevealAnswer()** (lines 1101-1130):
   - Delete the entire sound block
   - KeypadInterface will only handle UI updates and point awards
   - Let QuizHost handle all audio

### Why This Works:
- All sound logic centralized in one place (QuizHost)
- Eliminates duplicate sounds from both components
- Quiz Pack mode: Uses Quiz Pack logic to determine sound (existing code)
- On-the-spot mode: Uses Keypad logic to determine sound
- No more duplicate playback
