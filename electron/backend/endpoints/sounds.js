import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import { getResourcePaths } from '../pathInitializer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allowed audio file extensions
const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|webm)$/i;

export default (app) => {
  /**
   * List available buzzer files
   * GET /api/buzzers/list
   * Returns: { buzzers: string[] } - array of buzzer filenames
   */
  app.get('/api/buzzers/list', (_req, res) => {
    try {
      const resourcePaths = getResourcePaths();
      const buzzerDir = path.join(resourcePaths.sounds, 'Buzzers');

      log.info(`[Buzzers API] Listing buzzers from: ${buzzerDir}`);

      // Check if buzzers directory exists
      if (!fs.existsSync(buzzerDir)) {
        log.warn(`[Buzzers API] Buzzers directory does not exist: ${buzzerDir}`);
        return res.json({ buzzers: [] });
      }

      // Read directory and filter for audio files
      const files = fs.readdirSync(buzzerDir).filter((file) => {
        // Only include files (not directories)
        const filePath = path.join(buzzerDir, file);
        const isFile = fs.statSync(filePath).isFile();
        const isAudioFile = ALLOWED_AUDIO_EXTENSIONS.test(file);
        return isFile && isAudioFile;
      });

      // Sort alphabetically
      files.sort();

      log.info(`[Buzzers API] Found ${files.length} buzzer files`);
      res.json({ buzzers: files });
    } catch (err) {
      log.error(`[Buzzers API] Error listing buzzers:`, err);
      res.status(500).json({ error: err.message, buzzers: [] });
    }
  });

  /**
   * Serve a specific buzzer audio file
   * GET /api/buzzers/:fileName
   * Returns: audio file (mp3, wav, etc.)
   */
  app.get('/api/buzzers/:fileName', (req, res) => {
    try {
      const { fileName } = req.params;

      log.info(`[Buzzers API] Serving buzzer file: ${fileName}`);

      // Validate filename (prevent directory traversal attacks)
      if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        log.warn(`[Buzzers API] Invalid filename attempted: ${fileName}`);
        return res.status(400).send('Invalid filename');
      }

      // Validate file extension
      if (!ALLOWED_AUDIO_EXTENSIONS.test(fileName)) {
        log.warn(`[Buzzers API] File extension not allowed: ${fileName}`);
        return res.status(400).send('File type not allowed');
      }

      const resourcePaths = getResourcePaths();
      const buzzerDir = path.join(resourcePaths.sounds, 'Buzzers');
      const filePath = path.join(buzzerDir, fileName);

      // Additional security: ensure the resolved path is within the buzzers directory
      const resolvedPath = path.resolve(filePath);
      const resolvedBuzzerDir = path.resolve(buzzerDir);
      if (!resolvedPath.startsWith(resolvedBuzzerDir)) {
        log.warn(`[Buzzers API] Path traversal attempt detected: ${fileName}`);
        return res.status(400).send('Invalid path');
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        log.warn(`[Buzzers API] Buzzer file not found: ${filePath}`);
        return res.status(404).send('Buzzer file not found');
      }

      // Determine content type based on file extension
      const ext = path.extname(fileName).toLowerCase();
      const contentTypeMap = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
        '.webm': 'audio/webm'
      };

      const contentType = contentTypeMap[ext] || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);

      log.info(`[Buzzers API] Sending buzzer file: ${filePath} (type: ${contentType})`);
      res.sendFile(filePath);
    } catch (err) {
      log.error(`[Buzzers API] Error serving buzzer file:`, err);
      res.status(500).send('Error serving buzzer file');
    }
  });
};
