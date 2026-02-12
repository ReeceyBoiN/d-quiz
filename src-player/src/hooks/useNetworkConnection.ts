import { useEffect, useState, useCallback, useRef } from 'react';
import type { HostMessage } from '../types/network';

interface UseNetworkConnectionProps {
  playerId: string;
  onConnect?: (ws: WebSocket) => void;
  onMessage?: (message: HostMessage) => void;
  onDisconnect?: () => void;
}

export function useNetworkConnection({
  playerId,
  onConnect,
  onMessage,
  onDisconnect,
}: UseNetworkConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // CRITICAL FIX: Use refs to store callbacks instead of including them in useEffect dependencies
  // This prevents the WebSocket from reconnecting when callbacks change
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs whenever callbacks change (without causing effect rerun)
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  useEffect(() => {
    let wsInstance: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 15;

    const getDelayMs = (attempt: number): number => {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, etc. (capped at 30s)
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      return delayMs;
    };

    const connect = async () => {
      if (!isMounted || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('🛑 Max connection attempts reached. Cannot connect to host.');
          setError('Unable to connect to host after multiple attempts.');
        }
        return;
      }

      try {
        // Step 1: Try to get host info from the backend API
        let wsUrl: string | null = null;
        const httpProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:';

        // Determine current host for API call
        let currentHost = window.location.hostname || 'localhost';
        const apiUrl = `${httpProtocol}//${currentHost}:4310/api/host-info`;

        console.log(`[Player Connection Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}] Fetching host info from: ${apiUrl}`);

        try {
          const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            const hostInfo = await response.json();
            wsUrl = hostInfo.wsUrl;
            console.log(`✅ [Player] Got host info from server - Using WebSocket URL: ${wsUrl}`);
          } else {
            console.warn(`⚠️  [Player] Host info endpoint returned status ${response.status}`);
          }
        } catch (fetchErr) {
          console.warn(`⚠️  [Player] Failed to fetch host info:`, fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
        }

        // Step 2: Fallback to environment variables or window location if API call failed
        if (!wsUrl) {
          console.log('[Player] Falling back to environment variables or window location');
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          let backendHost = import.meta.env.VITE_BACKEND_HOST || window.location.hostname || 'localhost';
          const backendPort = import.meta.env.VITE_BACKEND_PORT || 4310;
          wsUrl = `${protocol}//${backendHost}:${backendPort}/events`;
        }

        console.log(`[Player Connection Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}] Connecting to: ${wsUrl}`);
        wsInstance = new WebSocket(wsUrl);

        // Set a timeout for connection attempt
        connectionTimeout = setTimeout(() => {
          if (wsInstance && wsInstance.readyState === WebSocket.CONNECTING) {
            console.warn('⏱️  Connection attempt timed out after 5 seconds');
            wsInstance?.close();
          }
        }, 5000);

        wsInstance.onopen = () => {
          if (!isMounted) return;
          clearTimeout(connectionTimeout);
          console.log('✅ Player connected to host');
          setIsConnected(true);
          setError(null);
          setWs(wsInstance);
          reconnectAttempts = 0; // Reset on successful connection
          onConnectRef.current?.(wsInstance!);
        };

        wsInstance.onmessage = (event) => {
          if (!isMounted) return;
          try {
            let message: HostMessage;
            try {
              message = JSON.parse(event.data);
            } catch (parseErr) {
              console.error('❌ [Player] Failed to parse message:', parseErr);
              console.error('[Player] Raw event data (first 200 chars):', event.data?.toString().substring(0, 200));
              return;
            }

            console.log('[Player] Successfully parsed message type:', message.type);

            // Special logging for critical message types
            if (message.type === 'TEAM_APPROVED') {
              console.log('🎉 [Player] 🎉 🎉 🎉 TEAM_APPROVED RECEIVED! 🎉 🎉 🎉');
              console.log('[Player] TEAM_APPROVED full message:', JSON.stringify(message).substring(0, 300) + '...');
              console.log('[Player] TEAM_APPROVED has displayData:', !!message.data?.displayData);
              console.log('[Player] About to call onMessage callback with TEAM_APPROVED');
            }

            try {
              console.log('[Player] [wsInstance.onmessage] Calling onMessage with message type:', message.type);
              onMessageRef.current?.(message);
              console.log('[Player] [wsInstance.onmessage] onMessage callback completed successfully for type:', message.type);
            } catch (callbackErr) {
              console.error('[Player] ❌ Error calling onMessage callback:', callbackErr);
              throw callbackErr;
            }
          } catch (err) {
            console.error('❌ [Player] Error in onMessage handler:', err);
            if (err instanceof Error) {
              console.error('[Player] Error stack:', err.stack);
            }
          }
        };

        wsInstance.onerror = (event) => {
          clearTimeout(connectionTimeout);
          if (!isMounted) return;
          console.error('❌ [Player] WebSocket error event:', event);
          if (event instanceof Event) {
            console.error('[Player] Error type:', event.type);
            console.error('[Player] Error target readyState:', (event.target as any)?.readyState);
          } else if (typeof event === 'object') {
            console.error('[Player] Error object keys:', Object.keys(event));
            console.error('[Player] Error details:', event);
          }
          setError('Connection error. Host may not be available.');
          setIsConnected(false);
        };

        wsInstance.onclose = (event) => {
          clearTimeout(connectionTimeout);
          if (!isMounted) return;
          console.log('⚠️  [Player] Disconnected from host');
          console.log(`[Player] Close code: ${event.code}, Reason: ${event.reason || 'none'}, Clean: ${event.wasClean}`);
          if (event.code === 1005) {
            console.warn('[Player] ⚠️  Connection closed abnormally (code 1005) - possible server error');
          }
          setIsConnected(false);
          onDisconnectRef.current?.();

          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayMs = getDelayMs(reconnectAttempts - 1);
            console.log(`📍 [Player] Scheduling reconnect in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            reconnectTimeout = setTimeout(connect, delayMs);
          }
        };
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to connect';
        setError(message);
        setIsConnected(false);

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delayMs = getDelayMs(reconnectAttempts - 1);
          reconnectTimeout = setTimeout(connect, delayMs);
        }
      }
    };

    // Wait 500ms before first connection attempt
    const initialDelayId = setTimeout(() => {
      if (isMounted) {
        console.log('Starting player connection process...');
        connect();
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(initialDelayId);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (wsInstance) {
        wsInstance.close();
      }
    };
  }, []);

  return { isConnected, error, ws };
}
