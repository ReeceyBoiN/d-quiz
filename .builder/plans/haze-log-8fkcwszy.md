# Buzzer Dropdown Display Fix - Plan

## Problem
The buzzer dropdown boxes in BuzzersManagement and TeamWindow components are showing blank with no options visible, even though:
- The API is successfully loading buzzers (console logs confirm data.buzzers arrays are populated)
- The buzzerSounds state is being set correctly
- The SelectItems are being rendered in the dropdown

## Root Cause
The issue is with how `SelectValue` component is being used in both files. Currently, both components pass custom children to `SelectValue`:

```jsx
<SelectValue placeholder="...">
  {team.buzzerSound ? getNormalizedBuzzerName(team.buzzerSound) : undefined}
</SelectValue>
```

**Why this breaks**: In Radix UI Select, passing children to `SelectValue` overrides the default automatic display mechanism that shows the selected SelectItem's text. When the children are undefined or don't update properly, the trigger appears blank. This is a common Radix Select pitfall.

## Solution
Remove custom children from `SelectValue` and let Radix automatically display the selected item's text. Since each SelectItem already contains the normalized name in its children, Radix will automatically show that when selected.

### Files to Fix
1. **src/components/BuzzersManagement.tsx**
   - Line ~258: Remove children from SelectValue
   - Change from: `<SelectValue placeholder="..."> {team.buzzerSound ? getNormalizedBuzzerName(...) : undefined} </SelectValue>`
   - Change to: `<SelectValue placeholder="..." />`

2. **src/components/TeamWindow.tsx**
   - Line ~599: Remove children from SelectValue
   - Same change pattern as above

### Expected Result
- Dropdown trigger will now show "Select buzzer sound" placeholder when no buzzer selected
- When a buzzer is selected, the trigger will automatically display the normalized buzzer name from the selected SelectItem
- Clicking the dropdown will show all available buzzers with normalized names and checkmarks for selection
- The visual indicator (✓) will appear for currently selected buzzer
- Greyed-out buzzers will still show for taken selections (in TeamWindow)

### Implementation Steps
1. Remove children prop and content from SelectValue in BuzzersManagement.tsx
2. Remove children prop and content from SelectValue in TeamWindow.tsx
3. Verify buzzer lists load and display correctly in both components
4. Confirm selection updates display without custom normalization logic in SelectValue

### Verification
- Open BuzzersManagement tab → dropdown should show all buzzers with normalized names
- Double-click a team → TeamWindow should show that team's selected buzzer in dropdown
- Click dropdown → should see full list of available buzzers
- Select a different buzzer → display should update immediately
