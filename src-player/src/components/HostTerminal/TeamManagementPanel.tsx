import React, { useState, useEffect } from 'react';
import { useHostTerminalAPI } from './useHostTerminalAPI';

interface Team {
  id: string;
  name: string;
  score: number;
  photo?: string;
  photoApprovalStatus?: 'pending' | 'approved' | 'declined';
  deviceId?: string;
}

interface TeamManagementPanelProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export function TeamManagementPanel({ deviceId, playerId, teamName, wsRef }: TeamManagementPanelProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendAdminCommand } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  // Fetch connected teams from backend on mount
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('[TeamManagementPanel] WebSocket not ready, cannot fetch teams');
      return;
    }

    setIsLoading(true);
    console.log('[TeamManagementPanel] Requesting list of connected teams from backend');

    // Handler for ADMIN_RESPONSE messages
    const handleAdminResponse = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ADMIN_RESPONSE' && message.commandType === 'GET_CONNECTED_TEAMS') {
          console.log('[TeamManagementPanel] ✅ Received team list from backend:', message.data.teams);

          // Convert backend teams to frontend Team format
          const convertedTeams = message.data.teams.map((backendTeam: any) => ({
            id: backendTeam.id,
            name: backendTeam.teamName,
            score: 0, // Score is not available from network list, will be 0 on controller
            photo: backendTeam.hasPhoto ? `photo-${backendTeam.id}` : undefined,
            photoApprovalStatus: backendTeam.photoApprovedAt ? 'approved' : 'pending',
            deviceId: backendTeam.deviceId
          }));

          setTeams(convertedTeams);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[TeamManagementPanel] Error handling message:', err);
      }
    };

    // Add listener for messages
    wsRef.current.addEventListener('message', handleAdminResponse);

    // Send request to backend for list of connected players/teams
    try {
      sendAdminCommand('GET_CONNECTED_TEAMS');
    } catch (err) {
      console.error('[TeamManagementPanel] Error sending GET_CONNECTED_TEAMS:', err);
      setIsLoading(false);
    }

    // Set a timeout to stop loading after 3 seconds if no response
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      if (wsRef.current) {
        wsRef.current.removeEventListener('message', handleAdminResponse);
      }
    };
  }, [wsRef, deviceId, playerId, teamName, sendAdminCommand]);

  const handleEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
  };

  const handleSaveTeamName = (teamId: string) => {
    console.log('[HostTerminal] Saving team name:', editingTeamName);

    // Send command to backend to update team name
    sendAdminCommand('UPDATE_TEAM_NAME', { teamId, newTeamName: editingTeamName });

    setTeams(teams.map(t =>
      t.id === teamId ? { ...t, name: editingTeamName } : t
    ));
    setEditingTeamId(null);
  };

  const handleAdjustScore = (teamId: string, points: number) => {
    console.log('[HostTerminal] Adjusting score for team:', teamId, 'points:', points);

    // Send command to backend to adjust score
    sendAdminCommand('ADJUST_TEAM_SCORE', { teamId, points });

    setTeams(teams.map(t =>
      t.id === teamId ? { ...t, score: Math.max(0, t.score + points) } : t
    ));
  };

  const handleApprovePhoto = (teamId: string) => {
    console.log('[HostTerminal] Approving photo for team:', teamId);

    // Send approval command to backend
    sendAdminCommand('APPROVE_TEAM_PHOTO', { teamId });
    console.log('[TeamManagementPanel] ✅ Sent APPROVE_TEAM_PHOTO command to backend');

    setTeams(teams.map(t =>
      t.id === teamId ? { ...t, photoApprovalStatus: 'approved' } : t
    ));
  };

  const handleDeclinePhoto = (teamId: string) => {
    console.log('[HostTerminal] Declining photo for team:', teamId);

    // Send decline command to backend
    sendAdminCommand('DECLINE_TEAM_PHOTO', { teamId });
    console.log('[TeamManagementPanel] ✅ Sent DECLINE_TEAM_PHOTO command to backend');

    setTeams(teams.map(t =>
      t.id === teamId ? { ...t, photoApprovalStatus: 'declined' } : t
    ));
  };

  const handleRemoveTeam = (teamId: string) => {
    if (confirm('Are you sure you want to remove this team?')) {
      console.log('[HostTerminal] Removing team:', teamId);

      // Send remove command to backend
      sendAdminCommand('REMOVE_TEAM', { teamId });

      setTeams(teams.filter(t => t.id !== teamId));
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-800 overflow-auto">
      <h2 className="text-xl font-bold text-white mb-6">Team Management</h2>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-400">Loading teams...</div>
        </div>
      )}

      {!isLoading && teams.length === 0 && (
        <div className="flex items-center justify-center h-full text-center">
          <div className="text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <p>No teams connected yet</p>
            <p className="text-sm text-slate-500 mt-2">Teams will appear here when players connect</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-slate-700 rounded-lg p-4 border border-slate-600"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                {editingTeamId === team.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="flex-1 px-3 py-1 bg-slate-600 text-white rounded border border-slate-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveTeamName(team.id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingTeamId(null)}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-white text-lg">{team.name}</h3>
                )}
              </div>
              {editingTeamId !== team.id && (
                <button
                  onClick={() => handleEditTeam(team)}
                  className="ml-2 px-2 py-1 text-slate-400 hover:text-slate-300 text-sm"
                >
                  ✏️
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-300">Score: <span className="font-bold text-white">{team.score}</span></div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAdjustScore(team.id, -10)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  -10
                </button>
                <button
                  onClick={() => handleAdjustScore(team.id, 10)}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  +10
                </button>
              </div>
            </div>

            {team.photoApprovalStatus === 'pending' && (
              <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500 rounded flex items-center justify-between">
                <span className="text-yellow-400 text-sm">📷 Photo awaiting approval</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprovePhoto(team.id)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeclinePhoto(team.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {team.photoApprovalStatus === 'approved' && (
              <div className="mb-3 p-2 bg-green-500/10 border border-green-500 rounded text-green-400 text-sm">
                ✓ Photo approved
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => handleRemoveTeam(team.id)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Remove Team
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
