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
import { getTeamPicturesPath } from './pathInitializer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ...lazy load bus and endpoints...
async function loadEndpoints(app) {
  const quizzesEndpoint = await import('./endpoints/quizzes.js');
  const usersEndpoint = await import('./endpoints/users.js');
  quizzesEndpoint.default(app);
  usersEndpoint.default(app);
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

  // Phase 2: Heartbeat configuration
  const HEARTBEAT_INTERVAL = 5000; // Send ping every 5 seconds
  const HEARTBEAT_TIMEOUT = 8000; // Mark as disconnected if no pong for 8 seconds (must be > INTERVAL)
  const STALE_CHECK_INTERVAL = 2000; // Check for stale connections every 2 seconds
  let heartbeatIntervalId = null;
  let staleCheckIntervalId = null;

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
            deviceId = data.deviceId;
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
              if (photoPath) {
                existingPlayer.teamPhoto = photoPath;
                console.log('[PLAYER_JOIN] - Updated teamPhoto to:', photoPath.substring(0, 50) + '...');
              } else if (data.teamPhoto) {
                console.log('[PLAYER_JOIN] ⚠️ photoPath is null but data.teamPhoto exists (size:', data.teamPhoto.length, 'bytes)');
              }
              log.info(`[WS-${connectionId}] 🔄 [Reconnection] Device ${deviceId} rejoining as "${data.teamName}", was approved at ${new Date(existingPlayer.approvedAt).toISOString()}, teamPhoto: ${existingPlayer.teamPhoto || 'null'}`);
            } else {
              // New join - treat as first time
              // FIX: Create playerEntry with null teamPhoto, store IMMEDIATELY, THEN do async photo save
              const createdAt = Date.now();
              const playerEntry = {
                ws,
                playerId,
                teamName: data.teamName,
                status: 'pending',
                approvedAt: null,
                timestamp: createdAt,
                teamPhoto: null, // Will be set when photo save completes
                lastPongAt: createdAt // Phase 2: Track heartbeat timestamp on join
              };
              log.info(`[WS-${connectionId}] [NEW_JOIN] Created player entry with lastPongAt=${createdAt} for device ${deviceId}`);

              // PHASE 1: Detailed entry creation logging
              console.log('[PLAYER_JOIN] Creating new player entry:', {
                deviceId,
                teamName: data.teamName,
                teamPhoto: 'null (will be set after async save)'
              });
              console.log('[PLAYER_JOIN] Entry object details:');
              console.log('  - ws.readyState:', ws.readyState);
              console.log('  - ws._socket exists:', !!ws._socket);
              console.log('  - playerId:', playerId);
              console.log('  - status: pending');

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

            const updateDeviceId = data.deviceId || deviceId;
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
            if (data.photoData) {
              console.log('[TEAM_PHOTO_UPDATE] Team photo found, calling saveTeamPhotoToDisk for device:', updateDeviceId);
              log.info(`[WS-${connectionId}] 📸 Team photo update received for ${data.teamName} (size: ${data.photoData.length} bytes), saving to disk...`);
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
              existingPlayer.teamPhoto = photoPath || existingPlayer.teamPhoto;
              console.log('[TEAM_PHOTO_UPDATE] After update - teamPhoto:', existingPlayer.teamPhoto ? (existingPlayer.teamPhoto.substring(0, 50) + '...') : 'null');
              console.log('[TEAM_PHOTO_UPDATE] Updated networkPlayers entry for device:', updateDeviceId);
              log.info(`[WS-${connectionId}] ✅ Updated networkPlayers for ${data.teamName}, teamPhoto is now: ${existingPlayer.teamPhoto || 'null'}`);

              // Verify the update was applied
              const verifyPlayer = networkPlayers.get(updateDeviceId);
              if (verifyPlayer?.teamPhoto) {
                console.log('[TEAM_PHOTO_UPDATE] ✅ Verification passed - photo is stored in networkPlayers');
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
  async function approveTeam(deviceId, teamName, displayData = {}, retryCount = 0) {
    try {
      // PHASE 1: ENHANCED DIAGNOSTICS - Log exact function entry
      const callTimestamp = Date.now();
      console.log('[approveTeam] ✅ Called:', { deviceId, teamName, timestamp: new Date(callTimestamp).toISOString() });
      log.info(`✅ approveTeam called: ${teamName} (${deviceId}) at ${new Date(callTimestamp).toISOString()}`);

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
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1);
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
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1);
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
          const retryResult = await approveTeam(deviceId, teamName, displayData, retryCount + 1);
          return retryResult;
        } else if (ws.readyState === 0) {
          log.error(`❌ approveTeam failed after ${APPROVAL_RETRY_CONFIG.maxRetries} retry attempts - ws still connecting: ${matchedDeviceId}`);
        }
        return false;
      }

      finalPlayer.status = 'approved';
      finalPlayer.approvedAt = Date.now();
      finalPlayer.lastPongAt = Date.now(); // CRITICAL FIX: Reset heartbeat timer when approved to prevent false timeouts
      log.info(`[approveTeam] Set player status to approved for ${matchedDeviceId}, approvedAt: ${new Date(finalPlayer.approvedAt).toISOString()}, lastPongAt reset to ${finalPlayer.lastPongAt}`);

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
        teamPhoto: player.teamPhoto || null
      };

      // Log the exact object being returned
      console.log(`[getAllNetworkPlayers] Built object for return:`, {
        deviceId: playerObj.deviceId,
        teamName: playerObj.teamName,
        hasTeamPhoto: !!playerObj.teamPhoto,
        teamPhotoValue: playerObj.teamPhoto ? (playerObj.teamPhoto.substring(0, 50) + '...') : 'null'
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
  };

  return { port, server, wss, approveTeam, declineTeam, getPendingTeams, getAllNetworkPlayers, getPendingAnswers, broadcastDisplayMode, broadcastDisplayUpdate, broadcastQuestion, broadcastReveal, broadcastFastest, broadcastTimeUp, broadcastPicture, cleanupTeamPhotos, stopHeartbeat };
}

export { startBackend };
