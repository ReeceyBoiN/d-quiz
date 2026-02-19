# External Display Header - Root Cause: CSS Drag Region Blocking Double-Click

## ACTUAL Problem Found

**Double-click events are NOT being detected on the header bar.**

Console shows NO `🖱️ Double-click detected` message when you double-click the header.

## Root Cause

The header has this CSS property in the styles:
```css
[data-external-display-header="true"] {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
}
```

The **`-webkit-app-region: drag`** property is the culprit:
- This property tells Electron that this region should be draggable
- BUT it ALSO prevents the renderer from receiving mouse events on that area
- The OS-level drag handler intercepts the click BEFORE JavaScript can see it
- This is why the `dblclick` event listener never fires

## Solution

We need to:

1. **Remove `-webkit-app-region: drag` from the header CSS** (lines 970-973 in ExternalDisplayWindow.tsx)
   - This is preventing the double-click from reaching JavaScript

2. **Implement custom drag handling** using JavaScript mouse events
   - Use `mousedown`, `mousemove`, `mouseup` to detect and handle dragging
   - This will preserve the dragging functionality without blocking events
   - The drag handler can still call `window.api.externalDisplay.setBounds()` to update window position

3. **Alternative: Use a separate drag handle**
   - Keep the full header draggable via CSS
   - Add a separate small drag handle area (like a title bar)
   - Make the rest of the header (clickable area) NOT have `-webkit-app-region`
   - This way, double-click on the text works, but sides/edges are still draggable

## Recommended Approach

**Option 1: JavaScript-based drag (Most reliable)**
- Remove `-webkit-app-region: drag` from header CSS
- Implement JavaScript drag handler on the header
- Use `mousedown`/`mousemove`/`mouseup` to track dragging
- Calculate offset and call `setBounds()` to move window
- Double-click will now work perfectly

**Option 2: Hybrid approach (Quick fix)**
- Keep `-webkit-app-region: drag` in CSS for backward compatibility
- Add a **separate clickable region** (centered text) without `-webkit-app-region`
- Make the text area NOT draggable so double-click works on it
- Edges of header remain draggable

## Files to Modify

1. **src/components/ExternalDisplayWindow.tsx**
   - Lines 970-973: Remove or refactor `-webkit-app-region: drag`
   - Lines 291-333: Add JavaScript drag handler (mousedown/mousemove/mouseup)
   - Lines 981-1016: Header rendering code

## Implementation Steps

### Step 1: Create JavaScript Drag Handler
In the useEffect for header auto-hide (line 287), add a new effect for drag handling:
```typescript
useEffect(() => {
  if (isMinimized) {
    let isDragging = false;
    let startX = 0, startY = 0;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Only drag from header area
      if ((e.target as HTMLElement)?.closest('[data-external-display-header]')) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && window.api?.externalDisplay) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        // Call setBounds to move window
        // (need current window position + delta)
      }
    };
    
    const handleMouseUp = () => {
      isDragging = false;
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }
}, [isMinimized]);
```

### Step 2: Remove `-webkit-app-region: drag`
Delete lines 970-973 in ExternalDisplayWindow.tsx:
```css
[data-external-display-header="true"] {
  -webkit-app-region: drag;  // ← DELETE THIS
  -webkit-user-select: none;
  user-select: none;
}
```

### Step 3: Update Header Styles
Remove the drag region CSS, but keep user-select: none for better UX.

### Step 4: Test
- Double-click header → should now see `🖱️ Double-click detected` in console
- Header should disappear when window maximizes
- Mouse move to top should reveal header again

## Why This is the Real Issue

- The `-webkit-app-region: drag` is a Chromium/Electron feature that works at the OS level
- It intercepts events BEFORE they reach the JavaScript event system
- This is why the `dblclick` listener on `document` never fires
- The event never reaches React/JavaScript at all

## Next Steps After Fix

Once double-click is working:
1. IPC message should arrive: `external-display/state-changed`
2. `setIsMinimized(false)` will be called
3. Header will disappear (already coded correctly)
4. Window will maximize and cover taskbar (already coded correctly)
