/**
 * Music Round Audio Engine
 * Handles loading, decoding, region selection, normalization, and playback
 * of audio clips for the music round game mode.
 */

export interface MusicClip {
  id: string;
  name: string;
  filePath: string;
  duration: number;
  regionStart: number;
  regionEnd: number;
  buffer: AudioBuffer;
}

export interface PlaybackHandle {
  stop: () => void;
  skipToNext: () => void;
  isPlaying: () => boolean;
}

interface PlaybackState {
  audioContext: AudioContext;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  compressorNode: DynamicsCompressorNode;
  currentClipIndex: number;
  clips: MusicClip[];
  clipStartTime: number; // Date.now() when current clip region started playing
  clipEndTime: number;   // Date.now() when current clip region will end
  currentClipId: string;
  isPlaying: boolean;
  isStopping: boolean;
  masterVolume: number;
  targetClipId?: string;
  onClipChange?: (clipId: string, clipIndex: number, startTime: number, endTime: number) => void;
  onPlaybackEnd?: () => void;
  onTargetClipFinished?: () => void;
  gapTimeoutId?: ReturnType<typeof setTimeout>;
  skipTimeoutId?: ReturnType<typeof setTimeout>;
  progressIntervalId?: ReturnType<typeof setInterval>;
}

let playbackState: PlaybackState | null = null;

/**
 * Convert a file path to a file:// URL suitable for fetch
 */
function pathToFileUrl(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (!normalized.match(/^[A-Za-z]:/)) {
    normalized = '/' + normalized;
  }
  return 'file:///' + normalized;
}

/**
 * Reverse an AudioBuffer's samples so it plays backwards
 */
export function reverseAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[src.length - 1 - i];
    }
  }
  return reversed;
}

/**
 * Load and decode an audio file into an AudioBuffer
 */
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
  } catch (err) {
    throw err;
  } finally {
    if (!sharedCtx) ctx.close();
  }
}

/**
 * Auto-select a random region of the track, avoiding first/last 20s.
 * If the track is too short, margins are relaxed proportionally.
 */
export function autoSelectRegion(duration: number, clipLength: number): { start: number; end: number } {
  // If clip length >= duration, just play the whole thing
  if (clipLength >= duration) {
    return { start: 0, end: duration };
  }

  let margin = 20;

  // Relax margin if track is too short for full margins
  const availableWindow = duration - clipLength;
  if (availableWindow < margin * 2) {
    margin = Math.max(0, availableWindow / 2);
  }

  const minStart = margin;
  const maxStart = duration - clipLength - margin;

  if (maxStart <= minStart) {
    // Not enough room, center the clip
    const start = Math.max(0, (duration - clipLength) / 2);
    return { start, end: start + clipLength };
  }

  const start = minStart + Math.random() * (maxStart - minStart);
  return { start, end: start + clipLength };
}

/**
 * Load all audio files from a list of file paths and prepare MusicClip objects.
 * If reversed is true, each buffer's samples are reversed so clips play backwards.
 */
export async function loadClips(
  filePaths: { name: string; path: string }[],
  clipLength: number,
  onProgress?: (loaded: number, total: number) => void,
  reversed?: boolean
): Promise<MusicClip[]> {
  const CONCURRENCY = 4;
  const sharedCtx = new AudioContext();
  let completed = 0;

  // Create a task for each file that returns a MusicClip or null on failure
  const tasks: (() => Promise<MusicClip | null>)[] = filePaths.map((file, i) => async () => {
    try {
      const { buffer, duration } = await loadAudioFile(file.path, sharedCtx);
      const region = autoSelectRegion(duration, clipLength);
      const finalBuffer = reversed ? reverseAudioBuffer(buffer) : buffer;
      const clip: MusicClip = {
        id: `clip-${i}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        filePath: file.path,
        duration,
        regionStart: reversed ? (duration - region.end) : region.start,
        regionEnd: reversed ? (duration - region.start) : region.end,
        buffer: finalBuffer,
      };
      completed++;
      onProgress?.(completed, filePaths.length);
      return clip;
    } catch (err) {
      console.error(`[MusicRoundAudio] Failed to load ${file.name}:`, err);
      completed++;
      onProgress?.(completed, filePaths.length);
      return null;
    }
  });

  // Run tasks with concurrency limit
  const results: (MusicClip | null)[] = new Array(tasks.length);
  let taskIndex = 0;

  async function worker() {
    while (taskIndex < tasks.length) {
      const idx = taskIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker());
  await Promise.all(workers);

  try { sharedCtx.close(); } catch (e) { /* already closed */ }

  // Filter out nulls and preserve original order
  return results.filter((clip): clip is MusicClip => clip !== null);
}

/**
 * Play a sequence of clips with fade-in, fade-out, and silence gaps.
 * Uses DynamicsCompressorNode for auto-leveling loudness across clips.
 *
 * If targetClipId is provided, playback will stop automatically after
 * that clip finishes, and onTargetClipFinished will be called.
 */
export function playClipSequence(
  clips: MusicClip[],
  masterVolume: number,
  onClipChange: (clipId: string, clipIndex: number, startTime: number, endTime: number) => void,
  onPlaybackEnd: () => void,
  targetClipId?: string,
  onTargetClipFinished?: () => void
): PlaybackHandle {
  const audioContext = new AudioContext();

  // Create compressor for auto-leveling
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
  compressor.knee.setValueAtTime(30, audioContext.currentTime);
  compressor.ratio.setValueAtTime(12, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  compressor.release.setValueAtTime(0.25, audioContext.currentTime);
  compressor.connect(audioContext.destination);

  // Create gain node for volume control and fading
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.connect(compressor);

  playbackState = {
    audioContext,
    sourceNode: null,
    gainNode,
    compressorNode: compressor,
    currentClipIndex: -1,
    clips,
    clipStartTime: 0,
    clipEndTime: 0,
    currentClipId: '',
    isPlaying: true,
    isStopping: false,
    masterVolume: masterVolume / 100,
    targetClipId,
    onClipChange,
    onPlaybackEnd,
    onTargetClipFinished,
  };

  playNextClip();

  return {
    stop: () => stopPlayback(),
    skipToNext: () => skipToNextClip(),
    isPlaying: () => playbackState?.isPlaying ?? false,
  };
}

function playNextClip() {
  if (!playbackState || playbackState.isStopping) return;

  const state = playbackState;
  state.currentClipIndex++;

  if (state.currentClipIndex >= state.clips.length) {
    // All clips played
    state.isPlaying = false;
    state.onPlaybackEnd?.();
    cleanupPlayback();
    return;
  }

  const clip = state.clips[state.currentClipIndex];
  const regionDuration = clip.regionEnd - clip.regionStart;
  const fadeTime = 1; // 1 second fade

  // Create buffer source
  const source = state.audioContext.createBufferSource();
  source.buffer = clip.buffer;
  source.connect(state.gainNode);

  state.sourceNode = source;
  state.currentClipId = clip.id;

  const now = state.audioContext.currentTime;

  // Fade in over 1 second
  state.gainNode.gain.cancelScheduledValues(now);
  state.gainNode.gain.setValueAtTime(0, now);
  state.gainNode.gain.linearRampToValueAtTime(state.masterVolume, now + fadeTime);

  // Fade out 1 second before end
  const fadeOutStart = now + regionDuration - fadeTime;
  if (fadeOutStart > now + fadeTime) {
    state.gainNode.gain.setValueAtTime(state.masterVolume, fadeOutStart);
  }
  state.gainNode.gain.linearRampToValueAtTime(0, now + regionDuration);

  // Record timing
  const clipStartTime = Date.now();
  const clipEndTime = clipStartTime + (regionDuration * 1000);
  state.clipStartTime = clipStartTime;
  state.clipEndTime = clipEndTime;

  // Notify about clip change
  state.onClipChange?.(clip.id, state.currentClipIndex, clipStartTime, clipEndTime);

  // Start playback from region start, for region duration
  source.start(0, clip.regionStart, regionDuration);

  // Schedule next clip after this one ends + 0.2s silence gap
  source.onended = () => {
    if (!playbackState || playbackState.isStopping) return;

    // If this was the target clip, stop playback and notify
    if (state.targetClipId && clip.id === state.targetClipId) {
      state.isPlaying = false;
      state.isStopping = true;
      state.onTargetClipFinished?.();
      cleanupPlayback();
      return;
    }

    // 0.2s silence gap before next clip
    state.gapTimeoutId = setTimeout(() => {
      playNextClip();
    }, 200);
  };
}

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
      } catch (e) {
        // Already stopped
      }
    }

    // If the current clip is the target clip, stop playback entirely
    if (state.targetClipId && state.currentClipId === state.targetClipId) {
      state.isPlaying = false;
      state.isStopping = true;
      state.onTargetClipFinished?.();
      cleanupPlayback();
      return;
    }

    // 0.2s silence gap after fade out, then play next clip
    state.gapTimeoutId = setTimeout(() => {
      playNextClip();
    }, 200);
  }, 1000);
}

function stopPlayback() {
  if (!playbackState) return;

  const state = playbackState;
  state.isStopping = true;
  state.isPlaying = false;

  // Clear any pending gap timeout
  if (state.gapTimeoutId) {
    clearTimeout(state.gapTimeoutId);
    state.gapTimeoutId = undefined;
  }

  // Clear any pending skip timeout
  if (state.skipTimeoutId) {
    clearTimeout(state.skipTimeoutId);
    state.skipTimeoutId = undefined;
  }

  const now = state.audioContext.currentTime;

  // Quick fade out
  state.gainNode.gain.cancelScheduledValues(now);
  state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, now);
  state.gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

  setTimeout(() => {
    if (state.sourceNode) {
      try {
        state.sourceNode.onended = null;
        state.sourceNode.stop();
      } catch (e) {
        // Already stopped
      }
    }
    cleanupPlayback();
  }, 600);
}

function cleanupPlayback() {
  if (!playbackState) return;
  // Clear any pending timeouts
  if (playbackState.gapTimeoutId) {
    clearTimeout(playbackState.gapTimeoutId);
  }
  if (playbackState.skipTimeoutId) {
    clearTimeout(playbackState.skipTimeoutId);
  }
  try {
    playbackState.audioContext.close();
  } catch (e) {
    // Already closed
  }
  playbackState = null;
}

/**
 * Update master volume during playback
 */
export function setMasterVolume(volume: number) {
  if (!playbackState) return;
  playbackState.masterVolume = volume / 100;
  const now = playbackState.audioContext.currentTime;
  playbackState.gainNode.gain.cancelScheduledValues(now);
  playbackState.gainNode.gain.setValueAtTime(volume / 100, now);
}

/**
 * Get current playback state for buzz validation
 */
export function getCurrentPlaybackState(): {
  currentClipId: string;
  clipStartTime: number;
  clipEndTime: number;
  isPlaying: boolean;
  currentClipIndex: number;
} | null {
  if (!playbackState) return null;
  return {
    currentClipId: playbackState.currentClipId,
    clipStartTime: playbackState.clipStartTime,
    clipEndTime: playbackState.clipEndTime,
    isPlaying: playbackState.isPlaying,
    currentClipIndex: playbackState.currentClipIndex,
  };
}

/**
 * Preview a single clip (for setup screen).
 * If reversed is true, the buffer samples are reversed before playback.
 */
export function previewClip(
  buffer: AudioBuffer,
  regionStart: number,
  regionEnd: number,
  volume: number,
  reversed?: boolean
): { stop: () => void } {
  const ctx = new AudioContext();
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(volume / 100, ctx.currentTime);
  gainNode.connect(ctx.destination);

  let playBuffer = buffer;
  if (reversed) {
    playBuffer = reverseAudioBuffer(buffer);
    // Adjust region for reversed buffer
    const duration = buffer.duration;
    const newStart = duration - regionEnd;
    const newEnd = duration - regionStart;
    regionStart = newStart;
    regionEnd = newEnd;
  }

  const source = ctx.createBufferSource();
  source.buffer = playBuffer;
  source.connect(gainNode);
  source.start(0, regionStart, regionEnd - regionStart);

  let stopped = false;

  source.onended = () => {
    stopped = true;
    try { ctx.close(); } catch (e) { /* */ }
  };

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
        ctx.close();
      } catch (e) { /* Already stopped */ }
    }
  };
}
