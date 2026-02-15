/**
 * Buzzer Folder Manager
 * Maintains the current buzzer folder path in the backend
 * This path is updated by the host app via IPC when the user changes the folder
 */

import log from 'electron-log';

// Module-level variable to store current buzzer folder path
let currentBuzzerFolderPath = null;

/**
 * Set the current buzzer folder path
 * Called from IPC when the host app updates the folder setting
 * 
 * @param {string|null} folderPath - Path to the buzzer folder, or null to reset to default
 */
function setCurrentBuzzerFolderPath(folderPath) {
  log.info(`[BuzzerFolderManager] Setting buzzer folder path to: ${folderPath || 'default'}`);
  currentBuzzerFolderPath = folderPath;
}

/**
 * Get the current buzzer folder path
 * 
 * @returns {string|null} - Current buzzer folder path or null (will use default)
 */
function getCurrentBuzzerFolderPath() {
  return currentBuzzerFolderPath;
}

/**
 * Reset to default buzzer folder path
 */
function resetBuzzerFolderPath() {
  log.info('[BuzzerFolderManager] Resetting buzzer folder path to default');
  currentBuzzerFolderPath = null;
}

export {
  setCurrentBuzzerFolderPath,
  getCurrentBuzzerFolderPath,
  resetBuzzerFolderPath
};
