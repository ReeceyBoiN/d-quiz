# Quiz Pack Results Summary Styling Refinement

## Problem Statement
The quiz pack mode results summary has a darker appearance compared to the keypad mode results, making it look less polished. Additionally, the answer label text needs to be updated to match the keypad mode display.

## Requirements
1. Make the results summary styling lighter to match keypad mode appearance
2. Update answer label to "Correct Answer"
3. **IMPORTANT**: Do NOT change the reveal answer flow or behavior - it should work exactly as it currently does

## Current Flow (to remain unchanged)
1. Timer ends → Results summary overlay appears on host
2. Reveal Answer button clicked → Correct answer displays on external display with applause sound
3. Fastest team button appears ready on host app
4. Fastest team that answered correctly displays on host app (for host to see before announcing)
5. Flow progresses to next stage normally

## Root Cause Analysis
1. **Overlay opacity**: Quiz pack uses `bg-black/50` (50% opacity) - makes everything look darker
   - Keypad mode has NO overlay, appears lighter
2. **Container background**: Quiz pack uses `bg-[#1a1a2e]` (very dark)
   - Keypad mode uses `bg-[#2c3e50]` (lighter, refined dark blue-grey)
3. **Label text**: Currently says "Answer:" before reveal, "Correct Answer:" after reveal
   - Should consistently say "Correct Answer:"

## Solution: Styling Changes Only

### Change 1: Reduce Overlay Opacity
**File**: `src/components/QuizHost.tsx` → `renderQuizPackResultsSummary()` (line ~5974)
**Current**: `bg-black/50`
**Change to**: `bg-black/30`
**Impact**: Makes the darkening effect lighter, more subtle

### Change 2: Update Card Background Color
**File**: `src/components/QuizHost.tsx` → `renderQuizPackResultsSummary()` (line ~5976)
**Current**: `bg-[#1a1a2e]`
**Change to**: `bg-[#2c3e50]`
**Impact**: Matches keypad panel background, appears lighter and more refined

### Change 3: Simplify Answer Label Text
**File**: `src/components/QuizHost.tsx` → `renderQuizPackResultsSummary()` (line ~6007-6008)
**Current**: Conditional - `'Correct Answer:' : 'Answer:'`
**Change to**: Always display `'Correct Answer:'`
**Impact**: Consistent with keypad mode appearance

## What Will NOT Change
- Reveal Answer button logic and behavior
- External display showing correct answer with applause sound
- Fastest team display on host app
- Flow progression between stages
- Any other functionality

## Files to Modify
- `src/components/QuizHost.tsx` - Three styling updates in `renderQuizPackResultsSummary()` function only

## Visual Result
- Lighter, cleaner appearance matching keypad mode
- Same functionality and flow, just better visual presentation
