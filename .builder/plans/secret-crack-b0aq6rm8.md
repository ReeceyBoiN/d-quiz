# Team Picture Full-Screen Display Plan

## User Request
Update the team picture display on player devices to:
- Take up nearly the full screen (no longer small and circular)
- Remove the circular crop - display the full picture scaled to fit
- Show team name on top/in front of the picture

## Current Implementation
**File**: `src-player/src/components/FastestTeamOverlay.tsx`

Current layout:
- Full-screen dark overlay (`fixed inset-0 bg-black/50`)
- Centered flex column with gap-6
- Small circular image (`w-40 h-40 sm:w-48 sm:h-48 rounded-full` with `rounded-full overflow-hidden`)
- Team name displayed below image
- Yellow border and decorative elements ("⚡ FASTEST TEAM ⚡" label)

## Planned Changes
**File to Modify**: `src-player/src/components/FastestTeamOverlay.tsx`

### Key Changes:
1. **Remove circular styling and make image full-screen:**
   - Remove `rounded-full` class from the image container
   - Change dimensions from `w-40 h-40 sm:w-48 sm:h-48` to nearly fill the screen (e.g., `w-screen h-screen`)
   - Adjust the container layout to use full screen dimensions

2. **Reposition team name:**
   - Change from absolute positioning below image to positioned on top/in front
   - Use absolute positioning with appropriate z-index to layer over the image
   - Center the text horizontally and position it at the top or center of the screen
   - Keep good contrast (white text with drop-shadow for readability)

3. **Update styling:**
   - Simplify the flex layout to accommodate full-screen image
   - Remove the decorative yellow border and ring (or make optional)
   - Adjust loading spinner styling for full-screen container
   - Keep the fade-in animation effects

4. **Fallback handling:**
   - Update the fallback trophy emoji display to fill the full screen
   - Ensure it maintains aspect ratio and doesn't look distorted

## Implementation Details
- **Image scaling**: Use `object-contain` so the entire image is visible (no cropping), with black bars if needed to maintain aspect ratio
- **Team name positioning**: Absolutely positioned, centered both horizontally and vertically over the image
- **Styling simplifications**:
  - Remove yellow border (`border-4 border-yellow-400`)
  - Remove yellow ring overlay
  - Remove the "⚡ FASTEST TEAM ⚡" label
  - Keep only the team name text with good contrast (white text with drop-shadow)
- **Layout**: Change from flex column to a single full-screen image container with the team name overlaid absolutely
- **Background**: Keep the semi-transparent dark background (`bg-black/50`) to ensure readability
- **Responsive**: Maintain responsive behavior for different screen sizes

## Dependencies
- No new dependencies needed
- Only modifying existing component styling and layout
- The image loading logic and error handling remain the same

## Validation
After changes:
- Verify image displays full-screen on different screen sizes
- Confirm team name is readable when overlaid on the image
- Test with various team photos to ensure good visibility
- Ensure no visual bugs with the circular loading spinner (will need adjustment for full-screen)
