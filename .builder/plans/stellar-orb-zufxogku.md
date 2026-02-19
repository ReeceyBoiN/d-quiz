# Plan: Remove Timer Style Options from Settings

## Objective
Remove countdown timer style options from the host app's External Screen settings to simplify the UI. Keep only the progress bar timer display and remove all other timer design variants.

## Key Changes Needed

### 1. Settings.tsx - Remove Timer Style Dropdown
- **Location**: src/components/Settings.tsx (lines ~1267-1286 and ~1399-1455)
- **Action**: Remove the countdown style Select component and its associated SelectItems (circular, digital, pulsing, progress-bar, matrix, liquid, gradient)
- **Keep**: All other settings in the External Screen tab

### 2. CountdownTimer.tsx - Simplify to Progress Bar Only
- **Location**: src/components/CountdownTimer.tsx
- **Action**: Remove render functions for all styles except renderProgressBar (remove renderCircular, renderDigital, renderPulsing, renderMatrix, renderLiquid, renderGradient)
- **Action**: Update the switch statement to always render progress bar only
- **Keep**: Progress bar rendering logic

### 3. ExternalDisplayWindow.tsx - Simplify Timer Rendering
- **Location**: src/components/ExternalDisplayWindow.tsx
- **Action**: Remove renderCountdownTimer switch cases for all styles except progress-bar
- **Action**: Simplify to always render the progress bar timer style
- **Keep**: Progress bar implementation and external screen layout

### 4. CountdownDebugScreen.tsx - Complete Removal
- **Location**: src/components/CountdownDebugScreen.tsx
- **Action**: Delete this entire file (no longer needed)
- **Action**: Remove any imports/references to this file from other components

### 5. SettingsContext.tsx - Clean Up Timer Style State
- **Location**: src/utils/SettingsContext.tsx
- **Action**: Remove countdownStyle state management
- **Action**: Remove updateCountdownStyle function
- **Action**: Keep other settings functionality intact

### 6. Search and Update References
- **Search for**: countdownStyle references throughout codebase
- **Files to check**: QuizHost.tsx, ExternalDisplayWindow.tsx, and any other components that:
  - Pass countdownStyle prop
  - Read from useSettings().countdownStyle
  - Send countdownStyle in DISPLAY_UPDATE messages
- **Action**: Remove these references or simplify to only use progress bar

## Rationale
- User confirmed they want uniform UI with only progress bar timer for clarity
- Removing multiple timer designs simplifies codebase and reduces maintenance
- Progress bar is the preferred visual style that works well with top/bottom bars
- Removes unused code and debug utilities

## Implementation Order
1. Clean up Settings.tsx first (remove dropdown UI)
2. Simplify CountdownTimer.tsx to only progress bar
3. Simplify ExternalDisplayWindow.tsx to only progress bar
4. Remove CountdownDebugScreen.tsx
5. Clean up SettingsContext.tsx (remove timer style state)
6. Search and remove all remaining countdownStyle references
7. Test that external screen and host UI still display timer correctly
