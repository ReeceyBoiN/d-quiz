# Fix: Show selected buzzer name in Team Buzzer Sound dropdown

## Problem
In `TeamWindow.tsx`, the "Team Buzzer Sound" dropdown appears blank even when a buzzer is selected. The host has to click the dropdown to see which buzzer is assigned.

## Root Cause
The `SelectValue` component on line 585 of `TeamWindow.tsx` only has a `placeholder` prop but no child content to display the selected value. The working version in `BuzzersManagement.tsx` (line 414-416) explicitly renders the normalized buzzer name as a child of `SelectValue`.

## Fix
**File: `src/components/TeamWindow.tsx` (line 585)**

Change:
```tsx
<SelectValue placeholder={loadingBuzzers ? "Loading buzzers..." : "Select buzzer sound"} />
```

To:
```tsx
<SelectValue placeholder={loadingBuzzers ? "Loading buzzers..." : "Select buzzer sound"}>
  {team.buzzerSound ? getNormalizedBuzzerName(team.buzzerSound) : undefined}
</SelectValue>
```

This mirrors exactly what `BuzzersManagement.tsx` does, ensuring the selected buzzer's name is always visible in the dropdown trigger without needing to click it.

## Files Modified
- `src/components/TeamWindow.tsx` — 1 line change (line 585)
