/**
 * Audio Handler - IPC endpoints for audio operations
 * Provides file:// URLs for audio files stored on the host machine
 */

import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { getResourcePaths } from '../../backend/pathInitializer.js';
import { getBuzzerFolder } from '../../utils/buzzerConfig.js';
import { getCurrentBuzzerFolderPath } from '../../backend/buzzerFolderManager.js';

// Allowed audio file extensions
const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|webm)$/i;

/**
 * Convert file path to file:// URL with proper encoding for special characters
 * Windows: C:\Users\name\Documents\... -> file:///C:/Users/name/Documents/...
 * macOS/Linux: /home/user/Documents/... -> file:///home/user/Documents/...
 *
 * Special characters (spaces, etc.) are percent-encoded in each path component
 * Example: "My Document.mp3" -> "file:///path/My%20Document.mp3"
 */
function pathToFileUrl(filePath) {
  // Normalize path separators to forward slashes
  let normalized = filePath.replace(/\\/g, '/');

  // Split by forward slash and encode each component
  const parts = normalized.split('/');
  const encodedParts = parts.map(part => {
    // Encode special characters but preserve the part structure
    // Skip empty parts (for Windows drive letters like C:)
    if (part === '' || part.includes(':')) {
      return part;
    }
    return encodeURIComponent(part);
  });

  const encodedPath = encodedParts.join('/');

  // Add file:/// prefix
  // Windows paths like C:/ need to be file:///C:/
  // Unix paths like /home/ need to be file:////home/
  if (encodedPath.charAt(1) === ':') {
    // Windows path
    return `file:///${encodedPath}`;
  } else {
    // Unix path
    return `file://${encodedPath}`;
  }
}

/**
 * Get the full file path for a buzzer sound
 * Returns a file:// URL that can be used in <audio> elements
 *
 * @param {Object} payload - Payload object containing buzzerName
 * @param {string} payload.buzzerName - Name of the buzzer file (e.g., "ABBA - Dancing Queen.mp3")
 * @returns {string} file:// URL to the buzzer
 */
export async function handleGetBuzzerPath(payload) {
  try {
    const buzzerName = payload?.buzzerName;
    log.info(`[Audio IPC] handleGetBuzzerPath called with: ${buzzerName}`);

    // Validate buzzer name (prevent directory traversal attacks)
    if (!buzzerName || typeof buzzerName !== 'string') {
      log.warn(`[Audio IPC] Invalid buzzer name (type): ${typeof buzzerName}`);
      throw new Error('Buzzer name must be a non-empty string');
    }

    if (buzzerName.includes('..') || buzzerName.includes('/') || buzzerName.includes('\\')) {
      log.warn(`[Audio IPC] Path traversal attempt detected: ${buzzerName}`);
      throw new Error('Invalid buzzer name - path traversal not allowed');
    }

    // Validate file extension
    if (!ALLOWED_AUDIO_EXTENSIONS.test(buzzerName)) {
      log.warn(`[Audio IPC] File extension not allowed: ${buzzerName}`);
      throw new Error('File type not allowed - only audio files are supported');
    }

    // Get the buzzers directory (configurable via SettingsContext)
    let buzzerDir;
    try {
      const customBuzzerPath = getCurrentBuzzerFolderPath();
      buzzerDir = getBuzzerFolder(customBuzzerPath);
    } catch (folderError) {
      log.warn(`[Audio IPC] Error getting buzzer folder, using default path:`, folderError.message);
      // Fallback to default directly from pathInitializer
      try {
        const resourcePaths = getResourcePaths();
        buzzerDir = path.join(resourcePaths.sounds, 'Buzzers');
      } catch (fallbackError) {
        log.error(`[Audio IPC] Failed to get default buzzer path:`, fallbackError.message);
        throw new Error('Unable to determine buzzer directory');
      }
    }
    const filePath = path.join(buzzerDir, buzzerName);

    // Additional security: ensure the resolved path is within the buzzers directory
    const resolvedPath = path.resolve(filePath);
    const resolvedBuzzerDir = path.resolve(buzzerDir);
    if (!resolvedPath.startsWith(resolvedBuzzerDir)) {
      log.warn(`[Audio IPC] Path traversal attempt detected (resolved): ${buzzerName}`);
      throw new Error('Invalid path - file must be within Buzzers directory');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log.warn(`[Audio IPC] Buzzer file not found: ${filePath}`);
      throw new Error(`Buzzer file not found: ${buzzerName}`);
    }

    // Convert to file:// URL
    const fileUrl = pathToFileUrl(filePath);
    log.info(`[Audio IPC] Converted to file URL: ${fileUrl}`);

    return { filePath, fileUrl };
  } catch (error) {
    log.error(`[Audio IPC] Error in handleGetBuzzerPath:`, error.message);
    throw new Error(`Failed to get buzzer path: ${error.message}`);
  }
}

export default handleGetBuzzerPath;
