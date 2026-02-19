# External Display Maximization - Deep Diagnosis & Root Cause Fix

## Current Issue (UPDATED WITH DIAGNOSTICS)
After rebuilding the exe, the external display window is **partially working**:
✅ **WORKING**: Double-click DOES expand/toggle the window size
❌ **NOT WORKING**: Header bar doesn't hide when maximized
❌ **NOT WORKING**: Window doesn't cover the taskbar
- The window is opening on the correct external/secondary display

## Problem Analysis

The previous fixes may not have worked because:
1. **Exe wasn't rebuilt** - The JavaScript changes need to be compiled and packaged into the exe
2. **Double-click still isn't firing** - The handler may not be attached properly, or the dblclick event isn't reaching it
3. **IPC call not reaching main process** - The toggleState() might not be invoking properly
4. **Window state not actually toggling** - toggleExternalWindowState() might be failing silently
5. **Electron window config missing** - The window might need additional Electron-level configuration to truly maximize and cover the taskbar
6. **Z-order not working** - setAlwaysOnTop with 'pop-up-menu' might not be sufficient on this system

## Diagnostic Approach

### 1. **Verify Exe Was Rebuilt**
- Check build output to confirm changes were compiled
- Ensure the exe is being run from the correct location
- Verify the vite bundle includes the modified React component

### 2. **Add Comprehensive Logging**
- Add detailed console.log() at every step of the double-click flow
- Log when double-click event fires (React level)
- Log when IPC invoke is called with parameters
- Log when main.js receives the IPC call
- Log each step in toggleExternalWindowState()
- Log final window bounds after setBounds() is called

### 3. **Verify Double-Click Event Firing**
- Confirm the dblclick event listener is attached to document
- Check if React event system is interfering
- Verify isElectron flag is true
- Check if window.api.externalDisplay is available

### 4. **Verify IPC Communication**
- Confirm the invoke() call is being made
- Check if main.js is receiving the 'external-display/toggle-state' message
- Verify the async/await is working correctly
- Check the response being sent back

### 5. **Verify Window State Changes**
- Log the state before and after toggleExternalWindowState()
- Verify getBounds() returns the expected values
- Check if setAlwaysOnTop() is being called
- Verify setSkipTaskbar(true) is being called when maximized
- Check if focus() is being called

### 6. **Investigate Electron Window Behavior**
- Consider using electron.app.relaunchAsUser() or other window modes
- Try setFullScreen(true) in addition to/instead of setBounds
- Verify the display.bounds values are correct
- Check if Windows taskbar is being excluded properly
- Consider using a custom window decoration approach

## Root Cause Analysis (BASED ON DIAGNOSTICS)

**KEY FINDING**: The window IS expanding, which means:
✅ Double-click handler IS working
✅ IPC IS working
✅ toggleExternalWindowState() IS being called and partially working
✅ Window bounds ARE being applied (size changes)

**But two things are failing:**
1. **Header not hiding** - The conditional render logic checking isMinimized state might not be updating
2. **Taskbar not covered** - The window bounds might not be using the true screen dimensions that include taskbar area

### H1: Header Not Hiding on State Change (MOST LIKELY)
**Likelihood: VERY HIGH**
The header hiding logic depends on `isMinimized` state in React. The state-changed IPC might be firing, but React might not be re-rendering properly, or the state update is delayed.

**Root cause**: In ExternalDisplayWindow.tsx, the header visibility depends on `isMinimized` state. The IPC listener sets this state, but there might be a timing issue or the listener isn't properly attached to the specific window instance.

**Evidence**: Window expands (physical change) but header doesn't hide (React state not updating)

### H2: Taskbar Not Fully Hidden by Window Bounds (VERY LIKELY)
**Likelihood: VERY HIGH**
The `screen.getPrimaryDisplay().bounds` might not include the full screen area when taskbar is present. On Windows, we need to use `workArea` (excludes taskbar) vs `bounds` (includes taskbar area), but we're already using `bounds`.

**Root cause**: The window might be set to the correct bounds, but Windows is still rendering the taskbar on top. Or the z-order isn't high enough.

**Evidence**: Window size changes but doesn't cover taskbar (z-order or positioning issue)

## Fix Strategy (Targeted Solutions)

### FIX #1: Force Header to Hide on State Change (PRIMARY ISSUE)
**Problem**: React component receives state change notification but header doesn't hide

**Solution**: Ensure the state-changed IPC listener is properly updating React state and triggering re-render

**Implementation**:
1. Verify the IPC listener in ExternalDisplayWindow.tsx is attached early and properly
2. Ensure isMinimized state update triggers header hiding logic
3. Add forced z-index and visibility to header hiding transition
4. Consider moving header hiding out of conditional render to CSS-based display:none

**Files**: src/components/ExternalDisplayWindow.tsx

### FIX #2: Force Window to Cover Taskbar (SECONDARY ISSUE)
**Problem**: Window expands but taskbar still shows on top

**Solution**: Use multiple Electron APIs to ensure window z-order is above taskbar

**Implementation**:
1. After setBounds(), immediately call setAlwaysOnTop(true, 'pop-up-menu') - already doing this
2. Add setIgnoreMouseEvents(false) to ensure window receives events
3. Try using setVisibleOnAllWorkspaces(true) to escape workspace constraints
4. Use screen.getAllDisplays() to get the EXACT secondary display bounds (not primary)
5. Add a small delay after setAlwaysOnTop before calling focus()
6. Verify the window is actually being positioned at secondary display coordinates (x, y), not (0, 0)

**Files**: electron/main/windows.js

### FIX #3: Debug Display Detection
**Problem**: Might be maximizing on wrong display or using wrong bounds

**Solution**: Get bounds of the specific display where external window is located

**Implementation**:
1. Store which display the external window is on when it's created
2. When maximizing, use that specific display's bounds, not getPrimaryDisplay()
3. Log all display information (bounds, workArea, usable height, etc.) to console

**Files**: electron/main/windows.js

## Implementation Order

1. **Fix the header hiding logic** (React state update must trigger)
2. **Fix window bounds for secondary display** (use correct display's full bounds)
3. **Increase z-order aggressiveness** (try higher levels if pop-up-menu fails)
4. **Add comprehensive logging** (verify each step works)
5. **Test on external display** (confirm taskbar coverage and header behavior)

## Critical Files to Modify

### 1. **src/components/ExternalDisplayWindow.tsx** (HIGH PRIORITY)
- **Issue**: Header not hiding when isMinimized state changes
- **Lines**: Header render logic (around lines 1000-1050) and state-changed listener (around 160-180)
- **Changes needed**:
  - Ensure IPC listener callback properly updates isMinimized state
  - Add console.log to verify state changes
  - Force header to hide using CSS opacity/visibility in addition to conditional render
  - Check if showHeader state is properly dependent on isMinimized

### 2. **electron/main/windows.js** (HIGH PRIORITY)
- **Issue**: Window not covering taskbar on secondary display
- **Lines**: maximizeExternalWindow() (around 145-170)
- **Changes needed**:
  - Detect which display external window is on (store during createExternalWindow)
  - Use correct display's bounds when maximizing (not always primary)
  - Add logging to show screen dimensions being used vs actual window bounds
  - Log all display info: primary bounds, secondary bounds, taskbar exclusions
  - Try setVisibleOnAllWorkspaces(true) to ensure taskbar doesn't overlap
  - Add small delay before focus() to let z-order apply

### 3. **electron/main/main.js** (MEDIUM PRIORITY)
- **Lines**: 'external-display/toggle-state' handler (around 165)
- **Changes needed**: Add logging to confirm state notification is sent immediately

## Expected Outcomes After Complete Fix

✅ Double-click on window → window expands/contracts
✅ On maximize → header immediately hides (visibility changes)
✅ On maximize → window covers entire secondary display including taskbar
✅ On maximize → mouse hover to top reveals header, hides on mouse leave
✅ On minimize → window returns to 900x600, header visible
✅ Window is always on the correct display (secondary, not primary)
