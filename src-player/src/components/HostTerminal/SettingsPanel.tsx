import React, { useState } from 'react';

interface SettingsPanelProps {
  deviceId: string;
  playerId: string;
  teamName: string;
}

export function SettingsPanel({ deviceId, playerId, teamName }: SettingsPanelProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [layout, setLayout] = useState<'compact' | 'expanded'>('compact');

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect from the host?')) {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-800 overflow-auto">
      <h2 className="text-xl font-bold text-white mb-6">Settings</h2>

      {/* Connection Info Section */}
      <div className="mb-8 p-4 bg-slate-700 rounded-lg border border-slate-600">
        <h3 className="font-bold text-white mb-3">Connection Information</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-slate-400">Status:</span>
            <span className="ml-2 text-green-400 font-semibold">✓ Connected</span>
          </div>
          <div>
            <span className="text-slate-400">Device ID:</span>
            <span className="ml-2 text-slate-200 font-mono text-xs">{deviceId.substring(0, 12)}...</span>
          </div>
          <div>
            <span className="text-slate-400">Controller PIN:</span>
            <span className="ml-2 text-slate-200 font-mono font-bold">{teamName}</span>
          </div>
        </div>
      </div>

      {/* Display Settings Section */}
      <div className="mb-8">
        <h3 className="font-bold text-white mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Theme:</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-slate-400"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Text Size:</label>
            <select
              value={textSize}
              onChange={(e) => setTextSize(e.target.value as 'small' | 'medium' | 'large')}
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-slate-400"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm mb-2">Layout:</label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as 'compact' | 'expanded')}
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-slate-400"
            >
              <option value="compact">Compact</option>
              <option value="expanded">Expanded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Game Settings Section */}
      <div className="mb-8">
        <h3 className="font-bold text-white mb-4">Game Mode</h3>
        <div className="p-4 bg-slate-700 rounded border border-slate-600">
          <div className="text-slate-400 mb-2">Current Mode:</div>
          <div className="text-white font-semibold">Waiting for game to start...</div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="mt-auto space-y-2">
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
        >
          🔄 Refresh Connection
        </button>
        <button
          onClick={handleDisconnect}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
        >
          🚪 Disconnect
        </button>
      </div>
    </div>
  );
}
