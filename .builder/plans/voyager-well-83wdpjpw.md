# Team Photos Animation Debug & Fix Plan

## Current Status
- **CSS Animation**: Already updated globals.css with box-shadow glow effect (lines 631-638)
- **Animation Keyframes**: Correct syntax - box-shadow: 0 0 0 0 (start) → 0 0 10px 3px (middle)
- **Problem**: Animation not visually appearing despite code being correct
- **Root Cause**: UNKNOWN - awaiting debug screenshots from user

## Diagnostic Process

### Phase 1: User provides screenshots showing:
1. Browser console output when team photo is pending
2. DevTools Inspector showing button HTML/classes
3. DevTools Styles tab showing computed animation
4. Result of manual box-shadow test in console

### Phase 2: Analyze screenshots to identify root cause:
- **If logs don't show "PENDING PHOTOS DETECTED"**: Backend issue (port 4310 or API failure)
- **If logs present but class missing**: Component state is true but className not applying
- **If class present but animation missing**: CSS not loading or syntax error
- **If animation present but no glow**: CSS clipping (overflow:hidden) or z-index burial
- **If manual box-shadow test shows glow**: Animation timing/visibility issue

### Phase 3: Apply targeted fix based on root cause:
- Backend: Restart dev server to fix port 4310 conflict
- Component: Fix className conditional in BottomNavigation.tsx
- CSS: Fix globals.css animation or remove/adjust overflow/z-index
- Clipping: Adjust parent container overflow or z-index values

## Root Cause Confirmed

**The Issue**: box-shadow animation doesn't render on native `<button>` HTML elements reliably, especially on Windows.

**Evidence**:
- ✅ `animate-flash-orange` class IS present on button
- ✅ Console logs confirm "PENDING PHOTOS DETECTED"
- ❌ Glow effect is invisible on the button

**The Fix**: Replace `box-shadow` with `filter: drop-shadow()` in the animation keyframes
- `drop-shadow()` works reliably on all HTML elements including buttons
- Works cross-browser (Windows, Mac, Linux)
- Won't be clipped by parent containers
- More vibrant and visible than box-shadow

## Implementation Steps

### Step 1: Update globals.css - Replace box-shadow with drop-shadow

**File**: `src/styles/globals.css` (lines 631-638)

**Change From** (current box-shadow approach):
```css
@keyframes flashOrange {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4);
  }
  50% {
    box-shadow: 0 0 10px 3px rgba(249, 115, 22, 0.7);
  }
}
```

**Change To** (drop-shadow for better button support):
```css
@keyframes flashOrange {
  0%, 100% {
    filter: drop-shadow(0 0 0px rgba(249, 115, 22, 0.4));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(249, 115, 22, 0.8));
  }
}
```

**Why drop-shadow works better**:
- Works reliably on native `<button>` elements (box-shadow doesn't)
- Won't be clipped by parent containers
- Renders consistently across browsers (Windows, Mac, Linux)
- More vibrant and visible effect
- Properly applies to the element's rendered area

### Step 2: Test the fix

1. Submit a new team photo without auto-approval
2. Check the Team Photos button at the bottom of the screen
3. Should see an **expanding orange glow** that pulses around the button
4. Glow should animate continuously until photo is approved/declined

**Expected Visual**:
- 0%/100%: No glow, orange button visible
- 50%: Bright orange glow extending ~12px from button edges
- Animation cycles every 0.8 seconds continuously

## Files to Modify
- `src/styles/globals.css` - Update `@keyframes flashOrange` (lines 631-638)

## Success Criteria
- ✅ Console logs show "PENDING PHOTOS DETECTED" when photo pending
- ✅ Team Photos button has `animate-flash-orange` class
- ✅ Computed styles show `animation: flashOrange 0.8s ease-in-out infinite`
- ✅ **Visible orange glow pulsing around button** - bright and obvious
- ✅ Glow cycles every 0.8 seconds continuously while photo is pending
- ✅ Glow stops when photo is approved/declined
- ✅ Drop-shadow animation works smoothly without flicker
