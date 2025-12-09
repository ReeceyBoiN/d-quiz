const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const log = require('electron-log');
const bus = require('../utils/bus');
const os = require('os');
let Bonjour;
try {
  const bonjourModule = require('bonjour-service');
  Bonjour = bonjourModule.Bonjour;
} catch (err) {
  log.warn('bonjour-service not available, mDNS will not work');
  Bonjour = null;
}

function loadEndpoints(app) {
  // Each file in backend/endpoints exports (router) => void
  //require('./endpoints/health')(app);
  require('./endpoints/quizzes')(app);
  require('./endpoints/users')(app);
}

function loadEvents(wss) {
  // Fan-out bus events over WS as JSON
  bus.on('quiz:start', (payload) => {
    const msg = JSON.stringify({ type: 'quiz/start', payload });
    wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
  });
}

async function startBackend({ port = 4310 } = {}) {
  const app = express();
  const fs = require('fs');

  app.use(express.json({ charset: 'utf-8' }));

  // Serve the player app
  const playerAppPath = path.join(__dirname, '../../dist-player');

  // Check if player app directory exists
  if (!fs.existsSync(playerAppPath)) {
    log.error(`Player app directory not found at: ${playerAppPath}`);
  } else {
    log.info(`Serving player app from: ${playerAppPath}`);
  }

  // Serve static assets
  app.use(express.static(playerAppPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }));

  // Load API endpoints first (before the catch-all)
  loadEndpoints(app);

  // SPA fallback - serve index.html for all non-API routes (catch-all at the end)
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
  loadEvents(wss);

  // Track network players: deviceId -> { ws, playerId, teamName, status }
  const networkPlayers = new Map();

  // Handle incoming WebSocket messages from players
  wss.on('connection', (ws) => {
    let deviceId = null;
    let playerId = null;
    const connectionId = Math.random().toString(36).slice(2, 9);

    log.info(`[WS-${connectionId}] Client connected. Total connections: ${wss.clients.size}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        log.info(`[WS-${connectionId}] Received: ${data.type}`, data);

        if (data.type === 'PLAYER_JOIN') {
          deviceId = data.deviceId;
          playerId = data.playerId;
          log.info(`[WS-${connectionId}] 🎯 Player join request: ${data.teamName} (device: ${deviceId}, player: ${playerId})`);

          // Store the player connection
          networkPlayers.set(deviceId, {
            ws,
            playerId,
            teamName: data.teamName,
            status: 'pending', // pending, approved, declined
            timestamp: Date.now()
          });

          log.info(`[WS-${connectionId}] Stored player connection. Total players: ${networkPlayers.size}`);

          // Broadcast PLAYER_JOIN to other clients (host) so they can approve/reject
          const otherClients = Array.from(wss.clients).filter(client => client.readyState === 1 && client !== ws);
          log.info(`[WS-${connectionId}] Broadcasting PLAYER_JOIN to ${otherClients.length} other clients`);

          otherClients.forEach(client => {
            client.send(JSON.stringify({
              type: 'PLAYER_JOIN',
              playerId,
              deviceId,
              teamName: data.teamName,
              timestamp: Date.now()
            }));
          });

          if (otherClients.length === 0) {
            log.warn(`[WS-${connectionId}] ⚠️  No other clients connected to receive PLAYER_JOIN message!`);
          }
        } else if (data.type === 'PLAYER_ANSWER') {
          log.info(`[WS-${connectionId}] 📝 Player answer: ${data.teamName} answered: ${data.answer}`);
          // Broadcast to other clients (host)
          wss.clients.forEach(client => {
            if (client.readyState === 1 && client !== ws) {
              client.send(JSON.stringify({
                type: 'PLAYER_ANSWER',
                playerId: data.playerId,
                teamName: data.teamName,
                answer: data.answer,
                timestamp: Date.now()
              }));
            }
          });
        }
      } catch (err) {
        log.error(`[WS-${connectionId}] WebSocket message error:`, err);
      }
    });

    ws.on('close', () => {
      if (deviceId) {
        log.info(`[WS-${connectionId}] Client disconnected: ${deviceId}. Total connections: ${wss.clients.size - 1}`);
        // Don't remove from networkPlayers immediately - let them reconnect with same deviceId
      } else {
        log.info(`[WS-${connectionId}] Unknown client disconnected. Total connections: ${wss.clients.size - 1}`);
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

  // Get local IP address
  function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  const localIP = getLocalIPAddress();

  // Advertise via mDNS/Bonjour
  if (Bonjour) {
    try {
      const bonjour = new Bonjour();
      bonjour.publish({
        name: 'popquiz',
        type: 'http',
        port: port,
        protocol: 'tcp',
      });
      log.info(`Advertised as popquiz.local on port ${port}`);
    } catch (err) {
      log.warn('Failed to advertise via mDNS:', err.message);
    }
  }

  // Log network access URL
  log.info(`Host can access player app at: http://${localIP}:${port}`);

  // Helper function to approve a team
  function approveTeam(deviceId, teamName, displayData = {}) {
    log.info(`✅ approveTeam called: ${teamName} (${deviceId})`);
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
      log.error(`❌ Player WebSocket not open. State: ${player.ws.readyState} (0=connecting, 1=open, 2=closing, 3=closed): ${deviceId}`);
      return;
    }

    player.status = 'approved';
    player.ws.send(JSON.stringify({
      type: 'TEAM_APPROVED',
      data: { teamName, deviceId, displayData },
      timestamp: Date.now()
    }));
    log.info(`✅ TEAM_APPROVED sent to: ${teamName} (${deviceId})`);
  }

  // Helper function to decline a team
  function declineTeam(deviceId, teamName) {
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
    player.ws.send(JSON.stringify({
      type: 'TEAM_DECLINED',
      data: { teamName, deviceId },
      timestamp: Date.now()
    }));
    log.info(`✅ TEAM_DECLINED sent to: ${teamName} (${deviceId})`);
  }

  // Helper function to get pending teams
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

  // Helper function to get all network players
  function getAllNetworkPlayers() {
    const players = [];
    networkPlayers.forEach((player, deviceId) => {
      players.push({
        deviceId,
        playerId: player.playerId,
        teamName: player.teamName,
        status: player.status,
        timestamp: player.timestamp
      });
    });
    return players;
  }

  // Helper function to broadcast display mode to all connected players
  function broadcastDisplayMode(displayMode, data = {}) {
    log.info(`[broadcastDisplayMode] Mode: ${displayMode}, Data keys: ${Object.keys(data).join(', ')}`);

    const messageData = {
      mode: displayMode,
      ...data
    };

    if (displayMode === 'scores') {
      log.info(`[broadcastDisplayMode] Broadcasting ${data.scores?.length || 0} scores to players`);
    }

    const message = JSON.stringify({
      type: 'DISPLAY_MODE',
      data: messageData,
      timestamp: Date.now()
    });

    let successCount = 0;
    let failCount = 0;
    const approvedPlayerCount = Array.from(networkPlayers.values()).filter(p => p.ws && p.ws.readyState === 1 && p.status === 'approved').length;

    networkPlayers.forEach((player, deviceId) => {
      if (player.ws && player.ws.readyState === 1 && player.status === 'approved') {
        try {
          player.ws.send(message);
          successCount++;
        } catch (error) {
          log.warn(`Failed to send display mode to ${deviceId}:`, error.message);
          failCount++;
        }
      }
    });

    log.info(`📺 Broadcast DISPLAY_MODE (${displayMode}) to ${successCount}/${approvedPlayerCount} approved players` + (failCount > 0 ? `, ${failCount} failed` : ''));
  }

  // Helper function to send display update to all connected players
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

  return { port, server, wss, approveTeam, declineTeam, getPendingTeams, getAllNetworkPlayers, broadcastDisplayMode, broadcastDisplayUpdate };
}

module.exports = { startBackend };
