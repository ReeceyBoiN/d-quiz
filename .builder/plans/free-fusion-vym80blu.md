# Team Photos Orange Flash Animation Fix

## Problem
The Team Photos tab button has `hasPendingTeamPhotos` correctly set to `true` (confirmed by console logs), but the orange flash animation is not visible even after adding `bg-orange-600` class.

## Root Cause
**Animation Definition Conflict**: There are two conflicting definitions of the `animate-flash-orange` class in the codebase:

1. **globals.css** (src/styles/globals.css, lines ~618-631):
   - `@keyframes flash-orange` (dashed name)
   - `.animate-flash-orange { animation: flash-orange 1s ease-in-out infinite; }`
   - Only animates: `background-color`, `color`

2. **tailwind.config.js** (tailwind.config.js):
   - `@keyframes flashOrange` (camelCase name - DIFFERENT from globals.css)
   - Animation entry: `'flash-orange': 'flashOrange 0.8s ease-in-out infinite'`
   - Animates: `backgroundColor`, `boxShadow`, `transform` (scale)

**The Problem**: Both definitions try to output the same `.animate-flash-orange` class but reference different keyframes (`flash-orange` vs `flashOrange`). CSS load order determines which one wins. If globals.css loads after Tailwind, it overrides with the less complete animation.

## Solution Approach
Choose ONE of these options:

### Option A: Use Tailwind Config (Recommended)
**Rationale**: Tailwind-generated animations work with the build system and provide richer effects (includes boxShadow for glow effect)

**Changes Required**:
1. **Remove** the manual `.animate-flash-orange` and `@keyframes flash-orange` from `src/styles/globals.css`
2. **Keep** the Tailwind definition in `tailwind.config.js` (already correct)
3. **Result**: Class `animate-flash-orange` will use Tailwind's `flashOrange` keyframes with richer animations

### Option B: Use Globals.css Only
**Rationale**: Simpler, keeps all animations in one place

**Changes Required**:
1. **Remove** animation definitions from `tailwind.config.js` (lines with 'flash-orange')
2. **Keep** the definitions in `globals.css`
3. **Update** globals.css keyframes to add the extra properties (boxShadow, transform) from Tailwind for visual parity
4. **Result**: Static CSS provides the animation without Tailwind duplication

## Recommended Approach: Option A ✅ SELECTED
- Cleaner separation of concerns
- Aligns with Tailwind workflow
- The Tailwind animation has better visual effect (includes glow shadow)
- Less CSS to maintain

## Files to Modify
1. `src/styles/globals.css` - Remove lines with `@keyframes flash-orange` and `.animate-flash-orange` class
2. Keep `tailwind.config.js` as-is (already has correct Tailwind animation)

## Expected Behavior After Fix
- Team Photos button will have orange background (`bg-orange-600`)
- When `hasPendingTeamPhotos=true`, button will flash with:
  - Pulsing between `rgb(249, 115, 22)` and `rgb(234, 88, 12)` (orange variants)
  - Scale effect (slight zoom in/out)
  - Glow effect (boxShadow animation)
  - Duration: 0.8 seconds per cycle, infinite loop
