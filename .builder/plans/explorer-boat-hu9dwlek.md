# Fix: Settings Modal Dragging Issue Blocking Close Button

## Problem Summary
The Settings modal header is inheriting the window dragging behavior from the main top navigation bar. This causes:
- Double-clicking the Settings header to maximize/minimize the window instead of interacting with the modal
- The header being treated as a draggable area, which prevents the close button from receiving clicks properly
- The close button being unable to respond because the dragging interaction takes priority

## Root Cause Analysis

### Why This Happens (Electron Window Management)
The app uses Electron's `-webkit-app-region` CSS property to make the main top navigation draggable:

**TopNavigation.tsx (Line ~66):**
```jsx
<div ... style={{ WebkitAppRegion: 'drag' }}>
```

This makes the entire top bar draggable for moving the window.

### The Settings Modal Problem
The Settings modal is rendered as a fixed overlay on top of the main window:

**Settings.tsx (Current Structure):**
```jsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  {/* Modal wrapper - NO WebkitAppRegion: 'no-drag' */}
  <div className="bg-card w-full h-full max-w-6xl max-h-[90vh] ...">
    {/* Modal header - NO WebkitAppRegion: 'no-drag' */}
    <div className="px-6 py-4 border-b border-border flex items-center justify-between min-h-[64px]">
      <h3>Settings Title</h3>
      <Button onClick={handleClose}>
        <X />
      </Button>
    </div>
```

Because the modal header lacks `style={{ WebkitAppRegion: 'no-drag' }}`, it inherits the draggable behavior from the top navigation area behind it (or the system treats it as draggable by default in Electron). This makes:
1. The header draggable instead of interactive
2. Double-clicks trigger window maximize/minimize
3. The close button unreachable because dragging takes priority over clicking

### Similar Issue Pattern in Codebase
The TopNavigation.tsx and LeftSidebar.tsx already use `WebkitAppRegion: 'no-drag'` on interactive controls (buttons, toggles), showing the pattern is established in the codebase.

## Solution Approach

Add explicit `WebkitAppRegion: 'no-drag'` styling to the Settings modal to prevent dragging within that area.

### Files to Modify

#### 1. src/components/Settings.tsx

**Location:** Modal overlay wrapper and header container (approximately line 1490-1510)

**Change 1 - Modal Overlay Wrapper:**
- Add `style={{ WebkitAppRegion: 'no-drag' }}` to the outermost modal container
- This prevents dragging anywhere within the modal

**Change 2 - Modal Header:**
- Add `style={{ WebkitAppRegion: 'no-drag' }}` to the header div that contains the title and close button
- This ensures the title, close button, and header area are all non-draggable

**Specific changes:**
```jsx
// Change the modal overlay from:
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

// To:
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ WebkitAppRegion: 'no-drag' }}>

// And change the modal header from:
<div className="px-6 py-4 border-b border-border flex items-center justify-between min-h-[64px]">

// To:
<div className="px-6 py-4 border-b border-border flex items-center justify-between min-h-[64px]" style={{ WebkitAppRegion: 'no-drag' }}>
```

## Expected Outcome
After these changes:
1. The Settings modal header will no longer be draggable
2. Double-clicking the header will no longer maximize/minimize the window
3. The close button will be fully interactive and clickable
4. The modal will behave like a proper dialog overlay, independent of the window dragging system

## Verification Steps
1. Open Settings menu in the app
2. Try to drag the Settings header - it should NOT move the window
3. Try to double-click the Settings header - it should NOT maximize/minimize
4. Click the X close button - it should properly close the Settings menu
5. Test in both dev mode and built EXE

## Technical Context
- **Electron API:** `-webkit-app-region` property
  - `drag` = makes element draggable (for moving the window)
  - `no-drag` = prevents dragging (makes element interactive)
- **Pattern:** Already established in codebase (TopNavigation.tsx, LeftSidebar.tsx)
- **Scope:** Minimal, focused change to one component
