# Make Player Leaderboard Scrollable

## Problem
On the player device, the leaderboard/scores screen (`ScoresPlayerDisplay.tsx`) currently uses `overflow: hidden` and an auto-scrolling CSS animation when there are too many teams. This prevents players from manually scrolling to see the full leaderboard.

## Solution
Modify `src-player/src/components/displays/ScoresPlayerDisplay.tsx` to replace the auto-scroll animation with a standard touch-scrollable list.

### Changes in `ScoresPlayerDisplay.tsx`
1. **Remove the auto-scroll logic**: Delete the `shouldScroll` state, the `useEffect` that checks if scrolling is needed, and the `containerRef`/`contentRef` refs used for measuring.
2. **Change container overflow**: Set `overflow: 'auto'` (instead of `'hidden'`) on the scores container so it becomes natively scrollable via touch/mouse.
3. **Add `-webkit-overflow-scrolling: touch`** for smooth momentum scrolling on iOS.
4. **Remove the duplicate entries trick**: Currently when `shouldScroll` is true, the scores array is duplicated (`[...displayScores, ...displayScores]`) for continuous animation. Remove this — render scores once.
5. **Remove the `@keyframes scrollScores` CSS animation** entirely.
6. **Add bottom padding** to the scrollable list so the last item isn't cut off by the footer.

### Files Modified
- `src-player/src/components/displays/ScoresPlayerDisplay.tsx` — single file change
