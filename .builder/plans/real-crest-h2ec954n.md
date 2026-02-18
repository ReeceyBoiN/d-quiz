# Team Photos Orange Flash - CSS Animation Fix

## Root Cause Identified
The React state and photo detection are working correctly - logs confirm:
- `hasPendingTeamPhotos changed: true` ✓
- `PENDING PHOTOS DETECTED - orange flash should activate` ✓
- `Filtered to 1 pending photos` ✓

The problem is the CSS animation itself. The current keyframes flash from **transparent** to **#FF8C42**, but since the button doesn't have a default background color to start with, the animation is too subtle to see.

### Current Animation
```css
@keyframes flash-orange {
  0%, 100% { background-color: transparent; }    /* invisible */
  50% { background-color: #FF8C42; }              /* orange flash */
}
```

Result: Very subtle flash (invisible → orange → invisible) that's hard to notice.

## Solution
Add a visible base background color to the button so the animation flashes between two visible states:

**Option 1 (Recommended)**: Modify the CSS animation to flash from dark orange to bright orange
```css
@keyframes flash-orange {
  0%, 100% { background-color: #E67E22; }   /* darker orange base */
  50% { background-color: #FF8C42; }        /* bright orange flash */
}
```

**Option 2**: Set base background on the button element with Tailwind
- Add `bg-orange-600` or similar to the button when `animate-flash-orange` is applied
- CSS animation then flashes from orange-600 to #FF8C42

**Option 3**: Modify animation to use brightness or shadow effects
- Instead of background-color, use box-shadow or filter brightness
- More visible effect that doesn't depend on button having background

## Implementation Details

### Recommended: Modify globals.css (Option 1)
Change the `@keyframes flash-orange` definition in `src/styles/globals.css` around line 618:

From:
```css
@keyframes flash-orange {
  0%, 100% {
    background-color: transparent;
    color: inherit;
  }
  50% {
    background-color: #FF8C42;
    color: white;
  }
}
```

To:
```css
@keyframes flash-orange {
  0%, 100% {
    background-color: #E67E22;  /* darker orange base */
    color: white;
  }
  50% {
    background-color: #FF8C42;  /* bright orange flash */
    color: white;
  }
}
```

This creates a visible oscillating effect: dark orange → bright orange → dark orange

### Alternative: Add background class to button (Option 2)
In `src/components/BottomNavigation.tsx`, modify the button className around line 1067:

From:
```jsx
className={`px-3 flex items-center gap-1.5 ... ${
  hasPendingTeamPhotos
    ? 'animate-flash-orange text-white'
    : 'hover:bg-accent'
}`}
```

To:
```jsx
className={`px-3 flex items-center gap-1.5 ... ${
  hasPendingTeamPhotos
    ? 'bg-orange-600 animate-flash-orange text-white'
    : 'hover:bg-accent'
}`}
```

Keep the CSS animation as-is, which will flash from orange-600 (from Tailwind) to #FF8C42.

## Expected Result
After fix: Clear, visible orange flashing animation on Team Photos button when photos are pending. The button will noticeably flash between two shades of orange at 1-second intervals continuously until photos are approved/declined.

## Files to Modify
- `src/styles/globals.css` (if using Option 1 - modify @keyframes)
- OR `src/components/BottomNavigation.tsx` (if using Option 2 - add bg-orange-600 class)
