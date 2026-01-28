# Fix FastestTeamDisplay Not Showing in Quiz Pack Mode

## Comparison: Keypad Mode vs Quiz Pack Mode

### Keypad Mode (WORKS) - Lines 3809-3868
```jsx
<div className="flex-1 relative min-h-0">
  <div className="flex-1 overflow-hidden">
    <KeypadInterface ... />
  </div>
  {showFastestTeamDisplay && (
    <div className="absolute inset-0 flex-1 overflow-hidden z-50">
      <FastestTeamDisplay ... />
    </div>
  )}
</div>
```

**Parent container**: `flex-1 relative min-h-0`
- `relative` = positioning context for absolute child
- `min-h-0` = allows child to shrink below content size
- `flex-1` = grows to fill available space

### Quiz Pack Mode (BROKEN) - Lines 3774-3804
```jsx
<div className="flex-1 overflow-hidden flex flex-col relative">
  <QuestionPanel ... />
  {showFastestTeamDisplay && (
    <div className="absolute inset-0 flex-1 overflow-hidden z-50">
      <FastestTeamDisplay ... />
    </div>
  )}
</div>
```

**Parent container**: `flex-1 overflow-hidden flex flex-col relative`
- `relative` = positioning context for absolute child
- `flex flex-col` = column flexbox (might affect overlay)
- `overflow-hidden` = clips content

## Key Difference Identified

The keypad parent has `min-h-0` which is critical for flex containers to properly constrain heights of absolutely positioned children. The quiz pack parent is missing this.

However, the more likely issue: **The overlay div still has `flex-1` combined with `absolute inset-0`** which causes CSS conflicts. This creates an invalid flex item that can't render properly.

## Two Possible Solutions

### Option A: Fix the CSS Classes (Simpler)
Remove `flex-1` from the overlay div in BOTH modes since `absolute inset-0` already fills the parent:
- Line 3790: Change `className="absolute inset-0 flex-1 overflow-hidden z-50"` → `className="absolute inset-0 overflow-hidden z-50"`
- Line 3854: Change same thing for keypad mode

### Option B: Match Keypad Structure Exactly (More Aligned)
Restructure quiz pack rendering to match keypad pattern:
```jsx
<div className="flex-1 relative min-h-0">
  <div className="flex-1 overflow-hidden flex flex-col">
    <QuestionPanel ... />
  </div>
  {showFastestTeamDisplay && (
    <div className="absolute inset-0 overflow-hidden z-50">
      <FastestTeamDisplay ... />
    </div>
  )}
</div>
```

## Final Implementation Plan (User Confirmed)

**Approach**: Restructure quiz pack rendering to exactly match keypad pattern

### Change 1: Quiz Pack Parent Container (Line 3778)
**Current**:
```jsx
<div className="flex-1 overflow-hidden flex flex-col relative">
```

**Change to**:
```jsx
<div className="flex-1 relative min-h-0">
```

### Change 2: Wrap QuestionPanel in Flex Container (After line 3778)
**Current**:
```jsx
<QuestionPanel ... />
{showFastestTeamDisplay && ...}
```

**Change to**:
```jsx
<div className="flex-1 overflow-hidden flex flex-col">
  <QuestionPanel ... />
</div>
{showFastestTeamDisplay && ...}
```

### Change 3: Fix Overlay CSS (Line 3790)
**Current**:
```jsx
<div className="absolute inset-0 flex-1 overflow-hidden z-50">
```

**Change to**:
```jsx
<div className="absolute inset-0 overflow-hidden z-50">
```

### Why This Works
- Parent with `relative min-h-0` creates proper positioning context
- `min-h-0` allows absolutely positioned child to constrain properly
- Removing `flex-1` from overlay eliminates CSS conflicts
- Matches proven keypad pattern that already works
- Overlay covers center area only, respects nav/team panels

## Files to Modify
- `src/components/QuizHost.tsx` - lines 3774-3802 (quiz pack rendering section)

## Expected Result
FastestTeamDisplay will show properly in quiz pack mode with:
- Full team information visible (name, photo, grid, stats)
- Proper positioning in center area only
- No overlap with navigation or team panels
- Full functionality (drag, controls, etc.)
