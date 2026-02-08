# Fix Black Screen on Picture Question in External Display

## Problem
When a picture question is sent to the external display by clicking "Send picture", the external display shows a black screen instead of displaying the picture. The picture should display on the right side with empty space on the left, maintaining the same layout position as when the question text is later revealed.

## Root Cause
- QuizHost sends `mode: 'picture'` to ExternalDisplayWindow
- ExternalDisplayWindow.tsx has **no handler/case for `mode: 'picture'`**, so it renders nothing (appears black)
- ExternalDisplayWindow only handles modes like 'question-with-timer', 'timer-with-question', etc.

## Solution Approach
Add a 'picture' rendering case to ExternalDisplayWindow.tsx that:
1. Recognizes `displayData.mode === 'picture'`
2. Renders a two-column layout matching the question-with-timer layout:
   - Left side: empty (blank space where question text will appear later)
   - Right side: displays the image from `displayData.data.imageDataUrl`
3. Maintains the same positioning and dimensions as the 'question-with-timer' mode so the image doesn't move when the question is revealed

## Implementation Steps

### Step 1: Read ExternalDisplayWindow.tsx
- Understand the current layout structure for 'question-with-timer' mode
- Identify CSS classes, spacing, and image rendering code
- Note how `displayData.data.imageDataUrl` is used

### Step 2: Add 'picture' rendering case
- Add a new conditional branch in the render method to handle `displayData.mode === 'picture'`
- Replicate the two-column layout from 'question-with-timer' but:
  - Leave left column empty
  - Only render the image in the right column
- Use same styling and spacing to ensure image doesn't shift position when question appears

### Step 3: Verify flow works end-to-end
- Test that "Send picture" now shows the picture (not black screen)
- Test that clicking "Send question" adds question text on the left while image stays on the right
- Ensure layout is consistent between picture-only and question+picture states

## Key Files to Modify
- `src/components/ExternalDisplayWindow.tsx` - Add 'picture' rendering case

## Key Files to Reference (read-only)
- `src/components/QuizHost.tsx` - Shows how sendToExternalDisplay is called with mode: 'picture'
- `src/state/flowState.ts` - Flow state constants

## Expected Outcome
- External display shows picture correctly when "Send picture" is clicked (not black screen)
- Picture appears in the right column where it will remain when question is added
- Question text can be added to the left column without image moving
