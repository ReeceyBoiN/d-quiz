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
    win.loadFile(path.join(__dirname, '../../build/index.html'));
  }
  return win;
}

module.exports = { createMainWindow };
