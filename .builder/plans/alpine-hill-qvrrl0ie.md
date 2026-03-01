# Buzzer Dropdown Display Issue - Fix Plan

## Issue
The buzzer dropdown in the Buzzer Management tab displays a blank value when a buzzer is selected for a team, even though a buzzer is attached to the team.

## Root Cause Identified
In `BuzzersManagement.tsx` (lines 414-416), the `SelectValue` component is used without custom content:
```jsx
<SelectValue placeholder={loadingBuzzers ? "Loading..." : "Select buzzer sound"} />
```

The problem is that:
1. The `SelectValue` displays the raw `value` from the Select (the filename with `.mp3` extension)
2. The dropdown options display the `normalizedName` (without `.mp3` extension) for better readability
3. This mismatch makes it appear blank or look different from what's in the dropdown

## Solution
Modify the `SelectValue` to display the normalized buzzer name when a buzzer is selected:
- If `team.buzzerSound` is set, display the normalized name (without .mp3 extension)
- If `team.buzzerSound` is empty/null, show the placeholder

## Implementation Details
**File to modify:** `src/components/BuzzersManagement.tsx`

**Change:** Replace lines 414-416 with custom `SelectValue` content that:
1. Checks if `team.buzzerSound` exists
2. If yes: find the matching buzzer name and display the normalized version
3. If no: show the placeholder

Example approach:
```jsx
<SelectValue>
  {team.buzzerSound ? getNormalizedBuzzerName(team.buzzerSound) : (loadingBuzzers ? "Loading..." : "Select buzzer sound")}
</SelectValue>
```

## Why This Works
- The dropdown options already use `normalizedName` for display
- Making the selected value display the same normalized name ensures consistency
- Users will see the same readable format whether the dropdown is open or closed
- The underlying `value` remains the full filename for proper matching and storage

## Files to Modify
- `src/components/BuzzersManagement.tsx` - Update SelectValue content (lines 414-416)
