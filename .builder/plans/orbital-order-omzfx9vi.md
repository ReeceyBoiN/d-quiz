# Fix Team Photo Display on Fastest Team Screen

## Problem
The team photo displayed on the fastest team screen covers most of the page. Currently, the image uses `object-cover` which scales the photo to completely fill and often crop it, making it appear zoomed-in especially for portrait photos. This blocks access to other UI elements.

## Root Cause
In `src/components/FastestTeamDisplay.tsx` (lines ~161-174), the team photo is rendered with:
```
className="w-full h-full object-cover"
```
This fills the entire container and aggressively scales the image, often zooming it beyond what's necessary.

## Solution Approach
Add a constrained placeholder box with a maximum size for the team photo instead of letting it fill the full screen. The photo will scale proportionally within this box.

**Location to modify:** `src/components/FastestTeamDisplay.tsx`

**Change needed:** Replace the image container styling to:
1. Add a max-width and max-height constraint (suggested: ~400-500px)
2. Center the image container within the left panel area
3. Change from `object-cover` to `object-contain` so the full image is visible without cropping
4. Add padding/margin to ensure other UI elements remain accessible

## Implementation Details
**User selected:** Small (400px) maximum size

- Wrap the image in a constrained div container with:
  - `max-width: 400px`
  - `max-height: 400px`
  - `margin: auto` (to center it)
  - Apply `object-contain` to the image instead of `object-cover`
  - This ensures the photo scales proportionally and fits entirely within the box
- This matches the pattern already used in `FastestTeamOverlaySimplified.tsx` (external display version which uses 350px)

## Files to Modify
- `src/components/FastestTeamDisplay.tsx` — Update the image container and image styling

## Expected Outcome
- Team photo displays in a smaller, centered box (not full-screen)
- Photo scales proportionally without being cropped
- Other UI elements on the fastest team screen remain visible and accessible
- Consistent with the external display version which already uses size constraints
