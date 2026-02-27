# Plan to Fix Bottom Navigation Bar Sizing

## Understanding the Issue
The previous fix added fixed widths (`w-[...]`) and horizontal scrolling (`overflow-x-auto`) to the bottom navigation bar. However, this caused the bar to exceed the screen width on smaller screens, forcing the user to scroll to see half of the functions. 
The user actually prefers the bar to be a bit taller (to accommodate wrapped text) but wants all buttons visible on the screen without horizontal scrolling. Most importantly, the buttons MUST NOT change size dynamically when toggled (which was the original problem causing UI jumps).

## Recommended Approach
To ensure the buttons fit perfectly on any screen size, wrap nicely, and *never* change width or height dynamically when their text updates, we will:
1. **Increase Container Height:** Permanently increase the height of the navigation bar so it has enough room for wrapped text, eliminating any height jumping.
2. **Proportional Flex Sizing:** Instead of hardcoded pixel widths or content-based auto-sizing, assign each button a strict `flex` ratio (e.g., `flex: '14 1 0%'`). This forces the browser to divide the exact screen width by fixed proportions, ensuring button widths are 100% immune to text changes.
3. **Text Wrapping:** Ensure the text inside buttons can wrap elegantly by tweaking font size, line-height, and word-break rules.

### Implementation Steps

1. **Modify Container Heights & Overflow in `src/components/BottomNavigation.tsx`**:
   - Change the top container's `h-[41px]` to `h-[60px]`. This makes the bar tall enough to fit up to 3 lines of small text without dynamically resizing.
   - Remove `overflow-x-auto overflow-y-hidden` from the inner container and ensure it is simply `flex-1 h-full flex items-stretch w-full`.

2. **Apply Strict Proportional Sizing to Buttons**:
   - Remove `w-[...]` and `flex-shrink-0` from all buttons in the home screen toggle area.
   - Add inline styles to apply strict flex fractions so their width is purely calculated from the screen width:
     - **Buzzers**: `style={{ flex: '10 1 0%' }}`
     - **Empty Lobby, Team Photos, Pause Scores, Clear Scores**: `style={{ flex: '11 1 0%' }}`
     - **Scramble Keypad**: `style={{ flex: '13 1 0%' }}`
     - **Hide Scores, Change Teams Layout, Host Controller**: `style={{ flex: '14 1 0%' }}`
     - **Font Size Down / Up**: `style={{ flex: '3.5 1 0%' }}`
     - **Font Size Label**: `style={{ flex: '7 1 0%' }}`
   - Add `min-w-0` to all button classNames to prevent long non-breaking text from overriding the flex ratio.
   - Reduce horizontal padding from `px-3` to `px-1.5` to give text more breathing room on small screens.

3. **Improve Text Wrapping**:
   - Update the text `<span>` inside each button from `text-sm` to `text-[11px] leading-tight break-words whitespace-normal`. This ensures longer strings ("Hide Scores & Positions") wrap cleanly inside their proportional boxes.
   - Add `shrink-0` to the icons to prevent them from squishing when text gets cramped.

### Rationale
By using `flex-basis: 0%` alongside fixed `flex-grow` ratios, the buttons' widths are mathematically detached from their text content. Changing a layout mode might change the text from 2 lines to 3 lines, but the `h-[60px]` container handles it invisibly, and the width remains mathematically locked to its fraction of the screen. No horizontal scrolling, no UI jumping, and everything fits perfectly.
