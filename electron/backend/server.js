import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import log from 'electron-log';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

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

  // Helper function to save team photos to disk
  function saveTeamPhotoToDisk(base64String, deviceId) {
    console.log('[saveTeamPhotoToDisk] Called with deviceId:', deviceId);

    try {
      // PHASE 4: Add base64 validation
      if (!base64String || typeof base64String !== 'string') {
        log.error('[saveTeamPhotoToDisk] ❌ Invalid base64String - not a string or is empty');
        console.error('[saveTeamPhotoToDisk] ❌ Invalid base64String - not a string or is empty');
        return null;
      }

      if (!base64String.includes('data:image')) {
        log.warn('[saveTeamPhotoToDisk] ⚠️ WARNING: base64 string does not include data: prefix');
        console.warn('[saveTeamPhotoToDisk] ⚠️ WARNING: base64 string does not include data: prefix');
      }

      // PHASE 3: Fix path issues - use "resources" instead of "resorces"
      const photosDir = path.join(__dirname, '../../resources/pics/Team Pics');
      console.log('[saveTeamPhotoToDisk] Attempting to save to directory:', photosDir);
      log.info(`[saveTeamPhotoToDisk] Attempting to save to directory: ${photosDir}`);

      // Create directory if it doesn't exist
      if (!fs.existsSync(photosDir)) {
        console.log('[saveTeamPhotoToDisk] Directory does not exist, creating...');
        log.info(`[saveTeamPhotoToDisk] Directory does not exist, creating...`);
        try {
          fs.mkdirSync(photosDir, { recursive: true });
          console.log('[saveTeamPhotoToDisk] ✅ Successfully created Team Pics directory');
          log.info(`[saveTeamPhotoToDisk] ✅ Successfully created Team Pics directory: ${photosDir}`);
        } catch (mkdirErr) {
          log.error(`[saveTeamPhotoToDisk] ❌ Failed to create directory:`, mkdirErr.message);
          console.error('[saveTeamPhotoToDisk] ❌ Failed to create directory:', mkdirErr.message);
          if (mkdirErr.code === 'EACCES') {
            log.error('[saveTeamPhotoToDisk] Permission denied - check directory permissions');
          } else if (mkdirErr.code === 'ENOSPC') {
            log.error('[saveTeamPhotoToDisk] No space left on device');
          }
          throw mkdirErr;
        }
      } else {
        console.log('[saveTeamPhotoToDisk] Directory already exists');
      }

      // Generate filename with timestamp for uniqueness
      const timestamp = Date.now();
      const fileName = `team_${deviceId}_${timestamp}.jpg`;
      const filePath = path.join(photosDir, fileName);
      console.log('[saveTeamPhotoToDisk] Generated filename:', fileName);
      console.log('[saveTeamPhotoToDisk] Full file path:', filePath);
      log.info(`[saveTeamPhotoToDisk] Generated filename: ${fileName}`);
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
        throw bufferErr;
      }

      // Write file to disk with detailed error handling
      try {
        fs.writeFileSync(filePath, buffer);
        console.log('[saveTeamPhotoToDisk] ✅ File written successfully, size:', buffer.length, 'bytes');
        log.info(`[saveTeamPhotoToDisk] ✅ File written successfully to: ${filePath} (${buffer.length} bytes)`);
        return filePath;
      } catch (writeErr) {
        log.error(`[saveTeamPhotoToDisk] ❌ Failed to write file:`, writeErr.message);
        console.error('[saveTeamPhotoToDisk] ❌ Failed to write file:', writeErr.message);
        log.error(`[saveTeamPhotoToDisk] Error code:`, writeErr.code);
        log.error(`[saveTeamPhotoToDisk] File path that failed:`, filePath);

        if (writeErr.code === 'EACCES') {
          log.error('[saveTeamPhotoToDisk] Permission denied - check write permissions');
        } else if (writeErr.code === 'ENOSPC') {
          log.error('[saveTeamPhotoToDisk] No space left on device');
        } else if (writeErr.code === 'EISDIR') {
          log.error('[saveTeamPhotoToDisk] Path is a directory, not a file');
        }
        throw writeErr;
      }
    } catch (err) {
      log.error(`[saveTeamPhotoToDisk] ❌ Failed to save team photo for device ${deviceId}:`, err.message);
      console.error('[saveTeamPhotoToDisk] ❌ Error:', err.message);
      if (err.stack) {
        log.error(`[saveTeamPhotoToDisk] Error stack:`, err.stack);
        console.error('[saveTeamPhotoToDisk] Error stack:', err.stack);
      }
      return null;
    }
  }

  // Helper function to cleanup team photos
  function cleanupTeamPhotos() {
    try {
      const photosDir = path.join(__dirname, '../../resources/pics/Team Pics');

      if (!fs.existsSync(photosDir)) {
        log.info(`[Photo Cleanup] Team Pics directory does not exist, nothing to cleanup`);
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

    ws.on('message', (message) => {
      try {
        let data;
        try {
          data = JSON.parse(message);
        } catch (parseErr) {
          log.error(`[WS-${connectionId}] ❌ Failed to parse message:`, parseErr.message, 'Raw message:', message.toString().substring(0, 200));
          return;
        }

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

            // Handle team photo - save to disk if present
            let photoPath = null;
            if (data.teamPhoto) {
              console.log('[PLAYER_JOIN] Team photo found, calling saveTeamPhotoToDisk for device:', deviceId);
              log.info(`[WS-${connectionId}] 📸 Team photo received for ${data.teamName} (size: ${data.teamPhoto.length} bytes), saving to disk...`);
              photoPath = saveTeamPhotoToDisk(data.teamPhoto, deviceId);
              console.log('[PLAYER_JOIN] saveTeamPhotoToDisk returned:', photoPath);
              log.info(`[WS-${connectionId}] [PLAYER_JOIN] saveTeamPhotoToDisk returned: ${photoPath}`);
              if (!photoPath) {
                console.warn('[PLAYER_JOIN] ⚠️  Failed to save team photo');
                log.warn(`[WS-${connectionId}] ⚠️  Failed to save team photo, will continue without it`);
              } else {
                console.log('[PLAYER_JOIN] ✅ Team photo saved successfully to:', photoPath);
                log.info(`[WS-${connectionId}] ✅ Team photo saved successfully to: ${photoPath}`);
              }
            } else {
              console.log('[PLAYER_JOIN] No team photo in payload for device:', deviceId);
              log.info(`[WS-${connectionId}] [PLAYER_JOIN] No team photo in payload`);
            }

            if (existingPlayer?.approvedAt) {
              // Reconnection - device was previously approved, update with new connection
              existingPlayer.teamName = data.teamName;
              existingPlayer.ws = ws;
              existingPlayer.playerId = data.playerId;
              if (photoPath) {
                existingPlayer.teamPhoto = photoPath;
              }
              log.info(`[WS-${connectionId}] 🔄 [Reconnection] Device ${deviceId} rejoining as "${data.teamName}", was approved at ${new Date(existingPlayer.approvedAt).toISOString()}`);
            } else {
              // New join - treat as first time
              networkPlayers.set(deviceId, {
                ws,
                playerId,
                teamName: data.teamName,
                status: 'pending',
                approvedAt: null,
                timestamp: Date.now(),
                teamPhoto: photoPath
              });
              log.info(`[WS-${connectionId}] ✨ [New Join] Device ${deviceId} joining for first time`);
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
        } else if (data.type === 'TEAM_PHOTO_UPDATE') {
          try {
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
              photoPath = saveTeamPhotoToDisk(data.photoData, updateDeviceId);
              console.log('[TEAM_PHOTO_UPDATE] saveTeamPhotoToDisk returned:', photoPath);
              log.info(`[WS-${connectionId}] [TEAM_PHOTO_UPDATE] saveTeamPhotoToDisk returned: ${photoPath}`);
              if (!photoPath) {
                console.warn('[TEAM_PHOTO_UPDATE] ⚠️  Failed to save team photo');
                log.warn(`[WS-${connectionId}] ⚠️  Failed to save team photo, update will not be sent`);
                return;
              } else {
                console.log('[TEAM_PHOTO_UPDATE] ✅ Team photo saved successfully to:', photoPath);
                log.info(`[WS-${connectionId}] ✅ Team photo saved successfully to: ${photoPath}`);
              }
            }

            // Update networkPlayers with new photo path if player exists
            if (existingPlayer) {
              existingPlayer.teamPhoto = photoPath || existingPlayer.teamPhoto;
              console.log('[TEAM_PHOTO_UPDATE] Updated networkPlayers entry for device:', updateDeviceId);
              log.info(`[WS-${connectionId}] ✅ Updated networkPlayers for ${data.teamName}`);
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
      res();
    });
    server.listen(port, '0.0.0.0', (err) => {
      if (err) {
        log.error(`Failed to listen on port ${port}:`, err);
        rej(err);
      }
    });
  });

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
  log.info(`Host can access player app at: http://${localIP}:${port}`);

  // ...existing helper functions (approveTeam, declineTeam, etc.)...
  function approveTeam(deviceId, teamName, displayData = {}) {
    try {
      console.log('[approveTeam] ✅ Called:', { deviceId, teamName });
      log.info(`✅ approveTeam called: ${teamName} (${deviceId})`);

      const player = networkPlayers.get(deviceId);

      // LOGGING: Log what we found in networkPlayers
      console.log('[approveTeam] Looking for player in networkPlayers');
      console.log('[approveTeam] Total players in map:', networkPlayers.size);
      console.log('[approveTeam] Player found:', !!player);
      if (player) {
        console.log('[approveTeam] Player details:');
        console.log('  - teamName:', player.teamName);
        console.log('  - status:', player.status);
        console.log('  - Has teamPhoto:', !!player.teamPhoto);
        if (player.teamPhoto) {
          console.log('  - teamPhoto value (first 100 chars):', player.teamPhoto.substring(0, 100) + '...');
        }
      }

      if (!player) {
        log.error(`❌ Player not found in networkPlayers: ${deviceId}`);
        log.info(`Available players: ${Array.from(networkPlayers.keys()).join(', ')}`);
        console.error('[approveTeam] ❌ Player not found in networkPlayers');
        return;
      }

      if (!player.ws) {
        log.error(`❌ Player has no WebSocket connection: ${deviceId}`);
        console.error('[approveTeam] ❌ Player has no WebSocket connection');
        return;
      }

      const ws = player.ws;
      log.info(`[approveTeam] WebSocket state before sending: ${ws.readyState} (0=connecting, 1=open, 2=closing, 3=closed)`);

      if (ws.readyState !== 1) {
        log.error(`❌ Player WebSocket not open. State: ${ws.readyState} (0=connecting, 1=open, 2=closing, 3=closed): ${deviceId}`);
        return;
      }

      player.status = 'approved';
      player.approvedAt = Date.now();
      log.info(`[approveTeam] Set player status to approved for ${deviceId}, approvedAt: ${new Date(player.approvedAt).toISOString()}`);

      let message;
      try {
        message = JSON.stringify({
          type: 'TEAM_APPROVED',
          data: { teamName, deviceId, displayData },
          timestamp: Date.now()
        });
        log.info(`[approveTeam] Message serialized successfully, size: ${message.length} bytes`);
      } catch (serializeErr) {
        log.error(`❌ Failed to serialize TEAM_APPROVED message:`, serializeErr.message);
        log.error(`[approveTeam] displayData that failed to serialize:`, JSON.stringify(displayData).substring(0, 200));
        throw serializeErr;
      }

      try {
        log.info(`[approveTeam] Attempting to send TEAM_APPROVED to ${deviceId}...`);
        log.info(`[approveTeam] Before ws.send - ws.readyState: ${ws.readyState}, ws.bufferedAmount: ${ws.bufferedAmount}`);

        ws.send(message, (err) => {
          if (err) {
            log.error(`❌ [approveTeam] ws.send callback error for ${deviceId}:`, err.message);
            log.error(`[approveTeam] Error code:`, err.code);
            log.error(`[approveTeam] Error name:`, err.name);
            if (err.stack) {
              log.error(`[approveTeam] ws.send callback error stack:`, err.stack);
            }
          } else {
            log.debug(`[approveTeam] ws.send callback success for ${deviceId}`);
          }
        });

        log.info(`[approveTeam] After ws.send call - ws.bufferedAmount: ${ws.bufferedAmount}`);
        log.info(`✅ TEAM_APPROVED sent to: ${teamName} (${deviceId})`);
      } catch (sendErr) {
        log.error(`❌ Failed to send TEAM_APPROVED to ${deviceId}:`, sendErr.message);
        if (sendErr.stack) {
          log.error(`[approveTeam] Send error stack:`, sendErr.stack);
        }
        throw sendErr;
      }
    } catch (err) {
      log.error(`❌ approveTeam error:`, err.message);
      if (err && err.stack) {
        log.error(`[approveTeam] Error stack:`, err.stack);
      }
    }
  }

  function declineTeam(deviceId, teamName) {
    try {
      log.info(`🚫 declineTeam called: ${teamName} (${deviceId})`);
      const player = networkPlayers.get(deviceId);

      if (!player) {
        log.error(`❌ Player not found in networkPlayers: ${deviceId}`);
        log.info(`Available players: ${Array.from(networkPlayers.keys()).join(', ')}`);
        return;
      }

      if (!player.ws) {
        log.error(`❌ Player has no WebSocket connection: ${deviceId}`);
        return;
      }

      if (player.ws.readyState !== 1) {
        log.error(`❌ Player WebSocket not open. State: ${player.ws.readyState}: ${deviceId}`);
        return;
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
      } catch (sendErr) {
        log.error(`❌ Failed to send TEAM_DECLINED to ${deviceId}:`, sendErr.message);
        log.error(`Send error stack:`, sendErr.stack);
      }
    } catch (err) {
      log.error(`❌ declineTeam error:`, err.message, err.stack);
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

      players.push({
        deviceId,
        playerId: player.playerId,
        teamName: player.teamName,
        status: player.status,
        timestamp: player.timestamp,
        teamPhoto: player.teamPhoto || null
      });
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

  return { port, server, wss, approveTeam, declineTeam, getPendingTeams, getAllNetworkPlayers, getPendingAnswers, broadcastDisplayMode, broadcastDisplayUpdate, broadcastQuestion, broadcastReveal, broadcastFastest, broadcastTimeUp, broadcastPicture, cleanupTeamPhotos };
}

export { startBackend };
