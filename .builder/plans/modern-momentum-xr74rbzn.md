# Picture Question Overlay Feature Plan

## Summary
Modify the player app to display picture questions as full-screen clickable overlays that can be toggled by the user. Currently, pictures show as small constrained images above answer options. The new behavior will make pictures immersive while keeping the answer interface accessible.

## Requirements
- Picture displays as full-screen overlay when question loads (taking up main area in front of answer keypad)
- Question text remains visible at the top of the screen
- Clicking anywhere on the picture dismisses the overlay to reveal answer options
- Clicking the question text re-displays the picture overlay
- Players can toggle between viewing the picture and entering answers as many times as they want
- All existing answer submission logic remains unchanged
- Works for all question types: numbers, letters, multiple-choice, sequence

## Key Implementation Details

### Current State
- Picture questions currently render in `src-player/src/components/QuestionDisplay.tsx` lines 359-373
- Images are constrained to 200px width with 2:3 aspect ratio
- Images render as a small box above answer options using object-contain
- No toggle/overlay functionality exists

### Changes Required

#### File: `src-player/src/components/QuestionDisplay.tsx`
1. **Add new state:**
   - `showImageOverlay` (boolean) - tracks whether image overlay should be displayed
   - Initialize to `true` when question has imageUrl
   - Reset to `true` when question changes (useEffect dependency)

2. **Replace the small inline image with:**
   - Remove the current constrained image div (lines 359-373)
   - Add conditional render: if `showImageOverlay` and image exists, show full-screen overlay
   - Keep answer options always rendered below (z-index layering)

3. **Create full-screen image overlay that:**
   - Uses fixed positioning to cover the main question area (above answer keypad)
   - Displays question text at top (unchanged styling)
   - Displays image below question text, scaled to fill available space
   - Uses `object-contain` to preserve aspect ratio while maximizing visible area
   - Has click handler on image div to set `showImageOverlay = false`
   - Z-index places overlay above answer options but below UI chrome

4. **Make question text clickable:**
   - Add click handler to the question text element
   - Clicking sets `showImageOverlay = true` to re-display the overlay
   - Add visual indicator (cursor pointer, slight hover effect) to show it's clickable
   - Only make clickable when image exists and overlay is hidden

5. **Layout structure:**
   - Main flex container (unchanged)
   - Timer bar (unchanged)
   - Content area with:
     - Question text div (make clickable when appropriate)
     - Full-screen image overlay (when `showImageOverlay` is true)
     - Answer options container (always rendered, visible when overlay is hidden)

### Z-Index Strategy
- Answer options container: `z-0` (default)
- Image overlay: `z-40` (above options but below settings/overlays)
- Answer feedback overlay: `z-50` (highest, unchanged)

### Interaction Flow
1. Question loads with image → overlay shows by default
2. Player sees question text + full-screen image
3. Player clicks image → overlay hides, answer options appear
4. Player can click question text to see image again
5. Player submits answer → reveal happens normally (image overlay doesn't interfere)
6. New question arrives → overlay resets to show state

### No Changes Needed To
- Question type detection logic
- Answer submission handlers
- Timer logic
- Answer reveal logic
- App.tsx (display mode already handles picture requests correctly)
- Network types

## Testing Considerations
- Image must be accessible and load properly
- Clicking image should reliably hide overlay
- Clicking question text should reliably show overlay
- Answer submission must work while overlay is hidden
- Answer reveal must not be blocked by overlay state
- All question types must support the feature
- Mobile responsive behavior verified
