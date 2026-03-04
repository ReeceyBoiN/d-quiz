## Goal
Ensure the top navigation bar fits on 13" screens without cutting off the right-side login/status text, while keeping the full labels visible.

## Recommended approach
1. **Tighten layout widths on small screens**
   - Reduce padding/gaps further on the top bar for `md`/`sm` sizes.
   - Shrink fixed-width controls on the left (DisplayModeToggle and Player devices buttons) at smaller breakpoints to free horizontal space.
   - Slightly reduce the title size and hide the version line on small widths to reclaim space without removing the title.

2. **Allow right-side text to wrap instead of clipping**
   - Override the Button defaults for the right-side controls to allow wrapping/breaking:
     - Add `whitespace-normal` and `break-words` (or `break-all` for the login label) on the network/login text containers.
     - Keep `min-w-0` and `shrink` on the right-side buttons so they can contract without forcing overflow.
   - Ensure the right-side container has `min-w-0` so the child text wrapping is honored.

3. **Verify alignment on 13" screens**
   - Confirm the right-side login label is fully visible (even if it wraps) and the bar stays visually balanced.
   - Check that larger screens remain unchanged (spacing restored with breakpoints).

## Files to modify
- `src/components/TopNavigation.tsx`
  - Adjust small-screen spacing and title sizing.
  - Add wrapping/breaking classes to the network and login label containers.
  - Reduce widths of the left-side toggle/button controls at smaller breakpoints.
- `src/components/DisplayModeToggle.tsx` (if needed)
  - Add responsive width adjustments for its buttons on small screens.

## Notes
- Button defaults include `whitespace-nowrap` and `shrink-0`; the plan explicitly overrides these in TopNavigation for the right-side buttons so the full label can wrap instead of being cut off.
