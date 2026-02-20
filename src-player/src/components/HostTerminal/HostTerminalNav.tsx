import React from 'react';

interface HostTerminalNavProps {
  activeTab: 'leaderboard' | 'teams' | 'controls' | 'settings';
  onTabChange: (tab: 'leaderboard' | 'teams' | 'controls' | 'settings') => void;
}

export function HostTerminalNav({ activeTab, onTabChange }: HostTerminalNavProps) {
  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard', icon: '📊' },
    { id: 'teams', label: 'Teams', icon: '👥' },
    { id: 'controls', label: 'Controls', icon: '🎮' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ] as const;

  return (
    <nav className="bg-slate-900 border-t border-slate-700 px-2 py-3">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-2 px-2 rounded transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="text-xl mb-1">{tab.icon}</div>
            <div className="text-xs font-semibold">{tab.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
}
