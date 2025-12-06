const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { createMainWindow, createExternalWindow } = require('./windows');
const { applySecurity } = require('./security');
const { createIpcRouter } = require('../ipc/ipcRouter');
const { startBackend } = require('../backend/server');

let mainWindow;

function setupAppEvents() {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}

async function boot() {
  applySecurity();
  await app.whenReady();

  const isDev = !!process.env.VITE_DEV_SERVER_URL || !app.isPackaged;

  // Always start the backend server for network player functionality
  let backend = null;
  let port = process.env.BACKEND_PORT || 4310;

  // Helper to get local IP address for network access
  const getLocalIPAddress = () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    log.info('[IP Detection] Available network interfaces:', Object.keys(interfaces));

    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name] || [];
      log.info(`[IP Detection] ${name}:`, ifaces.map(i => ({ family: i.family, address: i.address, internal: i.internal })));

      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          log.info(`[IP Detection] Selected IP: ${iface.address} from ${name}`);
          return iface.address;
        }
      }
    }

    log.warn('[IP Detection] No external IPv4 address found, using localhost');
    return 'localhost';
  };

  const localIP = getLocalIPAddress();

  try {
    backend = await startBackend({ port });
    process.env.BACKEND_URL = `http://${localIP}:${backend.port}`;
    process.env.BACKEND_WS = `ws://${localIP}:${backend.port}/events`;
    log.info(`✅ Backend server started successfully on port ${backend.port}`);
    log.info(`📍 Local IP: ${localIP}`);
    log.info(`🌐 Network access URL: http://${localIP}:${backend.port}`);
    log.info(`🔌 WebSocket URL: ws://${localIP}:${backend.port}/events`);
    log.info(`📌 Environment variables set: BACKEND_URL=${process.env.BACKEND_URL}, BACKEND_WS=${process.env.BACKEND_WS}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      log.warn(`Port ${port} is in use, trying port ${port + 1}`);
      try {
        backend = await startBackend({ port: port + 1 });
        process.env.BACKEND_URL = `http://${localIP}:${backend.port}`;
        process.env.BACKEND_WS = `ws://${localIP}:${backend.port}/events`;
        log.info(`Backend server started on fallback port ${backend.port}`);
        log.info(`Network access URL: http://${localIP}:${backend.port}`);
        log.info(`WebSocket URL: ws://${localIP}:${backend.port}/events`);
      } catch (err2) {
        log.error('Failed to start backend server on any port:', err2.message);
      }
    } else {
      log.error('Failed to start backend server:', err.message);
    }
  }

  // Store backend reference for IPC access
  global.backend = backend;

  // Create window
  mainWindow = createMainWindow();

  // IPC router (renderer ↔ main/modules)
  const router = createIpcRouter(ipcMain);
  router.mount('app/open-external-display', async () => {
    createExternalWindow();
    return { ok: true };
  });

  // Forward external display updates from renderer to external window
  // This allows the renderer to send updates via IPC which are forwarded to the external window's webContents
  ipcMain.on('external-display/update', (event, messageData) => {
    if (global.externalWindow && global.externalWindow.webContents) {
      global.externalWindow.webContents.send('external-display/update', messageData);
      log.info('Forwarded external-display/update to external window');
    }
  });
  router.mount('app/ready', async () => ({ ok: true, version: app.getVersion() }));
  router.mount('quiz/start', require('../modules/quizEngine').startQuiz);
  router.mount('quiz/score', require('../modules/scoring').scoreAttempt);

  // Network player management endpoints
  router.mount('network/pending-teams', async () => {
    if (!backend || !backend.getPendingTeams) {
      return [];
    }
    return backend.getPendingTeams();
  });

  router.mount('network/all-players', async () => {
    if (!backend || !backend.getAllNetworkPlayers) {
      return [];
    }
    return backend.getAllNetworkPlayers();
  });

  router.mount('network/approve-team', async (payload) => {
    if (!backend || !backend.approveTeam) {
      throw new Error('Backend not initialized');
    }
    const { deviceId, teamName } = payload;
    backend.approveTeam(deviceId, teamName);
    return { approved: true };
  });

  router.mount('network/decline-team', async (payload) => {
    if (!backend || !backend.declineTeam) {
      throw new Error('Backend not initialized');
    }
    const { deviceId, teamName } = payload;
    backend.declineTeam(deviceId, teamName);
    return { declined: true };
  });

  // Network messaging handlers
  router.mount('network/send-question-ready', async (payload) => {
    if (!backend || !backend.sendQuestionReadyToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { options, type, maxAnswers } = payload;
    backend.sendQuestionReadyToPlayers(options, type, maxAnswers);
    return { sent: true };
  });

  router.mount('network/send-question', async (payload) => {
    if (!backend || !backend.sendQuestionToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { text, options, type, maxAnswers } = payload;
    backend.sendQuestionToPlayers(text, options, type, maxAnswers);
    return { sent: true };
  });

  router.mount('network/send-picture', async (payload) => {
    if (!backend || !backend.sendPictureToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { imageUrl } = payload;
    backend.sendPictureToPlayers(imageUrl);
    return { sent: true };
  });

  router.mount('network/send-timer-start', async (payload) => {
    if (!backend || !backend.sendTimerStartToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { seconds, silent } = payload;
    backend.sendTimerStartToPlayers(seconds, silent);
    return { sent: true };
  });

  router.mount('network/send-timer', async (payload) => {
    if (!backend || !backend.sendTimerToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { seconds } = payload;
    backend.sendTimerToPlayers(seconds);
    return { sent: true };
  });

  router.mount('network/send-timeup', async () => {
    if (!backend || !backend.sendTimeUpToPlayers) {
      throw new Error('Backend not initialized');
    }
    backend.sendTimeUpToPlayers();
    return { sent: true };
  });

  router.mount('network/send-reveal', async (payload) => {
    if (!backend || !backend.sendRevealToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { answer, correctIndex, type } = payload;
    backend.sendRevealToPlayers(answer, correctIndex, type);
    return { sent: true };
  });

  router.mount('network/send-answer-confirmation', async (payload) => {
    if (!backend || !backend.sendAnswerConfirmationToPlayer) {
      throw new Error('Backend not initialized');
    }
    const { playerId, teamName } = payload;
    backend.sendAnswerConfirmationToPlayer(playerId, teamName);
    return { sent: true };
  });

  router.mount('network/send-fastest', async (payload) => {
    if (!backend || !backend.sendFastestToPlayers) {
      throw new Error('Backend not initialized');
    }
    const { teamName, questionNumber } = payload;
    backend.sendFastestToPlayers(teamName, questionNumber);
    return { sent: true };
  });

  router.mount('network/send-next', async () => {
    if (!backend || !backend.sendNextToPlayers) {
      throw new Error('Backend not initialized');
    }
    backend.sendNextToPlayers();
    return { sent: true };
  });

  router.mount('network/send-end-round', async () => {
    if (!backend || !backend.sendEndRoundToPlayers) {
      throw new Error('Backend not initialized');
    }
    backend.sendEndRoundToPlayers();
    return { sent: true };
  });

  // Open user's Documents/PopQuiz/Question Packs; create it if missing
  router.mount('app/open-from-file', async () => {
    const docsDir = app.getPath('documents');
    const baseDir = path.join(docsDir, 'PopQuiz');
    const qpDir = path.join(baseDir, 'Question Packs');
    fs.mkdirSync(qpDir, { recursive: true });

    const err = await shell.openPath(qpDir);
    if (err) throw new Error(err);

    return { path: qpDir };
  });

  // Return the default Question Packs directory (Documents/PopQuiz/Question Packs), creating it if needed
  router.mount('files/question-packs-path', async () => {
    const docsDir = app.getPath('documents');
    const baseDir = path.join(docsDir, 'PopQuiz');
    const qpDir = path.join(baseDir, 'Question Packs');
    fs.mkdirSync(qpDir, { recursive: true });
    return { path: qpDir };
  });

  // List the contents of a directory
  router.mount('files/list-directory', async (payload = {}) => {
    const dirPath = payload.path;
    if (!dirPath || typeof dirPath !== 'string') {
      throw new Error('path is required');
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory(),
      path: path.join(dirPath, d.name),
    }));
    return { entries };
  });

  log.info('App boot complete');
}

boot().catch(err => {
  log.error(err);
  app.quit();
});

module.exports = { /* reserved for tests */ };
