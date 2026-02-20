import React, { useState } from 'react';
import { HostTerminalNav } from './HostTerminalNav';
import { LeaderboardPanel } from './LeaderboardPanel';
import { TeamManagementPanel } from './TeamManagementPanel';
import { GameControlsPanel } from './GameControlsPanel';
import { SettingsPanel } from './SettingsPanel';

interface HostTerminalProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  flowState?: {
    flow: string;
    isQuestionMode: boolean;
    currentQuestion?: any;
    currentLoadedQuestionIndex?: number;
    loadedQuizQuestions?: any[];
    isQuizPackMode?: boolean;
  } | null;
}

export function HostTerminal({ deviceId, playerId, teamName, wsRef, flowState }: HostTerminalProps) {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'teams' | 'controls' | 'settings'>('leaderboard');
  const [showPurposeInfo, setShowPurposeInfo] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              Host Controller
            </h1>
            <p className="text-slate-400 text-sm mt-1">Remote Control Terminal</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPurposeInfo(!showPurposeInfo)}
              className="text-slate-400 hover:text-slate-200 text-lg transition-colors"
              title="Show Host Remote Purpose & Goals"
            >
              ℹ️
            </button>
            <div className="bg-green-500/20 border border-green-500 rounded-lg px-3 py-2">
              <span className="text-green-400 text-sm font-semibold">✓ Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose & Goals Reference Section */}
      {showPurposeInfo && (
        <div className="bg-slate-800/90 border-b border-slate-700 p-4 text-sm text-slate-300">
          <div className="max-h-48 overflow-y-auto space-y-3">
            <div>
              <h3 className="text-white font-semibold mb-1">🎯 Host Remote Purpose</h3>
              <p>Remote control terminal for the Quiz Host application. Manages quiz game from any device connected over local network (WiFi).</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">📊 Leaderboard Tab</h3>
              <p>Real-time team rankings & scores. Shows: Position • Team Name • Score. Updates via periodic fetch (3s) + real-time WebSocket.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">👥 Teams Tab</h3>
              <p>Manage connected players/teams. View team info, status, photo approval, player connections.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">🎮 Controls Tab</h3>
              <p>Game flow commands: Start/Stop timer, Advance question, Show/Hide answers, Reset scores, Navigate quiz.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">⚙️ Settings Tab</h3>
              <p>Configure quiz behavior: Timer duration, Scoring rules, Team management, Visual preferences.</p>
            </div>

            <div className="pt-2 border-t border-slate-600">
              <h3 className="text-white font-semibold mb-1">🔌 Data Source</h3>
              <p className="text-xs">Backend WebSocket: GET_CONNECTED_TEAMS command • Real-time updates via LEADERBOARD_UPDATE messages</p>
            </div>

            <div className="text-xs text-slate-500">
              <p>📍 Expected behavior: On load shows "Loading..." → Then shows real team data OR "No teams connected yet" if empty</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'leaderboard' && (
          <LeaderboardPanel deviceId={deviceId} wsRef={wsRef} />
        )}
        {activeTab === 'teams' && (
          <TeamManagementPanel deviceId={deviceId} wsRef={wsRef} />
        )}
        {activeTab === 'controls' && (
          <GameControlsPanel
            deviceId={deviceId}
            playerId={playerId}
            teamName={teamName}
            wsRef={wsRef}
            flowState={flowState}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            deviceId={deviceId}
            playerId={playerId}
            teamName={teamName}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <HostTerminalNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
