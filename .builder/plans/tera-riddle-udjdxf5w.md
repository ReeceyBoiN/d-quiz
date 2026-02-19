# Plan: Add Random Colored Borders to External Display Questions

## Overview
Add visually appealing random colored borders to question containers and option buttons on the external display livescreen. Each new question will get a fresh random border color picked from the app's existing color palette, creating a more polished and visually engaging presentation.

## User Requirements
- Add colored borders around the question container (entire question area with options)
- Add colored borders to individual option buttons
- Use random colors from existing `dynamicColors` array
- Change color for every new question (not per-quiz)
- Apply to all question display modes

## Implementation Strategy

### 1. Modify ExternalDisplayWindow.tsx

**Add state for border color:**
- Add `borderColor: string` to the `displayData` state (initialize to a random color)
- When `DISPLAY_UPDATE` message is received with question data, pick a new random color from `dynamicColors` array

**Add color selection logic:**
- Create helper function `getRandomBorderColor()` that picks from `dynamicColors` array
- Call this function when mode changes to a question-related mode (question-with-timer, timer, question, resultsSummary, etc.)

**Update styling in all question-related cases:**
- `case 'question-with-timer'` / `'timer-with-question'`: 
  - Change option border color from hardcoded `'#f97316'` to `displayData.borderColor`
  - Add border around the main question container (left section) using `displayData.borderColor`
  
- `case 'timer'`:
  - Add border color to question header if present
  
- `case 'question'`:
  - Change option button borders to use `displayData.borderColor`
  - Add border around question container
  
- `case 'resultsSummary'`:
  - Apply border color to the summary cards (Correct/Incorrect/No Answer boxes)

### 2. Key Implementation Details

**Color source:**
- Use existing `dynamicColors` array already defined in the component (lines ~72-77):
  ```javascript
  const dynamicColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
    // ... more colors
  ];
  ```

**When to pick new color:**
- Pick new color whenever a new question arrives (check if `event.data.mode` changes to a question display mode)
- Specifically check for mode transitions that indicate a new question: `question-with-timer`, `timer`, `question`, `resultsSummary`

**Border styling:**
- Keep existing border width and radius (2-3px border, 8-12px border-radius)
- Simply replace the color value with the dynamic border color

### 3. Files to Modify
- **src/components/ExternalDisplayWindow.tsx** (primary file)
  - Add borderColor to displayData state
  - Add helper function getRandomBorderColor()
  - Update color selection logic in message handlers
  - Update inline styles in all question rendering cases

### 4. Visual Impact
- Current state: Orange (#f97316) borders on all questions
- New state: Vibrant random color borders that change with each question
- Same border thickness and styling, just dynamic colors
- Creates visual distinction and makes the display more dynamic

### 5. Compatibility & Safety
- No changes to QuizHost.tsx (no new data needs to be sent)
- No changes to Settings.tsx
- No impact on host app rendering (only affects external display)
- Uses existing color palette (no new colors introduced)
- Respects existing textSize scaling (colors are independent)

### 6. Testing Considerations
- Verify border color changes when advancing to next question
- Verify color applies to both question container and option buttons
- Verify works with all question display modes
- Verify works with different screen sizes (responsive)
- Verify works with different text size settings (Small/Medium/Large)

## Rationale
This enhancement makes the external display more visually engaging and easier to follow during a quiz. The random colors help signal question transitions and add visual interest without changing the layout or affecting readability. Using the existing color palette maintains consistency with the app's design language.
