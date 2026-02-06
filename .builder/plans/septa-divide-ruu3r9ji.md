# Remove Question Text from Image Overlay - Plan

## Problem
The question text is displayed in two locations simultaneously:
1. Main area (above answer inputs)
2. Image overlay (at the top when image is shown)

This causes overlapping/duplicate text that looks cluttered and confusing.

## Solution
Remove the question text section from the image overlay (lines 435-448 in QuestionDisplay.tsx), keeping only:
- The image container/image itself
- Clean full-screen display when user clicks on picture

## Changes Required

### File: `src-player/src/components/QuestionDisplay.tsx`

**Current state (lines 429-465):**
- Image overlay div contains question text div (lines 435-448) + image container (lines 450-463)

**Required change:**
- Remove the entire question text div (lines 435-448)
- Keep only the image container
- This leaves a cleaner, full-screen image display without duplicate text

**Affected section:**
- Remove lines 435-448 (the "Question text at top of overlay" section)
- Keep lines 450-463 (the image container)
- Adjust the layout spacing accordingly

## Expected Outcome
When user clicks on a picture:
- Only the image displays in full-screen overlay
- No duplicate/overlapping question text
- Question text remains visible in the main area below (for context)
- Much cleaner visual presentation
