# Investigation Plan: Number Question Marking Issues

## Problem Statement
Number questions on quiz packs are not always marked correctly. Some questions answered correctly by players are marked as incorrect by the host.

## Key Findings

### Answer Processing Flow
1. **Player submission**: Number answers are submitted as numeric type (JavaScript number)
2. **Network transmission**: Sent via PLAYER_ANSWER websocket message
3. **Host reception**: Converted to string for storage and comparison
4. **Marking**: Host compares using normalized string equality

### Critical Mismatch Identified
**Type Comparison Discrepancy:**
- **Player-side correctness** (src-player/src/App.tsx:determineAnswerCorrectness): Uses numeric comparison for 'numbers' type
  - Parses both submitted and correct answer to integers using `parseInt()`
  - Strict numeric equality: `submittedNum === correctNum`
  
- **Host-side correctness** (src/components/QuizHost.tsx): Uses string comparison
  - Normalizes both sides: `.toLowerCase().trim()`
  - String equality: `teamAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()`

### Potential Issues with String-Based Host Comparison
1. **Leading zeros**: "042" vs "42" - player will convert both to 42 numerically, but host string comparison sees different strings
2. **Decimal numbers**: If quiz pack includes decimals, string comparison may fail if formatting differs
3. **Negative numbers**: Sign handling could vary
4. **Type consistency**: Answer originates as number, gets converted to string by host - any format inconsistency in conversion breaks comparison

## User Context
- Issue occurs **randomly across all number ranges** - not specific to certain values
- Affected only **player mobile app**, not host keypad entry
- Correct answers stored as **plain numbers** with no formatting
- This suggests the issue is in how the host **receives and compares** player submissions

## Investigation Scope

### Primary Suspect Areas
1. **Host answer reception** - How numeric answers from players are converted and stored
2. **Answer comparison logic** - The string comparison may not properly handle numeric type conversion
3. **Type consistency** - Mismatch between numeric submission and string storage/comparison

### Files to Examine in Detail
1. **src/components/QuizHost.tsx** - Team answer status update logic (where incorrect marks are assigned)
2. **src/components/KeypadInterface.tsx** - Answer extraction and comparison in `calculateAnswerStats()`
3. **src/utils/quizHostHelpers.ts** - `getAnswerText()` function (extracts correct answer)
4. **src-player/src/App.tsx** - `determineAnswerCorrectness()` function (player-side logic)
5. **electron/backend/server.js** - How answers are stored/transmitted

### Specific Checks Needed
- How number answers are formatted when stored in `teamAnswers` map on host
- How correct answers are extracted and formatted from quiz pack data
- Whether leading zeros or special formatting is being introduced
- If there's a case where numeric answers aren't being normalized consistently

## Recommended Approach

### Phase 1: Code Inspection
Read and analyze the exact comparison logic in:
- QuizHost.tsx team status determination
- KeypadInterface.tsx calculateAnswerStats
- quizHostHelpers.ts getAnswerText
- Compare player-side vs host-side comparison logic

### Phase 2: Identify Root Cause
Look for:
- Inconsistent string-to-number conversion
- Missing normalization of numeric answers before comparison
- Discrepancies between how answers are stored vs how they're compared
- Potential formatting issues in the quiz pack data itself

### Phase 3: Solution Implementation
If issue confirmed:
- Add numeric normalization on host side before comparison (parse both sides to numbers)
- Ensure consistent handling of numeric values throughout the pipeline
- Add safeguards for edge cases (leading zeros, negative numbers, decimals)

## Files that Will Likely Need Modification
- `src/components/QuizHost.tsx` (team status/marking logic)
- `src/components/KeypadInterface.tsx` (answer comparison logic)
- Possibly `src/utils/quizHostHelpers.ts` (answer extraction/normalization)
