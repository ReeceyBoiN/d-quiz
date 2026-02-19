# Plan: Fix External Display Question Width in Quiz Pack Mode

## Problem
In quiz pack mode on the external display, the question content appears squished vertically with noticeable empty space on the sides. The question bubble should be wider to better match the visual balance of the results page layout.

## Current State
- **File**: `src/components/ExternalDisplayWindow.tsx`
- **Case**: `'question'` case (lines 744-801)
- **Width Constraint**: Currently uses `maxWidth: '1200px'` wrapper (line 748)
- **Parent Container**: Results page also uses similar 1200px constraint but appears better proportioned

## Root Cause
The question content wrapper may need to be wider than the current `1200px` to better utilize available horizontal space and reduce the visual appearance of vertical squishing. The results page already has good proportions, so we should match or exceed that width.

## Recommended Solution

### Approach
Increase the maximum width of the question content wrapper from `1200px` to `1400px` to provide more horizontal spread and better match the visual balance of the results page.

### Changes Required
- **File**: `src/components/ExternalDisplayWindow.tsx`
- **Line 748**: Change `maxWidth: '1200px'` to `maxWidth: '1400px'`

This will:
- Spread question content wider horizontally
- Reduce the vertical height perception of the question bubble
- Better balance the layout similar to results page appearance
- Maintain responsive behavior

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (line 748)

## Testing Checklist
- [ ] Quiz pack mode questions display with improved width utilization
- [ ] Question appearance is balanced and not overly stretched
- [ ] No regressions in other game modes
- [ ] Results page and question page widths are now consistent
- [ ] Responsive on different screen widths
