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
      // Deny all other window opens
      return { action: 'deny' };
    });
  });
  app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*"
          ]
        }
      });
    });
  });
}

module.exports = { applySecurity };
