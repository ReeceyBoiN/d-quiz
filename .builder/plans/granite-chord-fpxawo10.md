# Fix React.Children.only Error in SelectItem

## Problem Summary
When clicking on a team in TeamWindow, the app crashes with:
```
Error: React.Children.only expected to receive a single React element child.
```

This happens right after buzzers are successfully loaded (68 items).

### Root Cause Analysis
In `src/components/ui/select.tsx`, the SelectItem uses:
```jsx
<SelectPrimitive.ItemText asChild>{children}</SelectPrimitive.ItemText>
```

The `asChild` prop requires exactly ONE child element. But BuzzersManagement and TeamWindow pass multiple:
```jsx
<SelectItem>
  {isSelected && <span className="text-green-500">✓ </span>}     // Child 1 (when true)
  {normalizedName}                                              // Child 2 (text)
</SelectItem>
```

When `isSelected` is true, 2 children are passed, causing the crash.

## Solution: Wrap Content in Single Element

Update SelectItem children in both components to wrap checkmark + text in a single span:

**BuzzersManagement.tsx:**
```jsx
<SelectItem key={sound} value={sound}>
  <span>
    {isSelected && <span className="text-green-500">✓ </span>}
    {normalizedName}
  </span>
</SelectItem>
```

**TeamWindow.tsx:**
```jsx
<SelectItem key={sound} value={sound} disabled={taken}>
  <span>
    {isSelected && <span className="text-green-500">✓ </span>}
    {normalizedName}
    {taken && teamWithBuzzer ? ` (${teamWithBuzzer.name})` : ""}
  </span>
</SelectItem>
```

## Files to Modify
1. `src/components/BuzzersManagement.tsx` - Wrap SelectItem content in span
2. `src/components/TeamWindow.tsx` - Wrap SelectItem content in span

## Expected Outcome
- SelectItem renders single child element
- React.Children.only error is resolved
- Team can be clicked and TeamWindow opens without crashing
- Checkmark and text both display correctly
