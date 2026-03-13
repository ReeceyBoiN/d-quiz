# Add Demo and Test Sounds Card to QuizPackDisplay Buzz-In Config

## Problem
When a buzz-in type quiz pack file is loaded in QuizPackDisplay, the config screen shows only 3 cards (Points, Evil Mode, One Guess Per Team) in a 2x2 grid with the bottom-right slot empty. The "Demo and Test Sounds" card with green tick and red X buttons is missing — unlike the on-the-spot BuzzInInterface which already has it.

## Changes — Single File: `src/components/QuizPackDisplay.tsx`

### 1. Add missing imports
- Import `Check` and `X` from `lucide-react` (needed for the green tick and red X buttons)

### 2. Add "Demo and Test Sounds" card in the buzz-in config grid
- Insert a new card block after the "One Guess Per Team" card, inside the `{isBuzzinPack && (...)}` conditional
- The card should match the exact same style as the one in `BuzzInInterface.tsx`:
  - Dark card background (`bg-[#34495e] border-[#4a5568]`)
  - Title: "Demo and Test Sounds"
  - Description: "Familiarise your teams with the game sounds."
  - Green circle button with Check icon
  - Red circle button with X icon
- This fills the empty bottom-right slot in the 2x2 grid

### Layout after fix (buzz-in pack mode):
```
[ Points (slider)     ] [ Evil Mode (checkbox)       ]
[ One Guess Per Team  ] [ Demo and Test Sounds       ]
[        START ROUND        ] [       CANCEL          ]
```

## Files to Modify
- `src/components/QuizPackDisplay.tsx` — Add `Check, X` imports + Demo and Test Sounds card
