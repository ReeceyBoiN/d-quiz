# Font Size Controls for Host App

## Summary
Wire the existing Font Size +/- buttons in the bottom navigation bar to scale text across the host app only. The player app and external display are separate windows/apps, so they won't be affected.

## Approach
Use the root HTML `font-size` to scale all text. Since Tailwind CSS classes use `rem` units (which are relative to the root font-size), changing `document.documentElement.style.fontSize` will proportionally scale all text throughout the host app. The external display runs in a separate Electron window (`?external=1`), and the player app is a completely separate application (`src-player/`), so neither will be affected.

The scale value will be persisted in `localStorage` via the existing `SettingsContext` pattern so it survives app restarts.

## Steps

### 1. Add `hostFontScale` to SettingsContext (`src/utils/SettingsContext.tsx`)
- Add `hostFontScale: number` to the context interface (default: `100`, representing percentage)
- Add state + localStorage persistence (same pattern as other settings)
- Add `updateHostFontScale` function
- Range: 75% to 150%, in steps of 5%

### 2. Apply font scale in App.tsx (`src/App.tsx`)
- In `AppInner`, read `hostFontScale` from `useSettings()`
- Use a `useEffect` to apply `document.documentElement.style.fontSize = `${hostFontScale}%`` 
- Clean up on unmount by resetting to default

### 3. Wire buttons in BottomNavigation (`src/components/BottomNavigation.tsx`)
- Import `useSettings` (already imported)
- Get `hostFontScale` and `updateHostFontScale` from context
- Wire the `-` button to decrease by 5 (min 75)
- Wire the `+` button to increase by 5 (max 150)
- Display the current scale percentage in the "Font Size" label
- Visually indicate when not at default (100%)

## Files to Modify
1. `src/utils/SettingsContext.tsx` - Add hostFontScale state + persistence
2. `src/App.tsx` - Apply the font scale to document root
3. `src/components/BottomNavigation.tsx` - Wire the +/- button click handlers
