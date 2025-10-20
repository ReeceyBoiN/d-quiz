const log = require('electron-log');
const { z } = require('zod');
const handlers = new Map();

/**
 * ipcMain wrapper with validation and namespacing
 * router.mount('ns/action', handlerFn, optionalZodSchema)
 */
function createIpcRouter(ipcMain) {
  function mount(channel, handler, schema) {
    if (handlers.has(channel)) throw new Error(`Duplicate IPC channel: ${channel}`);
    handlers.set(channel, { handler, schema });
    ipcMain.handle(channel, async (_e, payload) => {
      try {
        const data = schema ? schema.parse(payload) : payload;
        const result = await handler(data);
        return { ok: true, data: result ?? null };
      } catch (err) {
        log.error(`[IPC ${channel}]`, err);
        return { ok: false, error: String(err.message || err) };
      }
    });
  }
  return { mount };
}

module.exports = { createIpcRouter };
