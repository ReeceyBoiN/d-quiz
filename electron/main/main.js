const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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

  const isDev = !!process.env.VITE_DEV_SERVER_URL || !app.isPackaged;

  // Start HTTP + WS backend only in dev or when explicitly enabled
  let backend = null;
  if (isDev || process.env.POPQUIZ_ENABLE_BACKEND === '1') {
    backend = await startBackend({ port: process.env.BACKEND_PORT || 4310 });
    process.env.BACKEND_URL = `http://127.0.0.1:${backend.port}`;
    process.env.BACKEND_WS = `ws://127.0.0.1:${backend.port}`;
  }

  // Create window
  mainWindow = createMainWindow();

  // IPC router (renderer ↔ main/modules)
  const router = createIpcRouter(ipcMain);
  router.mount('app/ready', async () => ({ ok: true, version: app.getVersion() }));
  router.mount('quiz/start', require('../modules/quizEngine').startQuiz);
  router.mount('quiz/score', require('../modules/scoring').scoreAttempt);

  // Open user's Documents/PopQuiz, prompting via folder dialog defaulting to that path; create it if missing
  router.mount('app/open-from-file', async () => {
    const docsDir = app.getPath('documents');
    const targetDir = path.join(docsDir, 'PopQuiz');
    fs.mkdirSync(targetDir, { recursive: true });

    // Let user confirm/adjust, but default to Documents/PopQuiz
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select PopQuiz folder',
      defaultPath: targetDir,
      properties: ['openDirectory', 'createDirectory']
    });

    const selectedPath = result.canceled || !result.filePaths?.[0] ? targetDir : result.filePaths[0];

    const err = await shell.openPath(selectedPath);
    if (err) throw new Error(err);

    return { ok: true, data: { path: selectedPath } };
  });

  // Return the default Question Packs directory (Documents/PopQuiz/Question Packs), creating it if needed
  router.mount('files/question-packs-path', async () => {
    const docsDir = app.getPath('documents');
    const baseDir = path.join(docsDir, 'PopQuiz');
    const qpDir = path.join(baseDir, 'Question Packs');
    fs.mkdirSync(qpDir, { recursive: true });
    return { ok: true, data: { path: qpDir } };
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
    return { ok: true, data: { entries } };
  });

  log.info('App boot complete');
}

boot().catch(err => {
  log.error(err);
  app.quit();
});

module.exports = { /* reserved for tests */ };
