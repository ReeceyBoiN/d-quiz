const { app, session } = require('electron');

function applySecurity() {
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicyByDefault');
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', e => e.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*"
          ]
        }
      });
    });
  });
}

module.exports = { applySecurity };
