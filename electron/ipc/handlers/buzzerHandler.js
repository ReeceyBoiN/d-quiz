/**
 * Buzzer Handler - IPC endpoints for buzzer operations
 * Provides functionality to select custom buzzer folders
 */

import { dialog } from 'electron';
import fs from 'fs';
import log from 'electron-log';
import { getDefaultBuzzerFolder } from '../../utils/buzzerConfig.js';

/**
 * Handle buzzer folder selection
 * Opens a native file dialog to let user select a folder containing buzzer audio files
 * 
 * @param {Object} payload - Payload object (currently empty)
 * @param {BrowserWindow} mainWindow - Reference to the main window
 * @returns {Object} - { selectedPath: string | null }
 */
export async function handleSelectBuzzerFolder(mainWindow) {
  try {
    log.info('[Buzzer IPC] handleSelectBuzzerFolder called');

    // Get the default buzzer folder to use as starting directory
    const defaultBuzzerPath = getDefaultBuzzerFolder();
    log.info('[Buzzer IPC] Default buzzer folder:', defaultBuzzerPath);

    // Open folder selection dialog, starting in the default buzzer folder
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Buzzer Folder',
      message: 'Choose a folder containing your buzzer sound files',
      buttonLabel: 'Select Folder',
      defaultPath: defaultBuzzerPath
    });

    // User cancelled the dialog
    if (result.canceled) {
      log.info('[Buzzer IPC] User cancelled folder selection');
      return { selectedPath: null };
    }

    const selectedPath = result.filePaths[0];
    log.info(`[Buzzer IPC] User selected folder: ${selectedPath}`);

    // Validate that the folder exists and is readable
    if (!fs.existsSync(selectedPath)) {
      log.warn(`[Buzzer IPC] Selected folder does not exist: ${selectedPath}`);
      throw new Error('Selected folder no longer exists');
    }

    const stats = fs.statSync(selectedPath);
    if (!stats.isDirectory()) {
      log.warn(`[Buzzer IPC] Selected path is not a directory: ${selectedPath}`);
      throw new Error('Selected path is not a directory');
    }

    // Try to read directory to ensure it's accessible
    try {
      fs.readdirSync(selectedPath);
    } catch (error) {
      log.warn(`[Buzzer IPC] Cannot read selected folder: ${error.message}`);
      throw new Error(`Cannot access folder: ${error.message}`);
    }

    log.info(`[Buzzer IPC] ✓ Folder validation successful: ${selectedPath}`);
    return { selectedPath };
  } catch (error) {
    log.error(`[Buzzer IPC] Error in handleSelectBuzzerFolder:`, error.message);
    throw new Error(`Failed to select buzzer folder: ${error.message}`);
  }
}

export default handleSelectBuzzerFolder;
