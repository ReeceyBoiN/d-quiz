import { BrowserWindow, dialog, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let externalWindow = null;

// External window state management
let externalWindowState = {
  isMinimized: true,
  minimizedBounds: { x: 100, y: 100, width: 900, height: 600 }
};

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
    width: 900,
    height: 600,
    x: externalWindowState.minimizedBounds.x,
    y: externalWindowState.minimizedBounds.y,
    backgroundColor: '#000000',
    frame: false,
    title: 'External Display',
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  // Apply initial settings for better behavior
  externalWindow.setMinimumSize(400, 300); // Prevent resizing too small when minimized
  externalWindow.setSkipTaskbar(false); // Keep in taskbar when minimized

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

/**
 * Toggle the external window between minimized (900x600) and maximized (full screen)
 */
async function toggleExternalWindowState() {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return { success: false, error: 'Window not available' };
  }

  try {
    console.log('[Windows] toggleExternalWindowState - Current state:', externalWindowState.isMinimized ? 'minimized' : 'maximized');

    if (externalWindowState.isMinimized) {
      // Maximize to full screen
      console.log('[Windows] Maximizing external window...');
      maximizeExternalWindow();
    } else {
      // Minimize back to 900x600
      console.log('[Windows] Minimizing external window...');
      minimizeExternalWindow();
    }

    // Small delay to ensure window state is fully applied before notifying React
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[Windows] toggleExternalWindowState - New state:', externalWindowState.isMinimized ? 'minimized' : 'maximized');
    return { success: true, isMinimized: externalWindowState.isMinimized };
  } catch (err) {
    console.error('[Windows] toggleExternalWindowState error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Minimize external window to 900x600 and make it draggable/resizable
 */
function minimizeExternalWindow() {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return;
  }

  externalWindowState.isMinimized = true;
  console.log('[Windows] Minimizing external window...');

  // Re-enable taskbar button FIRST when minimized
  externalWindow.setSkipTaskbar(false);
  console.log('[Windows] Taskbar skip disabled - window now appears in taskbar');

  // Disable always-on-top when minimized
  externalWindow.setAlwaysOnTop(false);
  console.log('[Windows] Always-on-top disabled');

  // Re-enable visible on current workspace only
  externalWindow.setVisibleOnAllWorkspaces(false);
  console.log('[Windows] Set to current workspace only');

  // Ensure window is resizable when minimized
  externalWindow.resizable = true;
  console.log('[Windows] Window set to resizable');

  // Save current position
  const currentBounds = externalWindow.getBounds();
  externalWindowState.minimizedBounds = {
    x: currentBounds.x,
    y: currentBounds.y,
    width: 900,
    height: 600
  };

  // Set to 900x600 at saved position
  externalWindow.setBounds({
    x: externalWindowState.minimizedBounds.x,
    y: externalWindowState.minimizedBounds.y,
    width: 900,
    height: 600,
  });
  console.log('[Windows] Window bounds set to 900x600');

  // Focus window
  externalWindow.focus();
  console.log('[Windows] External window minimized, state:', { isMinimized: externalWindowState.isMinimized });
}

/**
 * Maximize external window to fill entire screen, covering taskbar completely
 */
function maximizeExternalWindow() {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return;
  }

  externalWindowState.isMinimized = false;

  // CRITICAL FIX: Find which display the external window is currently on
  // This is crucial because the window might be on a secondary/external display
  const currentBounds = externalWindow.getBounds();
  const centerX = currentBounds.x + currentBounds.width / 2;
  const centerY = currentBounds.y + currentBounds.height / 2;

  // Find the display that contains the window's center point
  let targetDisplay = screen.getPrimaryDisplay();
  const allDisplays = screen.getAllDisplays();

  for (const display of allDisplays) {
    const bounds = display.bounds;
    // Check if window center is within this display's bounds
    if (centerX >= bounds.x && centerX < bounds.x + bounds.width &&
        centerY >= bounds.y && centerY < bounds.y + bounds.height) {
      targetDisplay = display;
      console.log('[Windows] Found target display:', { bounds: targetDisplay.bounds, id: targetDisplay.id });
      break;
    }
  }

  const { x, y, width, height } = targetDisplay.bounds;
  const scaleFactor = targetDisplay.scaleFactor;

  // Diagnostic logging for DPI scaling
  console.log('[Windows] DPI Scaling Diagnostic:');
  console.log('  - Display Scale Factor:', scaleFactor);
  console.log('  - Display bounds (physical pixels):', { x, y, width, height });
  console.log('  - Display workArea:', targetDisplay.workArea);

  console.log('[Windows] Maximizing to display bounds:', { x, y, width, height });

  // CRITICAL: Disable resizing FIRST before setting properties
  externalWindow.resizable = false;

  // Set skip taskbar FIRST to ensure it takes effect
  externalWindow.setSkipTaskbar(true);
  console.log('[Windows] Taskbar skip enabled');

  // Set always-on-top with strongest level BEFORE setBounds to establish z-order immediately
  // Use 'pop-up-menu' level which is highly aggressive and reliable on Windows
  externalWindow.setAlwaysOnTop(true, 'pop-up-menu');
  console.log('[Windows] Always-on-top enabled with pop-up-menu level');

  // Make visible on all workspaces (for virtual desktop support)
  externalWindow.setVisibleOnAllWorkspaces(true);
  console.log('[Windows] Set visible on all workspaces');

  // Set window to fill entire screen including taskbar area
  // Use bounds instead of setFullScreen to have more control
  // CRITICAL: Set bounds to match display bounds exactly to cover taskbar
  // Account for DPI scaling if scaleFactor is not 1.0
  let finalWidth = width;
  let finalHeight = height;

  if (scaleFactor !== 1.0) {
    // When useContentSize is true, the bounds are in device pixels
    // We don't need to multiply by scaleFactor; instead we use bounds as-is
    console.log('[Windows] DPI Scale Factor applied. Width:', finalWidth, 'Height:', finalHeight);
  }

  externalWindow.setBounds({
    x: x,
    y: y,
    width: finalWidth,
    height: finalHeight,
  });
  console.log('[Windows] Window bounds set to fill display:', { x, y, width: finalWidth, height: finalHeight });

  // Focus window to bring to foreground after setting z-order and bounds
  // Use immediate focus without delay for maximum reliability
  externalWindow.focus();
  console.log('[Windows] Window focused immediately');

  // AGGRESSIVE FOLLOW-UP: Re-apply settings after small delay to ensure they stick
  setTimeout(() => {
    if (externalWindow && !externalWindow.isDestroyed()) {
      // Verify and re-apply critical settings
      externalWindow.setAlwaysOnTop(true, 'pop-up-menu');
      externalWindow.setSkipTaskbar(true);
      externalWindow.setVisibleOnAllWorkspaces(true);
      externalWindow.focus();
      console.log('[Windows] Re-applied maximize settings after delay');
    }
  }, 100);

  // Another follow-up after longer delay
  setTimeout(() => {
    if (externalWindow && !externalWindow.isDestroyed()) {
      const currentBounds = externalWindow.getBounds();
      const windowSize = externalWindow.getSize();
      const windowPosition = externalWindow.getPosition();
      console.log('[Windows] Final verification:');
      console.log('  - Current bounds:', currentBounds);
      console.log('  - Window size (getSize):', windowSize);
      console.log('  - Window position (getPosition):', windowPosition);
      console.log('  - Expected bounds:', { x, y, width, height });
      console.log('  - Gaps would exist if bounds don\'t match expected:', {
        rightGap: (x + width) - (currentBounds.x + currentBounds.width),
        bottomGap: (y + height) - (currentBounds.y + currentBounds.height)
      });
    }
  }, 250);

  console.log('[Windows] External window maximized, state:', { isMinimized: externalWindowState.isMinimized });
}

/**
 * Set custom bounds for the external window (used for resizing)
 */
function setExternalWindowBounds(x, y, width, height) {
  if (!externalWindow || externalWindow.isDestroyed()) {
    return { success: false, error: 'Window not available' };
  }

  try {
    externalWindow.setBounds({ x, y, width, height }, false);

    // Update minimized bounds if window is minimized
    if (externalWindowState.isMinimized) {
      externalWindowState.minimizedBounds = { x, y, width, height };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export {
  createMainWindow,
  createExternalWindow,
  toggleExternalWindowState,
  minimizeExternalWindow,
  maximizeExternalWindow,
  setExternalWindowBounds,
  externalWindowState
};
