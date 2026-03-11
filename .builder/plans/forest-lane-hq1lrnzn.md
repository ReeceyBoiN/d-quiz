# Fix: Music Round Skip Button & External Display Header

## Problem 1: Skip button continues playlist even on target song
When the skip button is pressed during music round playback, `skipToNextClip()` in `src/utils/musicRoundAudio.ts:291` always fades out the current clip and then calls `playNextClip()` after a short gap. It doesn't check whether the current clip is the **target clip**. 

**Expected behavior:**
- If the current clip is **not** the target → fade out, then fade into next clip (current behavior, correct)
- If the current clip **is** the target → fade out and **stay paused** (trigger `onTargetClipFinished` callback, same as natural end)

## Problem 2: External display shows "Question 1 of X" during music round
The external display renders `content === 'question'` at `ExternalDisplayWindow.tsx:752`, which always shows "Question {number} of {total}" in the header. During music rounds, the data is sent with `type: 'music-buzz'` but uses the same `'question'` content type, so it incorrectly shows "Question 1".

**Expected:** Show "Music Round - Buzz in when you hear:" instead of "Question X of Y" for music-buzz type.

---

## Changes

### 1. `src/utils/musicRoundAudio.ts` — Skip should stop on target clip

In `skipToNextClip()` (line ~291), after the fade-out completes, check if the current clip is the target clip. If so, call `onTargetClipFinished` and clean up instead of calling `playNextClip()`.

```ts
// Inside the setTimeout callback after fade-out (line ~309-322):
// After stopping the source node, check if this was the target clip
if (state.targetClipId && state.currentClipId === state.targetClipId) {
  state.isPlaying = false;
  state.isStopping = true;
  state.onTargetClipFinished?.();
  cleanupPlayback();
  return;
}
// Otherwise proceed to next clip as before
state.gapTimeoutId = setTimeout(() => {
  playNextClip();
}, 200);
```

### 2. `src/components/ExternalDisplayWindow.tsx` — Music round header

In the `case 'question'` block (line ~758-761), check `displayData.data?.type === 'music-buzz'`. If true, render "Music Round - Buzz in when you hear:" instead of "Question {N} of {T}".

```tsx
<h1 style={...}>
  {displayData.data?.type === 'music-buzz'
    ? 'Music Round - Buzz in when you hear:'
    : `Question ${displayData.data?.questionNumber || 1} of ${displayData.data?.totalQuestions || 1}`
  }
</h1>
```

## Files to modify

| File | Change |
|------|--------|
| `src/utils/musicRoundAudio.ts` | Add target clip check in `skipToNextClip()` after fade-out |
| `src/components/ExternalDisplayWindow.tsx` | Conditionally render music round header instead of "Question X" |
