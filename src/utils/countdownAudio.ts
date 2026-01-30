// Countdown audio utility for managing timer audio playback
// Plays Countdown.wav (normal) or Countdown Silent.wav (silent mode)
// Handles dynamic start time based on timer duration

import { getCountdownAudioPath } from './pathManager';

// Fallback paths for when not in Electron context
const FALLBACK_COUNTDOWN = '../../resources/sounds/Countdown/Countdown.wav';
const FALLBACK_COUNTDOWN_SILENT = '../../resources/sounds/Countdown/Countdown Silent.wav';

interface AudioPlayer {
  audio: HTMLAudioElement | null;
  isPlaying: boolean;
}

let currentPlayer: AudioPlayer = {
  audio: null,
  isPlaying: false
};

/**
 * Convert a filesystem path to a file:// URL that browsers can load
 * Handles Windows absolute paths (C:\...), Unix paths (/...), and relative paths
 *
 * Examples:
 * - Windows: "C:\Users\Documents\Countdown.wav" -> "file:///C:/Users/Documents/Countdown.wav"
 * - Windows with spaces: "C:\My Documents\Countdown.wav" -> "file:///C:/My%20Documents/Countdown.wav"
 * - Unix: "/home/user/Countdown.wav" -> "file:///home/user/Countdown.wav"
 * - Relative: "../../resources/Countdown.wav" -> "../../resources/Countdown.wav" (unchanged)
 * - URL: "http://example.com/audio.wav" -> "http://example.com/audio.wav" (unchanged)
 *
 * @param path - The filesystem path to convert
 * @returns A file:// URL for absolute paths, or the original path for relative paths
 */
function pathToFileUrl(path: string): string {
  // If it's already a URL (http://, https://, file://), return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path;
  }

  // If it's a relative path, return as-is
  if (!path.startsWith('/') && !path.match(/^[A-Za-z]:/)) {
    return path;
  }

  // Windows absolute path (C:\... or C:/...)
  if (path.match(/^[A-Za-z]:/)) {
    // Convert backslashes to forward slashes
    let normalizedPath = path.replace(/\\/g, '/');
    // Encode spaces and other special characters
    normalizedPath = encodeURI(normalizedPath);
    // Windows paths need file:/// (with three slashes)
    const fileUrl = `file:///${normalizedPath}`;
    console.log('[CountdownAudio] Windows path conversion:', {
      input: path,
      normalized: normalizedPath,
      output: fileUrl
    });
    return fileUrl;
  }

  // Unix absolute path (/)
  if (path.startsWith('/')) {
    // Encode spaces and other special characters
    const encodedPath = encodeURI(path);
    // Unix paths need file:// (with two slashes)
    const fileUrl = `file://${encodedPath}`;
    console.log('[CountdownAudio] Unix path conversion:', {
      input: path,
      output: fileUrl
    });
    return fileUrl;
  }

  return path;
}

/**
 * Get the audio file URL based on mode
 * @param isSilent - If true, uses silent countdown audio; otherwise uses normal countdown
 * @returns URL to the audio file
 */
async function getAudioUrl(isSilent: boolean): Promise<string> {
  try {
    const isElectron = typeof window !== 'undefined' &&
                       typeof (window as any).api !== 'undefined' &&
                       typeof (window as any).api.ipc !== 'undefined';

    console.log('[CountdownAudio] getAudioUrl called:', { isSilent, isElectron });

    if (isElectron) {
      const path = await getCountdownAudioPath(isSilent);
      console.log('[CountdownAudio] Raw path from getCountdownAudioPath:', path);

      // Convert filesystem path to file:// URL for browser Audio API
      const fileUrl = pathToFileUrl(path);
      console.log('[CountdownAudio] Converted to file:// URL:', fileUrl);

      return fileUrl;
    } else {
      // Fallback for non-Electron context (relative paths, no conversion needed)
      const fallbackUrl = isSilent ? FALLBACK_COUNTDOWN_SILENT : FALLBACK_COUNTDOWN;
      console.log('[CountdownAudio] Using fallback path (non-Electron):', fallbackUrl);
      return fallbackUrl;
    }
  } catch (error) {
    console.warn('[CountdownAudio] Error getting dynamic audio path, using fallback:', error);
    return isSilent ? FALLBACK_COUNTDOWN_SILENT : FALLBACK_COUNTDOWN;
  }
}

/**
 * Play countdown audio with support for playing the last N+1 seconds
 * Always plays from the END of the audio clip, going backwards by timer duration + 1 second
 * Examples:
 * - Timer 12 sec: plays last 13 seconds of audio
 * - Timer 15 sec: plays last 16 seconds of audio
 * - Timer 29-30 sec: plays full audio (or close to it)
 * @param timerDuration - Duration of the timer in seconds (e.g., 12, 30)
 * @param isSilent - If true, uses silent countdown; if false, uses normal countdown with sound
 */
export async function playCountdownAudio(timerDuration: number, isSilent: boolean = false): Promise<void> {
  try {
    // Stop any currently playing audio
    stopCountdownAudio();

    const audioUrl = await getAudioUrl(isSilent);
    const audio = new Audio(audioUrl);

    // Set up audio properties
    audio.volume = 1.0;

    // Wait for audio metadata to be loaded so we can get the duration
    await new Promise<void>((resolve, reject) => {
      const handleLoadedMetadata = () => {
        console.log('[CountdownAudio] Audio metadata loaded successfully');
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        resolve();
      };

      const handleError = (event: Event) => {
        const audioError = (audio as any).error;
        const errorCode = audioError?.code;
        const errorMessage = audioError?.message;
        console.error('[CountdownAudio] Audio loading error:', {
          errorCode,
          errorMessage,
          errorName: audioError?.code === 4 ? 'ERR_FILE_NOT_FOUND' : `ERR_CODE_${errorCode}`,
          audioUrl: audio.src
        });
        audio.removeEventListener('error', handleError);
        reject(new Error(`Failed to load audio: ${errorMessage || 'Unknown error'}`));
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      audio.addEventListener('error', handleError, { once: true });

      // Set a timeout in case metadata loading takes too long
      const timeoutId = setTimeout(() => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        console.warn('[CountdownAudio] Audio metadata loading timed out after 2000ms', {
          audioUrl: audio.src,
          duration: audio.duration,
          readyState: audio.readyState
        });
        // Reject the promise to properly signal the timeout
        reject(new Error('Audio metadata loading timed out after 2000ms'));
      }, 2000);

      // Clean up timeout if metadata loads successfully
      const cleanupTimeout = () => clearTimeout(timeoutId);
      audio.addEventListener('loadedmetadata', cleanupTimeout, { once: true });
      audio.addEventListener('error', cleanupTimeout, { once: true });
    });

    // Safely handle cases where metadata didn't load (duration would be NaN)
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0;

    // Calculate start time: always play from the END of the audio, working backwards
    // startTime = audioDuration - (timerDuration + 1)
    // This ensures we play the last (timerDuration + 1) seconds of the audio
    // If duration is 0 (metadata didn't load), start from beginning
    const startTime = Math.max(0, audioDuration - (timerDuration + 1));

    // Set the start time and play
    audio.currentTime = startTime;

    currentPlayer = {
      audio,
      isPlaying: true
    };

    // Play the audio
    await audio.play();

    console.log('[CountdownAudio] Playing audio:', {
      isSilent,
      timerDuration,
      audioDuration,
      startTime,
      durationToPlay: audioDuration - startTime
    });
  } catch (error) {
    console.error('[CountdownAudio] Error playing audio:', error);
    currentPlayer = {
      audio: null,
      isPlaying: false
    };
  }
}

/**
 * Stop the currently playing countdown audio
 */
export function stopCountdownAudio(): void {
  if (currentPlayer.audio) {
    try {
      currentPlayer.audio.pause();
      currentPlayer.audio.currentTime = 0;
    } catch (error) {
      console.error('[CountdownAudio] Error stopping audio:', error);
    }
  }

  currentPlayer = {
    audio: null,
    isPlaying: false
  };
}

/**
 * Check if countdown audio is currently playing
 */
export function isCountdownAudioPlaying(): boolean {
  return currentPlayer.isPlaying && currentPlayer.audio !== null && !currentPlayer.audio.paused;
}
