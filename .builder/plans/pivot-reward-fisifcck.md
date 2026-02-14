# Buzzer Selection Display Fix - Implementation Plan

## Problem
The buzzer dropdowns in BuzzersManagement and TeamWindow components show completely empty when clicked, even though:
- Buzzers are successfully loaded from the API (confirmed: "Loaded buzzers: Array(68)")
- The buzzerSounds state is populated
- SelectItems should be rendering in the map function

## Root Cause
The SelectItem components have complex nested structure with a wrapping `<div>` and conditional rendering inside:

```jsx
<SelectItem key={sound} value={sound}>
  <div className="flex items-center gap-2">
    {isSelected && <span className="text-green-500">✓</span>}
    {normalizedName}
  </div>
</SelectItem>
```

Radix UI's SelectItem expects children to be simple text or basic elements. A wrapping div with conditional rendering prevents Radix from properly rendering the items in the SelectContent dropdown.

## Solution
Remove the wrapping div and structure the SelectItem children as simple text/elements that Radix can render properly:

### BuzzersManagement.tsx Changes
- Change SelectItem children from complex div structure to simple text
- Keep the checkmark indicator but render it directly without wrapper div
- Structure: `{isSelected && <span>✓</span>}{normalizedName}`

### TeamWindow.tsx Changes  
- Change SelectItem children from complex span structure to simple text
- Keep the visual indicators but simplify nesting
- Remove unnecessary conditional className wrapper
- Structure: `{isSelected && <span>✓</span>}{normalizedName}{taken indicator if needed}`

## Implementation Files
1. **src/components/BuzzersManagement.tsx** - Lines 272-283 (SelectItem)
2. **src/components/TeamWindow.tsx** - Lines 607-617 (SelectItem)

## Success Criteria
1. Dropdown opens and shows all available buzzers from the API
2. Selected buzzer has a checkmark indicator
3. Selected buzzer name displays in the dropdown trigger
4. Users can select and change buzzers
5. Works correctly in both BuzzersManagement tab and TeamWindow
