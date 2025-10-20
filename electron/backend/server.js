const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const log = require('electron-log');
const bus = require('../utils/bus');

function loadEndpoints(app) {
  // Each file in backend/endpoints exports (router) => void
  require('./endpoints/health')(app);
  require('./endpoints/quizzes')(app);
  require('./endpoints/users')(app);
}

function loadEvents(wss) {
  // Fan-out bus events over WS as JSON
  bus.on('quiz:start', (payload) => {
    const msg = JSON.stringify({ type: 'quiz/start', payload });
    wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
  });
}

async function startBackend({ port = 4310 } = {}) {
  const app = express();
  app.use(express.json());

  loadEndpoints(app);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/events' });
  loadEvents(wss);

  await new Promise(res => server.listen(port, '127.0.0.1', res));
  log.info(`Backend listening on ${port}`);
  return { port, server, wss };
}

module.exports = { startBackend };
