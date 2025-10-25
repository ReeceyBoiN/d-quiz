const { BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow() {
  const isDev = process.env.VITE_DEV_SERVER_URL; // set by Vite
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: true
    }
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  return win;
}
let externalWindow = null;

function createExternalWindow() {
  if (externalWindow) {
    externalWindow.focus();
    return externalWindow;
  }

  const isDev = process.env.VITE_DEV_SERVER_URL;

  externalWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    title: 'External Display',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: true,
    },
  });

  if (isDev) {
    externalWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?external=1`);
  } else {
    externalWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      query: { external: '1' },
    });
  }

  externalWindow.on('closed', () => {
    externalWindow = null;
  });

  return externalWindow;
}

module.exports = { createMainWindow, createExternalWindow };
