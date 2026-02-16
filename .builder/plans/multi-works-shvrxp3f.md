# Window Management Fix Plan

## Problem Summary
The Team Photos popup (and other modal overlays) are intercepting window drag events, causing unintended window movements and minimize/maximize behavior. When users click on interactive elements in the Team Photos popup (like the close button), the click is being interpreted as dragging the main window because the modal containers lack proper WebKit drag-region styling.

## Root Cause Analysis

### How Window Dragging Works
1. The app uses a **frameless Electron window** (`frame: false` in windows.js)
2. **TopNavigation.tsx** and **LeftSidebar.tsx** create large draggable header regions with `WebkitAppRegion: 'drag'`
3. Interactive elements inside these regions are protected with `WebkitAppRegion: 'no-drag'`

### The Problem
1. Modal overlays (Team Photos, DisplaySettings, etc.) are rendered **on top of** the main window using fixed positioning
2. These modals do NOT set `WebkitAppRegion: 'no-drag'` on their containers
3. When a modal is open and positioned over a drag region, clicks on the modal can "fall through" to the underlying drag region
4. This causes the window to drag/move instead of the button to be clicked
5. Double-clicks on the modal can trigger minimize/maximize of the main window

## Solution Overview

### Affected Files
1. **src/components/BottomNavigation.tsx** - Team Photos popup (PRIMARY AND ONLY FOCUS)

### Implementation Strategy

#### Step 1: Fix Team Photos Popup (BottomNavigation.tsx)
- Add `style={{ WebkitAppRegion: 'no-drag' }}` to the outermost fixed overlay container
- This prevents clicks on the modal from being interpreted as window drag events
- Ensure all interactive elements (close button, approve/decline buttons, toggle switch) remain clickable

## Technical Details

### Code Pattern - Before
```jsx
{showTeamPhotosPopup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTeamPhotosPopup(false)} />
    <div className="relative bg-card border border-border rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-6xl overflow-hidden">
      {/* Content */}
    </div>
  </div>
)}
```

### Code Pattern - After (with fix)
```jsx
{showTeamPhotosPopup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ WebkitAppRegion: 'no-drag' }}>
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTeamPhotosPopup(false)} />
    <div className="relative bg-card border border-border rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-6xl overflow-hidden">
      {/* Content */}
    </div>
  </div>
)}
```

## Implementation Checklist

- [ ] Fix Team Photos popup in BottomNavigation.tsx - add WebkitAppRegion: 'no-drag' to outer container
- [ ] Test Team Photos popup - verify close button is clickable
- [ ] Test Team Photos popup - verify double-click on modal header does NOT minimize main window
- [ ] Test Team Photos popup - verify no unintended window drag when interacting with buttons
- [ ] Verify no regressions in window drag/move functionality on main headers

## Key Files to Modify
1. src/components/BottomNavigation.tsx (Team Photos popup overlay container, approximately line 990)

## Testing Strategy
1. Open Team Photos popup by clicking the "Team Photos" button in bottom navigation
2. Verify close button (X) is clickable and closes the modal
3. Try double-clicking on the top edge of the modal - should NOT minimize/maximize the main window
4. Click various buttons in the modal (Approve/Decline) - should work without triggering window drag
5. Click outside the modal to close it - should still work
6. Verify main window headers still allow normal drag/move and double-click minimize/maximize
