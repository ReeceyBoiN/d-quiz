const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');
const { createMainWindow } = require('./windows');
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

  // Start HTTP + WS backend inside Electron
  const backend = await startBackend({ port: process.env.BACKEND_PORT || 4310 });

  // Create window
  mainWindow = createMainWindow();

  // IPC router (renderer ↔ main/modules)
  const router = createIpcRouter(ipcMain);
  router.mount('app/ready', async () => ({ ok: true, version: app.getVersion() }));
  router.mount('quiz/start', require('../modules/quizEngine').startQuiz);
  router.mount('quiz/score', require('../modules/scoring').scoreAttempt);

  // Expose backend URL to preload via environment
  process.env.BACKEND_URL = `http://127.0.0.1:${backend.port}`;
  process.env.BACKEND_WS = `ws://127.0.0.1:${backend.port}`;
  log.info('App boot complete');
}

boot().catch(err => {
  log.error(err);
  app.quit();
});

module.exports = { /* reserved for tests */ };
