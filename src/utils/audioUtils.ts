/**
 * Audio Utility for playing sound effects
 * Uses Electron IPC to list audio files and HTMLAudioElement for playback
 */

import { listDirectory } from './fileBrowser';
import { getSoundsPath } from './pathManager';

/**
 * List audio files in a directory
 * @param folderPath - Absolute path to the sound folder (e.g., C:\PopQuiz\d-quiz\resources\sounds\Applause)
 * @returns Array of file paths in the directory
 */
async function listAudioFiles(folderPath: string): Promise<string[]> {
  try {
    const entries = await listDirectory(folderPath);

    // Filter for audio files (mp3, wav, etc.)
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    return entries
      .map(entry => entry.path)
      .filter(path => audioExtensions.some(ext => path.toLowerCase().endsWith(ext)));
  } catch (error) {
    console.warn(`Failed to list audio files in ${folderPath}:`, error);
    return [];
  }
}

/**
 * Select a random file from an array
 * @param files - Array of file paths
 * @returns Randomly selected file path or null if array is empty
 */
function selectRandomFile(files: string[]): string | null {
  if (!files || files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

/**
 * Convert Windows file path to file:// URL
 * @param windowsPath - Windows absolute path (e.g., C:\folder\file.mp3)
 * @returns file:// URL
 */
function pathToFileUrl(windowsPath: string): string {
  // Convert Windows path to file URL
  // Replace backslashes with forward slashes and add file:// protocol
  let filePath = windowsPath.replace(/\\/g, '/');

  // If path doesn't start with a drive letter pattern, it might already be partial
  if (!filePath.match(/^[A-Za-z]:/)) {
    filePath = '/' + filePath;
  }

  return 'file:///' + filePath;
}

/**
 * Play an audio file
 * @param filePath - Absolute path to the audio file (Windows path)
 * @param volume - Volume level (0-1), defaults to 1
 */
function playAudioFile(filePath: string, volume: number = 1): void {
  try {
    const fileUrl = pathToFileUrl(filePath);
    const audio = new Audio(fileUrl);
    audio.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    audio.play().catch(error => {
      console.warn(`Failed to play audio file ${filePath}:`, error);
    });
  } catch (error) {
    console.warn(`Error creating audio element for ${filePath}:`, error);
  }
}

/**
 * Play a random sound from a directory
 * @param folderPath - Absolute path to the sound folder
 * @param volume - Volume level (0-1), defaults to 1
 */
export async function playRandomSound(
  folderPath: string,
  volume: number = 1
): Promise<void> {
  try {
    const audioFiles = await listAudioFiles(folderPath);
    console.log('[audioUtils] playRandomSound - folderPath:', folderPath, 'files found:', audioFiles.length, 'files:', audioFiles);
    const selectedFile = selectRandomFile(audioFiles);

    if (selectedFile) {
      console.log('[audioUtils] Selected file:', selectedFile);
      playAudioFile(selectedFile, volume);
    } else {
      console.warn('[audioUtils] No audio files found in:', folderPath);
    }
  } catch (error) {
    console.warn(`Failed to play random sound from ${folderPath}:`, error);
    // Silent fail - don't show errors to user
  }
}

/**
 * Play applause sound (random file from Applause folder)
 */
export async function playApplauseSound(): Promise<void> {
  try {
    const soundsPath = await getSoundsPath();
    await playRandomSound(`${soundsPath}/Applause`, 1);
  } catch (error) {
    console.warn('Failed to play applause sound:', error);
  }
}

/**
 * Play fail sound (random file from Fail Sounds folder)
 */
export async function playFailSound(): Promise<void> {
  try {
    const soundsPath = await getSoundsPath();
    const failSoundsPath = `${soundsPath}/Fail Sounds`;
    console.log('[audioUtils] playFailSound - looking in:', failSoundsPath);
    await playRandomSound(failSoundsPath, 1);
  } catch (error) {
    console.warn('Failed to play fail sound:', error);
  }
}
