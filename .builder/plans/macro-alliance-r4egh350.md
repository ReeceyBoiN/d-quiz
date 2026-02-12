# Fix: Settings Close Button Visual Size

## Problem
The Settings close button (X) appears too small and is difficult to interact with. The button is currently using `size="sm"` which results in:
- Height: h-8 (32px)
- Padding: px-3 (very minimal)
- Font size: text-sm (small)

The inspect element shows very tight spacing with only 0px-10px padding, making the button feel cramped and hard to target.

## Root Cause
The button is styled with `size="sm"` variant in Settings.tsx:1506, which is designed for compact UI elements. However, for a header close button, users expect a larger visual target.

## Recommended Solution
Increase the button from `size="sm"` to `size="default"` which provides:
- Height: h-9 (36px) - slightly taller for better visibility
- Padding: px-4 (more spacious)
- Better proportions for a header control button
- Maintains design consistency without being too large

This is a sensible middle-ground increase that improves usability without making the button overly prominent in the header.

## Files to Modify
- **src/components/Settings.tsx** (line 1506)
  - Change from: `size="sm"`
  - Change to: `size="default"`
  - Keep the existing className with the hitbox expansion: `className="text-muted-foreground hover:text-foreground relative after:absolute after:-inset-2 md:after:hidden"`

## Test Cases
1. Visual inspection - verify the close button is noticeably larger and more prominent
2. Click the close button - should be easier to target and hit
3. Verify styling remains consistent with the Settings header design
4. Check on different screen sizes that the button looks proportional
