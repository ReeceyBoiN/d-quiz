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
    url: () => {
      const url = process.env.BACKEND_URL;
      console.log('[Preload] backend.url() returning:', url);
      return url;
    },
    ws: () => {
      const ws = process.env.BACKEND_WS;
      console.log('[Preload] backend.ws() returning:', ws);
      return ws;
    },
  },

  // --- Network player management ---
  network: {
    getPendingTeams: () => invoke('network/pending-teams'),
    getAllPlayers: () => invoke('network/all-players'),
    approveTeam: (data) => invoke('network/approve-team', data),
    declineTeam: (data) => invoke('network/decline-team', data),
    // Send messages to players
    sendQuestionReady: (data) => invoke('network/send-question-ready', data),
    sendQuestion: (data) => invoke('network/send-question', data),
    sendPicture: (data) => invoke('network/send-picture', data),
    sendTimerStart: (data) => invoke('network/send-timer-start', data),
    sendTimer: (data) => invoke('network/send-timer', data),
    sendTimeUp: () => invoke('network/send-timeup', {}),
    sendReveal: (data) => invoke('network/send-reveal', data),
    sendAnswerConfirmation: (data) => invoke('network/send-answer-confirmation', data),
    sendFastest: (data) => invoke('network/send-fastest', data),
    sendNext: () => invoke('network/send-next', {}),
    sendEndRound: () => invoke('network/send-end-round', {}),
  },

  // --- 🔹 IPC event helpers (for external display, etc.) ---
  ipc: {
    send,   // fire-and-forget
    on,     // subscribe to a channel
    invoke, // request/response
  },
});
