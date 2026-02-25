# Fix Host Remote A-D Button Display Issue

## Problem
When clicking the KEYPAD button in on-the-spot mode, the host remote immediately shows A-D multiple-choice buttons instead of showing the QuestionTypeSelector screen where the user should pick a question type first (Letters, Numbers, Multiple Choice, or Sequence).

## Root Cause
The flow state logic isn't properly distinguishing between:
1. **Idle/Selection State**: User hasn't selected a question type yet → should show QuestionTypeSelector
2. **Active State**: User has selected a question type AND a question is loaded → should show HostRemoteKeypad with appropriate buttons

Currently, when you click KEYPAD, the app enters game flow but without a selected question type, causing it to fall back to showing default A-D buttons instead of the type selector.

## Solution Approach

The fix is in `HostTerminal.tsx` to properly handle the case where:
- User is in on-the-spot mode
- User has clicked KEYPAD (entering a game flow)
- BUT no question type has been selected yet
- AND no actual question is loaded

In this state, show a message card saying "No quizpack or question loaded" instead of showing the keypad buttons.

## Key Files to Modify
1. **src-player/src/components/HostTerminal/index.tsx**
   - Update logic to check if we're in game flow but lacking both:
     - A selected question type, AND
     - An actual loaded question with content
   - When both are missing, render an info card with message instead of the keypad

## Implementation Details

### Changes to HostTerminal.tsx:
1. Modify the section that renders the answer keypad (around line 100)
2. Add condition: Check if `flowState?.selectedQuestionType` AND `flowState?.currentQuestion` both exist
3. If either is missing while in game flow, show info card instead
4. Card should display: "No quizpack or question loaded"
5. Use similar styling to existing status message cards in the codebase

### Result:
- Click KEYPAD button → shows message card
- Select question type → still shows message card (waiting for question)
- Question sent/loaded → keypad appears with proper buttons for that type

## Style/Presentation
- Info box/card format (like existing status cards)
- Centered in the keypad area
- Clear message: "No quizpack or question loaded"
- Optional: Add icon or suggest next action
