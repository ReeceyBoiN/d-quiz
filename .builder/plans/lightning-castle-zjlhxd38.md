# Plan: Compact Vertically-Centered Question Bubble

## User Request
Make the question bubble on the external display more compact vertically so it doesn't stretch and waste space at the bottom. The bubble should have comfortable internal spacing while remaining vertically centered on the screen with a fixed maximum width.

## Current Issue
- Question bubble stretches to fill available vertical space (using `flex: 1`)
- Results in wasted empty space at the bottom of the screen
- Bubble is centered but too tall/spread out

## Solution Approach
Modify `src/components/ExternalDisplayWindow.tsx` in the `question-with-timer` mode:

### Key Changes:
1. **Inner question container (the dark bubble):**
   - Remove `flex: displayData.data?.imageDataUrl ? '0 1 50%' : '1'`
   - Change to `flex: displayData.data?.imageDataUrl ? '0 1 50%' : '0 0 auto'`
   - This makes the bubble size based on content, not stretching to fill space
   - Add `maxWidth: 600px` or similar to constrain bubble width
   - Keep `justifyContent: 'center'` for content vertical centering within bubble

2. **Outer main content area:**
   - Keep flex layout with `alignItems: hasImage ? 'stretch' : 'center'`
   - This centers the compact bubble vertically on screen while image areas stretch if present

3. **Padding:**
   - Keep comfortable padding inside bubble (16px as is)
   - Maintain options grid gap spacing

### Result:
- Bubble wraps tightly around question + options content
- Bubble remains vertically centered on screen
- No wasted space at bottom
- Fixed max-width prevents bubble from getting too wide
- Works with all text sizes (Small/Medium/Large)
- No impact on host app or other display modes

## Files to Modify
- **Only:** `src/components/ExternalDisplayWindow.tsx` - question-with-timer section (~line 497)
