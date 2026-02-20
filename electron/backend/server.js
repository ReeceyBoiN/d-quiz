import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { app } from 'electron';
import log from 'electron-log';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { getTeamPicturesPath } from './pathInitializer.js';
import { setCurrentBuzzerFolderPath } from './buzzerFolderManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== PHOTO HASH UTILITY ==========
// Computes a SHA256 hash of photo data to detect when a new photo is submitted
// This allows us to preserve photo approval status across reconnections when the photo hasn't changed,
// while resetting approval status when a new photo is submitted
function hashPhotoData(photoData) {
  if (!photoData) return null;
  try {
    return crypto.createHash('sha256').update(photoData, 'binary').digest('hex');
  } catch (err) {
    console.error('[hashPhotoData] Error computing photo hash:', err.message);
    return null;
  }
}

// ...lazy load bus and endpoints...
async function loadEndpoints(app) {
  const quizzesEndpoint = await import('./endpoints/quizzes.js');
  const usersEndpoint = await import('./endpoints/users.js');
  const soundsEndpoint = await import('./endpoints/sounds.js');
  quizzesEndpoint.default(app);
  usersEndpoint.default(app);
  soundsEndpoint.default(app);
}

async function loadEvents(wss) {
  const busModule = await import('../utils/bus.js');
  const bus = busModule.default;
  
  bus.on('quiz:start', (payload) => {
    const msg = JSON.stringify({ type: 'quiz/start', payload });
    wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
  });
}

async function startBackend({ port = 4310 } = {}) {
  const app = express();

  app.use(express.json({ charset: 'utf-8' }));

  // Add CORS headers for all requests (fallback for file:// origin requests)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const playerAppPath = path.join(__dirname, '../../dist-player');

  if (!fs.existsSync(playerAppPath)) {
    log.error(`Player app directory not found at: ${playerAppPath}`);
  } else {
    log.info(`Serving player app from: ${playerAppPath}`);
  }

  app.use(express.static(playerAppPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }));

  await loadEndpoints(app);

  // Helper function to get local IP (will be used by /api/host-info endpoint)
  function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  const localIP = getLocalIPAddress();

  // Endpoint to provide host info to player devices
  app.get('/api/host-info', (req, res) => {
    const protocol = req.protocol === 'https' ? 'wss' : 'ws';
    res.json({
      localIP: localIP,
      port: port,
      wsUrl: `${protocol}://${localIP}:${port}/events`,
      httpUrl: `${req.protocol}://${localIP}:${port}`
    });
  });

  // Endpoint to check current network status
  app.get('/api/network-status', (req, res) => {
    const interfaces = os.networkInterfaces();
    log.info('[NetworkStatus] Checking network interfaces...');
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          log.info(`[NetworkStatus] Found IPv4 interface: ${name} (${iface.address})`);
          return res.json({
            hasNetwork: true,
            localIP: iface.address
          });
        }
      }
    }
    log.info('[NetworkStatus] No active network interfaces found');
    res.json({ hasNetwork: false });
  });

  // Endpoint to send message to specific player via HTTP request from host
  // This is used as a fallback when running in web mode (no IPC available)
  app.post('/api/send-to-player', (req, res) => {
    try {
      const { deviceId, messageType, data } = req.body;

      if (!deviceId || !messageType) {
        return res.status(400).json({ ok: false, error: 'Missing deviceId or messageType' });
      }

      const player = networkPlayers.get(deviceId.trim());
      if (!player || !player.ws) {
        log.warn(`[/api/send-to-player] Player not found or WebSocket not ready: ${deviceId}`);
        return res.status(404).json({ ok: false, error: 'Player not found' });
      }

      const message = JSON.stringify({
        type: messageType,
        data: data || {},
        timestamp: Date.now()
      });

      player.ws.send(message, (err) => {
        if (err) {
          log.error(`[send-to-player] Error sending to ${deviceId}:`, err.message);
          res.status(500).json({ ok: false, error: err.message });
        } else {
          log.info(`[send-to-player] Message sent to ${deviceId}`);
          res.json({ ok: true });
        }
      });
    } catch (err) {
      log.error('[send-to-player] Error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.use((req, res) => {
    const indexPath = path.join(playerAppPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      log.error(`index.html not found at: ${indexPath}`);
      return res.status(404).send('index.html not found');
    }
    log.info(`Serving index.html for request to ${req.path}`);
    res.sendFile(indexPath);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/events' });
  await loadEvents(wss);

  const networkPlayers = new Map();
  const recentAnswers = new Map();
  let autoApproveTeamPhotos = false; // Initialize auto-approve setting (will be synced from frontend)

  // Phase 2: Heartbeat configuration
  const HEARTBEAT_INTERVAL = 12000; // Send ping every 12 seconds (increased from 5s for scale)
  const HEARTBEAT_TIMEOUT = 18000; // Mark as disconnected if no pong for 18 seconds (increased from 8s for scale)
  const STALE_CHECK_INTERVAL = 10000; // Check for stale connections every 10 seconds (reduced frequency)
  const STALE_PLAYER_TTL = 30 * 60 * 1000; // Remove stale player entries after 30 minutes of inactivity
  const CLEANUP_INTERVAL = 60000; // Run cleanup every 60 seconds
  let heartbeatIntervalId = null;
  let staleCheckIntervalId = null;
  let cleanupIntervalId = null;

  // Backpressure handling - prevent buffer overflow when sending large messages
  const MAX_BUFFER_SIZE = 100 * 1024; // 100KB max buffered amount before warning
  const CRITICAL_BUFFER_SIZE = 500 * 1024; // 500KB critical level - skip sending if exceeded

  function checkAndLogBackpressure(ws, messageSize) {
    if (!ws || ws.readyState !== 1) return false;

    const bufferedAmount = ws.bufferedAmount || 0;
    const totalAmount = bufferedAmount + messageSize;

    if (totalAmount > CRITICAL_BUFFER_SIZE) {
      log.warn(`[Backpressure] ⚠️  CRITICAL: Skipping message (${(messageSize/1024).toFixed(1)}KB) - buffer already has ${(bufferedAmount/1024).toFixed(1)}KB buffered`);
      return false; // Don't send
    } else if (totalAmount > MAX_BUFFER_SIZE) {
      log.warn(`[Backpressure] ⚠️  HIGH: Message (${(messageSize/1024).toFixed(1)}KB) may cause buffering - current buffer: ${(bufferedAmount/1024).toFixed(1)}KB`);
    }

    return true; // OK to send
  }

  // Helper function to save team photos to disk (async version) using writable path from pathInitializer
  async function saveTeamPhotoToDisk(base64String, deviceId) {
    console.log('[saveTeamPhotoToDisk] Called with deviceId:', deviceId);

    try {
      // Validate ID
      if (!deviceId || typeof deviceId !== 'string') {
        log.error('[saveTeamPhotoToDisk] ❌ Invalid deviceId - not a string or is empty');
        console.error('[saveTeamPhotoToDisk] ❌ Invalid deviceId - not a string or is empty');
        return { success: false, error: 'Invalid deviceId - not a string or is empty', code: 'INVALID_DEVICE_ID' };
      }

      // Validate base64 string
      if (!base64String || typeof base64String !== 'string') {
        log.error('[saveTeamPhotoToDisk] ❌ Invalid base64String - not a string or is empty');
        console.error('[saveTeamPhotoToDisk] ❌ Invalid base64String - not a string or is empty');
        return { success: false, error: 'Invalid base64String - not a string or is empty', code: 'INVALID_BASE64' };
      }

      if (!base64String.includes('data:image')) {
        log.warn('[saveTeamPhotoToDisk] ⚠️ WARNING: base64 string does not include data: prefix');
        console.warn('[saveTeamPhotoToDisk] ⚠️ WARNING: base64 string does not include data: prefix');
      }

      // Parse MIME type to determine file extension
      const mimeMatch = base64String.match(/data:image\/(\w+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'jpg';
      const extension = mimeType === 'jpeg' ? 'jpg' : mimeType;

      // Get the writable path from pathInitializer
      const photosDir = getTeamPicturesPath();
      console.log('[saveTeamPhotoToDisk] Using Team Pictures path:', photosDir);
      log.info(`[saveTeamPhotoToDisk] Using Team Pictures path: ${photosDir}`);

      // Create directory with error handling
      console.log('[saveTeamPhotoToDisk] Creating directory structure...');
      log.info(`[saveTeamPhotoToDisk] Creating directory: ${photosDir}`);

      try {
        await fsp.mkdir(photosDir, { recursive: true });
        console.log('[saveTeamPhotoToDisk] ✅ Directory ready');
        log.info(`[saveTeamPhotoToDisk] ✅ Directory created/verified: ${photosDir}`);
      } catch (mkdirErr) {
        const detailedErr = `[saveTeamPhotoToDisk] ❌ Failed to create directory "${photosDir}": ${mkdirErr.message} (code: ${mkdirErr.code})`;
        console.error(detailedErr);
        log.error(detailedErr);

        if (mkdirErr.code === 'EACCES') {
          log.error('[saveTeamPhotoToDisk] EACCES: Permission denied - check directory permissions');
        } else if (mkdirErr.code === 'ENOSPC') {
          log.error('[saveTeamPhotoToDisk] ENOSPC: No space left on device');
        } else if (mkdirErr.code === 'ENOTDIR') {
          log.error('[saveTeamPhotoToDisk] ENOTDIR: A component of the path is not a directory.');
        }
        return { success: false, error: mkdirErr.message, code: mkdirErr.code, path: photosDir };
      }

      // Generate filename with timestamp for uniqueness, using correct extension
      const timestamp = Date.now();
      const fileName = `team_${deviceId}_${timestamp}.${extension}`;
      const filePath = path.join(photosDir, fileName);
      console.log('[saveTeamPhotoToDisk] Generated filename:', fileName);
      console.log('[saveTeamPhotoToDisk] Full file path:', filePath);
      log.info(`[saveTeamPhotoToDisk] Generated filename: ${fileName} (MIME type: ${mimeType})`);
      log.info(`[saveTeamPhotoToDisk] Full file path: ${filePath}`);

      // Convert base64 to buffer
      console.log('[saveTeamPhotoToDisk] Base64 string length BEFORE stripping prefix:', base64String.length);
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      console.log('[saveTeamPhotoToDisk] Base64 string length AFTER stripping prefix:', base64Data.length);

      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
        console.log('[saveTeamPhotoToDisk] ✅ Successfully converted base64 to buffer, size:', buffer.length, 'bytes');
        log.info(`[saveTeamPhotoToDisk] ✅ Successfully converted base64 to buffer, size: ${buffer.length} bytes`);
      } catch (bufferErr) {
        log.error(`[saveTeamPhotoToDisk] ❌ Failed to convert base64 to buffer:`, bufferErr.message);
        console.error('[saveTeamPhotoToDisk] ❌ Failed to convert base64 to buffer:', bufferErr.message);
        return { success: false, error: 'Invalid base64 encoding: ' + bufferErr.message, code: 'INVALID_BASE64' };
      }

      // Write file to disk asynchronously
      try {
        await fsp.writeFile(filePath, buffer);
        console.log('[saveTeamPhotoToDisk] ✅ File written successfully, size:', buffer.length, 'bytes');
        log.info(`[saveTeamPhotoToDisk] ✅ File written successfully to: ${filePath} (${buffer.length} bytes)`);

        // Verify file exists
        try {
          const stats = await fsp.stat(filePath);
          console.log('[saveTeamPhotoToDisk] ✅ File verification passed - size on disk:', stats.size, 'bytes');
          log.info(`[saveTeamPhotoToDisk] ✅ File verified on disk - size: ${stats.size} bytes`);
        } catch (statErr) {
          console.warn('[saveTeamPhotoToDisk] ⚠️  File written but verification failed:', statErr.message);
          log.warn(`[saveTeamPhotoToDisk] ⚠️  File stat check failed: ${statErr.message}`);
        }

        // Return file:// URL instead of raw path
        const fileUrl = pathToFileURL(filePath).href;
        console.log('[saveTeamPhotoToDisk] ✅ Returning file URL:', fileUrl);
        console.log('[saveTeamPhotoToDisk] File URL type:', typeof fileUrl);
        console.log('[saveTeamPhotoToDisk] File URL length:', fileUrl.length);
        return { success: true, filePath: fileUrl };
      } catch (writeErr) {
        const detailedErr = `[saveTeamPhotoToDisk] ❌ Failed to write file: ${writeErr.message} (code: ${writeErr.code})`;
        console.error(detailedErr);
        log.error(detailedErr);
        log.error(`[saveTeamPhotoToDisk] File path that failed: ${filePath}`);

        if (writeErr.code === 'EACCES') {
          log.error('[saveTeamPhotoToDisk] EACCES: Permission denied - check write permissions on: ' + photosDir);
        } else if (writeErr.code === 'ENOSPC') {
          log.error('[saveTeamPhotoToDisk] ENOSPC: No space left on device');
        } else if (writeErr.code === 'EISDIR') {
          log.error('[saveTeamPhotoToDisk] EISDIR: Path is a directory, not a file');
        } else if (writeErr.code === 'ENOTDIR') {
          log.error('[saveTeamPhotoToDisk] ENOTDIR: A component of the path is not a directory.');
        }
        return { success: false, error: writeErr.message, code: writeErr.code, path: filePath };
      }
    } catch (err) {
      log.error(`[saveTeamPhotoToDisk] ❌ Failed to save team photo for device ${deviceId}:`, err.message);
      console.error('[saveTeamPhotoToDisk] ❌ Error:', err.message);
      if (err.stack) {
        log.error(`[saveTeamPhotoToDisk] Error stack:`, err.stack);
        console.error('[saveTeamPhotoToDisk] Error stack:', err.stack);
      }
      return { success: false, error: err.message, code: err.code || 'UNKNOWN_ERROR' };
    }
  }

  // Helper function to delete a specific photo file from disk
  async function deletePhotoFile(photoUrl) {
    if (!photoUrl) {
      return { success: true, message: 'No photo URL provided, nothing to delete' };
    }

    try {
      // Convert file:// URL to actual file path
      let filePath;
      if (photoUrl.startsWith('file://')) {
        filePath = fileURLToPath(photoUrl);
      } else {
        filePath = photoUrl;
      }

      console.log('[deletePhotoFile] Attempting to delete photo:', filePath.substring(filePath.length - 50)); // Log last 50 chars
      log.info(`[deletePhotoFile] Deleting photo file: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log('[deletePhotoFile] ⚠️  File does not exist:', filePath.substring(filePath.length - 50));
        log.warn(`[deletePhotoFile] ⚠️  File does not exist, nothing to delete: ${filePath}`);
        return { success: true, message: 'File does not exist, nothing to delete' };
      }

      // Delete the file
      await fsp.unlink(filePath);
      console.log('[deletePhotoFile] ✅ Successfully deleted photo file');
      log.info(`[deletePhotoFile] ✅ Successfully deleted photo file: ${filePath}`);
      return { success: true, message: 'Photo file deleted successfully' };
    } catch (err) {
      console.error('[deletePhotoFile] ❌ Error deleting photo file:', err.message);
      log.error(`[deletePhotoFile] ❌ Error deleting photo file:`, err.message);

      // Don't throw error, just log warning - file deletion should not block the process
      if (err.code === 'EACCES') {
        log.warn(`[deletePhotoFile] EACCES: Permission denied when trying to delete photo file`);
      } else if (err.code === 'ENOENT') {
        log.warn(`[deletePhotoFile] ENOENT: File not found (may have been already deleted)`);
      }

      return { success: false, error: err.message };
    }
  }

  // Helper function to cleanup team photos
  function cleanupTeamPhotos() {
    try {
      const photosDir = getTeamPicturesPath();
      log.info(`[Photo Cleanup] Cleaning up team photos from: ${photosDir}`);

      if (!fs.existsSync(photosDir)) {
        log.info(`[Photo Cleanup] Team Pictures directory does not exist, nothing to cleanup`);
        return true;
      }

      const files = fs.readdirSync(photosDir);
      let deletedCount = 0;
      let failedCount = 0;

      files.forEach(file => {
        try {
          const filePath = path.join(photosDir, file);
          fs.unlinkSync(filePath);
          log.info(`[Photo Cleanup] ✅ Deleted: ${file}`);
          deletedCount++;
        } catch (err) {
          log.error(`[Photo Cleanup] ⚠️  Failed to delete ${file}:`, err.message);
          failedCount++;
        }
      });

      log.info(`[Photo Cleanup] Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`);
      return failedCount === 0;
    } catch (err) {
      log.error(`[Photo Cleanup] ❌ Cleanup error:`, err.message);
      if (err.stack) {
        log.error(`[Photo Cleanup] Error stack:`, err.stack);
      }
      return false;
    }
  }

  wss.on('connection', (ws) => {
    let deviceId = null;
    let playerId = null;
    const connectionId = Math.random().toString(36).slice(2, 9);

    log.info(`[WS-${connectionId}] Client connected. Total connections: ${wss.clients.size}`);

    ws.on('error', (error) => {
      log.error(`[WS-${connectionId}] ⚠️  WebSocket error event (will trigger close):`, error.message);
      log.error(`[WS-${connectionId}] Error code:`, error.code);
      log.error(`[WS-${connectionId}] Error name:`, error.name);
      if (error.stack) {
        log.error(`[WS-${connectionId}] Error stack:`, error.stack);
      }
      if (deviceId) {
        log.error(`[WS-${connectionId}] Error for device: ${deviceId}`);
      }
      log.error(`[WS-${connectionId}] ws.readyState at error: ${ws.readyState}, ws.bufferedAmount: ${ws.bufferedAmount}`);
    });

    // Phase 2: Handle pong responses for heartbeat tracking
    ws.on('pong', () => {
      const now = Date.now();
      if (deviceId && networkPlayers.has(deviceId)) {
        const player = networkPlayers.get(deviceId);
        const previousPongTime = player.lastPongAt;
        player.lastPongAt = now;
        const timeSincePreviousPong = previousPongTime ? (now - previousPongTime) : 'first pong';
        log.info(`[WS-${connectionId}] ❤️ Received pong from ${player.teamName} (device: ${deviceId}) - time since last pong: ${timeSincePreviousPong}ms`);
      } else if (deviceId) {
        log.warn(`[WS-${connectionId}] ⚠️ Received pong from device not in networkPlayers: ${deviceId}`);
      } else {
        log.debug(`[WS-${connectionId}] Received pong from connection with no deviceId set yet`);
      }
    });

    ws.on('message', async (message) => {
      try {
        let data;
        try {
          data = JSON.parse(message);
        } catch (parseErr) {
          log.error(`[WS-${connectionId}] ❌ Failed to parse message:`, parseErr.message, 'Raw message:', message.toString().substring(0, 200));
          return;
        }

        // DIAGNOSTIC: Log every message received at backend
        console.log(`[WebSocket] ✅ Message received from client - Type: ${data.type} | Connection: ${connectionId}`);
        log.info(`[WS-${connectionId}] Received: ${data.type}`, data);

        if (data.type === 'PLAYER_JOIN') {
          try {
            // DEFENSIVE FIX: Normalize deviceId to remove leading/trailing whitespace
            // This prevents Map from having multiple keys for the same logical device (e.g., "id " vs "id")
            deviceId = (data.deviceId || '').trim();
            playerId = data.playerId;

            // PHASE 1: Add comprehensive backend logging to PLAYER_JOIN handler
            console.log('[PLAYER_JOIN] Received message with fields:', Object.keys(data));
            log.info(`[WS-${connectionId}] [PLAYER_JOIN] Received message with fields:`, Object.keys(data).join(', '));

            console.log('[PLAYER_JOIN] Photo field present:', !!data.teamPhoto, 'Size:', data.teamPhoto?.length, 'bytes');
            log.info(`[WS-${connectionId}] [PLAYER_JOIN] Photo field present: ${!!data.teamPhoto}, Size: ${data.teamPhoto?.length || 'N/A'} bytes`);

            if (data.teamPhoto) {
              const photoPrefix = data.teamPhoto.substring(0, 100);
              console.log('[PLAYER_JOIN] Photo data prefix (first 100 chars):', photoPrefix);
              log.info(`[WS-${connectionId}] [PLAYER_JOIN] Photo data prefix: ${photoPrefix}`);
            }

            log.info(`[WS-${connectionId}] 🎯 Player join request: ${data.teamName} (device: ${deviceId}, player: ${playerId})`);

            const existingPlayer = networkPlayers.get(deviceId);

            // Initialize photoPath as null - will be set after async save completes
            let photoPath = null;

            // PHASE 1: Enhanced PLAYER_JOIN storage diagnostics
            const storageStartTime = Date.now();

            if (existingPlayer?.approvedAt) {
              // Reconnection - device was previously approved, update with new connection
              console.log('[PLAYER_JOIN] Reconnection detected for device:', deviceId);
              console.log('[PLAYER_JOIN] - Old teamPhoto:', existingPlayer.teamPhoto ? (existingPlayer.teamPhoto.substring(0, 50) + '...') : 'null');
              console.log('[PLAYER_JOIN] - New photoPath from payload:', photoPath ? (photoPath.substring(0, 50) + '...') : 'null');

              existingPlayer.teamName = data.teamName;
              existingPlayer.ws = ws;
              existingPlayer.playerId = data.playerId;
              const oldLastPongAt = existingPlayer.lastPongAt;
              existingPlayer.lastPongAt = Date.now(); // Phase 2: Update heartbeat on reconnection
              log.info(`[WS-${connectionId}] [RECONNECT] Updated lastPongAt from ${oldLastPongAt} to ${existingPlayer.lastPongAt} for device ${deviceId}`);

              // CRITICAL FIX: Enhanced hash-based photo comparison with approval persistence
              // Once a photo is approved and its hash stored in photoApprovedHash, that approval persists
              // for that specific photo, even across reconnections
              const oldPhotoApprovedAt = existingPlayer.photoApprovedAt;
              const oldPhotoHash = existingPlayer.teamPhotoHash;
              const approvedPhotoHash = existingPlayer.photoApprovedHash; // Hash of the photo that was approved
              const newPhotoHash = hashPhotoData(data.teamPhoto);

              console.log('[PLAYER_JOIN] 📸 PHOTO APPROVAL STATUS CHECK:');
              console.log('  - Current photo hash:', newPhotoHash ? (newPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - Previous photo hash:', oldPhotoHash ? (oldPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - Approved photo hash:', approvedPhotoHash ? (approvedPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - Current photoApprovedAt:', oldPhotoApprovedAt ? new Date(oldPhotoApprovedAt).toISOString() : 'null');

              // Check if the current photo matches the approved photo hash
              if (newPhotoHash && approvedPhotoHash && newPhotoHash === approvedPhotoHash) {
                // Current photo matches the approved photo → RESTORE approval status
                console.log('[PLAYER_JOIN] ✅ RESTORING photoApprovedAt: Current photo matches approved photo hash');
                console.log('  - Restoring to:', oldPhotoApprovedAt ? new Date(oldPhotoApprovedAt).toISOString() : 'SETTING NEW TIMESTAMP');
                if (!existingPlayer.photoApprovedAt) {
                  // If approval timestamp was lost, restore it (this shouldn't normally happen but handle it)
                  existingPlayer.photoApprovedAt = Date.now();
                  console.log('[PLAYER_JOIN] ⚠️  photoApprovedAt was null, setting new timestamp');
                }
                log.info(`[WS-${connectionId}] ✅ [RECONNECT] RESTORED photoApprovedAt for device ${deviceId}: Photo matches approved hash (${approvedPhotoHash.substring(0, 16)}...)`);
              } else if (oldPhotoHash && newPhotoHash && oldPhotoHash === newPhotoHash) {
                // Photo hash unchanged from last time → definitely same photo, preserve all approval status
                console.log('[PLAYER_JOIN] 📸 PRESERVED photoApprovedAt: Photo hash unchanged');
                console.log('  - Photo hash:', oldPhotoHash.substring(0, 16) + '...');
                log.info(`[WS-${connectionId}] 📸 [RECONNECT] PRESERVED photoApprovedAt for device ${deviceId}: Photo hash unchanged (${oldPhotoHash.substring(0, 16)}...)`);
              } else if (oldPhotoHash && newPhotoHash && oldPhotoHash !== newPhotoHash) {
                // Hash CHANGED and both hashes exist → NEW photo submitted, reset approval
                console.log('[PLAYER_JOIN] 📸 RESET photoApprovedAt: New photo detected (hash changed)');
                console.log('  - Old photo hash:', oldPhotoHash.substring(0, 16) + '...');
                console.log('  - New photo hash:', newPhotoHash.substring(0, 16) + '...');
                existingPlayer.photoApprovedAt = null; // Reset approval for new photo
                log.info(`[WS-${connectionId}] 📸 [RECONNECT] RESET photoApprovedAt for device ${deviceId}: New photo detected (hash changed from ${oldPhotoHash.substring(0, 16)}... to ${newPhotoHash.substring(0, 16)}...)`);
              } else if (!oldPhotoHash && newPhotoHash) {
                // No old hash but new hash exists → first time seeing photo data
                console.log('[PLAYER_JOIN] 📸 RESET photoApprovedAt: No previous photo hash found');
                existingPlayer.photoApprovedAt = null;
                log.info(`[WS-${connectionId}] 📸 [RECONNECT] RESET photoApprovedAt for device ${deviceId}: No previous hash for comparison`);
              } else if (oldPhotoHash && !newPhotoHash) {
                // Old hash exists but no new hash → photo was removed
                console.log('[PLAYER_JOIN] 📸 Photo removed in reconnection, keeping approval status');
                log.info(`[WS-${connectionId}] 📸 [RECONNECT] Photo missing in reconnection for device ${deviceId}, keeping approval status`);
              }

              // Always update the photo hash for future comparisons
              if (newPhotoHash) {
                existingPlayer.teamPhotoHash = newPhotoHash;
              }

              // Handle buzzer in reconnection (update if new buzzer provided)
              if (data.buzzerSound) {
                const normalizedBuzzer = (data.buzzerSound || '')
                  .trim()
                  .replace(/\.mp3$/i, '') + '.mp3';
                existingPlayer.buzzerSound = normalizedBuzzer;
                console.log('[PLAYER_JOIN] 🔊 Updated buzzer on reconnection:', data.buzzerSound, '→', normalizedBuzzer);
                log.info(`[WS-${connectionId}] 🔊 [RECONNECT] Updated buzzer: "${data.buzzerSound}" → "${normalizedBuzzer}"`);
              }

              if (photoPath) {
                existingPlayer.teamPhoto = photoPath;
                console.log('[PLAYER_JOIN] - Updated teamPhoto to:', photoPath.substring(0, 50) + '...');
              } else if (data.teamPhoto) {
                console.log('[PLAYER_JOIN] ⚠️ photoPath is null but data.teamPhoto exists (size:', data.teamPhoto.length, 'bytes)');
              }
              log.info(`[WS-${connectionId}] 🔄 [Reconnection] Device ${deviceId} rejoining as "${data.teamName}", was approved at ${new Date(existingPlayer.approvedAt).toISOString()}, teamPhoto: ${existingPlayer.teamPhoto || 'null'}, buzzer: ${existingPlayer.buzzerSound || 'null'}`);
            } else {
              // New join - treat as first time
              // FIX: Create playerEntry with null teamPhoto, store IMMEDIATELY, THEN do async photo save
              const createdAt = Date.now();

              // Extract and normalize buzzer sound if provided (fix for initial buzzer race condition)
              let buzzerSound = null;
              if (data.buzzerSound) {
                buzzerSound = (data.buzzerSound || '')
                  .trim()
                  .replace(/\.mp3$/i, '') + '.mp3';
                console.log('[PLAYER_JOIN] 🔊 Buzzer sound included in PLAYER_JOIN: ' + data.buzzerSound + ' → normalized to ' + buzzerSound);
                log.info(`[WS-${connectionId}] 🔊 PLAYER_JOIN includes buzzer: "${data.buzzerSound}" → normalized to "${buzzerSound}"`);
              } else {
                console.log('[PLAYER_JOIN] No buzzer sound in PLAYER_JOIN payload');
              }

              // Compute photo hash for new player
              const initialPhotoHash = hashPhotoData(data.teamPhoto);

              const playerEntry = {
                ws,
                playerId,
                teamName: data.teamName,
                status: 'pending',
                approvedAt: null,
                photoApprovedAt: null, // Track photo approval separately from team approval
                photoApprovedHash: null, // Track which photo hash was approved - this persists approval across reconnections
                timestamp: createdAt,
                teamPhoto: null, // Will be set when photo save completes
                teamPhotoHash: initialPhotoHash, // Track photo hash to detect changes on reconnection
                buzzerSound: buzzerSound, // Store buzzer if provided (fix for initial buzzer race condition)
                lastPongAt: createdAt, // Phase 2: Track heartbeat timestamp on join
                score: 0 // Initialize score to 0 for new teams
              };
              log.info(`[WS-${connectionId}] [NEW_JOIN] Created player entry with lastPongAt=${createdAt} for device ${deviceId}`);

              // PHASE 1: Detailed entry creation logging
              console.log('[PLAYER_JOIN] Creating new player entry:', {
                deviceId,
                teamName: data.teamName,
                teamPhoto: 'null (will be set after async save)',
                buzzerSound: buzzerSound || 'none'
              });
              console.log('[PLAYER_JOIN] Entry object details:');
              console.log('  - ws.readyState:', ws.readyState);
              console.log('  - ws._socket exists:', !!ws._socket);
              console.log('  - playerId:', playerId);
              console.log('  - status: pending');
              console.log('  - buzzerSound:', buzzerSound || 'none');

              // FIX: Store in map IMMEDIATELY - this is the critical fix
              console.log('[PLAYER_JOIN] 🔑 About to store in networkPlayers at deviceId:', `"${deviceId}"`);
              const beforeStoreSize = networkPlayers.size;
              networkPlayers.set(deviceId, playerEntry);
              const afterStoreSize = networkPlayers.size;

              console.log('[PLAYER_JOIN] 🔑 networkPlayers.set() completed');
              console.log('  - Size before:', beforeStoreSize);
              console.log('  - Size after:', afterStoreSize);
              console.log('  - Storage took:', Date.now() - storageStartTime, 'ms');

              log.info(`[WS-${connectionId}] ✨ [New Join] Device ${deviceId} joining for first time, player NOW AVAILABLE for approval`);

              // PHASE 1: Immediate verification that entry was stored correctly
              const storedEntry = networkPlayers.get(deviceId);
              console.log('[PLAYER_JOIN] 📋 VERIFICATION - Immediate lookup after set():');
              console.log('  - Entry found:', !!storedEntry);
              if (storedEntry) {
                console.log('  - teamName matches:', storedEntry.teamName === data.teamName);
                console.log('  - ws matches:', storedEntry.ws === ws);
                console.log('  - ws.readyState:', storedEntry.ws?.readyState);
                console.log('  - status:', storedEntry.status);
                console.log('  - teamPhoto:', storedEntry.teamPhoto ? (storedEntry.teamPhoto.substring(0, 50) + '...') : 'null (will update after photo save)');
              } else {
                console.error('[PLAYER_JOIN] ❌ CRITICAL: Entry was NOT found immediately after set()!');
                log.error(`[WS-${connectionId}] ❌ CRITICAL: Entry stored but not found in verification - deviceId: "${deviceId}"`);
              }

              // PHASE 1: Verify all entries in the map
              console.log('[PLAYER_JOIN] 📊 All entries in networkPlayers after storage:');
              const allEntries = [];
              networkPlayers.forEach((player, key) => {
                allEntries.push({
                  key: `"${key}"`,
                  teamName: player.teamName,
                  wsReadyState: player.ws?.readyState,
                  hasWs: !!player.ws
                });
              });
              console.log('  - Total entries:', allEntries.length);
              allEntries.forEach((entry, idx) => {
                console.log(`  [${idx}] deviceId: ${entry.key}, teamName: ${entry.teamName}, ws.readyState: ${entry.wsReadyState}`);
              });

              // FIX: Now do async photo save in background WITHOUT blocking
              // The player is already in networkPlayers and can be approved while photo is saving
              if (data.teamPhoto) {
                console.log('[PLAYER_JOIN] 📸 Starting async photo save for device:', deviceId);
                log.info(`[WS-${connectionId}] 📸 Team photo received for ${data.teamName} (size: ${data.teamPhoto.length} bytes), saving to disk in background...`);

                // Non-blocking: don't await this, let it run in the background
                saveTeamPhotoToDisk(data.teamPhoto, deviceId)
                  .then((saveResult) => {
                    console.log('[PLAYER_JOIN] Photo save completed for device:', deviceId);
                    log.info(`[WS-${connectionId}] [PLAYER_JOIN] Photo save completed:`, saveResult);
                    if (!saveResult.success) {
                      console.warn('[PLAYER_JOIN] ⚠️  Failed to save team photo:', saveResult.error);
                      log.warn(`[WS-${connectionId}] ⚠️  Failed to save team photo - ${saveResult.error} (code: ${saveResult.code})`);
                    } else {
                      // Update the stored entry with the photo path
                      const storedPlayer = networkPlayers.get(deviceId);
                      if (storedPlayer) {
                        storedPlayer.teamPhoto = saveResult.filePath;
                        console.log('[PLAYER_JOIN] ✅ Updated stored entry with photo path:', saveResult.filePath);
                        log.info(`[WS-${connectionId}] ✅ Team photo saved and stored: ${saveResult.filePath}`);
                      } else {
                        console.warn('[PLAYER_JOIN] ⚠️ Player entry not found when trying to update photo path');
                        log.warn(`[WS-${connectionId}] ⚠️ Player entry not found when trying to update photo path for device: ${deviceId}`);
                      }
                    }
                  })
                  .catch((err) => {
                    console.error('[PLAYER_JOIN] ❌ Photo save error:', err.message);
                    log.error(`[WS-${connectionId}] ❌ Photo save error:`, err.message);
                  });
              } else {
                console.log('[PLAYER_JOIN] No team photo in payload for device:', deviceId);
                log.info(`[WS-${connectionId}] [PLAYER_JOIN] No team photo in payload`);
              }
            }
            log.info(`[WS-${connectionId}] Stored player connection. Total players: ${networkPlayers.size}`);

            try {
              const otherClients = Array.from(wss.clients).filter(client => client.readyState === 1 && client !== ws);
              log.info(`[WS-${connectionId}] Broadcasting PLAYER_JOIN to ${otherClients.length} other clients`);

              const joinMessageData = {
                type: 'PLAYER_JOIN',
                playerId,
                deviceId,
                teamName: data.teamName,
                timestamp: Date.now()
              };

              // Include teamPhoto in broadcast if it was provided
              if (data.teamPhoto) {
                joinMessageData.teamPhoto = data.teamPhoto;
                console.log('[PLAYER_JOIN] Broadcasting PLAYER_JOIN with teamPhoto to other clients');
                log.info(`[WS-${connectionId}] Broadcasting PLAYER_JOIN WITH teamPhoto (${data.teamPhoto.length} bytes) to host`);
              } else {
                console.log('[PLAYER_JOIN] Broadcasting PLAYER_JOIN without teamPhoto to other clients');
                log.info(`[WS-${connectionId}] Broadcasting PLAYER_JOIN WITHOUT teamPhoto to host`);
              }

              const joinMessage = JSON.stringify(joinMessageData);
              log.info(`[WS-${connectionId}] PLAYER_JOIN message prepared, size: ${joinMessage.length} bytes`);

              otherClients.forEach((client, idx) => {
                try {
                  log.info(`[WS-${connectionId}] Sending PLAYER_JOIN to client ${idx + 1}/${otherClients.length}`);
                  client.send(joinMessage);
                  log.info(`[WS-${connectionId}] Successfully sent PLAYER_JOIN to client ${idx + 1}/${otherClients.length}`);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_JOIN to client ${idx + 1}:`, sendErr.message);
                  if (sendErr.stack) {
                    log.error(`[WS-${connectionId}] Send error stack:`, sendErr.stack);
                  }
                }
              });

              if (otherClients.length === 0) {
                log.warn(`[WS-${connectionId}] ⚠️  No other clients connected to receive PLAYER_JOIN message!`);
              }
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_JOIN:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
              throw broadcastErr;
            }
          } catch (playerJoinErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing PLAYER_JOIN:`, playerJoinErr.message);
            if (playerJoinErr.stack) {
              log.error(`[WS-${connectionId}] PLAYER_JOIN error stack:`, playerJoinErr.stack);
            }
          }
        } else if (data.type === 'PLAYER_ANSWER') {
          try {
            log.info(`[WS-${connectionId}] 📝 Player answer: ${data.teamName} answered:`, data.answer);

            const answerTimestamp = Date.now();
            recentAnswers.set(deviceId, {
              playerId: data.playerId,
              deviceId: deviceId,
              teamName: data.teamName,
              answer: data.answer,
              timestamp: answerTimestamp
            });
            log.info(`[WS-${connectionId}] ✅ Stored player answer. Total stored: ${recentAnswers.size}`);

            try {
              const answerClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting PLAYER_ANSWER to ${answerClients.length} clients`);

              const answerMessage = JSON.stringify({
                type: 'PLAYER_ANSWER',
                playerId: data.playerId,
                deviceId: deviceId,
                teamName: data.teamName,
                answer: data.answer,
                timestamp: answerTimestamp
              });

              answerClients.forEach((client, idx) => {
                try {
                  client.send(answerMessage);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_ANSWER to client ${idx}:`, sendErr.message);
                }
              });
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_ANSWER:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (playerAnswerErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing PLAYER_ANSWER:`, playerAnswerErr.message);
            if (playerAnswerErr.stack) {
              log.error(`[WS-${connectionId}] PLAYER_ANSWER error stack:`, playerAnswerErr.stack);
            }
          }
        } else if (data.type === 'PLAYER_AWAY') {
          // Handle player away state (tab switch, window blur, etc)
          try {
            log.info(`[WS-${connectionId}] 🚶 Player away: ${data.teamName} (device: ${data.deviceId}, reason: ${data.reason})`);

            try {
              const awayClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting PLAYER_AWAY to ${awayClients.length} clients`);

              const awayMessage = JSON.stringify({
                type: 'PLAYER_AWAY',
                playerId: data.playerId,
                deviceId: data.deviceId,
                teamName: data.teamName,
                reason: data.reason,
                timestamp: data.timestamp
              });

              awayClients.forEach((client, idx) => {
                try {
                  client.send(awayMessage);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_AWAY to client ${idx}:`, sendErr.message);
                }
              });
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_AWAY:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (playerAwayErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing PLAYER_AWAY:`, playerAwayErr.message);
            if (playerAwayErr.stack) {
              log.error(`[WS-${connectionId}] PLAYER_AWAY error stack:`, playerAwayErr.stack);
            }
          }
        } else if (data.type === 'PLAYER_ACTIVE') {
          // Handle player active state (returned from tab/window away)
          try {
            log.info(`[WS-${connectionId}] ✅ Player active: ${data.teamName} (device: ${data.deviceId}, reason: ${data.reason})`);

            try {
              const activeClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting PLAYER_ACTIVE to ${activeClients.length} clients`);

              const activeMessage = JSON.stringify({
                type: 'PLAYER_ACTIVE',
                playerId: data.playerId,
                deviceId: data.deviceId,
                teamName: data.teamName,
                reason: data.reason,
                timestamp: data.timestamp
              });

              activeClients.forEach((client, idx) => {
                try {
                  client.send(activeMessage);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_ACTIVE to client ${idx}:`, sendErr.message);
                }
              });
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_ACTIVE:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (playerActiveErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing PLAYER_ACTIVE:`, playerActiveErr.message);
            if (playerActiveErr.stack) {
              log.error(`[WS-${connectionId}] PLAYER_ACTIVE error stack:`, playerActiveErr.stack);
            }
          }
        } else if (data.type === 'TEAM_PHOTO_UPDATE') {
          try {
            console.log('[TEAM_PHOTO_UPDATE] 🔥 HANDLER ENTERED - Processing team photo update');
            console.log('[TEAM_PHOTO_UPDATE] Received message with fields:', Object.keys(data));
            log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Received message with fields:`, Object.keys(data).join(', '));

            // DEFENSIVE FIX: Normalize deviceId to remove leading/trailing whitespace
            // This prevents Map lookups from failing due to whitespace variations
            const updateDeviceId = ((data.deviceId || deviceId) || '').trim();
            console.log('[TEAM_PHOTO_UPDATE] Photo field present:', !!data.photoData, 'Size:', data.photoData?.length, 'bytes');
            log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Photo field present: ${!!data.photoData}, Size: ${data.photoData?.length || 'N/A'} bytes`);

            if (data.photoData) {
              const photoPrefix = data.photoData.substring(0, 100);
              console.log('[TEAM_PHOTO_UPDATE] Photo data prefix (first 100 chars):', photoPrefix);
              log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Photo data prefix: ${photoPrefix}`);
            }

            log.info(`[WS-${connectionId}] 📸 Team photo update: ${data.teamName} (device: ${updateDeviceId})`);

            const existingPlayer = networkPlayers.get(updateDeviceId);

            // Handle team photo update - save to disk if present
            let photoPath = null;
            const MAX_PHOTO_SIZE = 1024 * 1024 * 1024; // 1GB limit
            if (data.photoData) {
              // Validate photo size
              const photoSize = data.photoData.length;
              if (photoSize > MAX_PHOTO_SIZE) {
                console.warn('[TEAM_PHOTO_UPDATE] ⚠️  Photo size exceeds 1GB limit:', photoSize, 'bytes');
                log.warn(`[WS-${connectionId}] ⚠️  Photo size exceeds 1GB limit: ${photoSize} bytes for ${data.teamName}`);

                // Send error to client
                const errorMessage = JSON.stringify({
                  type: 'DEBUG_ERROR',
                  source: 'TEAM_PHOTO_UPDATE',
                  error: 'Photo size exceeds 1GB limit',
                  code: 'PHOTO_SIZE_EXCEEDED',
                  deviceId: updateDeviceId,
                  teamName: data.teamName,
                  photoSize: photoSize,
                  maxSize: MAX_PHOTO_SIZE,
                  timestamp: Date.now()
                });

                wss.clients.forEach(client => {
                  if (client.readyState === 1) {
                    try {
                      client.send(errorMessage);
                    } catch (sendErr) {
                      log.error(`[WS-${connectionId}] Failed to send photo size error:`, sendErr.message);
                    }
                  }
                });
                return;
              }

              console.log('[TEAM_PHOTO_UPDATE] Team photo found, calling saveTeamPhotoToDisk for device:', updateDeviceId);
              log.info(`[WS-${connectionId}] 📸 Team photo update received for ${data.teamName} (size: ${data.photoData.length} bytes), saving to disk...`);

              // CRITICAL FIX: Delete old photo files before saving new photo
              // This prevents storage bloat from accumulated old photos
              if (existingPlayer) {
                console.log('[TEAM_PHOTO_UPDATE] 🗑️  Cleanup: Checking for old photos to delete');

                // Delete old approved photo if it exists and is different from pending
                if (existingPlayer.teamPhoto) {
                  console.log('[TEAM_PHOTO_UPDATE] 🗑️  Deleting old approved photo');
                  log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Deleting old approved photo for ${data.teamName}`);
                  await deletePhotoFile(existingPlayer.teamPhoto);
                }

                // Delete old pending photo if it exists
                if (existingPlayer.teamPhotoPending && existingPlayer.teamPhotoPending !== existingPlayer.teamPhoto) {
                  console.log('[TEAM_PHOTO_UPDATE] 🗑️  Deleting old pending photo');
                  log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Deleting old pending photo for ${data.teamName}`);
                  await deletePhotoFile(existingPlayer.teamPhotoPending);
                }
              }

              const saveResult = await saveTeamPhotoToDisk(data.photoData, updateDeviceId);
              console.log('[TEAM_PHOTO_UPDATE] saveTeamPhotoToDisk returned:', saveResult);
              log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] saveTeamPhotoToDisk returned:`, saveResult);
              if (!saveResult.success) {
                console.warn('[TEAM_PHOTO_UPDATE] ⚠️  Failed to save team photo:', saveResult.error);
                log.warn(`[WS-${connectionId}] ⚠️  Failed to save team photo - ${saveResult.error} (code: ${saveResult.code})`);

                // PHASE 1: Broadcast detailed error to ALL connected clients (host and players)
                const errorMessage = JSON.stringify({
                  type: 'DEBUG_ERROR',
                  source: 'TEAM_PHOTO_UPDATE',
                  error: saveResult.error,
                  errorCode: saveResult.code,
                  deviceId: updateDeviceId,
                  teamName: data.teamName,
                  timestamp: Date.now()
                });

                console.log('[TEAM_PHOTO_UPDATE] Broadcasting DEBUG_ERROR with details:', { error: saveResult.error, code: saveResult.code });
                log.info(`[WS-${connectionId}] Broadcasting DEBUG_ERROR message with details to all connected clients`);

                wss.clients.forEach(client => {
                  if (client.readyState === 1) {
                    try {
                      client.send(errorMessage);
                      log.debug(`[WS-${connectionId}] Sent DEBUG_ERROR to client`);
                    } catch (sendErr) {
                      log.error(`[WS-${connectionId}] ❌ Failed to send DEBUG_ERROR:`, sendErr.message);
                    }
                  }
                });

                return;
              } else {
                photoPath = saveResult.filePath;
                console.log('[TEAM_PHOTO_UPDATE] ✅ Team photo saved successfully to:', photoPath);
                log.info(`[WS-${connectionId}] ✅ Team photo saved successfully to: ${photoPath}`);

                // PHASE 3: Broadcast success confirmation to ALL connected clients
                const successMessage = JSON.stringify({
                  type: 'DEBUG_INFO',
                  source: 'TEAM_PHOTO_UPDATE',
                  message: 'Photo saved successfully',
                  filePath: photoPath,
                  deviceId: updateDeviceId,
                  teamName: data.teamName,
                  timestamp: Date.now()
                });

                console.log('[TEAM_PHOTO_UPDATE] Broadcasting DEBUG_INFO success message to all clients');
                log.info(`[WS-${connectionId}] Broadcasting DEBUG_INFO success message to all connected clients`);

                wss.clients.forEach(client => {
                  if (client.readyState === 1) {
                    try {
                      client.send(successMessage);
                      log.debug(`[WS-${connectionId}] Sent DEBUG_INFO to client`);
                    } catch (sendErr) {
                      log.error(`[WS-${connectionId}] ❌ Failed to send DEBUG_INFO:`, sendErr.message);
                    }
                  }
                });
              }
            }

            // Update networkPlayers with new photo path if player exists
            if (existingPlayer) {
              console.log('[TEAM_PHOTO_UPDATE] Before update - teamPhoto:', existingPlayer.teamPhoto ? (existingPlayer.teamPhoto.substring(0, 50) + '...') : 'null');

              // CRITICAL FIX: Store new photo in pending field, NOT in displayed teamPhoto
              // Only update teamPhoto (displayed photo) if auto-approve is enabled
              existingPlayer.teamPhotoPending = photoPath;
              console.log('[TEAM_PHOTO_UPDATE] 📸 New photo stored in teamPhotoPending - awaiting approval');

              // Only update displayed photo if auto-approve setting is enabled
              if (autoApproveTeamPhotos === true) {
                existingPlayer.teamPhoto = photoPath;
                console.log('[TEAM_PHOTO_UPDATE] 🟢 Auto-approve ENABLED - updating displayed teamPhoto immediately');
              } else {
                console.log('[TEAM_PHOTO_UPDATE] 🔴 Auto-approve DISABLED - teamPhoto NOT updated (awaiting manual approval)');
              }

              // Compute and store the hash of the new photo
              const newPhotoHash = hashPhotoData(data.photoData);
              const oldPhotoHash = existingPlayer.teamPhotoHash;
              const approvedPhotoHash = existingPlayer.photoApprovedHash; // Hash of the approved photo
              existingPlayer.teamPhotoHash = newPhotoHash;

              // CRITICAL FIX: Always reset approval when a new photo is submitted
              // Per requirements, even identical photos (same hash) require re-approval unless auto-approve is enabled
              const oldPhotoApprovedAt = existingPlayer.photoApprovedAt;

              console.log('[TEAM_PHOTO_UPDATE] 🔍 APPROVAL CHECK:');
              console.log('  - Old photo hash:', oldPhotoHash ? (oldPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - New photo hash:', newPhotoHash ? (newPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - Approved photo hash:', approvedPhotoHash ? (approvedPhotoHash.substring(0, 16) + '...') : 'null');
              console.log('  - Current photoApprovedAt:', oldPhotoApprovedAt ? new Date(oldPhotoApprovedAt).toISOString() : 'null');
              console.log('  - Auto-approve setting:', autoApproveTeamPhotos);

              // When auto-approve is enabled, mark the photo as approved immediately
              // Otherwise, reset approval so manual approval is required
              if (autoApproveTeamPhotos === true) {
                // Auto-approve is enabled: mark this photo as approved
                const approvalTimestamp = Date.now();
                existingPlayer.photoApprovedAt = approvalTimestamp;
                existingPlayer.photoApprovedHash = newPhotoHash; // Mark this photo hash as approved
                console.log('[TEAM_PHOTO_UPDATE] 🟢 AUTO-APPROVAL: Photo marked as approved');
                console.log('[TEAM_PHOTO_UPDATE] photoApprovedAt set to:', new Date(approvalTimestamp).toISOString());
                console.log('[TEAM_PHOTO_UPDATE] photoApprovedHash set to:', newPhotoHash ? (newPhotoHash.substring(0, 16) + '...') : 'null');
                log.info(`[WS-${connectionId}] 🟢 [TEAM_PHOTO_UPDATE] AUTO-APPROVED photo for ${data.teamName}: Photo marked approved with timestamp`);
              } else {
                // Auto-approve is disabled: reset approval so manual approval is required
                existingPlayer.photoApprovedAt = null;
                existingPlayer.photoApprovedHash = null;
                existingPlayer.teamPhoto = null;
                console.log('[TEAM_PHOTO_UPDATE] 📸 RESET approval: New photo submitted - manual approval required');
                console.log('[TEAM_PHOTO_UPDATE] photoApprovedAt set to: null');
                console.log('[TEAM_PHOTO_UPDATE] photoApprovedHash set to: null');
                console.log('[TEAM_PHOTO_UPDATE] 📸 CLEARED displayed teamPhoto - new photo awaiting approval');
                log.info(`[WS-${connectionId}] 📸 [TEAM_PHOTO_UPDATE] RESET approval & cleared teamPhoto for ${data.teamName}: Manual approval required`);
              }

              console.log('[TEAM_PHOTO_UPDATE] After update - teamPhoto:', existingPlayer.teamPhoto ? (existingPlayer.teamPhoto.substring(0, 50) + '...') : 'null');
              console.log('[TEAM_PHOTO_UPDATE] Updated networkPlayers entry for device:', updateDeviceId);

              // Verify the update was applied
              const verifyPlayer = networkPlayers.get(updateDeviceId);
              if (verifyPlayer?.teamPhoto) {
                console.log('[TEAM_PHOTO_UPDATE] ✅ Verification passed - photo is stored in networkPlayers');
                console.log('[TEAM_PHOTO_UPDATE] ✅ Verification passed - current photo hash:', verifyPlayer.teamPhotoHash ? (verifyPlayer.teamPhotoHash.substring(0, 16) + '...') : 'null');
                console.log('[TEAM_PHOTO_UPDATE] ✅ Verification passed - approved photo hash:', verifyPlayer.photoApprovedHash ? (verifyPlayer.photoApprovedHash.substring(0, 16) + '...') : 'null');
                console.log('[TEAM_PHOTO_UPDATE] ✅ Verification passed - photoApprovedAt =', verifyPlayer.photoApprovedAt ? new Date(verifyPlayer.photoApprovedAt).toISOString() : 'null');
              } else {
                console.warn('[TEAM_PHOTO_UPDATE] ⚠️  Verification failed - teamPhoto not in networkPlayers!');
              }
            } else {
              console.warn('[TEAM_PHOTO_UPDATE] ⚠️  Player not found in networkPlayers for device:', updateDeviceId);
              log.warn(`[WS-${connectionId}] ⚠️  Player not found in networkPlayers - may be new or disconnected`);
            }

            // Broadcast TEAM_PHOTO_UPDATED message to all other clients (host app)
            try {
              const updateClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting TEAM_PHOTO_UPDATED to ${updateClients.length} clients`);

              const updateMessage = JSON.stringify({
                type: 'TEAM_PHOTO_UPDATED',
                playerId: data.playerId,
                deviceId: updateDeviceId,
                teamName: data.teamName,
                photoPath: photoPath,
                timestamp: Date.now()
              });

              console.log('[TEAM_PHOTO_UPDATE] Broadcasting TEAM_PHOTO_UPDATED message');
              log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] Broadcasting TEAM_PHOTO_UPDATED message (${updateMessage.length} bytes)`);

              updateClients.forEach((client, idx) => {
                try {
                  log.info(`[WS-${connectionId}] Sending TEAM_PHOTO_UPDATED to client ${idx + 1}/${updateClients.length}`);
                  client.send(updateMessage);
                  log.info(`[WS-${connectionId}] Successfully sent TEAM_PHOTO_UPDATED to client ${idx + 1}/${updateClients.length}`);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast TEAM_PHOTO_UPDATED to client ${idx}:`, sendErr.message);
                }
              });

              if (updateClients.length === 0) {
                log.warn(`[WS-${connectionId}] ⚠️  No other clients connected to receive TEAM_PHOTO_UPDATED message!`);
              }
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting TEAM_PHOTO_UPDATED:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (photoUpdateErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing TEAM_PHOTO_UPDATE:`, photoUpdateErr.message);
            if (photoUpdateErr.stack) {
              log.error(`[WS-${connectionId}] TEAM_PHOTO_UPDATE error stack:`, photoUpdateErr.stack);
            }
          }
        } else if (data.type === 'PLAYER_BUZZER_SELECT') {
          try {
            // DEFENSIVE FIX: Normalize deviceId to remove leading/trailing whitespace
            // This ensures consistency with PLAYER_JOIN normalization
            const buzzerDeviceId = ((data.deviceId || deviceId) || '').trim();

            // Normalize buzzer sound value (trim whitespace and ensure .mp3 extension)
            const normalizedBuzzerSound = (data.buzzerSound || '')
              .trim()
              .replace(/\.mp3$/i, '') + '.mp3';

            log.info(`[WS-${connectionId}] 🔊 Player buzzer selection: ${data.teamName} selected "${data.buzzerSound}" → normalized to "${normalizedBuzzerSound}" (device: ${buzzerDeviceId})`);

            // Update networkPlayers with normalized buzzer sound
            const existingPlayer = networkPlayers.get(buzzerDeviceId);
            if (existingPlayer) {
              existingPlayer.buzzerSound = normalizedBuzzerSound;
              log.info(`[WS-${connectionId}] ✅ Updated networkPlayers for ${data.teamName}, buzzer: ${normalizedBuzzerSound}`);
            } else {
              log.warn(`[WS-${connectionId}] ⚠️  Player not found in networkPlayers when updating buzzer (device: ${buzzerDeviceId})`);
            }

            // Broadcast PLAYER_BUZZER_SELECT message to all other clients (host and other players) with normalized value
            try {
              const buzzerClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting PLAYER_BUZZER_SELECT to ${buzzerClients.length} clients`);

              const buzzerMessage = JSON.stringify({
                type: 'PLAYER_BUZZER_SELECT',
                playerId: data.playerId,
                deviceId: buzzerDeviceId,
                teamName: data.teamName,
                buzzerSound: normalizedBuzzerSound,
                timestamp: Date.now()
              });

              buzzerClients.forEach((client, idx) => {
                try {
                  log.info(`[WS-${connectionId}] Sending PLAYER_BUZZER_SELECT to client ${idx + 1}/${buzzerClients.length}`);
                  client.send(buzzerMessage);
                  log.info(`[WS-${connectionId}] Successfully sent PLAYER_BUZZER_SELECT to client ${idx + 1}/${buzzerClients.length}`);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_BUZZER_SELECT to client ${idx}:`, sendErr.message);
                }
              });

              if (buzzerClients.length === 0) {
                log.warn(`[WS-${connectionId}] ⚠️  No other clients connected to receive PLAYER_BUZZER_SELECT message!`);
              }
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_BUZZER_SELECT:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (buzzerSelectErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing PLAYER_BUZZER_SELECT:`, buzzerSelectErr.message);
            if (buzzerSelectErr.stack) {
              log.error(`[WS-${connectionId}] PLAYER_BUZZER_SELECT error stack:`, buzzerSelectErr.stack);
            }
          }
        } else if (data.type === 'ADMIN_COMMAND') {
          // Handle admin commands from host controllers
          try {
            const adminDeviceId = ((data.deviceId || deviceId) || '').trim();
            const commandType = data.commandType || '';

            console.log(`[ADMIN_COMMAND] Received from device: ${adminDeviceId}, command: ${commandType}`);
            log.info(`[WS-${connectionId}] 🎮 Admin command received: ${commandType} from device ${adminDeviceId}`);

            // SECURITY: Validate that command type is a valid string
            if (typeof commandType !== 'string' || !commandType.trim()) {
              console.warn(`[ADMIN_COMMAND] ⚠️  Invalid commandType: ${commandType}`);
              log.warn(`[WS-${connectionId}] ⚠️  Invalid commandType received: ${commandType}`);
              return;
            }

            // Handle special controller commands that don't need to be broadcast to all clients
            if (commandType === 'GET_CONNECTED_TEAMS') {
              console.log('[ADMIN_COMMAND] Processing GET_CONNECTED_TEAMS request');
              log.info(`[WS-${connectionId}] Processing GET_CONNECTED_TEAMS request from controller`);

              // Collect all connected players/teams (excluding the controller device)
              const teams = Array.from(networkPlayers.entries())
                .filter(([key, player]) => key !== adminDeviceId) // Exclude the controller itself
                .map(([key, player]) => ({
                  id: key, // Use deviceId as the team ID
                  deviceId: key,
                  teamName: player.teamName,
                  status: player.status,
                  score: player.score || 0, // Include score, default to 0 if not set
                  photoApprovedAt: player.photoApprovedAt,
                  timestamp: player.timestamp,
                  hasPhoto: !!player.teamPhoto
                }));

              console.log(`[ADMIN_COMMAND] Returning ${teams.length} connected teams to controller`);
              log.info(`[WS-${connectionId}] Sending ${teams.length} connected teams to controller`);

              // Send the list back to the controller directly
              try {
                ws.send(JSON.stringify({
                  type: 'ADMIN_RESPONSE',
                  commandType: 'GET_CONNECTED_TEAMS',
                  success: true,
                  data: { teams },
                  timestamp: Date.now()
                }));
                console.log('[ADMIN_COMMAND] ✅ Sent team list to controller');
              } catch (sendErr) {
                log.error(`[WS-${connectionId}] ❌ Failed to send team list to controller:`, sendErr.message);
              }
              return; // Don't broadcast this response to all clients
            }

            try {
              // Broadcast ADMIN_COMMAND to all other clients (the host)
              const adminClients = Array.from(wss.clients).filter(c => c.readyState === 1 && c !== ws);
              log.info(`[WS-${connectionId}] Broadcasting ADMIN_COMMAND to ${adminClients.length} clients`);

              const adminMessage = JSON.stringify({
                type: 'ADMIN_COMMAND',
                playerId: data.playerId,
                deviceId: adminDeviceId,
                teamName: data.teamName,
                commandType: commandType,
                commandData: data.commandData,
                timestamp: Date.now()
              });

              adminClients.forEach((client, idx) => {
                try {
                  log.info(`[WS-${connectionId}] Sending ADMIN_COMMAND to client ${idx + 1}/${adminClients.length}`);
                  client.send(adminMessage);
                  log.info(`[WS-${connectionId}] Successfully sent ADMIN_COMMAND to client ${idx + 1}/${adminClients.length}`);
                } catch (sendErr) {
                  log.error(`[WS-${connectionId}] ❌ Failed to broadcast ADMIN_COMMAND to client ${idx}:`, sendErr.message);
                }
              });

              if (adminClients.length === 0) {
                log.warn(`[WS-${connectionId}] ⚠️  No other clients connected to receive ADMIN_COMMAND message!`);
              }
            } catch (broadcastErr) {
              log.error(`[WS-${connectionId}] ❌ Error broadcasting ADMIN_COMMAND:`, broadcastErr.message);
              if (broadcastErr.stack) {
                log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
              }
            }
          } catch (adminCommandErr) {
            log.error(`[WS-${connectionId}] ❌ Error processing ADMIN_COMMAND:`, adminCommandErr.message);
            if (adminCommandErr.stack) {
              log.error(`[WS-${connectionId}] ADMIN_COMMAND error stack:`, adminCommandErr.stack);
            }
          }
        } else {
          log.warn(`[WS-${connectionId}] ⚠️  Unknown message type: ${data.type}`);
        }
      } catch (err) {
        log.error(`[WS-${connectionId}] ❌ WebSocket message handler error:`, err.message);
        if (err && err.stack) {
          log.error(`[WS-${connectionId}] Message handler error stack:`, err.stack);
        }
      }
    });

    ws.on('close', (code, reason) => {
      try {
        const closeMsg = `[WS-${connectionId}] Close event - Code: ${code}, Reason: "${reason || 'none'}", ws.bufferedAmount: ${ws.bufferedAmount}, readyState: ${ws.readyState}`;
        if (deviceId) {
          log.info(`${closeMsg}, Device: ${deviceId}, Total connections: ${wss.clients.size - 1}`);
        } else {
          log.info(`${closeMsg}, Unknown client, Total connections: ${wss.clients.size - 1}`);
        }
        if (playerId) {
          log.info(`[WS-${connectionId}] Close event for playerId: ${playerId}`);
        }

        // Phase 1: Broadcast PLAYER_DISCONNECT when player disconnects
        // Try to find player by deviceId, or fallback to playerId lookup
        let player = null;
        let foundDeviceId = deviceId;

        if (deviceId && networkPlayers.has(deviceId)) {
          player = networkPlayers.get(deviceId);
        } else if (deviceId) {
          // deviceId exists but player not found - log for debugging
          log.warn(`[WS-${connectionId}] ⚠️ Close handler: deviceId "${deviceId}" not found in networkPlayers`);
        }

        // If player found, broadcast disconnect and clean up
        if (player) {
          log.info(`[WS-${connectionId}] 🔌 Player disconnected: ${player.teamName} (device: ${foundDeviceId})`);

          try {
            // Broadcast PLAYER_DISCONNECT to all other connected clients (host app)
            const disconnectMessage = JSON.stringify({
              type: 'PLAYER_DISCONNECT',
              data: {
                deviceId: foundDeviceId,
                playerId: playerId || player.playerId,
                teamName: player.teamName
              },
              timestamp: Date.now()
            });

            const otherClients = Array.from(wss.clients).filter(client => client.readyState === 1 && client !== ws);
            log.info(`[WS-${connectionId}] Broadcasting PLAYER_DISCONNECT to ${otherClients.length} clients`);

            otherClients.forEach((client, idx) => {
              try {
                client.send(disconnectMessage);
                log.info(`[WS-${connectionId}] Successfully sent PLAYER_DISCONNECT to client ${idx + 1}/${otherClients.length}`);
              } catch (sendErr) {
                log.error(`[WS-${connectionId}] ❌ Failed to broadcast PLAYER_DISCONNECT to client ${idx}:`, sendErr.message);
              }
            });

            if (otherClients.length === 0) {
              log.warn(`[WS-${connectionId}] ⚠️ No other clients connected to receive PLAYER_DISCONNECT message`);
            }

            // Keep player data in networkPlayers for reconnection, but update the ws reference to null
            player.ws = null;
            player.disconnectedAt = Date.now();
            log.info(`[WS-${connectionId}] ✅ Kept player data in networkPlayers for potential reconnection. Player status: ${player.status}`);
          } catch (broadcastErr) {
            log.error(`[WS-${connectionId}] ❌ Error broadcasting PLAYER_DISCONNECT:`, broadcastErr.message);
            if (broadcastErr.stack) {
              log.error(`[WS-${connectionId}] Broadcast error stack:`, broadcastErr.stack);
            }
          }
        } else if (!deviceId) {
          // No deviceId and no player found - likely early disconnect before PLAYER_JOIN
          log.debug(`[WS-${connectionId}] Close without PLAYER_JOIN - no player data to broadcast`);
        }
      } catch (closeErr) {
        log.error(`[WS-${connectionId}] Error in close handler:`, closeErr.message);
      }
    });
  });

  await new Promise((res, rej) => {
    server.once('error', (err) => {
      log.error(`Server error: ${err.message}`);
      rej(err);
    });
    server.once('listening', () => {
      log.info(`✅ Backend listening on all interfaces on port ${port}`);
      const address = server.address();
      log.info(`Server address info:`, address);
      log.info(`Process ID: ${process.pid}`);

      // Phase 2: Start heartbeat mechanism
      log.info(`[Heartbeat] Starting heartbeat mechanism - sending ping every ${HEARTBEAT_INTERVAL}ms, timeout after ${HEARTBEAT_TIMEOUT}ms`);

      // Heartbeat sender - send ping to all connected players
      heartbeatIntervalId = setInterval(() => {
        let sentCount = 0;
        let failCount = 0;

        networkPlayers.forEach((player, deviceId) => {
          if (player.ws && player.ws.readyState === 1) {
            try {
              player.ws.ping();
              sentCount++;
              log.debug(`[Heartbeat] Sent ping to ${player.teamName} (device: ${deviceId})`);
            } catch (err) {
              log.warn(`[Heartbeat] Failed to send ping to ${deviceId}:`, err.message);
              failCount++;
            }
          }
        });

        if (sentCount > 0 || failCount > 0) {
          log.debug(`[Heartbeat] Sent ${sentCount} pings` + (failCount > 0 ? `, ${failCount} failed` : ''));
        }
      }, HEARTBEAT_INTERVAL);

      // Stale connection checker - detect players who haven't ponged recently
      staleCheckIntervalId = setInterval(() => {
        const now = Date.now();
        const staleDevices = [];
        let checkedCount = 0;

        networkPlayers.forEach((player, deviceId) => {
          if (player.ws && player.ws.readyState === 1) {
            checkedCount++;
            const lastPongTime = player.lastPongAt || now;
            const timeSinceLastPong = now - lastPongTime;
            const timeSinceApproval = player.approvedAt ? (now - player.approvedAt) : -1;

            // Log all active connections for diagnosis
            log.debug(
              `[Heartbeat] Player status: ${player.teamName} (device: ${deviceId}) - ` +
              `lastPong: ${timeSinceLastPong}ms ago, ` +
              `approved: ${timeSinceApproval >= 0 ? timeSinceApproval + 'ms ago' : 'not approved'}, ` +
              `ws.readyState: ${player.ws.readyState} (1=open)`
            );

            if (timeSinceLastPong > HEARTBEAT_TIMEOUT) {
              log.warn(
                `[Heartbeat] ⚠️ STALE CONNECTION DETECTED: ${player.teamName} (device: ${deviceId}) - ` +
                `no pong for ${timeSinceLastPong}ms (timeout: ${HEARTBEAT_TIMEOUT}ms), ` +
                `approved: ${player.approvedAt ? 'yes' : 'no'}`
              );
              staleDevices.push({ deviceId, player });
            }
          }
        });

        if (checkedCount > 0) {
          log.debug(`[Heartbeat] Stale-check cycle: checked ${checkedCount} players, found ${staleDevices.length} stale`);

          // Detect cascade failures (many disconnections at once)
          if (staleDevices.length > checkedCount * 0.25) {
            log.error(`[Heartbeat] ⚠️  CASCADE FAILURE DETECTED: ${staleDevices.length}/${checkedCount} players are stale (${((staleDevices.length/checkedCount)*100).toFixed(1)}%)`);
            log.error(`[Heartbeat] This may indicate network congestion or server overload. Check buffer sizes and message sizes.`);
          }
        }

        // Close stale connections - the close handler will broadcast PLAYER_DISCONNECT
        staleDevices.forEach(({ deviceId, player }) => {
          try {
            log.info(`[Heartbeat] 🔌 Disconnecting stale player: ${player.teamName} (device: ${deviceId}) - no pong for ${Date.now() - (player.lastPongAt || Date.now())}ms`);

            // Close the WebSocket connection to trigger the close handler
            // The close handler will broadcast PLAYER_DISCONNECT and clean up the player reference
            if (player.ws && player.ws.readyState === 1) {
              player.ws.close(1000, 'Heartbeat timeout');
              log.info(`[Heartbeat] ✅ Close triggered for stale player: ${player.teamName} (device: ${deviceId})`);
            } else {
              log.warn(`[Heartbeat] ⚠️ Stale player WebSocket not available or already closed: ${player.teamName} (device: ${deviceId})`);
            }
          } catch (err) {
            log.error(`[Heartbeat] Error handling stale connection for ${deviceId}:`, err.message);
          }
        });
      }, STALE_CHECK_INTERVAL);

      // Cleanup interval - remove stale player entries that have been disconnected beyond TTL
      cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        const removedDevices = [];
        let connectedCount = 0;
        let disconnectedCount = 0;
        let totalBufferedAmount = 0;

        // Gather metrics while checking for stale entries
        networkPlayers.forEach((player, deviceId) => {
          if (player.ws && player.ws.readyState === 1) {
            connectedCount++;
            totalBufferedAmount += player.ws.bufferedAmount || 0;
          } else if (player.ws === null) {
            disconnectedCount++;
          }

          // If player is disconnected (ws is null) and TTL has expired, remove the entry
          if (player.ws === null && player.disconnectedAt) {
            const timeSinceDisconnect = now - player.disconnectedAt;
            if (timeSinceDisconnect > STALE_PLAYER_TTL) {
              removedDevices.push({ deviceId, teamName: player.teamName, timeSinceDisconnect });
              networkPlayers.delete(deviceId);
            }
          }
        });

        // Log comprehensive metrics for monitoring stability
        log.info(
          `[Metrics] Players: ${connectedCount} connected, ${disconnectedCount} disconnected (total: ${networkPlayers.size}) | ` +
          `Buffer: ${(totalBufferedAmount / 1024).toFixed(1)}KB total | ` +
          `Heartbeat: ${HEARTBEAT_INTERVAL/1000}s interval, ${HEARTBEAT_TIMEOUT/1000}s timeout`
        );

        if (removedDevices.length > 0) {
          log.info(`[Cleanup] ✅ Removed ${removedDevices.length} stale player entries (TTL expired)`);
          removedDevices.forEach(({ deviceId, teamName, timeSinceDisconnect }) => {
            log.info(`[Cleanup] - ${teamName} (device: ${deviceId}) disconnected ${(timeSinceDisconnect / 60000).toFixed(1)} minutes ago`);
          });
        }

        // Warn if too many disconnected entries are accumulating (indicates potential issue)
        if (disconnectedCount > 20) {
          log.warn(`[Metrics] ⚠️  Many disconnected players in memory: ${disconnectedCount}. Check if TTL cleanup is working.`);
        }

        if (totalBufferedAmount > 1024 * 1024) {
          log.warn(`[Metrics] ⚠️  HIGH BUFFER: ${(totalBufferedAmount / 1024 / 1024).toFixed(1)}MB buffered across all connections. May indicate slow clients.`);
        }
      }, CLEANUP_INTERVAL);

      log.info(`[Heartbeat] ✅ Heartbeat mechanism started successfully`);

      res();
    });
    server.listen(port, '0.0.0.0', (err) => {
      if (err) {
        log.error(`Failed to listen on port ${port}:`, err);
        rej(err);
      }
    });
  });

  log.info(`Host can access player app at: http://${localIP}:${port}`);

  // ...existing helper functions (approveTeam, declineTeam, etc.)...
  // PHASE 4: Retry configuration for approval with exponential backoff
  const APPROVAL_RETRY_CONFIG = {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 1600,
    backoffMultiplier: 2
  };

  // PHASE 5: Convert approveTeam to Promise-based to properly handle retries
  // This fixes the race condition where retries were scheduled but their results were never reported
  async function approveTeam(deviceId, teamName, displayData = {}, retryCount = 0, approvePhoto = false) {
    try {
      // PHASE 1: ENHANCED DIAGNOSTICS - Log exact function entry
      const callTimestamp = Date.now();
      console.log('[approveTeam] ✅ Called:', { deviceId, teamName, timestamp: new Date(callTimestamp).toISOString() });
      console.log('[approveTeam] 🔑 CRITICAL PARAMETER CHECK - approvePhoto:');
      console.log('  - Value:', approvePhoto);
      console.log('  - Type:', typeof approvePhoto);
      console.log('  - Strict true?:', approvePhoto === true);
      console.log('  - Truthy?:', !!approvePhoto);
      log.info(`✅ approveTeam called: ${teamName} (${deviceId}) with approvePhoto=${approvePhoto} at ${new Date(callTimestamp).toISOString()}`);

      // PHASE 1: Detailed deviceId inspection
      console.log('[approveTeam] 🔍 deviceId Inspection:');
      console.log('  - Value:', `"${deviceId}"`);
      console.log('  - Length:', deviceId.length);
      console.log('  - Type:', typeof deviceId);
      console.log('  - Char codes:', Array.from(deviceId).map((c, i) => `[${i}]=${c.charCodeAt(0)}`).join(', '));
      console.log('  - Has leading/trailing spaces:', deviceId !== deviceId.trim() ? 'YES' : 'NO');
      console.log('  - Trimmed version:', `"${deviceId.trim()}"`);

      // PHASE 1: Inspect networkPlayers map structure
      console.log('[approveTeam] 📍 networkPlayers Map Inspection:');
      console.log('  - Total size:', networkPlayers.size);
      console.log('  - All keys (exact values):');
      Array.from(networkPlayers.keys()).forEach((key, idx) => {
        console.log(`    [${idx}] "${key}" (length: ${key.length}, trimmed: "${key.trim()}")`);
      });

      // PHASE 1: Try exact match
      const player = networkPlayers.get(deviceId);

      // PHASE 1: Try trimmed match if exact fails
      let playerTrimmed = null;
      if (!player && deviceId !== deviceId.trim()) {
        console.log('[approveTeam] ⚠️  Exact match failed, trying trimmed deviceId...');
        playerTrimmed = networkPlayers.get(deviceId.trim());
        if (playerTrimmed) {
          console.log('[approveTeam] ✅ Found player with TRIMMED deviceId!');
        }
      }

      // PHASE 1: Try case-insensitive match
      let playerCaseInsensitive = null;
      if (!player && !playerTrimmed) {
        console.log('[approveTeam] ⚠️  Still no match, trying case-insensitive search...');
        for (const [key, value] of networkPlayers) {
          if (key.toLowerCase() === deviceId.toLowerCase()) {
            playerCaseInsensitive = value;
            console.log(`[approveTeam] ✅ Found player with CASE-INSENSITIVE match: "${key}"`);
            break;
          }
        }
      }

      const finalPlayer = player || playerTrimmed || playerCaseInsensitive;

      // PHASE 1: Log discovery results
      console.log('[approveTeam] 🔎 Player Lookup Results:');
      console.log('  - Exact match found:', !!player);
      console.log('  - Trimmed match found:', !!playerTrimmed);
      console.log('  - Case-insensitive match found:', !!playerCaseInsensitive);
      console.log('  - Final player found:', !!finalPlayer);

      if (finalPlayer) {
        console.log('[approveTeam] Player details:');
        console.log('  - teamName:', finalPlayer.teamName);
        console.log('  - status:', finalPlayer.status);
        console.log('  - approvedAt:', finalPlayer.approvedAt ? new Date(finalPlayer.approvedAt).toISOString() : 'null');
        console.log('  - Has ws:', !!finalPlayer.ws);
        console.log('  - ws readyState:', finalPlayer.ws?.readyState || 'N/A');
        console.log('  - Has teamPhoto:', !!finalPlayer.teamPhoto);
        if (finalPlayer.teamPhoto) {
          console.log('  - teamPhoto value (first 100 chars):', finalPlayer.teamPhoto.substring(0, 100) + '...');
        }
      }

      if (!finalPlayer) {
        log.error(`❌ Player not found in networkPlayers: ${deviceId}`);
        log.info(`Available players (${networkPlayers.size}): ${Array.from(networkPlayers.keys()).join(', ')}`);
        console.error('[approveTeam] ❌ Player not found in networkPlayers even after trimmed/case-insensitive search');

        // PHASE 5: Retry logic if player not found (likely race condition)
        if (retryCount < APPROVAL_RETRY_CONFIG.maxRetries) {
          const delayMs = Math.min(
            APPROVAL_RETRY_CONFIG.initialDelayMs * Math.pow(APPROVAL_RETRY_CONFIG.backoffMultiplier, retryCount),
            APPROVAL_RETRY_CONFIG.maxDelayMs
          );
          console.log(`[approveTeam] ⏱️  Retrying approval (attempt ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries}) after ${delayMs}ms delay...`);
          log.info(`[approveTeam] ⏱️  Scheduling retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} after ${delayMs}ms - player not in map yet`);

          // PHASE 5: Wait for retry to complete before returning
          await new Promise(res => setTimeout(res, delayMs));
          console.log(`[approveTeam] 🔄 Executing retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} for ${deviceId}`);
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1, approvePhoto);
          return retryResult;
        } else {
          log.error(`❌ approveTeam failed after ${APPROVAL_RETRY_CONFIG.maxRetries} retry attempts - player still not found: ${deviceId}`);
          return false;
        }
      }

      // Use the matched player for rest of function
      const matchedDeviceId = deviceId === deviceId.trim() ? deviceId : (player ? deviceId : (playerTrimmed ? deviceId.trim() : deviceId.toLowerCase()));

      if (!finalPlayer.ws) {
        log.error(`❌ Player has no WebSocket connection: ${matchedDeviceId}`);
        console.error('[approveTeam] ❌ Player has no WebSocket connection, ws is null/undefined');
        console.log('[approveTeam] Player object structure:', {
          teamName: finalPlayer.teamName,
          status: finalPlayer.status,
          timestamp: finalPlayer.timestamp,
          wsExists: !!finalPlayer.ws,
          wsType: typeof finalPlayer.ws
        });

        // PHASE 5: Retry logic if ws not yet assigned (race condition)
        if (retryCount < APPROVAL_RETRY_CONFIG.maxRetries) {
          const delayMs = Math.min(
            APPROVAL_RETRY_CONFIG.initialDelayMs * Math.pow(APPROVAL_RETRY_CONFIG.backoffMultiplier, retryCount),
            APPROVAL_RETRY_CONFIG.maxDelayMs
          );
          console.log(`[approveTeam] ⏱️  Retrying approval (attempt ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries}) after ${delayMs}ms delay - ws not yet assigned...`);
          log.info(`[approveTeam] ⏱️  Scheduling retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} after ${delayMs}ms - ws not assigned yet`);

          // PHASE 5: Wait for retry to complete before returning
          await new Promise(res => setTimeout(res, delayMs));
          console.log(`[approveTeam] 🔄 Executing retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} for ${matchedDeviceId} - checking ws`);
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1, approvePhoto);
          return retryResult;
        } else {
          log.error(`❌ approveTeam failed after ${APPROVAL_RETRY_CONFIG.maxRetries} retry attempts - ws still null: ${matchedDeviceId}`);
          return false;
        }
      }

      const ws = finalPlayer.ws;

      // PHASE 1: Comprehensive WebSocket state inspection
      console.log('[approveTeam] 🔌 WebSocket State Inspection:');
      console.log('  - readyState:', ws.readyState, `(${['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState]})`);
      console.log('  - bufferedAmount:', ws.bufferedAmount);
      console.log('  - url:', ws.url || 'N/A');
      console.log('  - protocol:', ws.protocol || 'N/A');
      console.log('  - extensions:', ws.extensions || 'N/A');
      console.log('  - Has _socket:', !!ws._socket);
      if (ws._socket) {
        console.log('    - _socket.readable:', ws._socket.readable);
        console.log('    - _socket.writable:', ws._socket.writable);
        console.log('    - _socket.remoteAddress:', ws._socket.remoteAddress);
        console.log('    - _socket.destroyed:', ws._socket.destroyed);
      }
      console.log('  - Event listeners:', Object.keys(ws._events || {}));

      log.info(`[approveTeam] WebSocket state before sending: ${ws.readyState} (0=connecting, 1=open, 2=closing, 3=closed)`);

      if (ws.readyState !== 1) {
        log.error(`❌ Player WebSocket not open. State: ${ws.readyState} (0=connecting, 1=open, 2=closing, 3=closed): ${matchedDeviceId}`);
        console.error('[approveTeam] ❌ WebSocket is not open. readyState:', ws.readyState);
        log.error(`[approveTeam] 📋 WebSocket details at failure:`, {
          readyState: ws.readyState,
          bufferedAmount: ws.bufferedAmount,
          hasSocket: !!ws._socket,
          socketReadable: ws._socket?.readable,
          socketWritable: ws._socket?.writable,
          socketDestroyed: ws._socket?.destroyed
        });

        // PHASE 5: Retry logic if WebSocket not yet open (still connecting)
        if (ws.readyState === 0 && retryCount < APPROVAL_RETRY_CONFIG.maxRetries) {
          // WebSocket is connecting, retry after delay
          const delayMs = Math.min(
            APPROVAL_RETRY_CONFIG.initialDelayMs * Math.pow(APPROVAL_RETRY_CONFIG.backoffMultiplier, retryCount),
            APPROVAL_RETRY_CONFIG.maxDelayMs
          );
          console.log(`[approveTeam] ⏱️  Retrying approval (attempt ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries}) after ${delayMs}ms delay - ws still connecting...`);
          log.info(`[approveTeam] ⏱️  Scheduling retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} after ${delayMs}ms - ws readyState: ${ws.readyState} (connecting)`);

          // PHASE 5: Wait for retry to complete before returning
          await new Promise(res => setTimeout(res, delayMs));
          console.log(`[approveTeam] 🔄 Executing retry ${retryCount + 1}/${APPROVAL_RETRY_CONFIG.maxRetries} for ${matchedDeviceId} - checking ws.readyState`);
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1, approvePhoto);
          return retryResult;
        } else if (ws.readyState === 0) {
          log.error(`❌ approveTeam failed after ${APPROVAL_RETRY_CONFIG.maxRetries} retry attempts - ws still connecting: ${matchedDeviceId}`);
        }
        return false;
      }

      finalPlayer.status = 'approved';
      finalPlayer.approvedAt = Date.now();

      // CRITICAL LOGGING: Track photoApprovedAt assignment
      console.log('[approveTeam] 🔑 PHOTO APPROVAL CHECK:');
      console.log('  - approvePhoto parameter value:', approvePhoto);
      console.log('  - approvePhoto type:', typeof approvePhoto);
      console.log('  - Condition (approvePhoto) evaluates to:', !!approvePhoto);
      console.log('  - WILL SET photoApprovedAt:', approvePhoto ? 'YES' : 'NO');

      if (approvePhoto) {
        console.log('[approveTeam] ✅ approvePhoto is TRUE - SETTING photoApprovedAt');
        const approvalTimestamp = Date.now();

        // CRITICAL FIX: Move pending photo to displayed photo if there's a pending one
        if (finalPlayer.teamPhotoPending) {
          finalPlayer.teamPhoto = finalPlayer.teamPhotoPending;
          finalPlayer.teamPhotoPending = null;
          console.log('[approveTeam] 📸 MOVED pending photo to displayed teamPhoto');
        }

        finalPlayer.photoApprovedAt = approvalTimestamp; // Only approve the photo if explicitly requested
        console.log('[approveTeam] ✅ ASSIGNMENT COMPLETE: finalPlayer.photoApprovedAt is now:', finalPlayer.photoApprovedAt);

        // CRITICAL FIX: Store the hash of the approved photo so we can restore approval if same photo is resubmitted
        const currentPhotoHash = finalPlayer.teamPhotoHash; // Get the current photo hash
        finalPlayer.photoApprovedHash = currentPhotoHash; // Mark THIS photo hash as approved
        console.log('[approveTeam] 📸 MARKED photo as approved with hash:', currentPhotoHash ? (currentPhotoHash.substring(0, 16) + '...') : 'null');

        // VERIFICATION: Check that the value was actually set
        console.log('[approveTeam] ✅ VERIFICATION: finalPlayer.photoApprovedAt after assignment:', finalPlayer.photoApprovedAt);
        console.log('[approveTeam] ✅ VERIFICATION: Is it equal to timestamp?', finalPlayer.photoApprovedAt === approvalTimestamp);

        // DOUBLE-CHECK: Ensure value persists in the Map
        const mapEntry = networkPlayers.get(matchedDeviceId);
        if (mapEntry && !mapEntry.photoApprovedAt) {
          console.warn('[approveTeam] ⚠️  CRITICAL: photoApprovedAt not persisted to Map! Forcing update...');
          mapEntry.photoApprovedAt = approvalTimestamp;
          console.log('[approveTeam] ✅ Force-updated Map entry with photoApprovedAt:', mapEntry.photoApprovedAt);
          log.warn(`[approveTeam] FORCE-UPDATED photoApprovedAt in Map for ${matchedDeviceId}`);
        }

        log.info(`[approveTeam] ✅ photoApprovedAt SET to ${new Date(approvalTimestamp).toISOString()}, photoApprovedHash: ${currentPhotoHash ? (currentPhotoHash.substring(0, 16) + '...') : 'null'}`);
      } else {
        console.log('[approveTeam] ⏹️  approvePhoto is FALSE - NOT setting photoApprovedAt');
        log.info(`[approveTeam] ⏹️  photoApprovedAt NOT set (photo approval not requested)`);
        // Explicitly log that we're NOT setting it
        console.log('[approveTeam] 📌 photoApprovedAt remains:', finalPlayer.photoApprovedAt || 'undefined/null');
      }

      finalPlayer.lastPongAt = Date.now(); // CRITICAL FIX: Reset heartbeat timer when approved to prevent false timeouts
      const logMsg = approvePhoto
        ? `[approveTeam] Set player status to approved for ${matchedDeviceId}, approvedAt: ${new Date(finalPlayer.approvedAt).toISOString()}, photoApprovedAt: ${new Date(finalPlayer.photoApprovedAt).toISOString()}, lastPongAt reset to ${finalPlayer.lastPongAt}`
        : `[approveTeam] Set player status to approved for ${matchedDeviceId}, approvedAt: ${new Date(finalPlayer.approvedAt).toISOString()}, NO photoApprovedAt set (photo approval separate), lastPongAt reset to ${finalPlayer.lastPongAt}`;
      log.info(logMsg);
      console.log('[approveTeam] ✅ Final player state:', { approvedAt: finalPlayer.approvedAt, photoApprovedAt: finalPlayer.photoApprovedAt });

      // PHASE 1: Log displayData being sent
      console.log('[approveTeam] 📦 displayData Inspection:');
      console.log('  - Keys:', Object.keys(displayData));
      console.log('  - mode:', displayData.mode);
      console.log('  - Size estimate:', JSON.stringify(displayData).length, 'bytes');

      let message;
      const messageTimestamp = Date.now();
      try {
        message = JSON.stringify({
          type: 'TEAM_APPROVED',
          data: { teamName, deviceId: matchedDeviceId, displayData },
          timestamp: messageTimestamp
        });
        log.info(`[approveTeam] Message serialized successfully, size: ${message.length} bytes at ${new Date(messageTimestamp).toISOString()}`);
        console.log('[approveTeam] ✅ Message serialized, size:', message.length, 'bytes');
      } catch (serializeErr) {
        log.error(`❌ Failed to serialize TEAM_APPROVED message:`, serializeErr.message);
        log.error(`[approveTeam] displayData that failed to serialize:`, JSON.stringify(displayData).substring(0, 200));
        console.error('[approveTeam] ❌ Serialization error:', serializeErr.message);
        throw serializeErr;
      }

      try {
        log.info(`[approveTeam] Attempting to send TEAM_APPROVED to ${matchedDeviceId}...`);
        log.info(`[approveTeam] Before ws.send - ws.readyState: ${ws.readyState}, ws.bufferedAmount: ${ws.bufferedAmount}`);
        console.log('[approveTeam] ✅ ABOUT TO CALL ws.send() for device:', matchedDeviceId);
        console.log('[approveTeam] Message size:', message.length, 'bytes');
        console.log('[approveTeam] Message type: TEAM_APPROVED');
        console.log('[approveTeam] ws.readyState before send:', ws.readyState);
        console.log('[approveTeam] ws.bufferedAmount before send:', ws.bufferedAmount);

        // PHASE 5: Wrap ws.send in a Promise to properly wait for callback
        const sendStartTime = Date.now();
        return new Promise((resolveCallback, rejectCallback) => {
          const sendTimeoutId = setTimeout(() => {
            console.warn('[approveTeam] ⚠️  WARNING: ws.send() callback did not complete within 5 seconds');
            log.warn(`[approveTeam] WARNING: ws.send() callback timeout for ${matchedDeviceId}`);
            // Still consider it a success if message was buffered
            clearTimeout(sendTimeoutId);
            resolveCallback(true);
          }, 5000);

          ws.send(message, (err) => {
            clearTimeout(sendTimeoutId);
            const sendEndTime = Date.now();
            const sendDuration = sendEndTime - sendStartTime;
            if (err) {
              log.error(`❌ [approveTeam] ws.send callback error for ${matchedDeviceId} (duration: ${sendDuration}ms):`, err.message);
              log.error(`[approveTeam] Error code:`, err.code);
              log.error(`[approveTeam] Error name:`, err.name);
              if (err.stack) {
                log.error(`[approveTeam] ws.send callback error stack:`, err.stack);
              }
              console.error('[approveTeam] ❌ ws.send callback reported error:', err.message, `(duration: ${sendDuration}ms)`);
              rejectCallback(new Error(`ws.send failed: ${err.message}`));
            } else {
              log.debug(`[approveTeam] ws.send callback success for ${matchedDeviceId} (duration: ${sendDuration}ms)`);
              console.log('[approveTeam] ✅ ws.send callback - no error reported', `(duration: ${sendDuration}ms)`);
              console.log('[approveTeam] ✅ ws.send() callback completed');
              log.info(`[approveTeam] After ws.send call - ws.bufferedAmount: ${ws.bufferedAmount}`);
              console.log('[approveTeam] ws.bufferedAmount after send:', ws.bufferedAmount);
              console.log('[approveTeam] Total time from call start to return:', Date.now() - callTimestamp, 'ms');
              log.info(`✅ TEAM_APPROVED sent to: ${teamName} (${matchedDeviceId}) - total time: ${Date.now() - callTimestamp}ms`);
              resolveCallback(true);
            }
          });
        });
      } catch (sendErr) {
        log.error(`❌ Failed to send TEAM_APPROVED to ${matchedDeviceId}:`, sendErr.message);
        if (sendErr.stack) {
          log.error(`[approveTeam] Send error stack:`, sendErr.stack);
        }
        console.error('[approveTeam] ❌ Exception during send:', sendErr.message);
        throw sendErr;
      }
    } catch (err) {
      log.error(`❌ approveTeam error:`, err.message);
      if (err && err.stack) {
        log.error(`[approveTeam] Error stack:`, err.stack);
      }
      console.error('[approveTeam] ❌ Fatal error:', err.message);
      return false;
    }
  }

  function declineTeam(deviceId, teamName) {
    try {
      log.info(`🚫 declineTeam called: ${teamName} (${deviceId})`);
      const player = networkPlayers.get(deviceId);

      if (!player) {
        log.error(`❌ Player not found in networkPlayers: ${deviceId}`);
        log.info(`Available players: ${Array.from(networkPlayers.keys()).join(', ')}`);
        return false;
      }

      if (!player.ws) {
        log.error(`❌ Player has no WebSocket connection: ${deviceId}`);
        return false;
      }

      if (player.ws.readyState !== 1) {
        log.error(`❌ Player WebSocket not open. State: ${player.ws.readyState}: ${deviceId}`);
        return false;
      }

      player.status = 'declined';

      const message = JSON.stringify({
        type: 'TEAM_DECLINED',
        data: { teamName, deviceId },
        timestamp: Date.now()
      });

      try {
        player.ws.send(message);
        log.info(`✅ TEAM_DECLINED sent to: ${teamName} (${deviceId})`);
        return true;
      } catch (sendErr) {
        log.error(`❌ Failed to send TEAM_DECLINED to ${deviceId}:`, sendErr.message);
        log.error(`Send error stack:`, sendErr.stack);
        return false;
      }
    } catch (err) {
      log.error(`❌ declineTeam error:`, err.message, err.stack);
      return false;
    }
  }

  function getPendingTeams() {
    const pending = [];
    networkPlayers.forEach((player, deviceId) => {
      if (player.status === 'pending') {
        pending.push({
          deviceId,
          playerId: player.playerId,
          teamName: player.teamName,
          timestamp: player.timestamp
        });
      }
    });
    return pending;
  }

  function getAllNetworkPlayers() {
    console.log('[getAllNetworkPlayers] Called');
    log.info(`[getAllNetworkPlayers] Retrieving all network players from map (total: ${networkPlayers.size})`);

    const players = [];
    networkPlayers.forEach((player, deviceId) => {
      console.log(`[getAllNetworkPlayers] Processing player: ${deviceId}`);
      console.log(`  - teamName: ${player.teamName}`);
      console.log(`  - status: ${player.status}`);
      console.log(`  - photoApprovedAt: ${player.photoApprovedAt ? new Date(player.photoApprovedAt).toISOString() : 'null'}`);
      console.log(`  - photoApprovedHash: ${player.photoApprovedHash ? (player.photoApprovedHash.substring(0, 16) + '...') : 'null'}`);
      console.log(`  - Has teamPhoto: ${!!player.teamPhoto}`);
      if (player.teamPhoto) {
        console.log(`  - teamPhoto value (first 100 chars): ${player.teamPhoto.substring(0, 100)}...`);
        log.info(`[getAllNetworkPlayers] ✅ Player ${deviceId} has teamPhoto: ${player.teamPhoto.substring(0, 100)}`);
      } else {
        console.log(`  - teamPhoto: NULL`);
        log.info(`[getAllNetworkPlayers] ⚠️ Player ${deviceId} has NO teamPhoto`);
      }

      const playerObj = {
        deviceId,
        playerId: player.playerId,
        teamName: player.teamName,
        status: player.status,
        timestamp: player.timestamp,
        teamPhoto: player.teamPhoto || null,
        teamPhotoPending: player.teamPhotoPending || null,
        photoApprovedAt: player.photoApprovedAt || null
      };

      // Log the exact object being returned
      console.log(`[getAllNetworkPlayers] Built object for return:`, {
        deviceId: playerObj.deviceId,
        teamName: playerObj.teamName,
        photoApprovedAt: playerObj.photoApprovedAt ? new Date(playerObj.photoApprovedAt).toISOString() : 'null',
        hasTeamPhoto: !!playerObj.teamPhoto,
        hasTeamPhotoPending: !!playerObj.teamPhotoPending,
        teamPhotoValue: playerObj.teamPhoto ? (playerObj.teamPhoto.substring(0, 50) + '...') : 'null',
        teamPhotoPendingValue: playerObj.teamPhotoPending ? (playerObj.teamPhotoPending.substring(0, 50) + '...') : 'null'
      });

      players.push(playerObj);
    });

    console.log('[getAllNetworkPlayers] Returning', players.length, 'players');
    log.info(`[getAllNetworkPlayers] Returning ${players.length} players`);
    players.forEach((p) => {
      log.info(`[getAllNetworkPlayers] Returning - ${p.deviceId}: ${p.teamName} (status: ${p.status}, hasPhoto: ${!!p.teamPhoto})`);
    });

    return players;
  }

  function getPendingAnswers() {
    const answers = Array.from(recentAnswers.values());
    recentAnswers.clear();
    return answers;
  }

  function broadcastDisplayMode(displayMode, data = {}) {
    try {
      log.info(`[broadcastDisplayMode] Mode: ${displayMode}, Data keys: ${Object.keys(data).join(', ')}, transitionDelay: ${data.displayTransitionDelay || 0}`);

      const messageData = {
        mode: displayMode,
        ...data
      };

      if (displayMode === 'scores') {
        log.info(`[broadcastDisplayMode] Broadcasting ${data.scores?.length || 0} scores to players`);
      }

      log.info(`[broadcastDisplayMode] Final messageData keys:`, Object.keys(messageData));

      let message;
      try {
        message = JSON.stringify({
          type: 'DISPLAY_MODE',
          data: messageData,
          timestamp: Date.now()
        });
        log.info(`[broadcastDisplayMode] Message serialized successfully, size: ${message.length} bytes`);
      } catch (serializeErr) {
        log.error(`❌ Failed to serialize DISPLAY_MODE message:`, serializeErr.message);
        if (serializeErr.stack) {
          log.error(`[broadcastDisplayMode] Serialization error stack:`, serializeErr.stack);
        }
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];
      const approvedPlayers = Array.from(networkPlayers.values()).filter(p => p.ws && p.ws.readyState === 1 && p.status === 'approved');
      const approvedPlayerCount = approvedPlayers.length;

      log.info(`[broadcastDisplayMode] Found ${approvedPlayerCount} approved players to send to`);

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastDisplayMode] Sending ${displayMode} to ${deviceId}...`);
            log.debug(`[broadcastDisplayMode] Before send: ws.readyState=${player.ws.readyState}, ws.bufferedAmount=${player.ws.bufferedAmount}`);

            // Check backpressure before sending
            if (!checkAndLogBackpressure(player.ws, message.length)) {
              log.warn(`[broadcastDisplayMode] Skipping send to ${deviceId} due to backpressure`);
              failCount++;
              failedDevices.push(deviceId);
              return;
            }

            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastDisplayMode] ws.send callback error for ${deviceId}:`, err.message);
                log.error(`[broadcastDisplayMode] Error code:`, err.code);
                log.error(`[broadcastDisplayMode] Error name:`, err.name);
                if (err.stack) {
                  log.error(`[broadcastDisplayMode] ws.send callback error stack:`, err.stack);
                }
              } else {
                log.debug(`[broadcastDisplayMode] ws.send callback success for ${deviceId}`);
              }
            });

            successCount++;
            log.debug(`[broadcastDisplayMode] Successfully sent ${displayMode} to ${deviceId}`);
          } catch (error) {
            log.error(`❌ Failed to send display mode (${displayMode}) to ${deviceId}:`, error.message);
            if (error.stack) {
              log.error(`[broadcastDisplayMode] Send error stack:`, error.stack);
            }
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`📺 Broadcast DISPLAY_MODE (${displayMode}) to ${successCount}/${approvedPlayerCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastDisplayMode error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastDisplayMode] Error stack:`, err.stack);
      }
    }
  }

  function broadcastDisplayUpdate(updateData) {
    const message = JSON.stringify({
      type: 'DISPLAY_UPDATE',
      data: updateData,
      timestamp: Date.now()
    });

    let successCount = 0;
    let failCount = 0;

    networkPlayers.forEach((player, deviceId) => {
      if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
        try {
          // Check backpressure before sending
          if (!checkAndLogBackpressure(player.ws, message.length)) {
            log.warn(`[broadcastDisplayUpdate] Skipping send to ${deviceId} due to backpressure`);
            failCount++;
            return;
          }

          player.ws.send(message);
          successCount++;
        } catch (error) {
          log.warn(`Failed to send display update to ${deviceId}:`, error.message);
          failCount++;
        }
      }
    });

    log.info(`📺 Broadcast DISPLAY_UPDATE to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed` : ''));
  }

  function broadcastQuestion(questionData) {
    try {
      log.info(`[broadcastQuestion] Broadcasting question with type: ${questionData.type || 'default'}`);

      const message = JSON.stringify({
        type: 'QUESTION',
        data: questionData,
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastQuestion] Sending question to ${deviceId}...`);
            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastQuestion] ws.send callback error for ${deviceId}:`, err.message);
              } else {
                log.debug(`[broadcastQuestion] Successfully sent question to ${deviceId}`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send question to ${deviceId}:`, error.message);
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`📋 Broadcast QUESTION to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastQuestion error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastQuestion] Error stack:`, err.stack);
      }
    }
  }

  function broadcastReveal(revealData) {
    try {
      log.info(`[broadcastReveal] Broadcasting reveal with answer:`, revealData.answer);

      const message = JSON.stringify({
        type: 'REVEAL',
        data: revealData,
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastReveal] Sending reveal to ${deviceId}...`);
            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastReveal] ws.send callback error for ${deviceId}:`, err.message);
              } else {
                log.debug(`[broadcastReveal] Successfully sent reveal to ${deviceId}`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send reveal to ${deviceId}:`, error.message);
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`✅ Broadcast REVEAL to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastReveal error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastReveal] Error stack:`, err.stack);
      }
    }
  }

  function broadcastFastest(fastestData) {
    try {
      log.info(`[broadcastFastest] Broadcasting fastest team:`, fastestData.teamName);

      const message = JSON.stringify({
        type: 'FASTEST',
        data: fastestData,
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastFastest] Sending fastest team to ${deviceId}...`);
            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastFastest] ws.send callback error for ${deviceId}:`, err.message);
              } else {
                log.debug(`[broadcastFastest] Successfully sent fastest team to ${deviceId}`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send fastest team to ${deviceId}:`, error.message);
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`⚡ Broadcast FASTEST to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastFastest error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastFastest] Error stack:`, err.stack);
      }
    }
  }

  function broadcastTimeUp() {
    try {
      log.info(`[broadcastTimeUp] Broadcasting time up signal`);

      const message = JSON.stringify({
        type: 'TIMEUP',
        data: {},
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastTimeUp] Sending time up to ${deviceId}...`);
            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastTimeUp] ws.send callback error for ${deviceId}:`, err.message);
              } else {
                log.debug(`[broadcastTimeUp] Successfully sent time up to ${deviceId}`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send time up to ${deviceId}:`, error.message);
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`⏱️ Broadcast TIMEUP to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastTimeUp error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastTimeUp] Error stack:`, err.stack);
      }
    }
  }

  function broadcastPicture(imageDataUrl) {
    try {
      log.info(`[broadcastPicture] Broadcasting picture to players`);

      const message = JSON.stringify({
        type: 'PICTURE',
        data: { image: imageDataUrl },
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      networkPlayers.forEach((player, deviceId) => {
        if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
          try {
            log.info(`[broadcastPicture] Sending picture to ${deviceId}...`);
            player.ws.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastPicture] ws.send callback error for ${deviceId}:`, err.message);
              } else {
                log.debug(`[broadcastPicture] Successfully sent picture to ${deviceId}`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send picture to ${deviceId}:`, error.message);
            failCount++;
            failedDevices.push(deviceId);
          }
        }
      });

      log.info(`🖼️ Broadcast PICTURE to ${successCount} approved players` + (failCount > 0 ? `, ${failCount} failed (${failedDevices.join(', ')})` : ''));
    } catch (err) {
      log.error(`❌ broadcastPicture error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastPicture] Error stack:`, err.stack);
      }
    }
  }

  function updateBuzzerFolderPath(folderPath) {
    try {
      log.info(`[updateBuzzerFolderPath] Setting buzzer folder to: ${folderPath}`);

      // Update the backend's current buzzer folder
      setCurrentBuzzerFolderPath(folderPath);

      // Clear all team buzzer selections when folder changes
      let clearedCount = 0;
      networkPlayers.forEach((player) => {
        if (player.buzzerSound) {
          player.buzzerSound = null;
          clearedCount++;
        }
      });

      log.info(`[updateBuzzerFolderPath] Cleared buzzer selections for ${clearedCount} players`);

      // Broadcast the change to all players
      broadcastBuzzerFolderChange(folderPath);

      return true;
    } catch (err) {
      log.error(`❌ updateBuzzerFolderPath error:`, err.message);
      return false;
    }
  }

  function broadcastBuzzerFolderChange(folderPath) {
    try {
      log.info(`[broadcastBuzzerFolderChange] Broadcasting new buzzer folder path: ${folderPath}`);

      const message = JSON.stringify({
        type: 'BUZZERS_FOLDER_CHANGED',
        data: { folderPath },
        timestamp: Date.now()
      });

      let successCount = 0;
      let failCount = 0;
      const failedDevices = [];

      // Broadcast to ALL connected clients (not just approved players)
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          try {
            client.send(message, (err) => {
              if (err) {
                log.error(`❌ [broadcastBuzzerFolderChange] ws.send callback error:`, err.message);
              } else {
                log.debug(`[broadcastBuzzerFolderChange] Successfully sent to client`);
              }
            });
            successCount++;
          } catch (error) {
            log.error(`❌ Failed to send buzzer folder change notification:`, error.message);
            failCount++;
            failedDevices.push('unknown');
          }
        }
      });

      log.info(`🔊 Broadcast BUZZERS_FOLDER_CHANGED to ${successCount} clients` + (failCount > 0 ? `, ${failCount} failed` : ''));
    } catch (err) {
      log.error(`❌ broadcastBuzzerFolderChange error:`, err.message);
      if (err && err.stack) {
        log.error(`[broadcastBuzzerFolderChange] Error stack:`, err.stack);
      }
    }
  }

  // Phase 2: Cleanup function for heartbeat intervals
  const stopHeartbeat = () => {
    log.info('[Heartbeat] Stopping heartbeat mechanism');
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
      log.info('[Heartbeat] ✅ Heartbeat sender stopped');
    }
    if (staleCheckIntervalId) {
      clearInterval(staleCheckIntervalId);
      staleCheckIntervalId = null;
      log.info('[Heartbeat] ✅ Stale connection checker stopped');
    }
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
      log.info('[Heartbeat] ✅ Cleanup interval stopped');
    }
  };

  // Setter for auto-approve team photos setting (synced from frontend)
  const setAutoApproveTeamPhotos = (enabled) => {
    const previousValue = autoApproveTeamPhotos;
    autoApproveTeamPhotos = enabled === true;
    console.log(`[setAutoApproveTeamPhotos] Setting changed from ${previousValue} to ${autoApproveTeamPhotos}`);
    log.info(`[setAutoApproveTeamPhotos] Auto-approve team photos setting: ${previousValue} → ${autoApproveTeamPhotos}`);
  };

  return { port, server, wss, approveTeam, declineTeam, getPendingTeams, getAllNetworkPlayers, getPendingAnswers, broadcastDisplayMode, broadcastDisplayUpdate, broadcastQuestion, broadcastReveal, broadcastFastest, broadcastTimeUp, broadcastPicture, cleanupTeamPhotos, stopHeartbeat, updateBuzzerFolderPath, broadcastBuzzerFolderChange, setAutoApproveTeamPhotos };
}

export { startBackend };
