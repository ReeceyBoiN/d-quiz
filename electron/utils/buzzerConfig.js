/**
 * Buzzer Configuration Manager
 * Handles getting and validating the configured buzzer folder path
 * The path is stored in React's SettingsContext/localStorage and accessed via IPC
 */

import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { getResourcePaths } from '../backend/pathInitializer.js';

/**
 * Get the default buzzer folder path
 * Used as fallback if no custom folder is configured
 */
function getDefaultBuzzerFolder() {
  const resourcePaths = getResourcePaths();
  return path.join(resourcePaths.sounds, 'Buzzers');
}

/**
 * Validate that a folder path is accessible and readable
 * 
 * @param {string} folderPath - Path to validate
 * @returns {boolean} - True if folder exists and is readable
 */
function validateFolderPath(folderPath) {
  try {
    if (!folderPath || typeof folderPath !== 'string') {
      log.warn('[BuzzerConfig] Invalid folder path - not a string');
      return false;
    }

    if (!fs.existsSync(folderPath)) {
      log.warn(`[BuzzerConfig] Folder does not exist: ${folderPath}`);
      return false;
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      log.warn(`[BuzzerConfig] Path is not a directory: ${folderPath}`);
      return false;
    }

    // Try to list directory contents to ensure it's readable
    fs.readdirSync(folderPath);
    
    return true;
  } catch (error) {
    log.warn(`[BuzzerConfig] Error validating folder path: ${error.message}`);
    return false;
  }
}

/**
 * Get the current buzzer folder path
 * 
 * @param {string|null} customFolderPath - Optional custom path from SettingsContext
 * @returns {string} - Valid buzzer folder path (custom or default)
 */
function getBuzzerFolder(customFolderPath) {
  // If custom path is provided and valid, use it
  if (customFolderPath && validateFolderPath(customFolderPath)) {
    log.info(`[BuzzerConfig] Using custom buzzer folder: ${customFolderPath}`);
    return customFolderPath;
  }

  // If custom path is invalid, log warning and fall back to default
  if (customFolderPath) {
    log.warn(`[BuzzerConfig] Custom buzzer folder is invalid, falling back to default: ${customFolderPath}`);
  }

  const defaultFolder = getDefaultBuzzerFolder();
  log.info(`[BuzzerConfig] Using default buzzer folder: ${defaultFolder}`);
  return defaultFolder;
}

export {
  getDefaultBuzzerFolder,
  validateFolderPath,
  getBuzzerFolder
};
