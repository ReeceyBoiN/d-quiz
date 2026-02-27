# Plan: Fix Player WebSocket Connection Issue on Local Network

## Overview
When players attempt to connect to the host app from another device on the local network (e.g., a phone connecting to `192.168.1.117:4310`), the web page loads, but the WebSocket fails to connect. This happens because the backend attempts to auto-detect its local IP address to give to the player. On systems with multiple network adapters (like WSL, VirtualBox, or VPNs), the server often guesses the wrong IP (e.g. `172.28.x.x` or `localhost`). The player app receives this wrong IP and attempts to open a WebSocket connection to it, which times out since it's unreachable from the phone. 

However, since the phone successfully requested the host info from the backend using the *correct* IP (the one typed in the browser, like `192.168.1.117`), the player app should just use that known-working IP for the WebSocket connection instead of relying on the server's guess.

## Recommended Fix

### 1. Update Player Network Connection Hook
Modify the player connection logic to build the WebSocket URL using the hostname that successfully served the `/api/host-info` request, instead of blindly trusting the server's `hostInfo.wsUrl`.

**File:** `src-player/src/hooks/useNetworkConnection.ts`
- Locate the `try/catch` block where it fetches `apiUrl` and parses `hostInfo`.
- Instead of setting `wsUrl = hostInfo.wsUrl`, dynamically construct it using `currentHost`:
  ```typescript
  if (response.ok) {
    const hostInfo = await response.json();
    // Use the host we successfully reached, rather than the one the server guesses
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = hostInfo.port || 4310;
    wsUrl = `${wsProtocol}//${currentHost}:${port}/events`;
    console.log(`✅ [Player] Got host info from server - Using WebSocket URL: ${wsUrl}`);
  }
  ```

This ensures that if the user types `192.168.1.117:4310`, the player app will strictly open the WebSocket at `192.168.1.117:4310`, regardless of what internal IP the Electron backend thinks it's running on. This will solve the connectivity issue across different devices on the same network.
