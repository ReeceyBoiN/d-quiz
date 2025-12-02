const { app, session } = require('electron');

function applySecurity() {
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicyByDefault');
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', e => e.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      // Allow opening windows for about:blank (used for external display)
      if (url === 'about:blank') {
        return { action: 'allow' };
      }
      // Allow localhost URLs (for external display in dev mode)
      if (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
        return { action: 'allow' };
      }
      // Deny all other window opens
      return { action: 'deny' };
    });
  });
  app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      // Extract the backend URL from environment variables to include in CSP
      const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:4310';
      const backendHost = new URL(backendUrl).host;
      const wsBackendHost = `ws://${backendHost}`;
      const httpBackendHost = `http://${backendHost}`;

      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* ${httpBackendHost} ${wsBackendHost} http://192.168.*:* ws://192.168.*:* http://10.*:* ws://10.*:*`
          ]
        }
      });
    });
  });
}

module.exports = { applySecurity };
