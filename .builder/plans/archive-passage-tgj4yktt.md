# Align BuzzInInterface (On The Spot Buzz-In) UI with QuizPackDisplay Layout

## Goal
Restructure the BuzzInInterface round setup screen to match the QuizPackDisplay buzz-in layout style (compact card grid), while keeping the "Demo and Test Sounds" section.

## Current State
- **BuzzInInterface** (`src/components/BuzzInInterface.tsx`): Full-width Points/Classic mode cards in a 2-col grid at top, then full-width "One Guess Per Team" card, then full-width "Demo and Test Sounds" card, then Start/Cancel buttons.
- **QuizPackDisplay** (`src/components/QuizPackDisplay.tsx`): Compact 2-column grid with smaller cards (Points, Evil Mode, One Guess Per Team), then Start/Cancel buttons. No "Demo and Test Sounds" section.

## Desired Layout (2-column grid, matching QuizPackDisplay style)
```
[ Points (slider)     ] [ Evil Mode (checkbox)       ]
[ One Guess Per Team  ] [ Demo and Test Sounds       ]
[        START ROUND        ] [       CANCEL          ]
```

## Changes — Single File: `src/components/BuzzInInterface.tsx`

### 1. Add missing imports and settings
- Import `Skull` from lucide-react (for Evil Mode icon)
- Destructure `evilModeEnabled` and `updateEvilModeEnabled` from `useSettings()`

### 2. Remove Points/Classic mode selection
- Remove the `modes` array and the `selectedMode` state (the Classic mode concept is already the default buzz-in behavior — there's no separate "classic" vs "points" logic needed)
- Remove the large 2-col mode selection cards with orange headers

### 3. Replace with compact 2x2 grid matching QuizPackDisplay style
- Use `grid grid-cols-2 gap-4 mb-6` container (same as QuizPackDisplay)
- **Top-left**: Points card with slider (compact style matching QuizPackDisplay's Points card — dark bg, small icon, slider)
- **Top-right**: Evil Mode card with checkbox (matching QuizPackDisplay's Evil Mode card)
- **Bottom-left**: One Guess Per Team card (matching QuizPackDisplay's One Guess Per Team card)
- **Bottom-right**: Demo and Test Sounds card (same compact card style, with correct/wrong sound preview buttons)

### 4. Keep Start Round / Cancel buttons as-is

### 5. Pass `selectedMode` as `"points"` always to BuzzInDisplay
- Since we're removing the Classic/Points toggle, always pass `"points"` mode (or remove the mode prop if BuzzInDisplay doesn't differentiate — need to verify)

## Files to Modify
- `src/components/BuzzInInterface.tsx` — All UI changes above
