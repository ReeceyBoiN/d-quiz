# Fix Team Photos Tab Orange Flash Notification

## Problem Statement
The Team Photos tab in the bottom navigation bar should display an orange flash/highlight when there are team photos waiting for approval, but currently shows no visual indication at all. The backend is correctly detecting pending photos (confirmed via console logs), but the styling is not being applied to the button.

## Root Cause Analysis

### Current Implementation
- **File**: `src/components/BottomNavigation.tsx` (line ~1800)
- **Logic**: The button has conditional class application:
  ```jsx
  className={`... ${
    hasPendingTeamPhotos
      ? 'bg-orange-600 animate-flash-orange text-white'
      : 'hover:bg-accent'
  }`}
  ```
- **Animation**: Defined in `src/styles/globals.css` uses `filter: drop-shadow()` for a glow effect only

### Identified Issues

1. **Animation Only Creates Glow, Not Background Flash**
   - Current `flashOrange` keyframes only use `drop-shadow()` filter
   - Does NOT change the background color itself
   - The animation effect is subtle and might be visually lost

2. **Potential CSS Specificity Issues**
   - The `bg-orange-600` class may be getting overridden by parent/sibling styles
   - Button is nested within conditional rendering with multiple className layers
   - The `hover:bg-accent` alternative styling might have higher specificity

3. **Animation Performance**
   - Current animation uses `filter: drop-shadow()` which is less performant
   - A more impactful animation would use direct `background-color` changes

## Solution Approach

### Step 1: Verify the Issue
1. Add forced inline styles as a debugging measure to confirm CSS is being overridden
2. Check browser DevTools to see what final computed styles are applied
3. Verify `hasPendingTeamPhotos` state is actually true when photos are pending

### Step 2: Implement Stronger Visual Feedback
1. **Enhance the `flashOrange` animation** to not just use drop-shadow but also:
   - Change the background color intensity
   - Possibly add a subtle scale/pulse effect
   - Make it more noticeable

2. **Fix potential CSS specificity issues**:
   - Use `!important` flags if needed for animation
   - Consider using inline styles as fallback for critical styling
   - Ensure `bg-orange-600` is not being overridden

3. **Simplify the class application**:
   - Move the conditional styling logic to be clearer
   - Add `!important` to critical classes if overrides are occurring
   - Ensure the class string is properly constructed

### Step 3: Enhance Animation Visibility
The current animation in `globals.css` needs to:
- Use more dramatic color changes
- Possibly combine multiple effects (glow + brightness + scale)
- Ensure the animation is noticeable and stands out

## Files to Modify

### 1. **`src/styles/globals.css`** - Enhance the flashOrange animation
**Current issue**: Animation only uses `filter: drop-shadow()` which creates a subtle glow, not a visible color change.

**Changes needed**:
- Add explicit `background-color` changes in the keyframes (0%, 100%, 50%)
- Use `!important` flags to prevent override by other CSS rules
- Combine with enhanced drop-shadow for maximum visibility
- Add opacity changes for subtle breathing effect

**New animation**:
```css
@keyframes flashOrange {
  0%, 100% {
    background-color: rgb(234, 88, 12) !important;
    filter: drop-shadow(0 0 0px rgba(249, 115, 22, 0.4));
    opacity: 1;
  }
  50% {
    background-color: rgb(249, 115, 22) !important;
    filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.9));
    opacity: 0.95;
  }
}
```

Also need to add the animation class utility if not already there:
```css
.animate-flash-orange {
  animation: flashOrange 0.8s ease-in-out infinite !important;
}
```

### 2. **`src/components/BottomNavigation.tsx`** - Strengthen the conditional styling
**Location**: Team Photos button (around line 1800)

**Current code** (line ~1800):
```jsx
className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
  hasPendingTeamPhotos
    ? 'bg-orange-600 animate-flash-orange text-white'
    : 'hover:bg-accent'
}`}
```

**Changes needed**:
- Replace `bg-orange-600` with explicit hex/rgb value for stronger control: `bg-[rgb(234,88,12)]`
- Add `!important` flag variants if needed
- Ensure text color `text-white` is applied (already there)
- Add shadow classes for emphasis: `shadow-lg` or similar
- Add explicit inline style as fallback if CSS classes are being overridden:
  ```jsx
  style={hasPendingTeamPhotos ? {
    backgroundColor: 'rgb(234, 88, 12)',
    color: 'white'
  } : {}}
  ```

**Updated code**:
```jsx
className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
  hasPendingTeamPhotos
    ? 'bg-[#ea580c] animate-flash-orange text-white shadow-lg'
    : 'hover:bg-accent'
}`}
style={hasPendingTeamPhotos ? {
  backgroundColor: 'rgb(234, 88, 12)',
  color: 'white'
} : undefined}
```

## Success Criteria
- Team Photos tab shows clear orange highlight when `hasPendingTeamPhotos` is true
- Animation is noticeable and flashes (not just subtle glow)
- Orange flash appears within 1-2 seconds of a team photo being uploaded
- When no pending photos exist, the button returns to normal hover state

## Testing Plan
1. Disable auto-approve in settings
2. Upload a team photo from a player app
3. Verify the Team Photos button shows orange flash in bottom navigation
4. Check console logs show correct pending photo count
5. Verify flash stops once photo is approved
