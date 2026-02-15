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

  // --- Window controls ---
  window: {
    minimize: () => invoke('window/minimize'),
    maximize: () => invoke('window/maximize'),
    close: () => invoke('window/close'),
  },

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
    getDefaultBuzzerPath: async () => {
      try {
        const result = await Promise.race([
          invoke('files/get-default-buzzer-path'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('IPC timeout')), 5000)
          )
        ]);
        if (!result?.path) {
          console.warn('[Preload] getDefaultBuzzerPath() - No path in response:', result);
          return undefined;
        }
        console.log('[Preload] getDefaultBuzzerPath() returning:', result.path);
        return result;
      } catch (error) {
        console.error('[Preload] Error getting default buzzer path:', error);
        return undefined;
      }
    },
  },

  // --- Backend (Express/WebSocket) info ---
  backend: {
    url: async () => {
      try {
        const result = await invoke('app/get-backend-url');
        if (!result?.ok) {
          console.error('[Preload] backend.url() - IPC response not ok:', result?.error);
          return undefined;
        }
        const url = result?.data?.url;
        console.log('[Preload] backend.url() returning:', url);
        return url;
      } catch (error) {
        console.error('[Preload] Error getting backend URL:', error);
        return undefined;
      }
    },
    ws: async () => {
      try {
        const result = await invoke('app/get-backend-ws');
        if (!result?.ok) {
          console.error('[Preload] backend.ws() - IPC response not ok:', result?.error);
          return undefined;
        }
        const ws = result?.data?.ws;
        console.log('[Preload] backend.ws() returning:', ws);
        return ws;
      } catch (error) {
        console.error('[Preload] Error getting backend WebSocket URL:', error);
        return undefined;
      }
    },
  },

  // --- Network player management ---
  network: {
    getPendingTeams: () => invoke('network/pending-teams'),
    getAllPlayers: () => invoke('network/all-players'),
    approveTeam: (data) => invoke('network/approve-team', data),
    declineTeam: (data) => invoke('network/decline-team', data),
    broadcastDisplayMode: (data) => invoke('network/broadcast-display-mode', data),
    broadcastFastest: (data) => invoke('network/broadcast-fastest', data),
    broadcastPicture: (data) => invoke('network/broadcast-picture', data),
    broadcastQuestion: (data) => invoke('network/broadcast-question', data),
    broadcastReveal: (data) => invoke('network/broadcast-reveal', data),
    broadcastTimeUp: () => invoke('network/broadcast-timeup'),
    broadcastBuzzerFolderChange: (data) => invoke('network/broadcast-buzzer-folder-change', data),
  },

  // --- 🔹 IPC event helpers (for external display, etc.) ---
  ipc: {
    send,   // fire-and-forget
    on,     // subscribe to a channel
    invoke, // request/response
  },
});
