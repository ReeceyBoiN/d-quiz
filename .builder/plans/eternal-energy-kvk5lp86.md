# Team Photos Flash Animation - Glow Effect Solution

## Problem Summary
The Team Photos button correctly applies the `animate-flash-orange` class when pending photos exist, but the current opacity animation (0.7 → 1.0) is too subtle to see. The animation needs to be MORE DRAMATIC and IMMEDIATELY VISIBLE.

## Solution: Glow/Shadow Animation (USER SELECTED)

### Implementation
Change the `@keyframes flashOrange` in `src/styles/globals.css` to use an expanding glow effect:

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

### Visual Effect
- **Start/End**: No glow - button appears normal with orange-600 background
- **Middle**: Expanding glow around button with orange halo - VERY VISIBLE
- **Duration**: 0.8s, repeating infinitely
- **Result**: Button appears to pulse with an orange glow that expands and contracts

### Why This Works
1. ✅ **Instantly visible** - Box shadow glow is very obvious
2. ✅ **Attention-grabbing** - Orange halo pulls the eye
3. ✅ **Professional look** - Common pattern in modern UIs for notifications
4. ✅ **No conflicts** - Works with any background color
5. ✅ **GPU-accelerated** - Smooth performance

## Implementation Steps

### Step 1: Update globals.css
Location: `src/styles/globals.css` (around line 432-440)

Replace this:
```css
@keyframes flashOrange {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}
```

With this:
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

### Step 2: Verify
- Submit a new team photo (without auto-approval enabled)
- Team Photos button should FLASH with an orange glow
- Glow expands and contracts repeatedly
- Glow stops when photo is approved or declined

## No Other Changes Needed
- ✅ BottomNavigation.tsx - Already correct, no changes
- ✅ Component logic - Already applying class correctly
- ✅ State management - Already detecting pending photos
- ✅ Animation utility class - Already defined, just updating keyframes

## Files to Modify
1. `src/styles/globals.css` - Update `@keyframes flashOrange` only

## Testing Checklist
- [ ] Update keyframes in globals.css
- [ ] Submit a new team photo
- [ ] Verify orange glow effect is visible on Team Photos button
- [ ] Confirm glow pulses/flashes repeatedly
- [ ] Approve/decline the photo
- [ ] Confirm glow stops when photo is handled
- [ ] Test with multiple pending photos
