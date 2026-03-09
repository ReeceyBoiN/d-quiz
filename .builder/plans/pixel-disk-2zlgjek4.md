# Leaderboard Reveal: Applause Sound on Each Team Reveal

## Summary
Add applause sound effect when each team is revealed on the leaderboard screen. Spacebar support for the "Next Team" button is already implemented.

## What Already Works
- **Spacebar shortcut**: Already implemented at `LeaderboardReveal.tsx:195-209` — pressing Space calls `handleNext()`, with proper guards against input fields
- **Applause sound utility**: `playApplauseSound()` exists in `src/utils/audioUtils.ts` — picks a random file from the Applause sounds folder and plays it
- **Reveal order**: Teams already sorted ascending by score (last place revealed first, winner last)

## Change Required

### File: `src/components/LeaderboardReveal.tsx`

1. **Add import** for `playApplauseSound` from `../utils/audioUtils`
2. **Call `playApplauseSound()`** inside the `handleNext()` function when a team is revealed (right after updating the index)

That's it — one import, one function call. No other files need changes.
