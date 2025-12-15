const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { createMainWindow, createExternalWindow } = require('./windows');
const { applySecurity } = require('./security');
const { createIpcRouter } = require('../ipc/ipcRouter');
const { startBackend } = require('../backend/server');
const { initializePaths, getResourcePaths } = require('../backend/pathInitializer');

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

  // Initialize PopQuiz resource folders in Documents
  initializePaths();

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

  router.mount('network/pending-answers', async () => {
    if (!backend || !backend.getPendingAnswers) {
      return [];
    }
    const answers = backend.getPendingAnswers();
    log.info('[IPC] network/pending-answers returning', answers.length, 'answers');
    return answers;
  });

  router.mount('network/approve-team', async (payload) => {
    try {
      log.info('[IPC] network/approve-team called with:', { deviceId: payload?.deviceId, teamName: payload?.teamName, hasDisplayData: !!payload?.displayData });

      if (!backend || !backend.approveTeam) {
        log.error('[IPC] Backend not initialized for network/approve-team');
        throw new Error('Backend not initialized');
      }

      const { deviceId, teamName, displayData } = payload;
      log.info('[IPC] displayData details:', { hasImages: !!displayData?.images, scoresLength: displayData?.scores?.length, mode: displayData?.mode });
      if (displayData?.images) {
        log.info('[IPC] displayData.images count:', displayData.images.length);
      }
      if (displayData?.scores) {
        log.info('[IPC] displayData.scores count:', displayData.scores.length);
        log.info('[IPC] displayData.scores sample:', displayData.scores.slice(0, 1));
      }
      log.info('[IPC] Calling backend.approveTeam...');
      try {
        backend.approveTeam(deviceId, teamName, displayData);
        log.info('[IPC] backend.approveTeam completed successfully');
      } catch (approveErr) {
        log.error('[IPC] backend.approveTeam threw error:', approveErr.message);
        if (approveErr.stack) {
          log.error('[IPC] approveTeam error stack:', approveErr.stack);
        }
        throw approveErr;
      }

      return { approved: true };
    } catch (err) {
      log.error('[IPC] network/approve-team error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  router.mount('network/decline-team', async (payload) => {
    try {
      log.info('[IPC] network/decline-team called with:', { deviceId: payload?.deviceId, teamName: payload?.teamName });

      if (!backend || !backend.declineTeam) {
        log.error('[IPC] Backend not initialized for network/decline-team');
        throw new Error('Backend not initialized');
      }
      const { deviceId, teamName } = payload;
      log.info('[IPC] Calling backend.declineTeam...');
      backend.declineTeam(deviceId, teamName);
      log.info('[IPC] backend.declineTeam completed successfully');
      return { declined: true };
    } catch (err) {
      log.error('[IPC] network/decline-team error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
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

  // Get resource paths for PopQuiz (sounds, images, etc.)
  ipcMain.handle('get-resource-paths', async () => {
    return getResourcePaths();
  });

  // Broadcast display mode to player devices
  router.mount('network/broadcast-display-mode', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-display-mode called with:', { displayMode: payload?.displayMode, hasImages: !!payload?.images, hasScores: !!payload?.scores, scoresLength: payload?.scores?.length, displayTransitionDelay: payload?.displayTransitionDelay });

      if (!backend || !backend.broadcastDisplayMode) {
        log.error('[IPC] Backend not initialized for broadcast-display-mode');
        throw new Error('Backend not initialized');
      }
      const { displayMode, images, rotationInterval, scores, scrollSpeed, displayTransitionDelay } = payload;

      log.info('[IPC] Broadcast-display-mode received:', { displayMode, hasImages: !!images, hasScores: !!scores, scoresLength: scores?.length, displayTransitionDelay });

      const displayData = {
        mode: displayMode,
        displayTransitionDelay: displayTransitionDelay || 0,
      };

      if (displayMode === 'slideshow' && images) {
        displayData.images = images;
        displayData.rotationInterval = rotationInterval || 10000;
        log.info('[IPC] Added slideshow data');
      }

      if (displayMode === 'scores' && scores) {
        displayData.scores = scores;
        displayData.scrollSpeed = scrollSpeed || 'medium';
        log.info('[IPC] Added scores data:', scores);
      } else if (displayMode === 'scores') {
        log.warn('[IPC] Scores mode requested but no scores data!');
      }

      log.info('[IPC] Final displayData keys:', Object.keys(displayData));
      log.info('[IPC] Final displayData:', { mode: displayData.mode, displayTransitionDelay: displayData.displayTransitionDelay, hasImages: !!displayData.images, hasScores: !!displayData.scores });
      log.info('[IPC] Calling backend.broadcastDisplayMode...');
      try {
        backend.broadcastDisplayMode(displayMode, displayData);
        log.info('[IPC] backend.broadcastDisplayMode completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastDisplayMode threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastDisplayMode error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }
      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-display-mode error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  // Broadcast question to player devices
  router.mount('network/broadcast-question', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-question called with:', { hasQuestion: !!payload?.question, questionType: payload?.question?.type });

      if (!backend || !backend.broadcastQuestion) {
        log.error('[IPC] Backend not initialized for broadcast-question');
        throw new Error('Backend not initialized');
      }

      const questionData = payload.question || payload;
      log.info('[IPC] Broadcasting question:', { type: questionData.type, hasText: !!questionData.text, optionsCount: questionData.options?.length || 0 });

      try {
        backend.broadcastQuestion(questionData);
        log.info('[IPC] backend.broadcastQuestion completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastQuestion threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastQuestion error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-question error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  // Broadcast reveal to player devices
  router.mount('network/broadcast-reveal', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-reveal called with:', { answer: payload?.answer, correctIndex: payload?.correctIndex, type: payload?.type });

      if (!backend || !backend.broadcastReveal) {
        log.error('[IPC] Backend not initialized for broadcast-reveal');
        throw new Error('Backend not initialized');
      }

      log.info('[IPC] Broadcasting reveal:', { answer: payload.answer, type: payload.type });

      try {
        backend.broadcastReveal(payload);
        log.info('[IPC] backend.broadcastReveal completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastReveal threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastReveal error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-reveal error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  // Broadcast fastest team to player devices
  router.mount('network/broadcast-fastest', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-fastest called with:', { teamName: payload?.teamName, questionNumber: payload?.questionNumber, hasPhoto: !!payload?.teamPhoto });

      if (!backend || !backend.broadcastFastest) {
        log.error('[IPC] Backend not initialized for broadcast-fastest');
        throw new Error('Backend not initialized');
      }

      log.info('[IPC] Broadcasting fastest team:', { teamName: payload.teamName, questionNumber: payload.questionNumber });

      try {
        backend.broadcastFastest(payload);
        log.info('[IPC] backend.broadcastFastest completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastFastest threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastFastest error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-fastest error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  log.info('App boot complete');
}

boot().catch(err => {
  log.error(err);
  app.quit();
});

module.exports = { /* reserved for tests */ };
