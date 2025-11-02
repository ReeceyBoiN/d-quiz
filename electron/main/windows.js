const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let externalWindow = null;

function getExternalWindow() {
  return externalWindow;
}

function setExternalWindow(window) {
  externalWindow = window;
}

function closeExternalWindow() {
  if (externalWindow && !externalWindow.isDestroyed()) {
    externalWindow.close();
    externalWindow = null;
  }
}

function createMainWindow() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL; // true if Vite dev server running

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    title: 'PopQuiz',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    // ✅ Load Vite dev server
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // ✅ Load production build from dist
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return win;
}

function createExternalWindow() {
  if (externalWindow) {
    externalWindow.focus();
    return externalWindow;
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  externalWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    title: 'External Display',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  if (isDev) {
    // ✅ Use Vite dev server with external flag
    externalWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?external=1`);
  } else {
    // ✅ Load from dist and pass search param correctly
    externalWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      search: 'external=1',
    });
  }

  externalWindow.on('closed', () => {
    externalWindow = null;
  });

  return externalWindow;
}

module.exports = { createMainWindow, createExternalWindow, getExternalWindow, setExternalWindow, closeExternalWindow };
