# Faster Audio Clip Loading in Music Round

## Problem
When loading 18 tracks, `loadClips()` in `src/utils/musicRoundAudio.ts:127` processes them **one at a time** (sequential `for` loop with `await`). Each track goes through: create AudioContext → fetch file → decode audio → close AudioContext. This means track 2 doesn't start loading until track 1 is fully decoded.

## Optimizations

### 1. Parallel loading with concurrency limit
Load multiple tracks simultaneously instead of one-by-one. Use a concurrency limit (e.g. 4 at a time) to avoid overwhelming the system with 18 simultaneous large file decodes.

### 2. Reuse a single AudioContext for all decoding
Currently `loadAudioFile()` creates and closes a **new AudioContext for every single track**. Creating/destroying AudioContexts is expensive. Instead, create one shared AudioContext and reuse it for all 18 `decodeAudioData` calls.

### 3. Keep progress reporting working
The progress callback still needs to fire as each clip finishes, so the UI progress bar updates smoothly.

## Changes

### File: `src/utils/musicRoundAudio.ts`

**`loadClips()` function (~line 127):**
- Create a single shared `AudioContext` before the loop
- Process files in parallel batches (concurrency of 4) using a worker-pool pattern
- Track completed count for progress reporting
- Close the shared AudioContext once all clips are done

**`loadAudioFile()` function (~line 83):**
- Add an optional `ctx` parameter so callers can pass in a shared AudioContext
- When a shared context is provided, skip creating/closing a new one

## Implementation detail

```ts
// loadAudioFile gets optional shared context
export async function loadAudioFile(
  filePath: string,
  sharedCtx?: AudioContext
): Promise<{ buffer: AudioBuffer; duration: number }> {
  const ctx = sharedCtx || new AudioContext();
  try {
    const fileUrl = pathToFileUrl(filePath);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return { buffer: audioBuffer, duration: audioBuffer.duration };
  } finally {
    if (!sharedCtx) ctx.close();
  }
}

// loadClips uses parallel loading with concurrency limit
export async function loadClips(...) {
  const clips: MusicClip[] = [];
  const sharedCtx = new AudioContext();
  let completed = 0;
  const CONCURRENCY = 4;

  // Process in parallel with concurrency limit
  const tasks = filePaths.map((file, i) => async () => {
    const { buffer, duration } = await loadAudioFile(file.path, sharedCtx);
    const region = autoSelectRegion(duration, clipLength);
    const finalBuffer = reversed ? reverseAudioBuffer(buffer) : buffer;
    const clip = { id: `clip-${i}`, name: ..., ... };
    completed++;
    onProgress?.(completed, filePaths.length);
    return clip;
  });

  // Run with concurrency limit of 4
  // (simple semaphore pattern)
  const results = await runWithConcurrency(tasks, CONCURRENCY);
  
  // Sort results back to original order
  clips.push(...results.filter(Boolean).sort((a, b) => ...));
  
  sharedCtx.close();
  return clips;
}
```

## Expected improvement
- With 18 tracks loaded 4-at-a-time instead of 1-at-a-time, loading should be roughly **3-4x faster**
- Eliminating 17 unnecessary AudioContext create/destroy cycles saves additional overhead
- No behavioral changes — progress bar, clip ordering, and reversed mode all work the same
