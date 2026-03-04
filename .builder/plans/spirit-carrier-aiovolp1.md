## Goal
Ensure the top navigation bar fits on smaller 13" screens without cutting off the account/login area, while still looking clean on larger displays.

## Recommended approach
1. **Tighten top-nav spacing on smaller widths**
   - In `src/components/TopNavigation.tsx`, reduce gaps and horizontal padding at small breakpoints so the right-side account area stays visible (e.g., `gap-2 sm:gap-1`, `px-4 sm:px-2`, or more targeted padding on the right button group).
   - Apply the spacing changes only at smaller breakpoints so the layout remains roomy on larger screens.

2. **Add a safety fallback if needed**
   - If spacing alone still risks overflow, selectively truncate label text (e.g., login status) with `truncate max-w-[...]` on smaller sizes while keeping icons visible.

3. **Verify layout alignment**
   - Confirm the right-side status group stays aligned and the title still looks centered.
   - Check the 13" width and larger screens to ensure spacing restores and the layout looks balanced.

## Files to modify
- `src/components/TopNavigation.tsx` — add responsive visibility/truncation classes for the network status and login labels.

## Notes
- The cut-off is likely caused by button content using `whitespace-nowrap` and `shrink-0` (from `src/components/ui/button.tsx`). The plan avoids changing the global button style and instead adjusts just the top navigation labels for a safer, targeted fix.
