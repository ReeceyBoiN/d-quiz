// Countdown audio utility for managing timer audio playback
// Plays Countdown.wav (normal) or Countdown Silent.wav (silent mode)
// Handles dynamic start time based on timer duration

import { getCountdownAudioPath } from './pathManager';

// Fallback paths for when not in Electron context
const FALLBACK_COUNTDOWN = '../../resorces/sounds/Countdown/Countdown.wav';
const FALLBACK_COUNTDOWN_SILENT = '../../resorces/sounds/Countdown/Countdown Silent.wav';

interface AudioPlayer {
  audio: HTMLAudioElement | null;
  isPlaying: boolean;
}

let currentPlayer: AudioPlayer = {
  audio: null,
  isPlaying: false
};

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

    if (isElectron) {
      return await getCountdownAudioPath(isSilent);
    } else {
      // Fallback for non-Electron context
      return isSilent ? FALLBACK_COUNTDOWN_SILENT : FALLBACK_COUNTDOWN;
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
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        resolve();
      };

      const handleError = () => {
        audio.removeEventListener('error', handleError);
        reject(new Error('Failed to load audio'));
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      audio.addEventListener('error', handleError, { once: true });

      // Set a timeout in case metadata loading takes too long
      setTimeout(() => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        resolve();
      }, 2000);
    });

    const audioDuration = audio.duration;

    // Calculate start time: always play from the END of the audio, working backwards
    // startTime = audioDuration - (timerDuration + 1)
    // This ensures we play the last (timerDuration + 1) seconds of the audio
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
