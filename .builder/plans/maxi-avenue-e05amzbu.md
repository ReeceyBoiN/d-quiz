# Team Photos Orange Flash - Root Cause and Fix

## Root Cause Identified ✅
The button has **no visible background color**, so the animation (which animates background-color) is invisible. When the button is in the "pending photos" state:
- The button gets `animate-flash-orange` class
- The CSS animation runs and flashes the background from #E67E22 to #FF8C42
- But the button has no initial background, so there's nothing to flash

## Solution
**Add a visible base background color to the button** when `animate-flash-orange` is applied. This gives the animation a starting point and makes the flash visible.

### Implementation Approach (Recommended)

**File**: `src/components/BottomNavigation.tsx` (Team Photos button, around line 1065-1076)

**Current Code**:
```jsx
className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
  hasPendingTeamPhotos
    ? 'animate-flash-orange text-white'
    : 'hover:bg-accent'
}`}
```

**Fixed Code**:
```jsx
className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
  hasPendingTeamPhotos
    ? 'bg-orange-600 animate-flash-orange text-white'
    : 'hover:bg-accent'
}`}
```

**Changes**:
- When `hasPendingTeamPhotos` is true: Add `bg-orange-600` before `animate-flash-orange`
- This gives the button an orange-600 background as the base state
- The animation will now flash between orange-600 and #FF8C42 (visible!)

### Why This Works
1. **Before**: button with transparent background → animation tries to change background → no visible change
2. **After**: button with orange-600 background → animation flashes to bright orange (#FF8C42) → visible pulsing effect

### Alternative: Modify CSS Instead
If you prefer to modify CSS only (no JSX changes):
- Change the @keyframes in `src/styles/globals.css` to use `background-color: rgba()` with opacity
- Or add `!important` flags to force the animation to override other styles

But the JSX solution is simpler and more reliable.

## Files to Modify
1. `src/components/BottomNavigation.tsx` - Add `bg-orange-600` to className

## Expected Result
When a team photo is pending:
- Team Photos button will have an orange background
- Background will continuously flash/pulse between darker orange and bright orange
- Animation runs at 1-second intervals
- Text remains white for contrast
- Console confirms state detection is working
