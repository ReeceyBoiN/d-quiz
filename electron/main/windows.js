import { BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let externalWindow = null;

function createMainWindow() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL; // true if Vite dev server running

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    frame: false,
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

  // Handle close with confirmation dialog
  win.on('close', (e) => {
    // Check if there are teams loaded (quiz in progress or lobby has teams)
    // We do this by checking if the user has interacted with the app
    // For simplicity, we'll show a confirmation dialog

    // Prevent default close
    e.preventDefault();

    // Show confirmation dialog
    dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancel', 'Close'],
      defaultId: 0,
      title: 'Close Application',
      message: 'Are you sure you want to close the application?',
      detail: 'If you close without saving, you may lose quiz progress.'
    }).then((result) => {
      if (result.response === 1) {
        // User clicked 'Close' button
        // Close external display window first
        if (externalWindow && !externalWindow.isDestroyed()) {
          externalWindow.close();
        }
        // Then close the main window
        win.destroy();
      }
      // If result.response === 0, user clicked 'Cancel' - do nothing
    });
  });

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
    frame: false,
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
    global.externalWindow = null;
  });

  // Store in global scope so main.js can access it for IPC forwarding
  global.externalWindow = externalWindow;

  return externalWindow;
}

export { createMainWindow, createExternalWindow };
