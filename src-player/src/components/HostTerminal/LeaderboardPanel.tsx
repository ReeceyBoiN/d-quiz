import React, { useState, useEffect } from 'react';
import { useHostTerminalAPI } from './useHostTerminalAPI';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  position: number;
}

interface TeamFromBackend {
  id: string;
  deviceId: string;
  teamName: string;
  score: number;
  status: string;
  photoApprovedAt?: string | null;
  timestamp: number;
  hasPhoto: boolean;
}

interface LeaderboardPanelProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export function LeaderboardPanel({ deviceId, playerId, teamName, wsRef }: LeaderboardPanelProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pinnedTeamId, setPinnedTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const { sendAdminCommand } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  /**
   * Fetch connected teams from backend and update leaderboard
   */
  const fetchAndUpdateLeaderboard = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('[LeaderboardPanel] WebSocket not ready (state: ' + (wsRef.current?.readyState || 'null') + '), cannot fetch teams');
      return;
    }

    console.log('[LeaderboardPanel] Requesting connected teams from backend');
    setIsLoading(true);

    let timeoutId: NodeJS.Timeout | null = null;
    let messageHandlerRegistered = false;

    // Handler for ADMIN_RESPONSE messages
    const handleAdminResponse = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ADMIN_RESPONSE' && message.commandType === 'GET_CONNECTED_TEAMS') {
          console.log('[LeaderboardPanel] ✅ Received team list from backend:', message.data.teams);

          // Convert backend teams to leaderboard format
          const backendTeams: TeamFromBackend[] = message.data.teams || [];
          const leaderboardEntries: LeaderboardEntry[] = backendTeams
            .map((team: TeamFromBackend) => ({
              id: team.id,
              name: team.teamName,
              score: team.score || 0
            }))
            // Sort by score descending
            .sort((a, b) => b.score - a.score)
            // Add position numbers
            .map((team, idx) => ({
              ...team,
              position: idx + 1
            }));

          console.log('[LeaderboardPanel] ✅ Converted to leaderboard format:', leaderboardEntries);
          setLeaderboard(leaderboardEntries);
          setLastRefreshTime(Date.now());
          setIsLoading(false);

          // Clean up listener and timeout
          if (messageHandlerRegistered && wsRef.current) {
            wsRef.current.removeEventListener('message', handleAdminResponse);
            messageHandlerRegistered = false;
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (err) {
        console.error('[LeaderboardPanel] Error handling response:', err);
      }
    };

    // Add listener for messages - only once
    if (wsRef.current && !messageHandlerRegistered) {
      wsRef.current.addEventListener('message', handleAdminResponse);
      messageHandlerRegistered = true;
    }

    // Send request to backend for list of connected teams
    try {
      const success = sendAdminCommand('GET_CONNECTED_TEAMS');
      if (!success) {
        console.error('[LeaderboardPanel] Error sending GET_CONNECTED_TEAMS via sendAdminCommand');
        setIsLoading(false);
        if (messageHandlerRegistered && wsRef.current) {
          wsRef.current.removeEventListener('message', handleAdminResponse);
          messageHandlerRegistered = false;
        }
        return;
      }
      console.log('[LeaderboardPanel] ✅ Sent GET_CONNECTED_TEAMS request to backend');
    } catch (err) {
      console.error('[LeaderboardPanel] Error sending GET_CONNECTED_TEAMS:', err);
      setIsLoading(false);
      if (messageHandlerRegistered && wsRef.current) {
        wsRef.current.removeEventListener('message', handleAdminResponse);
        messageHandlerRegistered = false;
      }
      return;
    }

    // Set a timeout to stop loading after 5 seconds if no response
    timeoutId = setTimeout(() => {
      console.warn('[LeaderboardPanel] ⏱️ Timeout waiting for GET_CONNECTED_TEAMS response');
      setIsLoading(false);
      if (messageHandlerRegistered && wsRef.current) {
        wsRef.current.removeEventListener('message', handleAdminResponse);
        messageHandlerRegistered = false;
      }
    }, 5000);

    return timeoutId;
  };

  /**
   * Handle real-time leaderboard updates from host broadcast
   */
  const handleLeaderboardUpdate = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);

      // Listen for LEADERBOARD_UPDATE or SCORES messages from host
      if (message.type === 'LEADERBOARD_UPDATE' || message.type === 'SCORES') {
        console.log('[LeaderboardPanel] 📊 Received real-time leaderboard update:', message.data);

        // Only update if we have data and it's an object
        if (message.data && typeof message.data === 'object' && Object.keys(message.data).length > 0) {
          setLeaderboard((prevLeaderboard) => {
            // Only update if we have existing teams
            if (prevLeaderboard.length === 0) {
              console.log('[LeaderboardPanel] No teams in leaderboard yet, skipping real-time update');
              return prevLeaderboard;
            }

            const updated = prevLeaderboard.map((team) => ({
              ...team,
              score: message.data[team.id] !== undefined ? message.data[team.id] : team.score
            }));

            // Re-sort and re-position
            const sorted = updated
              .sort((a, b) => b.score - a.score)
              .map((team, idx) => ({
                ...team,
                position: idx + 1
              }));

            console.log('[LeaderboardPanel] ✅ Updated leaderboard with new scores:', sorted);
            return sorted;
          });
        }
      }
    } catch (err) {
      console.error('[LeaderboardPanel] Error handling leaderboard update:', err);
    }
  };

  // Fetch teams on mount and set up periodic refresh
  useEffect(() => {
    console.log('[LeaderboardPanel] Component mounted, fetching initial leaderboard');

    // Clear any existing leaderboard state to avoid stale data
    setLeaderboard([]);
    setIsLoading(true);

    // Initial fetch
    let refreshTimeout: NodeJS.Timeout | undefined = fetchAndUpdateLeaderboard();

    // Set up periodic refresh every 3 seconds
    const refreshInterval = setInterval(() => {
      console.log('[LeaderboardPanel] Periodic refresh triggered');
      refreshTimeout = fetchAndUpdateLeaderboard();
    }, 3000);

    // Add listener for real-time updates
    if (wsRef.current) {
      wsRef.current.addEventListener('message', handleLeaderboardUpdate);
    }

    // Cleanup on unmount
    return () => {
      console.log('[LeaderboardPanel] Component unmounting, cleaning up');

      // Clear intervals and timeouts
      clearInterval(refreshInterval);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      // Remove event listeners
      if (wsRef.current) {
        wsRef.current.removeEventListener('message', handleLeaderboardUpdate);
      }
    };
  }, [wsRef, deviceId, playerId, teamName, sendAdminCommand]);

  const handlePinTeam = (teamId: string) => {
    setPinnedTeamId(pinnedTeamId === teamId ? null : teamId);
  };

  const handleRefresh = () => {
    console.log('[LeaderboardPanel] Manual refresh triggered');
    fetchAndUpdateLeaderboard();
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-800 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          {isLoading && <span className="text-sm text-slate-400">Loading...</span>}
          {lastRefreshTime > 0 && !isLoading && (
            <span className="text-xs text-slate-500">
              Updated {Math.round((Date.now() - lastRefreshTime) / 1000)}s ago
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {isLoading && leaderboard.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-slate-400">
            <div className="text-4xl mb-2">📊</div>
            <p>Loading leaderboard...</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {leaderboard.map((team) => (
          <div
            key={team.id}
            className={`flex items-center justify-between p-4 rounded-lg transition-all ${
              pinnedTeamId === team.id
                ? 'bg-yellow-500/20 border-2 border-yellow-500'
                : 'bg-slate-700 border border-slate-600 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-600 text-white font-bold">
                {team.position}
              </div>
              <div>
                <div className="font-semibold text-white">{team.name}</div>
                <div className="text-sm text-slate-400">{team.score} points</div>
              </div>
            </div>
            <button
              onClick={() => handlePinTeam(team.id)}
              className={`text-lg transition-colors ${
                pinnedTeamId === team.id
                  ? 'text-yellow-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📌
            </button>
          </div>
        ))}
      </div>

      {!isLoading && leaderboard.length === 0 && (
        <div className="flex items-center justify-center h-full text-center">
          <div className="text-slate-400">
            <div className="text-4xl mb-2">📊</div>
            <p>No teams connected yet</p>
            <p className="text-sm text-slate-500 mt-2">Teams will appear here when players connect</p>
          </div>
        </div>
      )}
    </div>
  );
}
