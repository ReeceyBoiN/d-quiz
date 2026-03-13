# Remove Go Wide & Punishment from Buzz-In Quiz Pack Config

## Summary
In buzz-in quiz pack mode, the config screen should only show:
1. **Points** slider (already there)
2. **Evil Mode** checkbox (already there, but needs Punishment sub-option removed)

The following should be hidden when `isBuzzinPack` is true:
- Speed Bonus card (already done)
- Go Wide card
- Punishment sub-option inside Evil Mode

These cards remain visible for normal keypad quiz pack mode.

## File to Modify

### `src/components/QuizPackDisplay.tsx`

1. **Line 454** — Change grid columns: when `isBuzzinPack`, use `grid-cols-2` instead of current `grid-cols-3` (since we're removing Go Wide too, only Points + Evil Mode remain)

2. **Lines 543-593** — Wrap the Go Wide `<div>` in `{!isBuzzinPack && ...}` to hide it in buzz-in mode

3. **Lines 621-640** — Wrap the Punishment sub-option `<div>` inside the Evil Mode card in `{!isBuzzinPack && ...}` to hide it in buzz-in mode

Single-file change, three edits.
