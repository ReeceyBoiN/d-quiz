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
  'PopQuiz/Resources/Team Pictures',
  'PopQuiz/Resources/Sounds',
  'PopQuiz/Resources/Sounds/Countdown',
  'PopQuiz/Resources/Sounds/Applause',
  'PopQuiz/Resources/Sounds/Fail Sounds',
  'PopQuiz/Resources/Sounds/Buzzers'
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
    teamPictures: path.join(root, 'Resources', 'Team Pictures'),
    sounds: path.join(root, 'Resources', 'Sounds')
  };
}

/**
 * Get the Team Pictures directory path (convenience function)
 */
function getTeamPicturesPath() {
  return path.join(getPopQuizRootPath(), 'Resources', 'Team Pictures');
}

/**
 * Create all required folders
 */
function createFolderStructure() {
  log.info('[PathInitializer] ===== START: createFolderStructure() =====');

  try {
    const documentsPath = getDocumentsPath();
    log.info(`[PathInitializer] Documents path: ${documentsPath}`);
    log.info(`[PathInitializer] Total folders to create: ${FOLDERS_TO_CREATE.length}`);

    FOLDERS_TO_CREATE.forEach((folderRelativePath, index) => {
      const fullPath = path.join(documentsPath, folderRelativePath);
      log.info(`[PathInitializer] [${index + 1}/${FOLDERS_TO_CREATE.length}] Processing: ${folderRelativePath}`);

      try {
        if (!fs.existsSync(fullPath)) {
          log.info(`[PathInitializer]   → Folder does not exist, creating...`);
          fs.mkdirSync(fullPath, { recursive: true });

          // Verify creation was successful
          if (fs.existsSync(fullPath)) {
            log.info(`[PathInitializer]   ✓ Successfully created: ${fullPath}`);
          } else {
            log.error(`[PathInitializer]   ✗ FAILED to create: ${fullPath}`);
          }
        } else {
          log.info(`[PathInitializer]   → Already exists: ${fullPath}`);
        }
      } catch (folderError) {
        log.error(`[PathInitializer]   ✗ Error creating folder ${folderRelativePath}:`, folderError);
      }
    });

    log.info('[PathInitializer] ===== END: createFolderStructure() - SUCCESS =====');
    return true;
  } catch (error) {
    log.error('[PathInitializer] ===== END: createFolderStructure() - ERROR =====');
    log.error('[PathInitializer] Error creating folder structure:', error);
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
  log.info('[PathInitializer] ===== START: migrateSoundsIfNeeded() =====');

  try {
    const newSoundsPath = path.join(getPopQuizRootPath(), 'Resources', 'Sounds');
    const failSoundsPath = path.join(newSoundsPath, 'Fail Sounds');

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
      const hasOldFailSounds = fs.existsSync(path.join(foundOldPath, 'Fail Sounds'));

      if (hasOldCountdown || hasOldApplause || hasOldFailSounds) {
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

        // Copy Fail Sounds
        if (hasOldFailSounds) {
          const oldFailSoundsPath = path.join(foundOldPath, 'Fail Sounds');
          const newFailSoundsPath = path.join(newSoundsPath, 'Fail Sounds');
          copyDirectoryRecursive(oldFailSoundsPath, newFailSoundsPath);
          log.info('[PathInitializer] Migrated Fail Sounds');
        }

        log.info('[PathInitializer] ✅ Sound migration completed');
      }
    }

    // FALLBACK: Ensure Fail Sounds folder exists as a safety net
    log.info('[PathInitializer] Running fallback: Ensuring Fail Sounds folder exists...');
    if (!fs.existsSync(failSoundsPath)) {
      log.warn('[PathInitializer] Fail Sounds folder missing, creating fallback...');
      try {
        fs.mkdirSync(failSoundsPath, { recursive: true });
        if (fs.existsSync(failSoundsPath)) {
          log.info(`[PathInitializer] ✓ Fallback creation successful: ${failSoundsPath}`);
        } else {
          log.error(`[PathInitializer] ✗ Fallback creation FAILED: ${failSoundsPath}`);
        }
      } catch (fallbackError) {
        log.error('[PathInitializer] ✗ Fallback folder creation error:', fallbackError);
      }
    } else {
      log.info(`[PathInitializer] ✓ Fail Sounds folder already exists: ${failSoundsPath}`);
    }

    log.info('[PathInitializer] ===== END: migrateSoundsIfNeeded() =====');
  } catch (error) {
    log.warn('[PathInitializer] Sound migration/fallback failed (non-critical):', error);
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
  getTeamPicturesPath,
  createFolderStructure,
  migrateSoundsIfNeeded
};
