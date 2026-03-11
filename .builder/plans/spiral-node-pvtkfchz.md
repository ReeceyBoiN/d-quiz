# Fix: Rapid Skip Button Causes Multiple Tracks to Play Simultaneously

## Root Cause

In `src/utils/musicRoundAudio.ts`, the `skipToNextClip()` function has a race condition:

1. When skip is clicked, it starts a **1-second fade-out** using a `setTimeout(…, 1000)` — but this timeout is **not tracked or guarded**.
2. Inside that timeout, it stops the current source, then schedules `playNextClip()` after a 200ms gap (via `gapTimeoutId`).
3. When skip is clicked **rapidly**, each click creates a **new untracked 1000ms timeout**. The `gapTimeoutId` is cleared at the top, but the 1-second fade timeout is fire-and-forget.
4. Result: multiple untracked timeouts each eventually call `playNextClip()`, causing multiple clips to start playing on top of each other.

## Fix — `src/utils/musicRoundAudio.ts`

### 1. Add a `skipTimeoutId` field to `PlaybackState`
Track the 1-second fade-out timeout so it can be cancelled on subsequent skips.

### 2. Guard `skipToNextClip()` against re-entry
- At the top of `skipToNextClip()`, clear any existing `skipTimeoutId` before starting a new one.
- Also null-out the `onended` handler on the current source immediately (not just inside the timeout) to prevent the natural end handler from also triggering `playNextClip()`.

### 3. Clear `skipTimeoutId` in `stopPlayback()` and `cleanupPlayback()`
Ensure the skip timeout is also cleaned up when playback is stopped or cleaned up entirely.

### Concrete changes in `skipToNextClip()`:

```
function skipToNextClip() {
  if (!playbackState || !playbackState.isPlaying) return;

  const state = playbackState;

  // Clear any pending skip timeout from a previous rapid click
  if (state.skipTimeoutId) {
    clearTimeout(state.skipTimeoutId);
    state.skipTimeoutId = undefined;
  }

  // Clear any pending gap timeout
  if (state.gapTimeoutId) {
    clearTimeout(state.gapTimeoutId);
    state.gapTimeoutId = undefined;
  }

  // Immediately null out onended to prevent double-fire
  if (state.sourceNode) {
    state.sourceNode.onended = null;
  }

  const now = state.audioContext.currentTime;

  // Fade out current clip over 1 second
  state.gainNode.gain.cancelScheduledValues(now);
  state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, now);
  state.gainNode.gain.linearRampToValueAtTime(0, now + 1);

  // Track the skip timeout so rapid clicks cancel previous ones
  state.skipTimeoutId = setTimeout(() => {
    state.skipTimeoutId = undefined;

    if (state.sourceNode) {
      try {
        state.sourceNode.stop();
      } catch (e) { /* Already stopped */ }
    }

    // If the current clip is the target clip, stop playback entirely
    if (state.targetClipId && state.currentClipId === state.targetClipId) {
      state.isPlaying = false;
      state.isStopping = true;
      state.onTargetClipFinished?.();
      cleanupPlayback();
      return;
    }

    // 0.2s silence gap, then play next
    state.gapTimeoutId = setTimeout(() => {
      playNextClip();
    }, 200);
  }, 1000);
}
```

### In `PlaybackState` interface, add:
```
skipTimeoutId?: ReturnType<typeof setTimeout>;
```

### In `stopPlayback()` and `cleanupPlayback()`, add clearing:
```
if (state.skipTimeoutId) {
  clearTimeout(state.skipTimeoutId);
  state.skipTimeoutId = undefined;
}
```
