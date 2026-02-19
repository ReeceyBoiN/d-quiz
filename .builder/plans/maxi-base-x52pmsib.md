# Plan: Fix External Display Stats Visibility

## Problem Statement
Stats (Correct/Incorrect/No Answer counts) are being displayed at the wrong times:
1. In keypad/on-the-spot mode: Stats show before "Reveal Answer" is clicked
2. In nearest wins mode: Stats are shown when they shouldn't be displayed at all

## Root Cause Analysis
- The 'correctAnswer' case in ExternalDisplayWindow renders stats unconditionally
- Need to check the `revealed` flag from KeypadInterface to determine when to show stats
- 'nearest-wins-results' should show placement results (closest, 2nd, 3rd), NOT the correct/incorrect/no-answer stats

## Solution Approach

### Phase 1: Update 'correctAnswer' Render Case - Conditional Stats Display
**File**: `src/components/ExternalDisplayWindow.tsx`

**Current Behavior**:
- Shows "Correct Answer" header and the answer ✓ (correct, keep this)
- Shows stats grid immediately (incorrect)

**Required Changes**:
1. Keep the "Correct Answer" header and answer display as-is
2. Only render the stats grid (Correct/Incorrect/No Answer) when `answerData?.revealed === true`
3. Before reveal, the stats section should simply not be rendered (empty space where stats would appear)

**Implementation**:
- Wrap the stats grid in a conditional: `if (answerData?.revealed === true && stats data exists)`
- Use ternary or conditional rendering to show stats only after reveal

### Phase 2: Verify 'nearest-wins-results' Mode
**File**: `src/components/ExternalDisplayWindow.tsx`

**Review**:
- Current 'nearest-wins-results' case shows placement results (🥇 Closest, 🥈 2nd Close, 🥉 3rd Close)
- Should NOT display Correct/Incorrect/No Answer stats
- Current implementation already correct - no changes needed

## Data Flow
- **KeypadInterface** sends `revealed: true` (before first reveal sends `revealed: false`)
- **Data structure**: `{ correctAnswer, revealed: true/false, stats: {correct, wrong, noAnswer}, ... }`
- **ExternalDisplayWindow** receives this and conditionally renders stats based on `revealed` flag

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx`
  - Line ~1045-1080: Update 'correctAnswer' case
  - Wrap stats grid with conditional check: `if (answerData?.revealed === true) { show stats } else { don't render }`

## Implementation Detail
Change from:
```js
{(stats.correct !== undefined || stats.wrong !== undefined || stats.noAnswer !== undefined) && (
  <div style={{ display: 'grid', ... }}>
    {/* Stats cards */}
  </div>
)}
```

To:
```js
{answerData?.revealed === true && (stats.correct !== undefined || stats.wrong !== undefined || stats.noAnswer !== undefined) && (
  <div style={{ display: 'grid', ... }}>
    {/* Stats cards */}
  </div>
)}
```

## Testing Checklist
- [ ] Keypad mode: Stats NOT visible when answer shows before reveal (placeholder sent with `revealed: false`)
- [ ] Keypad mode: Stats visible after clicking "Reveal Answer" (sent with `revealed: true`)
- [ ] Nearest wins mode: No correct/incorrect stats displayed (only placement results)
- [ ] Text sizing still applied
- [ ] Border colors still random
- [ ] "Correct Answer" header stays visible at all times
