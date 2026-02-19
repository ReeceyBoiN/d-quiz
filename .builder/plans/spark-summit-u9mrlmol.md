# External Display Window - Taskbar Coverage & Auto-hiding Header

## User Requirements
1. **Full Screen Coverage**: Window should extend in front of the taskbar when maximized (currently it doesn't)
2. **Auto-hiding Header**: When maximized, hide the header bar by default
3. **Hover to Reveal**: Show header when mouse moves near the top of the screen
4. **Auto-hide on Leave**: Hide header when mouse moves away from top area
5. **Goal**: Maximize display real estate for content

## Current State Analysis
- Minimized state: 900x600px with draggable header (correct)
- Maximized state: Fills screen but NOT in front of taskbar, header always hidden (partial)
- Header doesn't have mouse hover reveal logic

## Recommended Approach

### 1. Electron Window Configuration (electron/main/windows.js)
**Problem**: Window needs `alwaysOnTop: true` property to cover taskbar
**Solution**:
- Update `maximizeExternalWindow()` to set `alwaysOnTop: true`
- Update `minimizeExternalWindow()` to set `alwaysOnTop: false` (allow other windows on top when minimized)
- This ensures window covers taskbar on Windows systems

### 2. React Component Header Hide/Show Logic (src/components/ExternalDisplayWindow.tsx)
**Problem**: Header doesn't have hover-reveal behavior
**Solution**:
- Add state: `showHeader` (separate from `isMinimized`)
- Add state: `headerHideTimer` to track auto-hide timeout
- Add mouse move listener with:
  - **Mouse near top** (y < 100px): Show header, clear any hide timeout
  - **Mouse away from top**: Set timeout (800ms) to hide header
  - **Mouse over header**: Always show header
- Header reveals with smooth CSS transition
- When maximized: Use `position: absolute`, `top: 0`, `z-index: high` with auto-hide logic
- When minimized: Use normal flow (current behavior)

### 3. Visual Updates
- Header opacity/transition when showing/hiding (fade-in/fade-out)
- Ensure header is still draggable when visible (even though window is maximized)
- Consider hover hint message change when maximized: "Hover top to reveal | Double-click to minimize"

## Implementation Files
1. **electron/main/windows.js**
   - Modify `maximizeExternalWindow()` - add `alwaysOnTop: true`
   - Modify `minimizeExternalWindow()` - add `alwaysOnTop: false`

2. **src/components/ExternalDisplayWindow.tsx**
   - Add `showHeader` state (initialized to `false` when maximized, `true` when minimized)
   - Add mouse move listener on main container
   - Add header auto-hide timeout logic
   - Update header rendering with conditional positioning and opacity animation
   - Update header message based on window state

## Key Implementation Details
- **Mouse detection zone**: Top 150px of window (user confirmed preference for larger zone)
- **Auto-hide delay**: 1500ms (more forgiving, less aggressive hide timing per user preference)
- **Z-index strategy**: Ensure header layers above content
- **Smooth transitions**: CSS opacity/visibility transitions for header reveal/hide
- **Edge case**: If user has taskbar on left/right, ensure window still covers entire display
- **Header behavior**: When maximized, show on any mouse move in top 150px, hide after 1500ms without mouse activity in that zone

## Success Criteria
✓ Maximized window covers entire screen including taskbar (confirmed visually)
✓ Header hidden by default when maximized
✓ Header appears on mouse hover (top 100px area)
✓ Header auto-hides after mouse leaves hover area
✓ Header remains draggable while maximized
✓ Double-click anywhere still minimizes window
✓ No visual glitches during header show/hide transitions
