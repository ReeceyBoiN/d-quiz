import { useEffect, useState } from 'react';

interface HostInfo {
  baseUrl: string; // e.g., "http://192.168.1.117:4310"
}

// Cache for host info to avoid repeated IPC calls
let hostInfoCache: HostInfo | null = null;

/**
 * Parse WebSocket URL to extract base HTTP URL
 * @param wsUrl - WebSocket URL like "ws://192.168.1.117:4310/events"
 * @returns Base HTTP URL like "http://192.168.1.117:4310"
 */
function parseWebSocketUrl(wsUrl: string): string {
  try {
    // Replace ws:// or wss:// with http:// or https://
    const httpUrl = wsUrl.replace(/^wss?:\/\//, (match) => {
      return match === 'wss://' ? 'https://' : 'http://';
    });

    // Remove path (e.g., /events)
    const url = new URL(httpUrl);
    return `${url.protocol}//${url.host}`;
  } catch (err) {
    console.error('[useHostInfo] Error parsing WebSocket URL:', wsUrl, err);
    return '';
  }
}

/**
 * Hook to get host info via Electron IPC
 * Caches the result to avoid repeated IPC calls
 * @returns HostInfo object or null if unavailable
 */
export function useHostInfo() {
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have the info cached, use it immediately
    if (hostInfoCache) {
      setHostInfo(hostInfoCache);
      setIsLoading(false);
      return;
    }

    const fetchHostInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get backend URL from Electron IPC
        const api = (window as any).api;

        if (api?.backend?.url) {
          // Try to get the HTTP URL first
          const backendUrl = api.backend.url();

          if (backendUrl) {
            const baseUrl = backendUrl.replace(/\/events$/, ''); // Remove /events if present
            hostInfoCache = { baseUrl };
            setHostInfo(hostInfoCache);
            console.log('[useHostInfo] Successfully retrieved backend URL via IPC:', baseUrl);
            return;
          }
        }

        // Fallback: try to parse WebSocket URL
        if (api?.backend?.ws) {
          const wsUrl = api.backend.ws();

          if (wsUrl) {
            const baseUrl = parseWebSocketUrl(wsUrl);
            if (baseUrl) {
              hostInfoCache = { baseUrl };
              setHostInfo(hostInfoCache);
              console.log('[useHostInfo] Successfully parsed WebSocket URL to get backend URL:', baseUrl);
              return;
            }
          }
        }

        throw new Error('No backend URL available from IPC');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[useHostInfo] Error fetching host info:', errorMsg);
        setError(errorMsg);
        setHostInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHostInfo();
  }, []);

  return { hostInfo, isLoading, error };
}
