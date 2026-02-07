# Hide Answer Options While Picture is Displayed

## User Request
Fix picture questions on the player device so that answer options (A, B, C, D buttons) are not visible behind the picture. Answer options should:
1. Be hidden while the picture is displaying
2. Appear after the picture is clicked to disappear

## Current Behavior
- Picture questions use a full-screen overlay (`showImageOverlay` state in `QuestionDisplay.tsx`)
- The overlay has z-index 40 and covers the full screen when displayed
- Answer option buttons are always rendered and visible, potentially showing behind/through the picture
- Clicking the picture hides the overlay and reveals the answer options

## Root Cause
Answer option buttons are rendered unconditionally, regardless of whether the image overlay is displayed. They don't have visibility state tied to the overlay.

## Solution Approach
Add CSS-based hiding to the answer option buttons when the image overlay is visible. This will:
- Preserve the DOM layout structure
- Use Tailwind classes to conditionally hide buttons when `showImageOverlay && question?.imageUrl`
- Make buttons invisible with `opacity-0 pointer-events-none` when hidden
- Restore them to full visibility and interactivity when overlay is hidden

## Implementation Plan

### Files to Modify
- **src-player/src/components/QuestionDisplay.tsx** (primary file)

### Changes Needed

1. **Identify all answer option rendering sections** in QuestionDisplay.tsx:
   - Multiple-choice buttons (likely around lines 200-250)
   - Letter grid (isLetters condition)
   - Number keypad (isNumber condition)
   - Sequence options (isSequence condition)
   - Any other answer option UI

2. **Add conditional CSS classes to each answer option container**:
   - Wrap each answer option section with a conditional class
   - When `showImageOverlay && question?.imageUrl`: apply `opacity-0 pointer-events-none`
   - When overlay is hidden: use normal visibility classes

3. **Implementation detail**:
   - Create a variable: `const hideAnswers = showImageOverlay && question?.imageUrl;`
   - Apply to answer containers: `className={`...base-classes... ${hideAnswers ? 'opacity-0 pointer-events-none' : ''}`}`

## Key Files from Exploration
- src-player/src/components/QuestionDisplay.tsx - Main component handling image overlay and answer rendering
- src-player/src/App.tsx - Manages question state and image URL (not modifying, just for context)

## Testing Considerations
- Verify options are invisible while picture displays
- Verify options become interactive after picture is clicked
- Check all question types (multiple-choice, letters, numbers, sequence)
- Ensure clicking the question area to re-show picture still hides the options
- Verify TIMEUP message still clears image (host-side behavior)

## User Preference
Use CSS hiding (opacity/pointer-events) rather than conditional rendering to maintain layout structure.
