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
    // Reset photo loading state when overlay mounts
    setPhotoLoaded(false);
    setPhotoError(false);

    // Trigger animation on mount with slight delay
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
      className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Team Photo Section - Full Screen */}
      {teamPhoto && !photoError ? (
        <div className="relative w-screen h-screen flex items-center justify-center">
          {!photoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700 z-10">
              <div className="animate-spin h-12 w-12 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
            </div>
          )}
          <img
            src={teamPhoto}
            alt={teamName}
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              photoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handlePhotoLoad}
            onError={handlePhotoError}
          />

          {/* Team Name Overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center z-20 transition-all duration-300 ease-out ${
              isVisible
                ? 'scale-100 opacity-100'
                : 'scale-75 opacity-0'
            }`}
          >
            <div className="text-center max-w-2xl px-4">
              <div className="text-white text-4xl sm:text-5xl md:text-6xl font-bold drop-shadow-2xl break-words">
                {teamName}
              </div>
              {guess !== undefined && difference !== undefined && (
                <div className="mt-4">
                  <div className="text-white text-2xl sm:text-3xl font-semibold drop-shadow-lg">Guessed: {guess}</div>
                  <div className="text-white/80 text-xl sm:text-2xl drop-shadow-lg">Off by {difference}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-screen h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <div
            className={`transform transition-all duration-300 ease-out ${
              isVisible
                ? 'scale-100 opacity-100'
                : 'scale-75 opacity-0'
            }`}
          >
            <div className="flex flex-col items-center gap-6">
              <span className="text-9xl">{guess !== undefined ? '🎯' : '🏆'}</span>
              <div className="text-white text-4xl sm:text-5xl md:text-6xl font-bold drop-shadow-lg text-center break-words max-w-2xl px-4">
                {teamName}
              </div>
              {guess !== undefined && difference !== undefined && (
                <div className="text-center">
                  <div className="text-white text-2xl sm:text-3xl font-semibold drop-shadow-lg">Guessed: {guess}</div>
                  <div className="text-white/80 text-xl sm:text-2xl drop-shadow-lg">Off by {difference}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
