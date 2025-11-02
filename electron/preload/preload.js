const { contextBridge, ipcRenderer } = require('electron');

// ============================================================
// 🧱 Internal helpers
// ============================================================

// Generic safe invoke helper (request/response pattern)
const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

// Generic send helper (fire-and-forget)
const send = (channel, payload) => ipcRenderer.send(channel, payload);

// Generic listener helper (subscribe to events)
const on = (channel, callback) => {
  const subscription = (_event, data) => callback(data);
  ipcRenderer.on(channel, subscription);
  // Return cleanup function so React can unsubscribe cleanly
  return () => ipcRenderer.removeListener(channel, subscription);
};

// ============================================================
// ✅ Expose safe API to renderer
// ============================================================
contextBridge.exposeInMainWorld('api', {
  // --- App lifecycle ---
  appReady: () => invoke('app/ready'),

  // --- Quiz actions ---
  quiz: {
    start: (data) => invoke('quiz/start', data),
    score: (data) => invoke('quiz/score', data),
  },

  // --- File operations ---
  files: {
    openFromFile: () => invoke('app/open-from-file'),
    questionPacksPath: () => invoke('files/question-packs-path'),
    listDirectory: (path) => invoke('files/list-directory', { path }),
  },

  // --- Backend (Express/WebSocket) info ---
  backend: {
    url: () => process.env.BACKEND_URL,
    ws: () => process.env.BACKEND_WS,
  },

  // --- External Display ---
  externalDisplay: {
    open: () => invoke('app/open-external-display'),
    close: () => invoke('app/close-external-display'),
    update: (data) => send('external-display/update', data),
  },

  // --- 🔹 IPC event helpers (for external display, etc.) ---
  ipc: {
    send,   // fire-and-forget
    on,     // subscribe to a channel
    invoke, // request/response
  },
});
