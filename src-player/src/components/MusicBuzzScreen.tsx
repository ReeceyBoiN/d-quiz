import { useState, useCallback } from 'react';
import type { KeypadColor } from '../hooks/usePlayerSettings';

interface MusicBuzzScreenProps {
  targetClipName: string;
  nowPlayingClipName?: string;
  keypadColor: KeypadColor;
  onBuzz: () => void;
  buzzState: 'waiting' | 'active' | 'buzzed' | 'correct' | 'wrong' | 'too-late' | 'revealed';
  points?: number;
  revealedAnswer?: string;
}

const colorMap: Record<KeypadColor, { bg: string; active: string; pressed: string; ring: string }> = {
  cyan: {
    bg: 'bg-cyan-500',
    active: 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-400/50',
    pressed: 'bg-cyan-600 scale-95',
    ring: 'ring-cyan-300',
  },
  blue: {
    bg: 'bg-blue-500',
    active: 'bg-blue-400 hover:bg-blue-300 shadow-blue-400/50',
    pressed: 'bg-blue-600 scale-95',
    ring: 'ring-blue-300',
  },
  purple: {
    bg: 'bg-purple-500',
    active: 'bg-purple-400 hover:bg-purple-300 shadow-purple-400/50',
    pressed: 'bg-purple-600 scale-95',
    ring: 'ring-purple-300',
  },
  green: {
    bg: 'bg-green-500',
    active: 'bg-green-400 hover:bg-green-300 shadow-green-400/50',
    pressed: 'bg-green-600 scale-95',
    ring: 'ring-green-300',
  },
  orange: {
    bg: 'bg-orange-500',
    active: 'bg-orange-400 hover:bg-orange-300 shadow-orange-400/50',
    pressed: 'bg-orange-600 scale-95',
    ring: 'ring-orange-300',
  },
  pink: {
    bg: 'bg-pink-500',
    active: 'bg-pink-400 hover:bg-pink-300 shadow-pink-400/50',
    pressed: 'bg-pink-600 scale-95',
    ring: 'ring-pink-300',
  },
};

export function MusicBuzzScreen({
  targetClipName,
  nowPlayingClipName,
  keypadColor,
  onBuzz,
  buzzState,
  points,
  revealedAnswer,
}: MusicBuzzScreenProps) {
  const [isPressed, setIsPressed] = useState(false);
  const colors = colorMap[keypadColor] || colorMap.blue;

  const handlePress = useCallback(() => {
    if (buzzState !== 'active') return;
    setIsPressed(true);
    onBuzz();
    setTimeout(() => setIsPressed(false), 200);
  }, [buzzState, onBuzz]);

  const isDisabled = buzzState !== 'active';

  const getButtonStyle = () => {
    if (buzzState === 'waiting') return 'bg-gray-600 cursor-not-allowed opacity-60';
    if (buzzState === 'buzzed') return `${colors.bg} opacity-70 cursor-not-allowed`;
    if (buzzState === 'correct') return 'bg-green-500 cursor-not-allowed';
    if (buzzState === 'wrong') return 'bg-gray-700 cursor-not-allowed opacity-40';
    if (buzzState === 'too-late') return 'bg-gray-600 cursor-not-allowed opacity-50';
    if (buzzState === 'revealed') return 'bg-green-600 cursor-not-allowed';
    if (isPressed) return colors.pressed;
    return `${colors.active} shadow-2xl`;
  };

  const getStatusText = () => {
    switch (buzzState) {
      case 'waiting': return 'Get ready...';
      case 'active': return 'TAP TO BUZZ!';
      case 'buzzed': return 'BUZZED!';
      case 'correct': return points !== undefined ? `Correct! +${points} pts` : 'Correct!';
      case 'wrong': return 'Wrong clip! Wait...';
      case 'too-late': return 'Too late!';
      case 'revealed': return 'Answer Revealed!';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (buzzState) {
      case 'waiting': return 'text-gray-400';
      case 'active': return 'text-white';
      case 'buzzed': return 'text-yellow-300';
      case 'correct': return 'text-green-400';
      case 'wrong': return 'text-red-400';
      case 'too-late': return 'text-gray-400';
      case 'revealed': return 'text-green-400';
      default: return 'text-white';
    }
  };

  // Show revealed answer screen
  if (buzzState === 'revealed' && revealedAnswer) {
    return (
      <div className="flex flex-col items-center justify-between h-full w-full bg-gray-900 select-none p-4"
        style={{ minHeight: '100dvh' }}
      >
        {/* Top: Target clip info stays visible */}
        <div className="text-center pt-4 px-4 w-full">
          <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Listening for</p>
          <h1 className="text-xl font-bold text-white leading-tight break-words">
            {targetClipName || 'Unknown'}
          </h1>
        </div>

        {/* Center: Revealed answer */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-8">
          <div className="w-full max-w-[320px] bg-green-900/30 border-2 border-green-500/50 rounded-2xl p-6 text-center">
            <svg className="w-16 h-16 mx-auto mb-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-400/80 uppercase tracking-wider mb-2">The answer was</p>
            <h2 className="text-2xl font-black text-green-400 break-words">
              {revealedAnswer}
            </h2>
          </div>
        </div>

        {/* Bottom: Status */}
        <div className="pb-6 text-center">
          <p className={`text-lg font-bold ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-full w-full bg-gray-900 select-none p-4"
      style={{ minHeight: '100dvh' }}
    >
      {/* Top: Target clip info + now playing */}
      <div className="text-center pt-4 px-4 w-full">
        <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Buzz when you hear</p>
        <h1 className="text-2xl font-bold text-white leading-tight break-words">
          {targetClipName || 'Waiting...'}
        </h1>
        {nowPlayingClipName && (
          <div className="mt-3 px-3 py-1.5 bg-white/10 rounded-lg">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Now Playing</p>
            <p className="text-sm font-semibold text-orange-400 truncate">{nowPlayingClipName}</p>
          </div>
        )}
      </div>

      {/* Center: BUZZ button */}
      <div className="flex-1 flex items-center justify-center w-full px-8">
        <button
          onClick={handlePress}
          onTouchStart={(e) => {
            e.preventDefault();
            handlePress();
          }}
          disabled={isDisabled}
          className={`
            w-full aspect-square max-w-[280px] max-h-[280px]
            rounded-full
            flex items-center justify-center
            text-white font-black text-4xl
            transition-all duration-150 transform
            ${getButtonStyle()}
            ${buzzState === 'active' ? `ring-4 ${colors.ring} animate-pulse` : ''}
          `}
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          {buzzState === 'correct' ? (
            <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : buzzState === 'wrong' ? (
            <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            'BUZZ'
          )}
        </button>
      </div>

      {/* Bottom: Status */}
      <div className="pb-6 text-center">
        <p className={`text-lg font-bold ${getStatusColor()}`}>
          {getStatusText()}
        </p>
      </div>
    </div>
  );
}
