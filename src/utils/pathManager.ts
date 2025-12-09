/**
 * Path Manager for PopQuiz Resources
 * Manages resource paths for:
 * - Documents/PopQuiz/Resources/Phone Slideshow (images for player devices)
 * - Documents/PopQuiz/Resources/Display Slideshow (images for host display)
 * - Documents/PopQuiz/Resources/Sounds (audio files)
 */

// Resource folder structure
const RESOURCES_ROOT = 'PopQuiz';
const RESOURCES_SUBFOLDER = 'Resources';
const PHONE_SLIDESHOW_FOLDER = 'Phone Slideshow';
const DISPLAY_SLIDESHOW_FOLDER = 'Display Slideshow';
const SOUNDS_FOLDER = 'Sounds';

interface ResourcePaths {
  phoneSlideshow: string;
  displaySlideshow: string;
  sounds: string;
  root: string;
}

let cachedPaths: ResourcePaths | null = null;

/**
 * Check if we're running in Electron context
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         typeof (window as any).api !== 'undefined' &&
         typeof (window as any).api.ipc !== 'undefined';
}

/**
 * Get the full resource paths from Electron
 * Paths are relative to user's Documents folder
 */
export async function getResourcePaths(): Promise<ResourcePaths> {
  if (cachedPaths) {
    return cachedPaths;
  }

  try {
    if (!isElectron()) {
      throw new Error('Not running in Electron context');
    }

    const paths = await (window as any).api.ipc.invoke('get-resource-paths');
    cachedPaths = paths;
    return paths;
  } catch (error) {
    console.error('[PathManager] Error getting resource paths from Electron:', error);
    throw new Error('Failed to initialize resource paths');
  }
}

/**
 * Get the phone slideshow folder path
 */
export async function getPhoneSlideshowPath(): Promise<string> {
  const paths = await getResourcePaths();
  return paths.phoneSlideshow;
}

/**
 * Get the display slideshow folder path
 */
export async function getDisplaySlideshowPath(): Promise<string> {
  const paths = await getResourcePaths();
  return paths.displaySlideshow;
}

/**
 * Get the sounds folder path
 */
export async function getSoundsPath(): Promise<string> {
  const paths = await getResourcePaths();
  return paths.sounds;
}

/**
 * Get the root PopQuiz resources folder path
 */
export async function getResourcesRootPath(): Promise<string> {
  const paths = await getResourcePaths();
  return paths.root;
}

/**
 * Clear cached paths (useful for testing or when paths change)
 */
export function clearPathCache(): void {
  cachedPaths = null;
}

/**
 * Get a countdown audio file path
 */
export async function getCountdownAudioPath(isSilent: boolean = false): Promise<string> {
  const soundsPath = await getSoundsPath();
  const fileName = isSilent ? 'Countdown Silent.wav' : 'Countdown.wav';
  return `${soundsPath}/Countdown/${fileName}`;
}

/**
 * Get an applause audio file path
 */
export async function getAppauseAudioPath(): Promise<string> {
  const soundsPath = await getSoundsPath();
  return `${soundsPath}/Applause/Applause1.wav`;
}

/**
 * Initialize resource paths on app start
 * This is called automatically by Electron and shouldn't be called directly
 */
export function initializePaths(): void {
  // Paths are initialized by Electron on startup
  // This function is here for consistency
  console.log('[PathManager] Path initialization triggered');
}
