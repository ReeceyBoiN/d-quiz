# External Display Window Minimize/Maximize Feature

## User Requirement
The external display screen needs:
- **Double-click anywhere** to toggle between minimized and maximized states
- **Minimized state**: 900x600px window, draggable and resizable, no borders (or minimal frame)
- **Maximized state**: Full screen (covers taskbar), no borders
- **No manual buttons** — only double-click functionality

## Architecture Overview
The external display is a native Electron BrowserWindow created in the main process. We need to:
1. Add state tracking for minimized/maximized in the Electron main process
2. Add double-click detection in the React component (ExternalDisplayWindow)
3. Implement IPC communication to control window state from renderer
4. Modify window properties (frame, position, size) based on state

## Implementation Plan

### Phase 1: Electron Main Process Updates
**File: `electron/main/windows.js`**
- Modify `createExternalWindow()` to:
  - Create window with `frame: false` (no native titlebar)
  - Set initial size to 900x600
  - Store window state (minimized/maximized) as a property on the BrowserWindow instance
  - Add helper methods: `toggleExternalWindowState()`, `minimizeExternalWindow()`, `maximizeExternalWindow()`

**File: `electron/main/main.js`**
- Add IPC handler `'external-display/toggle-state'` that:
  - Checks current state of external window
  - If minimized: restore to last known position with size 900x600
  - If maximized: toggle to minimized state (900x600)
  - Persists the toggled state
- Add IPC handler `'external-display/set-bounds'` to allow resizing when minimized
- Forward these handlers to the external window (similar to how window/minimize/maximize forward to main window)

### Phase 2: Preload API Exposure
**File: `electron/preload/preload.js`**
- Extend `window.api` to expose:
  - `window.api.externalDisplay.toggleState()` — calls external-display/toggle-state
  - `window.api.externalDisplay.setBounds(x, y, width, height)` — calls external-display/set-bounds (for resizing)

### Phase 3: External Display Component Updates
**File: `src/components/ExternalDisplayWindow.tsx`**
- Add state to track minimized/maximized:
  - `const [isMinimized, setIsMinimized] = useState(true)`
- Add double-click event listener to root container:
  - On double-click: call `window.api.externalDisplay.toggleState()`
  - Listen for state-change IPC messages to update local state
- Add visual feedback (optional):
  - Consider disabling pointer-events on content when implementing drag area (if using native Electron drag)
  - Ensure content is always visible/editable

### Phase 4: Window State & Persistence
**File: `electron/main/windows.js`**
- Store external window state:
  - `externalWindow._isMinimized = true/false`
  - `externalWindow._minimizedBounds = { x, y, width: 900, height: 600 }`
- When toggling to minimized:
  - Save current position using `getBounds()`
  - Set window size to 900x600
  - Position at saved location (or center if first time)
  - Ensure window remains visible in screen bounds
- When toggling to maximized:
  - Use `electron.screen.getPrimaryDisplay()` to get full bounds
  - Set window bounds to fill entire screen using `setBounds()`
  - Disable maximum size limit temporarily or set to screen size

### Phase 5: No-Border Implementation
- **When minimized**: Keep `frame: false` with transparent/minimal UI (user manages drag/resize)
- **When maximized**: Ensure window is frameless and covers entire display including taskbar
- The external React component should handle its own drag handle area (if needed) or rely purely on double-click toggle

## Key Implementation Details

### External Window Bounds Management
- Use Electron's `window.getBounds()` and `window.setBounds(x, y, width, height)` methods
- When resizing (mouse drag on edge): could use native Electron window resizing or custom HTML5 resize handles in React
- **Recommendation**: Use native Electron for simpler implementation; avoid re-resizable since that's for in-app UI

### Dragging the Minimized Window
- Option A: Use Electron's native `-webkit-app-region: drag` CSS class on a header/titlebar area in the React component
  - Add a draggable header to ExternalDisplayWindow when minimized
  - Apply `-webkit-app-region: drag` CSS to that header
- Option B: Handle drag manually in React and call `window.api.externalDisplay.setBounds()` on mousemove
  - This gives more control but adds complexity

- **Recommendation**: Use Option A (native Electron drag) for simplicity and performance

### Boundary Management
- When toggling to minimized: ensure 900x600 window fits on screen
  - If not enough screen space, scale to largest available size maintaining 900x600 ratio
- When toggling to maximized: fill entire primary display

### State Synchronization
- External window state is managed in main process (`externalWindow._isMinimized`)
- External React component listens for IPC `'external-display/state-changed'` messages to sync UI
- This ensures both Electron and React agree on current state

## Files to Modify
1. `electron/main/windows.js` — window creation and state management
2. `electron/main/main.js` — IPC handlers for toggle/setBounds
3. `electron/preload/preload.js` — expose externalDisplay API
4. `src/components/ExternalDisplayWindow.tsx` — double-click handler, state listeners, draggable header

## Edge Cases to Handle
- External window closed while state toggle is in progress
- Minimized window positioned outside visible screen bounds
- Multi-monitor setups: use appropriate display bounds
- Window resize while toggle is happening
- IPC message arrives after window is destroyed

## Expected User Flow
1. External display opens (starts in minimized 900x600 state)
2. User double-clicks anywhere on content → window maximizes to full screen
3. User double-clicks again → window returns to 900x600 at previous position
4. User can drag the window by the header (if Option A) or manually when minimized
5. User can resize by dragging edges when minimized (if adding native resize handles)
