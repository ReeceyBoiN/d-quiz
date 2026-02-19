# Plan: Fix External Display Black Screen Issue

## Problem Summary
When testing keypad, nearest wins, and buzz-in modes on the external display:
- During countdown: works correctly (shows timer via 'timer' mode)
- When answer is revealed: shows black "External Display" screen instead of answer reveal
- Root cause: ExternalDisplayWindow.renderContent() lacks explicit cases for modes sent by these game interfaces

## Root Cause Analysis
The host sends specific display modes during gameplay:
- **KeypadInterface (on-the-spot mode)** sends:
  - 'timer' during countdown ✓ (handled, shows correctly)
  - 'correctAnswer' on reveal ✗ (NOT handled, falls to default black screen)
  - 'questionWaiting' between questions ✗ (NOT handled)
  - 'fastTrack' / 'fastestTeam' ✗ (missing fastTrack case)
  
- **NearestWinsInterface** sends:
  - 'nearest-wins-question' ✗ (NOT handled)
  - 'nearest-wins-timer' ✓ (handled via 'timer' case)
  - 'nearest-wins-results' ✗ (NOT handled)

- **BuzzInInterface** - similar to keypad, sends 'correctAnswer' on reveal ✗

Currently, ExternalDisplayWindow.renderContent() has cases for:
- basic, question-with-timer, timer-with-question, picture, timer, question, resultsSummary, fastestTeam, wheel-spinner, scores, default

Missing cases that need to be added:
- 'correctAnswer' - show answer reveal with stats/fastest team
- 'questionWaiting' - show waiting UI between questions
- 'nearest-wins-question' - show target number and prompt
- 'nearest-wins-results' - show results with answer revealed
- 'fastTrack' - show fastest team (or map to fastestTeam)

## Solution Approach

### Phase 1: Add Missing Render Cases
Add explicit case statements to ExternalDisplayWindow.renderContent() for the modes currently falling to default:

**1. 'correctAnswer' case** (used by keypad & buzz-in on reveal)
- **Design**: Full stats + answer with bubble styling
- Show the correct answer prominently with the chosen letter (A/B/C/D)
- Display stats grid: Correct count | Incorrect count | No Answer count
- Show fastest team info if available
- Use bubble design with colored border (dark background, border color from displayData.borderColor)
- Styling: similar to 'resultsSummary' case but with bubble background
- Data: displayData.correctAnswer, displayData.stats (correctCount, incorrectCount, noAnswerCount), displayData.fastestTeamData
- Apply text size scaling via getTextSizeMultiplier()

**2. 'questionWaiting' case** (between questions in keypad/buzz-in)
- **Design**: Simple question number display
- Show just "Question X" or "Question X of Y" in large text
- Minimal UI - centered, no bubble needed
- Data: displayData.questionInfo (contains questionNumber and totalQuestions)
- Apply text size scaling

**3. 'nearest-wins-question' case** (when nearest wins round starts)
- Show the target number prominently
- Basic UI to show the number players are trying to guess closest to
- Data: displayData.targetNumber, displayData.gameInfo
- Apply text size scaling

**4. 'nearest-wins-results' case** (when nearest wins answer is revealed)
- **Design**: Show answer text only (simplified)
- Display the correct answer that was revealed
- Include stats grid (similar to correctAnswer)
- Use bubble design with colored border
- Data: displayData.correctAnswer, displayData.results (if has stats), displayData.answerRevealed
- Apply text size scaling

**5. 'fastTrack' case** (if needed for keypad)
- Map to 'fastestTeam' rendering or reuse existing logic
- Use displayData.fastestTeamData

### Phase 2: Implementation Details
- Use existing styling patterns from 'resultsSummary' and 'fastestTeam' cases
- Apply text size scaling (getTextSizeMultiplier) to all new cases
- Ensure color scheme matches (use displayData.backgroundColor and displayData.borderColor)
- Maintain consistency with existing UI design (rounded borders, shadows, orange accents)
- Don't affect host app - changes are only to ExternalDisplayWindow component

### Phase 3: Testing Checklist
- **Keypad/On-the-Spot Mode**: 
  - Timer shows during countdown ✓
  - Answer reveal shows with correct answer and stats ✓
  - Between questions shows waiting UI ✓
- **Nearest Wins Mode**:
  - Target number shows prominently ✓
  - Timer shows during count ✓
  - Results show after reveal ✓
- **Buzz In Mode**:
  - Works same as keypad ✓
- **Text Sizing**:
  - All new cases respect Small/Medium/Large text settings ✓
- **Visual Consistency**:
  - All modes use consistent styling ✓
  - Colored borders show ✓

## Files to Modify
- **src/components/ExternalDisplayWindow.tsx** - Add missing render cases (~line 850-1100 in renderContent switch)

## Key Data Fields Already Available
displayData now receives and stores these fields (confirmed in message handlers):
- correctAnswer, answerRevealed
- targetNumber, results, gameInfo
- fastestTeamData
- questionInfo
- borderColor, backgroundColor (for styling)
- textSize (for scaling)

These fields just need to be consumed by new render cases.

## Why This Approach
- Minimal disruption: only adds missing cases to existing switch statement
- Follows established patterns: reuses styling from 'resultsSummary' and 'fastestTeam'
- Data is already being sent and stored: just needs presentation logic
- Host app unaffected: changes only to isolated external display component
- Fixes all three modes at once: keypad, nearest-wins, buzz-in
