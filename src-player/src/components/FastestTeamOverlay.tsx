import { useEffect, useState } from 'react';

interface FastestTeamOverlayProps {
  teamName: string;
  teamPhoto: string | null;
  guess?: number;
  difference?: number;
}

export function FastestTeamOverlay({ teamName, teamPhoto, guess, difference }: FastestTeamOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    setPhotoLoaded(false);
    setPhotoError(false);

    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(animationTimer);
  }, []);

  const handlePhotoLoad = () => {
    console.log('[Player] FastestTeamOverlay: Photo loaded successfully');
    setPhotoLoaded(true);
  };

  const handlePhotoError = () => {
    console.error('[Player] FastestTeamOverlay: Failed to load photo from', teamPhoto);
    setPhotoError(true);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style>{`
        @keyframes flashBorder {
          0%, 100% { border-color: #f59e0b; box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); }
          50% { border-color: #fbbf24; box-shadow: 0 0 30px rgba(251, 191, 36, 0.9); }
        }
      `}</style>

      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        {/* Team Name - Flashing Box Above Photo */}
        <div
          className={`transform transition-all duration-300 ease-out mb-4 ${
            isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 -translate-y-4'
          }`}
        >
          <div
            className="bg-gray-900 border-4 rounded-xl px-6 py-3 max-w-[90vw]"
            style={{ animation: 'flashBorder 1s ease-in-out infinite' }}
          >
            <div className="text-white text-3xl sm:text-4xl md:text-5xl font-bold text-center break-words">
              {teamName}
            </div>
            {guess !== undefined && difference !== undefined && (
              <div className="mt-2 text-center">
                <div className="text-amber-300 text-xl sm:text-2xl font-semibold">Guessed: {guess}</div>
                <div className="text-amber-200/80 text-lg sm:text-xl">Off by {difference}</div>
              </div>
            )}
          </div>
        </div>

        {/* Team Photo Below */}
        {teamPhoto && !photoError ? (
          <div
            className={`relative flex items-center justify-center transition-all duration-500 ease-out ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
            style={{ maxWidth: '80vw', maxHeight: '55vh' }}
          >
            {!photoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded-xl z-10">
                <div className="animate-spin h-12 w-12 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
              </div>
            )}
            <img
              src={teamPhoto}
              alt={teamName}
              className={`max-w-full max-h-[55vh] object-contain rounded-xl transition-opacity duration-300 ${
                photoLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handlePhotoLoad}
              onError={handlePhotoError}
            />
          </div>
        ) : (
          <div
            className={`transform transition-all duration-300 ease-out ${
              isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            }`}
          >
            <span className="text-9xl">{guess !== undefined ? '🎯' : '🏆'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
