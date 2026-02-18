# Network Status Detection Bug Fix Plan

## Problem Analysis

The network status button is flashing "not connected" even when WiFi is actually connected. After investigation, the root cause is:

1. **Frontend uses relative path**: `fetch('/api/network-status')` in AuthContext.tsx
2. **Production renderer origin is `file://`**: Electron loads the dist HTML via `win.loadFile()`
3. **Relative fetch fails silently**: When origin is `file://`, the relative path `/api/network-status` resolves to `file:///api/network-status` instead of reaching the backend server
4. **No error logging**: The catch block silently swallows the error without console logging, so the UI just sets `networkAvailable = false` and stays stuck

## Why It Was Working Initially in Testing
- In development (Vite dev server with `npm run dev`), the UI origin is `http://localhost:xxxx` so relative fetches can be proxied
- The issue becomes apparent in production (Electron executable) where origin is `file://`

## Solution Approach

**Use the existing preload API** (`window.api.backend.url()`) to construct absolute backend URLs instead of relative paths. This approach:
- Reuses existing infrastructure (preload already exposes backend.url())
- Other components already use similar patterns (e.g., NetworkTroubleshootingModal tries to use preload APIs)
- Avoids CORS issues entirely
- Provides better error logging for debugging

## Implementation Steps

### 1. Update AuthContext.tsx - Network Polling Logic
**File**: `src/utils/AuthContext.tsx`
**Changes**:
- Modify `checkNetworkStatus` function to use `window.api.backend.url()` to get the backend base URL
- Build absolute URL: `${backendUrl}/api/network-status` instead of relative `/api/network-status`
- Add console.error logging in the catch block so fetch failures are visible in DevTools
- Add console.error logging for non-ok responses
- Handle case where preload API might not be available (fallback to relative URL with a warning)

**Code pattern**:
```javascript
const checkNetworkStatus = async () => {
  try {
    // Get backend base URL from preload API (if available)
    let url = '/api/network-status';
    if (window.api?.backend?.url) {
      const backendUrl = await window.api.backend.url();
      if (backendUrl) {
        url = `${backendUrl}/api/network-status`;
      }
    }
    
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      setNetworkAvailable(data.hasNetwork === true);
    } else {
      console.error('[AuthContext] network-status response not ok:', response.status);
      setNetworkAvailable(false);
    }
  } catch (error) {
    console.error('[AuthContext] Failed to fetch network-status:', error);
    setNetworkAvailable(false);
  }
};
```

### 2. Add CORS Headers to Backend (Fallback)
**File**: `electron/backend/server.js`
**Changes**:
- Add CORS support as a fallback in case preload API is unavailable
- Set `Access-Control-Allow-Origin` header to `*` for API endpoints
- This ensures that if a renderer somehow uses absolute URLs from file:// origin, requests won't be CORS-blocked

**Code pattern**:
```javascript
// Early in the middleware setup (after express app created, before routes)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

### 3. Optional: Add Logging to Backend Endpoint
**File**: `electron/backend/server.js`
**Changes**:
- Add console.log or electron-log to the `/api/network-status` endpoint for debugging
- Log when the endpoint is called and what network interfaces are detected
- This helps diagnose future issues with network detection

## Testing Steps

1. **Open DevTools** in the host application (View > Toggle Developer Tools)
2. **Watch Console** tab for the new error logs from AuthContext
3. **Verify the fix**:
   - With WiFi connected: Button should show green "Network Connected" after load or within 30 seconds
   - Disable WiFi: Within 30 seconds, button should flash red/orange "No Network Detected"
   - Re-enable WiFi: Within 30 seconds, button should show green again
4. **Check Console** for any `[AuthContext]` error messages that would indicate fetch failures

## Files to Modify

1. `src/utils/AuthContext.tsx` - Main fix (use preload backend URL + add logging)
2. `electron/backend/server.js` - Add CORS headers (fallback) and optional logging

## Key Insights

- The preload API (`window.api.backend.url()`) is already available and should be used by frontend code that needs to contact the backend
- Relative paths work in dev mode but break in production when renderer origin is `file://`
- Without logging, network fetch failures are invisible to users - adding error logs helps with future debugging
- CORS headers on backend are a good defensive measure even after switching to preload URLs

## Success Criteria

✅ Network button shows green when WiFi/Ethernet is connected  
✅ Network button flashes when WiFi/Ethernet is disconnected  
✅ Button updates correctly within 30 seconds after toggling WiFi  
✅ No CORS errors in DevTools Console  
✅ Network fetch failures (if any) are logged to Console for debugging
