/**
 * Path Initializer
 * Creates the required folder structure in Documents/PopQuiz/Resources on app startup
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import log from 'electron-log';

// Folder structure to create
const FOLDERS_TO_CREATE = [
  'PopQuiz',
  'PopQuiz/Resources',
  'PopQuiz/Resources/Phone Slideshow',
  'PopQuiz/Resources/Display Slideshow',
  'PopQuiz/Resources/Sounds',
  'PopQuiz/Resources/Sounds/Countdown',
  'PopQuiz/Resources/Sounds/Applause'
];

/**
 * Get the Documents folder path
 */
function getDocumentsPath() {
  return path.join(os.homedir(), 'Documents');
}

/**
 * Get the full PopQuiz resources root path
 */
function getPopQuizRootPath() {
  return path.join(getDocumentsPath(), 'PopQuiz');
}

/**
 * Get individual resource paths
 */
function getResourcePaths() {
  const root = getPopQuizRootPath();
  return {
    root,
    phoneSlideshow: path.join(root, 'Resources', 'Phone Slideshow'),
    displaySlideshow: path.join(root, 'Resources', 'Display Slideshow'),
    sounds: path.join(root, 'Resources', 'Sounds')
  };
}

/**
 * Create all required folders
 */
function createFolderStructure() {
  try {
    const documentsPath = getDocumentsPath();
    log.info(`[PathInitializer] Creating folder structure in: ${documentsPath}`);

    FOLDERS_TO_CREATE.forEach((folderRelativePath) => {
      const fullPath = path.join(documentsPath, folderRelativePath);
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        log.info(`[PathInitializer] Created folder: ${fullPath}`);
      } else {
        log.info(`[PathInitializer] Folder already exists: ${fullPath}`);
      }
    });

    log.info('[PathInitializer] ✅ Folder structure initialized successfully');
    return true;
  } catch (error) {
    log.error('[PathInitializer] ❌ Error creating folder structure:', error);
    return false;
  }
}

/**
 * Recursively copy directory
 */
function copyDirectoryRecursive(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const files = fs.readdirSync(source);
  
  files.forEach((file) => {
    const sourceFile = path.join(source, file);
    const destFile = path.join(destination, file);
    
    if (fs.statSync(sourceFile).isDirectory()) {
      copyDirectoryRecursive(sourceFile, destFile);
    } else {
      fs.copyFileSync(sourceFile, destFile);
    }
  });
}

/**
 * Migrate existing sounds from old location to new location
 * This is a one-time migration for existing installations
 */
function migrateSoundsIfNeeded() {
  try {
    const newSoundsPath = path.join(getPopQuizRootPath(), 'Resources', 'Sounds');

    // Check multiple possible old locations
    const possibleOldLocations = [
      path.join(process.cwd(), 'resorces', 'sounds'), // Original process.cwd() location
      path.join('C:', 'PopQuiz', 'd-quiz', 'resorces', 'sounds') // Actual old location
    ];

    let foundOldPath = null;
    for (const oldLocation of possibleOldLocations) {
      if (fs.existsSync(oldLocation)) {
        foundOldPath = oldLocation;
        log.info(`[PathInitializer] Found old sounds directory at: ${oldLocation}`);
        break;
      }
    }

    // If old location found, attempt migration
    if (foundOldPath) {
      const hasOldCountdown = fs.existsSync(path.join(foundOldPath, 'Countdown'));
      const hasOldApplause = fs.existsSync(path.join(foundOldPath, 'Applause'));

      if (hasOldCountdown || hasOldApplause) {
        log.info('[PathInitializer] Found old sounds directory, attempting migration...');

        // Copy Countdown sounds
        if (hasOldCountdown) {
          const oldCountdownPath = path.join(foundOldPath, 'Countdown');
          const newCountdownPath = path.join(newSoundsPath, 'Countdown');
          copyDirectoryRecursive(oldCountdownPath, newCountdownPath);
          log.info('[PathInitializer] Migrated Countdown sounds');
        }

        // Copy Applause sounds
        if (hasOldApplause) {
          const oldAppausePath = path.join(foundOldPath, 'Applause');
          const newAppausePath = path.join(newSoundsPath, 'Applause');
          copyDirectoryRecursive(oldAppausePath, newAppausePath);
          log.info('[PathInitializer] Migrated Applause sounds');
        }

        log.info('[PathInitializer] ✅ Sound migration completed');
      }
    }
  } catch (error) {
    log.warn('[PathInitializer] Sound migration failed (non-critical):', error);
    // Don't throw - this is not critical
  }
}

/**
 * Initialize all paths on app startup
 */
function initializePaths() {
  log.info('[PathInitializer] Starting path initialization...');
  
  createFolderStructure();
  migrateSoundsIfNeeded();
  
  log.info('[PathInitializer] Path initialization complete');
}

export {
  initializePaths,
  getDocumentsPath,
  getPopQuizRootPath,
  getResourcePaths,
  createFolderStructure,
  migrateSoundsIfNeeded
};
