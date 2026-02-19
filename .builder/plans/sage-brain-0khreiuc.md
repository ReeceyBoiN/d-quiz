# Plan: Add External Display Text Size Controls

## Overview
Add a text size control (Small, Medium, Large presets) to the External Screen settings in the Settings menu. The setting will persist in localStorage and only affect text sizes on the external display screen (not the host app).

## Implementation Approach

### Key Design Decisions
1. **Three preset options**: Small (0.85x), Medium (1.0x baseline), Large (1.2x) for relative scaling
2. **Single source of truth**: Store `externalDisplayTextSize` in localStorage alongside other display settings
3. **Relative scaling**: Apply a multiplier to existing font sizes to maintain proportional relationships
4. **Persistence**: Save to `quizHostSettings` localStorage key, persists across sessions
5. **Message passing**: Send the text size setting to external display via existing update mechanism

## Files to Modify

### 1. `src/components/Settings.tsx`
**Purpose**: Add UI control and state management for text size setting

**Changes**:
- Add `externalDisplayTextSize: 'medium'` to default settings state (around line 280)
- Add a button group UI in `renderExternalScreen()` to let users select Small/Medium/Large
- Each button updates the setting via `updateSetting('externalDisplayTextSize', value)`
- Ensure the setting is included in the save/load flow (it will be via updateSetting)

**Why**: This is where all external screen settings are managed and persisted

### 2. `src/components/QuizHost.tsx`
**Purpose**: Send the text size setting to the external display whenever it changes

**Changes**:
- Monitor the `externalDisplayTextSize` setting (add to dependencies or listen to settings context)
- Include `textSize: settings.externalDisplayTextSize` in the messageData object sent via `updateExternalDisplay()`
- Ensure it's sent in both initial window open and on setting changes

**Why**: The host needs to communicate the current text size to the external display component

### 3. `src/components/ExternalDisplayWindow.tsx`
**Purpose**: Receive and apply the text size multiplier to all text rendering

**Changes**:
- Extract/receive `displayData.textSize` from incoming messages
- Create a helper function to calculate scale multiplier based on text size preset:
  - `'small'` → 0.85
  - `'medium'` → 1.0
  - `'large'` → 1.2
- Apply the multiplier to all inline `fontSize` values throughout the component
- For fixed px values: multiply by the scale factor (e.g., `40px` becomes `40 * 0.85 = 34px`)
- For clamp() expressions: multiply all three values in the clamp (min, preferred, max)
- Create a helper function like `scaleFontSize(baseSize, multiplier)` to avoid duplication
- Update all renderContent mode sections to use the scaled font sizes

**Why**: This is where the external display renders all content; the scaling must be applied here

### 4. `src/components/FastestTeamOverlaySimplified.tsx` (if used by external display)
**Purpose**: Scale text in fastest team overlay component

**Changes**:
- Receive textSize from parent (via displayData or direct prop)
- Apply the same scale multiplier to font sizes in this overlay
- Ensure consistency with main external display scaling

**Why**: This component is rendered within the external display for fastest team overlay

## Implementation Order

1. **Settings.tsx**: Add the UI control and state (Simple - just adding UI)
2. **ExternalDisplayWindow.tsx**: Create the scaling logic and apply multipliers (Core change)
3. **QuizHost.tsx**: Wire up the setting transmission (Connect the pieces)
4. **FastestTeamOverlaySimplified.tsx**: Apply scaling if needed (Polish)
5. **Testing**: Verify all display modes work with all three text sizes

## Technical Details

### Scale Multiplier Mapping
```
Small:  0.85x
Medium: 1.0x (baseline - current display size)
Large:  1.2x
```

### Font Size Calculation Examples
- Fixed px: `40px` with scale 0.85 = `34px`
- Clamp: `clamp(3rem, 12vw, 10rem)` with scale 1.2 = `clamp(3.6rem, 14.4vw, 12rem)`

### Message Data Structure
The messageData sent to external display should include:
```
{
  type: 'DISPLAY_UPDATE',
  mode: '...',
  data: {...},
  textSize: 'small' | 'medium' | 'large'  // NEW
}
```

## Expected Behavior

1. User opens Settings → External Screen tab
2. Sees three buttons: "Small", "Medium", "Large"
3. Selects one (Medium is highlighted by default)
4. Setting is saved to localStorage as part of `quizHostSettings`
5. External display receives the setting and scales all text accordingly
6. Next session, external display remembers the user's choice
7. Text maintains proportional relationships (titles, options, descriptions all scale together)

## Potential Edge Cases

1. **Responsive designs**: Some elements use clamp() for viewport scaling - ensure multiplier works with these
2. **SVG text**: Wheel spinner uses SVG text elements - may need fontSize attribute handling
3. **Dynamic sizing**: Question-with-timer mode computes sizes based on isMobileSize - multiplier should apply after logic
4. **Backward compatibility**: Old external display windows without textSize should default to 'medium'

## Dependencies & Notes

- No new dependencies required
- Uses existing localStorage persistence pattern
- Uses existing message passing infrastructure (window.postMessage / IPC)
- Settings context already handles localStorage + events
- All font sizes in external display are inline styles (favorable for applying multiplier)
