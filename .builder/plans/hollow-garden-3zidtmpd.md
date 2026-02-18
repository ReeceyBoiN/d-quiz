# Network Status Periodic Check Implementation Plan

## Problem Analysis
- Current implementation: `wsConnected` only checks if the WebSocket to `localhost:4310` is connected (always true on host machine)
- Does NOT check if host machine is actually connected to a network that players can reach
- When user disables WiFi/ethernet, the button still shows "Connected" because localhost connection is unaffected
- Need: Actual network availability detection with periodic polling (~30 seconds)

## Solution Overview

### Phase 1: Add Backend Network Status Endpoint
**Goal**: Create an endpoint that checks current network interfaces on-demand

**Files to Modify**:
- `electron/backend/server.js`
  - Add new `/api/network-status` endpoint that:
    - Checks `os.networkInterfaces()` on every request (not just startup)
    - Returns whether a non-internal IPv4 address currently exists
    - Returns format: `{ hasNetwork: boolean, localIP?: string }`
  - Existing function `getLocalIPAddress()` already does the right checks - reuse it

**Approach**:
- Create a reusable function `checkCurrentNetworkStatus()` that:
  - Calls `os.networkInterfaces()` to get current state
  - Checks if any non-internal IPv4 address exists
  - Returns boolean flag `hasNetwork` and the IP if available
- Expose this via GET `/api/network-status` endpoint
- Return simple JSON: `{ hasNetwork: true/false, localIP: "192.168.x.x" }` or `{ hasNetwork: false }`

### Phase 2: Update Frontend Network Status Hook
**Goal**: Implement periodic polling of network status instead of relying on wsConnected alone

**Files to Modify**:
- `src/utils/AuthContext.tsx`
  - Add new state: `networkAvailable` (boolean) - whether host is connected to a network
  - Add periodic polling interval that calls `/api/network-status` every 30 seconds
  - Start polling on mount, clean up on unmount
  - Immediately check on app startup (don't wait 30 seconds)
  - Keep existing `isOnline` (browser online/offline)

**Approach**:
- Use `useEffect` with interval for periodic checking
- Call `fetch('/api/network-status')` every 30 seconds
- Update `networkAvailable` state based on response
- Add error handling - on fetch error, assume network is down
- Export `networkAvailable` from AuthContext so TopNavigation can use it

**Alternative**: Create a separate `NetworkStatusContext` if adding to AuthContext feels wrong, but AuthContext already tracks network state so reusing it is cleaner

### Phase 3: Update TopNavigation Button Logic
**Goal**: Use real network availability instead of wsConnected

**Files to Modify**:
- `src/components/TopNavigation.tsx`
  - Change button state logic from using only `wsConnected` to:
    - Primary check: `networkAvailable` from AuthContext (actual network interfaces)
    - Still accept `wsConnected` prop as secondary indicator
  - Button is ONLY green when `networkAvailable === true`
  - Button flashes when `networkAvailable === false` (regardless of wsConnected)
  
**Update Props**:
- Keep `wsConnected` prop (may still be useful)
- Get `networkAvailable` from useAuth() hook

### Phase 4: Update NetworkTroubleshootingModal
**Goal**: Show real network status in the modal

**Files to Modify**:
- `src/components/NetworkTroubleshootingModal.tsx`
  - Change modal display to show `networkAvailable` status instead of just `wsConnected`
  - Show both statuses:
    - Network Available: checking real network interfaces
    - WebSocket Connected: for debugging purposes
  - Update icon/messaging to reflect actual network availability

## Implementation Details

### Backend Changes (electron/backend/server.js)
```javascript
// Reuse or refactor existing getLocalIPAddress logic
function checkCurrentNetworkStatus() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return { hasNetwork: true, localIP: iface.address };
      }
    }
  }
  return { hasNetwork: false };
}

// Add new endpoint
app.get('/api/network-status', (req, res) => {
  const status = checkCurrentNetworkStatus();
  res.json(status);
});
```

### Frontend Changes (src/utils/AuthContext.tsx)
```javascript
// Add state
const [networkAvailable, setNetworkAvailable] = useState(false);

// Add effect for periodic polling
useEffect(() => {
  // Check immediately on mount
  const checkNetwork = async () => {
    try {
      const response = await fetch('/api/network-status', { timeout: 5000 });
      if (response.ok) {
        const data = await response.json();
        setNetworkAvailable(data.hasNetwork === true);
      } else {
        setNetworkAvailable(false);
      }
    } catch {
      setNetworkAvailable(false);
    }
  };

  checkNetwork(); // Initial check
  
  // Poll every 30 seconds
  const interval = setInterval(checkNetwork, 30000);
  
  return () => clearInterval(interval);
}, []);

// Export networkAvailable in context
```

### Frontend Changes (src/components/TopNavigation.tsx)
```javascript
// In TopNavigation, use networkAvailable from useAuth()
const { networkAvailable } = useAuth();

// Button state: green when networkAvailable, flashing when not
// Show different message based on networkAvailable
// Pass both networkAvailable and wsConnected to modal for debugging
```

## Success Criteria
- ✅ Button shows green (no flash) when host is actually connected to network
- ✅ Button flashes red/orange when WiFi/ethernet is disabled
- ✅ Network status updates automatically every ~30 seconds
- ✅ No delay on startup - network status checked immediately
- ✅ Modal shows both network availability and WebSocket status
- ✅ Graceful handling of fetch errors (assumes no network)

## Key Insights
1. `os.networkInterfaces()` is fast and reliable for checking current network state
2. Polling every 30 seconds is good balance: responsive to changes, not too frequent
3. Browser's `navigator.onLine` is separate concern - keep for backward compatibility
4. Must check network state on EVERY request, not just at startup like current code does
5. Fetch timeout important to avoid hanging on network errors
