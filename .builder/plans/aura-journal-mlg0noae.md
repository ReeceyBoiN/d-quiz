# Fix Port 4310 Already In Use Error

## Problem
The Electron application intermittently fails to start with error: "Error: listen EADDRINUSE: address already in use 0.0.0.0:4310"

This happens when:
- Previous instance didn't fully shut down
- Another process is using port 4310
- Port is in TIME_WAIT state after a crash
- Multiple app instances try to start simultaneously

## Current Implementation Issues
1. **Minimal fallback**: Only tries port+1 once if 4310 fails
2. **No backoff delay**: Doesn't wait before retrying (port may still be in TIME_WAIT)
3. **No range scanning**: Should try multiple alternative ports
4. **Silent failure**: If all retries fail, app may start with backend=null without clear indication

## Root Cause Location
- `electron/main/main.js`: Single retry on EADDRINUSE with no delay
- `electron/backend/server.js`: Server doesn't have internal retry logic, just rejects Promise

## Recommended Solution

### Change 1: Improve Retry Logic in electron/main/main.js
Replace the simple single-retry logic with a robust port-scanning approach:
- Try ports in range: 4310-4319 (configurable)
- Add 500ms delay between retries (allows TIME_WAIT to clear)
- Log each attempt clearly
- Show which port was finally used

### Change 2: Handle Failure Gracefully
- If all ports fail, show user a clear error dialog
- Option: Auto-generate random port if all defaults are unavailable
- Log the final outcome clearly

### Implementation Strategy

**Option A (Recommended)**: Add a retry loop in main.js
```javascript
async function startBackendWithRetry(initialPort = 4310, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const port = initialPort + i;
    try {
      const backend = await startBackend({ port });
      log.info(`✅ Backend started successfully on port ${port}`);
      return { backend, port };
    } catch (err) {
      if (err.code === 'EADDRINUSE' && i < maxRetries - 1) {
        log.warn(`Port ${port} in use, retrying ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      } else {
        throw err;
      }
    }
  }
}
```

**Option B**: Add delay and intelligent port selection
- If 4310 fails, wait 1 second before trying 4311
- This gives TIME_WAIT sockets time to close naturally
- Try up to 10 ports before giving up

## Benefits
- ✅ Handles intermittent port conflicts gracefully
- ✅ No app crash on port conflict
- ✅ Automatic fallback to alternative port
- ✅ Clear logging of what happened
- ✅ User sees app starting normally without knowing about port issue

## Files to Modify
- `electron/main/main.js`: Enhance boot() function with retry loop
- `electron/backend/server.js`: Optional - add internal timeout handling

## Testing Scenarios
1. Start app normally → should use port 4310
2. Start app, then immediately restart → should use port 4311 (4310 in TIME_WAIT)
3. Run two instances simultaneously → each gets different port
4. Kill app while running, restart quickly → should find available port

## Risk Assessment
- **Low Risk**: Retry logic only affects startup, doesn't change runtime behavior
- **Backward Compatible**: App still tries 4310 first
- **No Breaking Changes**: Existing code consuming BACKEND_PORT/BACKEND_URL works as-is
