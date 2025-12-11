import { useEffect, useState } from 'react';

interface FastestTeamOverlayProps {
  teamName: string;
  teamPhoto: string | null;
}

export function FastestTeamOverlay({ teamName, teamPhoto }: FastestTeamOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(animationTimer);
  }, []);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 bg-black/40 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-6 transform transition-all duration-300 ${
          isVisible
            ? 'scale-100 opacity-100'
            : 'scale-95 opacity-0'
        }`}
      >
        {/* Team Photo Section */}
        {teamPhoto ? (
          <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-yellow-400 shadow-2xl shadow-yellow-500/50">
            <img
              src={teamPhoto}
              alt={teamName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 ring-2 ring-inset ring-yellow-400 rounded-full"></div>
          </div>
        ) : (
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-yellow-400 shadow-2xl shadow-yellow-500/50">
            <span className="text-6xl">🏆</span>
          </div>
        )}

        {/* Team Name Section */}
        <div className="text-center">
          <div className="text-yellow-400 text-2xl font-bold mb-2">⚡ FASTEST TEAM ⚡</div>
          <div className="text-white text-4xl font-bold drop-shadow-lg">{teamName}</div>
        </div>
      </div>
    </div>
  );
}
