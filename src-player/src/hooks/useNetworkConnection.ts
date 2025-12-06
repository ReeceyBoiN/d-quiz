import { useEffect, useState, useCallback } from 'react';
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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

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

    const connect = () => {
      if (!isMounted || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('🛑 Max connection attempts reached. Cannot connect to host.');
          setError('Unable to connect to host after multiple attempts.');
        }
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/events`;

        console.log(`[Player Connection Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}] Connecting to: ${wsUrl}`);
        setConnectionStatus('connecting');
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
          setConnectionStatus('connected');
          setError(null);
          setWs(wsInstance);
          reconnectAttempts = 0; // Reset on successful connection
          onConnect?.(wsInstance!);
        };

        wsInstance.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const message: HostMessage = JSON.parse(event.data);
            onMessage?.(message);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        wsInstance.onerror = (event) => {
          clearTimeout(connectionTimeout);
          if (!isMounted) return;
          console.error('❌ WebSocket error:', event);
          setError('Connection error. Host may not be available.');
          setIsConnected(false);
          setConnectionStatus('disconnected');
        };

        wsInstance.onclose = () => {
          clearTimeout(connectionTimeout);
          if (!isMounted) return;
          console.log('⚠️  Disconnected from host');
          setIsConnected(false);
          setConnectionStatus('disconnected');
          onDisconnect?.();

          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayMs = getDelayMs(reconnectAttempts - 1);
            console.log(`📍 Scheduling reconnect in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
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
  }, [onConnect, onMessage, onDisconnect]);

  return { isConnected, connectionStatus, error, ws };
}
