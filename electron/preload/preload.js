const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('api', {
  appReady: () => invoke('app/ready'),
  quiz: {
    start: (data) => invoke('quiz/start', data),
    score: (data) => invoke('quiz/score', data),
  },
  files: {
    openFromFile: () => invoke('app/open-from-file')
  },
  backend: {
    url: () => process.env.BACKEND_URL,
    ws: () => process.env.BACKEND_WS
  }
});
