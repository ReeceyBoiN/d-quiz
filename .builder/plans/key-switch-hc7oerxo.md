# Plan: UI Fixes and Nearest Wins Memory Leak / Audio Issues

## 1. Bottom Navigation Bar Layout Shift
**Issue:** The bottom navigation bar buttons change their layout size depending on dynamic text, causing the whole navigation bar to stretch/shrink dynamically, which the user found annoying.
**Solution:**
We will update `src/components/BottomNavigation.tsx` to ensure all buttons with dynamic text have a set `min-w-*` (minimum width) property so they take up the maximum needed space, regardless of the text shown. Also, we will ensure that the container size remains consistent.
- "Change Teams Layout": Added `min-w-[80px]` or specific layout rules.
- "Host Controller": Added `min-w-[100px]`.
- "Scramble Keypad": Added `min-w-[70px]`.
- "Hide Scores & Positions": Added `min-w-[80px]`.
- "Pause Scores": Added `min-w-[70px]`.

We will also replace the inline `flex items-center gap-1.5` layout with `flex flex-col items-center justify-center gap-1` and provide standard minimal heights to ensure a smooth, uniform appearance across all buttons within the bottom navigation bar.

## 2. Nearest Wins Memory Leak & Timer Exploding Logs
**Issue:** When clicking "Start Timer" in Nearest Wins Mode, the console "explodes" with logs and the app slows down significantly (memory leak behavior).
**Root Cause:** `NearestWinsInterface.tsx` repeatedly calls the parent `setGameActionHandlers` on every render. This happens because it passes freshly created handler functions (`handleStartTimer` and `handleNextRound`) inside a `useEffect` whose dependencies are non-memoized functions. This triggers an infinite re-render loop between the child (`NearestWinsInterface`) and parent (`QuizHost`).

**Fix:**
Modify `src/components/NearestWinsInterface.tsx`:
1. Wrap `handleStartTimer` and `handleNextRound` with `useCallback`.
2. This stabilizes the handler identities, preventing the `useEffect` from re-triggering constantly and breaking the re-render loop.
3. Optimize the timer countdown `useEffect` by reducing its dependencies (it currently depends on `countdown` while simultaneously updating it every 100ms, causing excessive effect recreations). 

## 3. Nearest Wins Timer Sound
**Issue:** The nearest wins timer sound does not trigger.
**Root Cause:**
The timer audio playback is hindered by the rapid re-rendering loop mentioned above. With the infinite re-render loop executing hundreds of times per second, the `stopCountdownAudio()` is repeatedly invoked right after `playCountdownAudio()`, cancelling the audio immediately before it can play.
**Fix:**
Applying the `useCallback` fix to resolve the memory leak will simultaneously allow the `playCountdownAudio()` call to complete without being immediately interrupted by subsequent renders.

### Affected Files
- `src/components/BottomNavigation.tsx`
- `src/components/NearestWinsInterface.tsx`
