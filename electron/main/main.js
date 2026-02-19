import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { createMainWindow, createExternalWindow, toggleExternalWindowState, setExternalWindowBounds, externalWindowState } from './windows.js';
import { applySecurity } from './security.js';
import { createIpcRouter } from '../ipc/ipcRouter.js';
import { startBackend } from '../backend/server.js';
import { initializePaths, getResourcePaths } from '../backend/pathInitializer.js';
import { handleGetBuzzerPath } from '../ipc/handlers/audioHandler.js';
import { handleSelectBuzzerFolder } from '../ipc/handlers/buzzerHandler.js';
import { GetBuzzerPathSchema } from '../ipc/validators.js';
import { getDefaultBuzzerFolder } from '../utils/buzzerConfig.js';
import os from 'os';

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
    log.info('[Backend] Attempting to start backend server on port:', port);
    backend = await startBackend({ port });
    process.env.BACKEND_URL = `http://${localIP}:${backend.port}`;
    process.env.BACKEND_WS = `ws://${localIP}:${backend.port}/events`;
    log.info(`✅ Backend server started successfully on port ${backend.port}`);
    log.info(`📍 Local IP: ${localIP}`);
    log.info(`🌐 Network access URL: http://${localIP}:${backend.port}`);
    log.info(`🔌 WebSocket URL: ws://${localIP}:${backend.port}/events`);
  } catch (err) {
    log.error('[Backend] Error during startup:', {
      code: err.code,
      message: err.message,
      port: port
    });

    if (err.code === 'EADDRINUSE') {
      log.warn(`[Backend] Port ${port} is in use, trying port ${port + 1}`);
      try {
        backend = await startBackend({ port: port + 1 });
        process.env.BACKEND_URL = `http://${localIP}:${backend.port}`;
        process.env.BACKEND_WS = `ws://${localIP}:${backend.port}/events`;
        log.info(`✅ Backend server started on fallback port ${backend.port}`);
      } catch (err2) {
        log.error('[Backend] Failed on fallback port:', {
          code: err2.code,
          message: err2.message,
          port: port + 1
        });
        // Set fallback URLs even if backend failed - use localhost with original port
        process.env.BACKEND_URL = `http://localhost:${port}`;
        process.env.BACKEND_WS = `ws://localhost:${port}/events`;
        log.warn(`[Backend] Using localhost fallback URLs - backend may not be available`);
      }
    } else {
      log.error('[Backend] Backend startup failed (non-EADDRINUSE error):', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      // Set fallback URLs even if backend failed
      process.env.BACKEND_URL = `http://localhost:${port}`;
      process.env.BACKEND_WS = `ws://localhost:${port}/events`;
      log.warn(`[Backend] Using localhost fallback URLs - backend may not be available`);
    }
  }

  // Store backend reference for IPC access
  global.backend = backend;

  // Log backend URL availability before creating window
  log.info('[Window] Creating main window with backend configuration:', {
    backendUrl: process.env.BACKEND_URL,
    backendWs: process.env.BACKEND_WS,
    backendStarted: !!backend
  });

  // Create window
  mainWindow = createMainWindow();

  // IPC router (renderer ↔ main/modules)
  const router = createIpcRouter(ipcMain);

  // Backend URL/WS info handlers
  router.mount('app/get-backend-url', async () => {
    log.info('[IPC] app/get-backend-url called, returning:', process.env.BACKEND_URL);
    return { url: process.env.BACKEND_URL };
  });

  router.mount('app/get-backend-ws', async () => {
    log.info('[IPC] app/get-backend-ws called, returning:', process.env.BACKEND_WS);
    return { ws: process.env.BACKEND_WS };
  });

  // Window control handlers
  router.mount('window/minimize', async () => {
    mainWindow.minimize();
    return { ok: true };
  });

  router.mount('window/maximize', async () => {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
    return { ok: true };
  });

  router.mount('window/close', async () => {
    mainWindow.close();
    return { ok: true };
  });

  router.mount('app/open-external-display', async () => {
    createExternalWindow();
    return { ok: true };
  });

  // External display window control handlers
  router.mount('external-display/toggle-state', async () => {
    try {
      log.info('[IPC] external-display/toggle-state called, current state:', externalWindowState.isMinimized ? 'minimized' : 'maximized');
      const result = await toggleExternalWindowState();
      log.info('[IPC] external-display/toggle-state completed, new state:', externalWindowState.isMinimized ? 'minimized' : 'maximized');

      // Notify external window of state change AFTER window bounds/z-order are fully applied
      if (global.externalWindow && global.externalWindow.webContents) {
        global.externalWindow.webContents.send('external-display/state-changed', {
          isMinimized: result.isMinimized
        });
      }

      return { ok: true, isMinimized: result.isMinimized };
    } catch (err) {
      log.error('[IPC] external-display/toggle-state error:', err.message);
      throw err;
    }
  });

  router.mount('external-display/set-bounds', async (payload) => {
    try {
      const { x, y, width, height } = payload;
      log.info('[IPC] external-display/set-bounds called with:', { x, y, width, height });

      const result = setExternalWindowBounds(x, y, width, height);
      log.info('[IPC] external-display/set-bounds completed:', result);

      return result;
    } catch (err) {
      log.error('[IPC] external-display/set-bounds error:', err.message);
      throw err;
    }
  });

  router.mount('get-window-bounds', async () => {
    try {
      if (!global.externalWindow || global.externalWindow.isDestroyed()) {
        log.warn('[IPC] get-window-bounds: externalWindow not available');
        return { x: 100, y: 100, width: 900, height: 600 };
      }

      const bounds = global.externalWindow.getBounds();
      log.info('[IPC] get-window-bounds returning:', bounds);
      return bounds;
    } catch (err) {
      log.error('[IPC] get-window-bounds error:', err.message);
      throw err;
    }
  });

  router.mount('app/close-external-display', async () => {
    try {
      log.info('[IPC] app/close-external-display called');
      if (global.externalWindow && !global.externalWindow.isDestroyed()) {
        global.externalWindow.close();
        log.info('[IPC] External window closed successfully');

        // Notify host renderer that external window was closed
        if (global.mainWindow && global.mainWindow.webContents) {
          global.mainWindow.webContents.send('external-display/closed', {});
          log.info('[IPC] Notified main window that external display was closed');
        }

        return { ok: true };
      }
      log.warn('[IPC] External window not found or already destroyed');
      return { ok: false, error: 'External window not found' };
    } catch (err) {
      log.error('[IPC] app/close-external-display error:', err.message);
      throw err;
    }
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

  // Audio handlers
  router.mount('audio/get-buzzer-path', handleGetBuzzerPath, GetBuzzerPathSchema);

  // Buzzer handlers
  router.mount('buzzer/select-folder', async () => {
    return await handleSelectBuzzerFolder(mainWindow);
  });

  router.mount('buzzer/update-folder-path', async (payload) => {
    try {
      log.info('[IPC] buzzer/update-folder-path called with path:', payload?.folderPath);

      if (!backend || !backend.updateBuzzerFolderPath) {
        log.error('[IPC] Backend not initialized for buzzer/update-folder-path');
        throw new Error('Backend not initialized');
      }

      const { folderPath } = payload;
      const success = backend.updateBuzzerFolderPath(folderPath);

      if (success) {
        log.info('[IPC] ✅ Successfully updated buzzer folder path:', folderPath);
        return { ok: true, data: { success: true } };
      } else {
        throw new Error('Failed to update buzzer folder path in backend');
      }
    } catch (err) {
      log.error('[IPC] buzzer/update-folder-path error:', err.message);
      throw err;
    }
  });

  // Dynamic imports for quiz modules
  const quizEngine = await import('../modules/quizEngine.js');
  const scoring = await import('../modules/scoring.js');

  router.mount('quiz/start', quizEngine.startQuiz);
  router.mount('quiz/score', scoring.scoreAttempt);

  // Network player management endpoints
  router.mount('network/pending-teams', async () => {
    if (!backend || !backend.getPendingTeams) {
      return [];
    }
    return backend.getPendingTeams();
  });

  router.mount('network/all-players', async () => {
    if (!backend || !backend.getAllNetworkPlayers) {
      log.warn('[IPC] network/all-players: Backend not initialized');
      return [];
    }
    const players = backend.getAllNetworkPlayers();
    log.info('[IPC] network/all-players returning', players.length, 'players');
    players.forEach((p, idx) => {
      log.info(`[IPC] Player ${idx}: ${p.deviceId} - ${p.teamName}, hasTeamPhoto: ${!!p.teamPhoto}`);
      if (p.teamPhoto) {
        log.info(`[IPC]   teamPhoto value (first 100 chars): ${p.teamPhoto.substring(0, 100)}`);
      }
    });
    return players;
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
      log.info('[IPC] network/approve-team called with:', { deviceId: payload?.deviceId, teamName: payload?.teamName, hasDisplayData: !!payload?.displayData, isPhotoApproval: !!payload?.isPhotoApproval });
      console.log('[IPC] 📋 DETAILED PARAMETER CHECK:');
      console.log('  - payload.isPhotoApproval value:', payload?.isPhotoApproval);
      console.log('  - payload.isPhotoApproval type:', typeof payload?.isPhotoApproval);
      console.log('  - payload keys:', Object.keys(payload || {}));

      if (!backend || !backend.approveTeam) {
        log.error('[IPC] Backend not initialized for network/approve-team');
        throw new Error('Backend not initialized');
      }

      const { deviceId, teamName, displayData, isPhotoApproval = false } = payload;
      console.log('[IPC] 📦 After destructuring:');
      console.log('  - isPhotoApproval:', isPhotoApproval);
      console.log('  - isPhotoApproval type:', typeof isPhotoApproval);
      console.log('  - Will pass to backend:', isPhotoApproval);

      log.info('[IPC] displayData details:', { hasImages: !!displayData?.images, scoresLength: displayData?.scores?.length, mode: displayData?.mode });
      if (displayData?.images) {
        log.info('[IPC] displayData.images count:', displayData.images.length);
      }
      if (displayData?.scores) {
        log.info('[IPC] displayData.scores count:', displayData.scores.length);
        log.info('[IPC] displayData.scores sample:', displayData.scores.slice(0, 1));
      }
      log.info('[IPC] 🔑 KEY PARAMETER: Calling backend.approveTeam with isPhotoApproval:', isPhotoApproval);
      console.log('[IPC] 🎯 ABOUT TO CALL BACKEND with approvePhoto parameter:', isPhotoApproval);

      let approveSuccess = false;
      try {
        // PHASE 5: Await the new async approveTeam function
        approveSuccess = await backend.approveTeam(deviceId, teamName, displayData, 0, isPhotoApproval);
        log.info('[IPC] backend.approveTeam returned:', approveSuccess);
        if (!approveSuccess) {
          log.error('[IPC] ❌ backend.approveTeam returned false - message may not have been sent');
          throw new Error('Failed to send TEAM_APPROVED message to player. Check player WebSocket connection state.');
        }
        log.info('[IPC] backend.approveTeam completed successfully');
      } catch (approveErr) {
        log.error('[IPC] backend.approveTeam threw error:', approveErr.message);
        if (approveErr.stack) {
          log.error('[IPC] approveTeam error stack:', approveErr.stack);
        }
        throw approveErr;
      }

      // PHASE 6: Fetch updated player data to return confirmation with photoApprovedAt
      // Ensure complete response structure for robust frontend handling
      let confirmationResponse = {
        approved: true,
        photoApprovedAt: null,
        photoUrl: null,
        timestamp: Date.now()
      };

      if (isPhotoApproval) {
        try {
          console.log('[IPC] 🔄 PHOTO APPROVAL: Fetching confirmation data...');
          console.log('[IPC] 📋 Looking for deviceId:', deviceId);

          // PHASE 6: Extended delay to ensure backend has fully updated the player object
          // Using 100ms instead of 50ms to reliably get the photoApprovedAt timestamp
          await new Promise(res => setTimeout(res, 100));

          const updatedPlayers = backend.getAllNetworkPlayers();
          console.log('[IPC] 📊 getAllNetworkPlayers returned:', updatedPlayers.length, 'players');

          if (!Array.isArray(updatedPlayers)) {
            console.error('[IPC] ❌ getAllNetworkPlayers did not return an array:', typeof updatedPlayers);
            log.error('[IPC] getAllNetworkPlayers did not return an array');
          }

          const approvedPlayer = updatedPlayers.find(p => (p.deviceId || '').trim() === (deviceId || '').trim());

          console.log('[IPC] 🔍 Player lookup result:', {
            found: !!approvedPlayer,
            deviceId: approvedPlayer?.deviceId,
            teamName: approvedPlayer?.teamName,
            photoApprovedAt: approvedPlayer?.photoApprovedAt,
            hasTeamPhoto: !!approvedPlayer?.teamPhoto
          });

          if (approvedPlayer) {
            // CRITICAL FIX: Ensure photoApprovedAt is set even if backend didn't set it
            // This handles edge cases where backend approval succeeds but timestamp isn't persisted
            let responsePhotoApprovedAt = approvedPlayer.photoApprovedAt;

            if (!approvedPlayer.photoApprovedAt) {
              // Backend didn't set it - use current timestamp for the response
              responsePhotoApprovedAt = Date.now();
              console.warn('[IPC] ⚠️  Backend approval succeeded but photoApprovedAt missing - using current timestamp');
              console.log('[IPC] 📸 Response photoApprovedAt:', new Date(responsePhotoApprovedAt).toISOString());
              log.warn('[IPC] WORKAROUND: Using current timestamp for photoApprovedAt - backend may not have persisted it correctly');
            }

            // PHASE 6: Always return complete structure, even if some fields are null
            // This ensures frontend code doesn't have to check multiple response paths
            confirmationResponse = {
              approved: true,
              photoApprovedAt: responsePhotoApprovedAt,
              photoUrl: approvedPlayer.teamPhoto || null,
              timestamp: Date.now()
            };

            if (responsePhotoApprovedAt) {
              console.log('[IPC] ✅ Photo approval confirmed with timestamp - returning complete data');
              log.info('[IPC] Photo approval confirmation returned:', {
                photoApprovedAt: responsePhotoApprovedAt,
                hasPhotoUrl: !!approvedPlayer.teamPhoto
              });
            }
          } else {
            console.warn('[IPC] ⚠️  Could not find player with deviceId:', deviceId);
            const availableIds = updatedPlayers.map(p => p.deviceId);
            console.warn('[IPC] Available deviceIds:', availableIds);
            log.warn('[IPC] ⚠️  Player not found in confirmation lookup');

            // Return at least the structure showing approval succeeded (response will have approved: true)
            // Frontend can use this to know approval went through even if lookup failed
          }
        } catch (confirmErr) {
          console.error('[IPC] ❌ Error retrieving confirmation data:', confirmErr.message);
          if (confirmErr.stack) {
            console.error('[IPC] Error stack:', confirmErr.stack);
          }
          log.warn('[IPC] Error retrieving confirmation data:', confirmErr.message);

          // PHASE 6: Still return approved: true with complete structure
          // Approval already succeeded on the backend even if we can't fetch confirmation
          confirmationResponse = {
            approved: true,
            photoApprovedAt: null,
            photoUrl: null,
            timestamp: Date.now()
          };
        }
      }

      console.log('[IPC] 📤 Returning confirmation response:', JSON.stringify(confirmationResponse));
      return confirmationResponse;
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
      const declineSuccess = backend.declineTeam(deviceId, teamName);
      log.info('[IPC] backend.declineTeam returned:', declineSuccess);
      if (!declineSuccess) {
        log.error('[IPC] ❌ backend.declineTeam returned false - message may not have been sent');
        throw new Error('Failed to send TEAM_DECLINED message to player. Check player WebSocket connection state.');
      }
      log.info('[IPC] backend.declineTeam completed successfully');
      return { declined: true };
    } catch (err) {
      log.error('[IPC] network/decline-team error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  router.mount('network/cleanup-team-photos', async () => {
    try {
      log.info('[IPC] network/cleanup-team-photos called');

      if (!backend || !backend.cleanupTeamPhotos) {
        log.error('[IPC] Backend not initialized for network/cleanup-team-photos');
        throw new Error('Backend not initialized');
      }

      log.info('[IPC] Calling backend.cleanupTeamPhotos...');
      const success = backend.cleanupTeamPhotos();
      log.info('[IPC] backend.cleanupTeamPhotos completed:', { success });

      return { success };
    } catch (err) {
      log.error('[IPC] network/cleanup-team-photos error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  router.mount('network/set-team-photos-auto-approve', async (payload) => {
    try {
      log.info('[IPC] network/set-team-photos-auto-approve called with:', payload);

      if (!backend || !backend.setAutoApproveTeamPhotos) {
        log.error('[IPC] Backend not initialized for network/set-team-photos-auto-approve');
        throw new Error('Backend not initialized');
      }

      const { enabled } = payload;
      log.info('[IPC] Calling backend.setAutoApproveTeamPhotos with enabled:', enabled);
      backend.setAutoApproveTeamPhotos(enabled);
      log.info('[IPC] backend.setAutoApproveTeamPhotos completed');

      return { success: true, enabled };
    } catch (err) {
      log.error('[IPC] network/set-team-photos-auto-approve error:', err.message);
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

  // Get the default buzzer folder path
  router.mount('files/get-default-buzzer-path', async () => {
    try {
      const defaultPath = getDefaultBuzzerFolder();
      log.info('[IPC] files/get-default-buzzer-path returning:', defaultPath);
      return { path: defaultPath };
    } catch (error) {
      log.error('[IPC] files/get-default-buzzer-path error:', error.message);
      throw error;
    }
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

  // Broadcast time up signal to player devices (timer ended)
  router.mount('network/broadcast-timeup', async () => {
    try {
      log.info('[IPC] network/broadcast-timeup called');

      if (!backend || !backend.broadcastTimeUp) {
        log.error('[IPC] Backend not initialized for broadcast-timeup');
        throw new Error('Backend not initialized');
      }

      log.info('[IPC] Broadcasting time up signal');

      try {
        backend.broadcastTimeUp();
        log.info('[IPC] backend.broadcastTimeUp completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastTimeUp threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastTimeUp error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-timeup error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  // Broadcast picture to player devices
  router.mount('network/broadcast-picture', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-picture called with:', { hasImage: !!payload?.image, imageSize: payload?.image?.length || 0 });

      if (!backend || !backend.broadcastPicture) {
        log.error('[IPC] Backend not initialized for broadcast-picture');
        throw new Error('Backend not initialized');
      }

      const imageDataUrl = payload.image;
      if (!imageDataUrl) {
        log.warn('[IPC] No image data provided for broadcast-picture');
        throw new Error('Image data is required');
      }

      log.info('[IPC] Broadcasting picture with size:', imageDataUrl.length, 'bytes');

      try {
        backend.broadcastPicture(imageDataUrl);
        log.info('[IPC] backend.broadcastPicture completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastPicture threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastPicture error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-picture error:', err.message);
      log.error('[IPC] Error stack:', err.stack);
      throw err;
    }
  });

  // Broadcast buzzer folder change to player devices
  router.mount('network/broadcast-buzzer-folder-change', async (payload) => {
    try {
      log.info('[IPC] network/broadcast-buzzer-folder-change called with:', { folderPath: payload?.folderPath });

      if (!backend || !backend.broadcastBuzzerFolderChange) {
        log.error('[IPC] Backend not initialized for broadcast-buzzer-folder-change');
        throw new Error('Backend not initialized');
      }

      const { folderPath } = payload;
      log.info('[IPC] Broadcasting buzzer folder change:', { folderPath });

      try {
        backend.broadcastBuzzerFolderChange(folderPath);
        log.info('[IPC] backend.broadcastBuzzerFolderChange completed successfully');
      } catch (broadcastErr) {
        log.error('[IPC] backend.broadcastBuzzerFolderChange threw error:', broadcastErr.message);
        if (broadcastErr.stack) {
          log.error('[IPC] broadcastBuzzerFolderChange error stack:', broadcastErr.stack);
        }
        throw broadcastErr;
      }

      return { broadcasted: true };
    } catch (err) {
      log.error('[IPC] network/broadcast-buzzer-folder-change error:', err.message);
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

export { /* reserved for tests */ };
