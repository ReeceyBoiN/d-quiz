# Add Right-Side Pointer to External Display Wheel Spinner

## Problem Statement
The external display (live screen) is missing the orange arrow/pointer indicator on the right side of the wheel that exists on the host app. This pointer is important for building suspense and showing viewers which segment the wheel has landed on.

## Current State
- **Host app (WheelSpinnerInterface.tsx)**: Has an orange triangle pointer positioned on the right side at the middle height
  - Location: Lines 496-499
  - Style: Right-side triangle with `border-r-[#f39c12]` (orange) color
  - Position: `absolute top-1/2 right-0 transform translate-x-3 -translate-y-1/2`

- **External display (ExternalDisplayWindow.tsx)**: Has a triangle pointer positioned at the top center
  - Location: Case 'wheel-spinner' rendering block (~line 813-911)
  - Style: Top-center triangle
  - Position: Top-center with transform `translateX(-50%) translateY(-50%) rotateZ(180deg)`

## Recommended Solution

**Modify ExternalDisplayWindow.tsx** to replace the top-center pointer with a right-side pointer that matches the host app's design.

### Changes Required

**File: src/components/ExternalDisplayWindow.tsx**

In the 'wheel-spinner' case rendering block (around line 813-911):

1. **Replace the pointer div** with right-side positioning:
   - Change from top-center triangle to right-side triangle
   - Use the same orange color (#f39c12) and styling as host app
   - Position: right side of wheel, vertically centered
   - CSS transforms: `absolute top-1/2 right-0 transform translate-x-3 -translate-y-1/2`

2. **Update border styles**:
   - Old: `borderTop` and `borderBottom` with `rotateZ(180deg)` (top-center pointer)
   - New: `borderTop`, `borderBottom`, and `borderRight` with orange fill (right-side pointer)
   - Dimensions: Similar to host (width 0, height 0, thick borders to create triangle shape)

3. **Ensure proper z-index**: Maintain `zIndex: 20` so pointer appears above the wheel

### Why This Approach
1. **Visual Consistency**: External display matches host app, creating unified user experience
2. **Same Data Flow**: No changes needed to messaging/state passing - external display already receives rotation and winner data
3. **Low Risk**: Only CSS/positioning changes, no logic modifications
4. **Minimal Impact**: One component, one section of code (the pointer div)

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (1 change: pointer element positioning and styling)

## Verification Checklist
- [ ] External display wheel shows orange triangle pointer on right side
- [ ] Pointer is vertically centered (at middle height of wheel)
- [ ] Pointer appears above the wheel (no overlap issues)
- [ ] When wheel spins, pointer remains stationary while wheel rotates underneath
- [ ] When spin completes, pointer indicates the winning segment
- [ ] Pointer styling (color, size, shape) matches host app
- [ ] No console errors or warnings
- [ ] Works on both Electron external display and browser-based external display

## Code Reference
- Host pointer implementation: `src/components/WheelSpinnerInterface.tsx:496-499`
- External display wheel render: `src/components/ExternalDisplayWindow.tsx:~813-911`
- Border styles for right-side triangle: `border-t-9 border-b-9 border-r-15` with transparent top/bottom, orange right
