# Remove Timer Controls Section from Host Remote

## Objective
Remove the expandable "Timer Controls" section from the Host Remote GameControlsPanel. This section displays timer duration and allows manual timer control, which is not needed on the host remote.

## Current State
The Timer Controls section is in `GameControlsPanel.tsx` and displays when `flowState?.flow === 'sent-question'`. It includes:
- Expandable/collapsible button showing "⏱️ Timer Controls"
- Timer duration display from settings
- Buttons to start silent timer, start normal timer, and stop timer
- All wrapped in a conditional render block (lines 498-536)

## What Needs to Be Removed

### Primary Changes
**File: `src-player/src/components/HostTerminal/GameControlsPanel.tsx`**

1. **Remove Timer Controls Section** (lines 498-536)
   - The entire conditional block that renders the Timer Controls div
   - This is the expandable section below the Dynamic Action Buttons

2. **Remove Unused State and Handler** (clean removal approach)
   - `expandedSection` state variable (line ~162)
   - `toggleSection` handler function (lines ~266-268)
   - These were only used for the Timer Controls expand/collapse functionality

3. **Remove Unused Handler Functions** (if only used for Timer Controls)
   - Check if `handleStartNormalTimer`, `handleStartSilentTimer`, `handleStopTimer` are used elsewhere
   - If only used in the Timer Controls section being removed, these can also be removed
   - However, keep the `startNormalTimer`, `startSilentTimer`, `stopTimer` from the hook if they might be used elsewhere

## Files to Modify
1. **`src-player/src/components/HostTerminal/GameControlsPanel.tsx`**
   - Remove lines 498-536 (Timer Controls section)
   - Remove `expandedSection` state initialization
   - Remove `toggleSection` handler function
   - Clean up any now-unused timer handler functions

## Rationale
The host remote is designed for remote control of the quiz from a separate device. Timer functionality is already available through the main timer buttons (Normal Timer / Silent Timer) in the Dynamic Action Buttons section. The expandable Timer Controls section with duration display and manual control adds unnecessary UI clutter and duplicate functionality that isn't needed on the remote device.

## Implementation Notes
- The timer buttons themselves (Normal Timer / Silent Timer) that appear in the Dynamic Action Buttons section should remain - only the expandable Timer Controls section below should be removed
- The layout will be cleaner and more focused with just the Answer Input above and the Game Controls below
