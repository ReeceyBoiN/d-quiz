# Fix: Settings Menu Close Button Not Working with Unsaved Changes

## Problem
When the user clicks the X button to close the Settings menu with unsaved changes, nothing happens. The browser's `confirm()` dialog doesn't appear and the settings don't close.

## Root Cause
The close button is wired correctly (`onClick={handleClose}` at Settings.tsx:1499), but the `handleClose()` function relies on `window.confirm()` (line 431), which:
- May be blocked or not visible due to modal z-index issues
- Provides poor UX consistency with the custom-styled app
- Can be unreliable in certain browser contexts

## Solution: Replace Browser confirm() with Custom Modal

### Implementation Strategy
1. **Create a confirmation modal state** in Settings component
   - Add `showConfirmClose` state to track if confirmation dialog should show
   - Add `isConfirmed` state if user confirms the action

2. **Modify handleClose()** function
   - When unsaved changes exist, show custom modal instead of calling `confirm()`
   - Only call `onClose()` if user confirms in the custom modal

3. **Render custom confirmation dialog**
   - Create a simple modal overlay (similar to the existing Settings modal structure)
   - Include "Are you sure?" message, Cancel and Discard buttons
   - Ensure proper z-index and focus handling

4. **Update logic flow**
   - `handleClose()` → if unsaved changes, show modal → wait for user choice → execute onClose()

### Files to Modify
- **src/components/Settings.tsx**
  - Add state for confirmation dialog (`showConfirmClose`)
  - Modify `handleClose()` to show modal instead of using `confirm()`
  - Add custom confirmation modal JSX in the render

### Code Changes Overview
```typescript
// New state for confirmation
const [showConfirmClose, setShowConfirmClose] = useState(false);

// Updated handleClose
const handleClose = () => {
  if (hasUnsavedChanges) {
    setShowConfirmClose(true);
  } else {
    onClose();
  }
};

// New handler for confirmation confirmation
const handleConfirmClose = () => {
  setShowConfirmClose(false);
  onClose();
  setHasUnsavedChanges(false);
};

// Render custom modal alongside main settings modal
// (in JSX after main modal)
{showConfirmClose && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
    {/* Confirmation modal content */}
  </div>
)}
```

### Benefits
- Eliminates z-index/visibility issues with browser confirm
- Consistent with app's design system
- Better user experience
- More reliable event handling
- Easier to debug and test

## Test Cases
1. Open settings, make NO changes, click X → should close immediately
2. Open settings, make changes, click X → confirmation modal appears
3. Click "Cancel" in confirmation → modal closes, settings stay open
4. Click "Discard" in confirmation → settings close without saving
5. Repeat steps with different types of settings changes

## Priority
High - Settings is critical functionality for app configuration
