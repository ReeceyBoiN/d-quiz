/**
 * API utility for making HTTP calls to the backend
 * Uses dynamic backend URL from host info
 */

interface HostInfo {
  baseUrl: string; // e.g., "http://192.168.1.117:4310"
}

/**
 * Fetch the list of available buzzer sounds
 * @param hostInfo - Host info containing backend URL
 * @returns Array of buzzer sound filenames
 */
export async function getBuzzersList(hostInfo: HostInfo | null): Promise<string[]> {
  if (!hostInfo) {
    console.error('[API] Host info is not available');
    return [];
  }

  try {
    const apiUrl = `${hostInfo.baseUrl}/api/buzzers/list`;
    console.log('[API] Fetching buzzers from:', apiUrl);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to load buzzers: ${response.statusText}`);
    }

    const data = await response.json();
    const buzzers = data.buzzers || [];
    console.log('[API] Successfully loaded buzzers:', buzzers);

    return buzzers;
  } catch (error) {
    console.error('[API] Error loading buzzer list:', error);
    return [];
  }
}

/**
 * Get the URL for playing a buzzer sound
 * @param hostInfo - Host info containing backend URL
 * @param buzzerSound - Buzzer sound filename
 * @returns Full URL to the buzzer sound
 */
export function getBuzzerUrl(hostInfo: HostInfo | null, buzzerSound: string): string {
  if (!hostInfo) {
    console.error('[API] Host info is not available');
    return '';
  }

  return `${hostInfo.baseUrl}/api/buzzers/${buzzerSound}`;
}

/**
 * Get the local file path for a buzzer sound via IPC
 * Returns a file:// URL that can be used in <audio> elements
 * This avoids CSP issues and is more efficient than HTTP requests
 *
 * @param buzzerSound - Buzzer sound filename (e.g., "ABBA - Dancing Queen.mp3")
 * @returns file:// URL to the buzzer sound
 */
export async function getBuzzerFilePath(buzzerSound: string): Promise<string> {
  if (!buzzerSound) {
    throw new Error('Buzzer sound name is required');
  }

  try {
    console.log('[API] Requesting buzzer file path via IPC:', buzzerSound);

    // Call the IPC handler to get the file path
    const result = await (window as any).api?.ipc?.invoke('audio/get-buzzer-path', { buzzerName: buzzerSound });

    if (!result) {
      throw new Error('No response from IPC handler');
    }

    if (!result.ok) {
      throw new Error(result.error || 'Failed to get buzzer file path');
    }

    const { fileUrl } = result.data;
    console.log('[API] Successfully got buzzer file URL:', fileUrl);
    return fileUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[API] Error getting buzzer file path via IPC:', errorMsg);
    throw new Error(`Failed to get buzzer file path: ${errorMsg}`);
  }
}
