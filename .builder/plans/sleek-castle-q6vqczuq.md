# Keypad Scrambling Fix for On-The-Spot Mode

## Problem
Keypad scrambling works correctly in **Quiz Pack mode** (pre-loaded questions) but **not in On-The-Spot mode** (manual question entry).

Currently:
- Host sends original options in order (A, B, C, D) to players
- Players receive the scrambled flag and shuffle the DISPLAY layout on their end
- This causes confusion: when answer is revealed, the position no longer matches the letter shown

Expected behavior:
- Host should shuffle the options ARRAY ITSELF before sending to players
- If Option A (Spain) gets shuffled to position 3, players should receive position 3 as the first option
- When answer is revealed, it matches the order players see

## Root Cause
The two modes send questions via different code paths:
1. **Quiz Pack mode** (working): Uses `QuizPackDisplay.tsx` → likely has options pre-processed
2. **On-The-Spot mode** (broken): Uses `KeypadInterface.tsx` → sends options without shuffling

## Solution

### Step 1: Create a shuffle utility function in the host
- Location: `src/utils/shuffleArray.ts` or add to existing utils
- Function: `shuffleOptionsWithScramble(options: string[], scrambled: boolean): string[]`
  - If `scrambled === true`: Return Fisher-Yates shuffled array
  - If `scrambled === false`: Return options as-is
- This ensures consistent shuffling logic across host app

### Step 2: Modify KeypadInterface.tsx (on-the-spot mode)
- Find where `KeypadInterface` sends questions (look for `broadcastQuestionToPlayers` or `sendQuestionToPlayers` calls)
- Before calling the broadcast function:
  - Get the current team's `scrambled` flag from quiz state
  - Apply the shuffle utility to the options array
  - Pass the SHUFFLED options array to the broadcast function, not the original

### Step 3: Verify QuizPackDisplay.tsx (quiz pack mode)
- Check if quiz pack mode is already doing this shuffling
- If yes: Document why it works so we don't break it
- If no: Apply the same shuffle logic in that code path

### Step 4: Update broadcast payload (if needed)
- Current payload shape: `{ type: 'QUESTION', data: { text, options, type, scrambled } }`
- Keep it the same - just send shuffled options in the `options` array
- Players receive already-scrambled options and don't need to re-shuffle on their end

## Key Files to Modify
1. `src/components/KeypadInterface.tsx` - Apply shuffling to options before sending
2. `src/components/QuizHost.tsx` - May need adjustments to how on-the-spot sends questions
3. `src/utils/*.ts` - Add or use existing shuffle utility
4. Verify `src/components/QuizPackDisplay.tsx` - Ensure it's shuffling correctly

## Expected Result
- When host sends a question with scramble ON in on-the-spot mode
- Players receive options in random order (e.g., Spain, France, Germany, Italy)
- When answer is revealed, it matches the first option position (no confusion)
- Works consistently across both Quiz Pack and On-The-Spot modes
