# Fix Teams Not Displaying in Wheel Spinner

## Problem Identified

Teams are not showing in the wheel spinner's "Teams" content type because of a **prop name mismatch**:

- **QuizHost.tsx** passes: `teams={quizzes}` 
- **WheelSpinnerInterface.tsx** expects: `quizzes` prop

This causes the WheelSpinnerInterface to receive `undefined` for the quizzes prop, resulting in an empty wheel items list.

### Evidence
- QuizHost render call (line ~4426): `<WheelSpinnerInterface teams={quizzes} ... />`
- WheelSpinnerInterface prop interface: expects `quizzes: Quiz[]`
- The useEffect that generates wheelItems depends on `quizzes` prop, which is undefined
- Result: `wheelItems` array remains empty, no teams display

## Root Cause Analysis

Looking at other components in the codebase (NearestWinsInterface, BuzzInInterface, FastestTeamDisplay), they all use the standard pattern:
```typescript
teams={quizzes}
```

However, WheelSpinnerInterface uniquely expects the prop to be named `quizzes`, creating an inconsistency.

This inconsistency likely came from the component being created with a different naming convention than the rest of the components.

## Recommended Solution

**Update WheelSpinnerInterface to accept the `teams` prop** (consistent with other game mode components):

### Changes Required

**File: src/components/WheelSpinnerInterface.tsx**

1. Update the prop interface to accept `teams` instead of `quizzes`:
   ```typescript
   interface WheelSpinnerInterfaceProps {
     teams: Quiz[];  // Changed from 'quizzes'
     onBack: () => void;
     onHome: () => void;
     onAwardPoints?: ...
     externalWindow?: Window | null;
     onExternalDisplayUpdate?: ...
   }
   ```

2. Update the function parameter and all references from `quizzes` to `teams`:
   - Function parameter: `{ teams = [], ... }`
   - Replace all `quizzes` references with `teams` throughout the component
   - Update the Select display label: `Teams ({teams.length} teams)`
   - Update the useEffect dependency: `[contentType, teams, ...]`

### Why This Approach

1. **Consistency**: Aligns WheelSpinnerInterface with other game mode components (NearestWinsInterface, BuzzInInterface, etc.)
2. **No breaking changes to QuizHost**: QuizHost already passes `teams={quizzes}` - no changes needed there
3. **Minimal scope**: Only changes WheelSpinnerInterface, lower risk of side effects
4. **Maintainability**: Future developers will see consistent prop naming across all game modes

## Verification Checklist

After implementation:
- [ ] Teams appear in the wheel spinner's "Teams" content type
- [ ] Wheel displays correct number of team segments
- [ ] Team names appear correctly on wheel segments
- [ ] Spin functionality works with teams
- [ ] External display shows teams correctly
- [ ] No console errors or warnings
- [ ] SelectItem component renders without React.Children.only errors

## Impact Assessment

- **Impact Level**: Low
- **Files Modified**: 1 file (WheelSpinnerInterface.tsx)
- **Components Affected**: Only WheelSpinnerInterface
- **Breaking Changes**: None (prop naming is internal to component)
- **Backward Compatibility**: Not needed (internal component change)

## Note on Recent Changes

The recent changes to `src/components/ui/select.tsx` (removing SelectPrimitive.ItemText asChild) are unrelated to this issue and should not affect team display. The select component fix addresses the React.Children.only error that was appearing in the console.
