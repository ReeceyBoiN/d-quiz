import { useState, useEffect, useRef, useCallback } from 'react';
import { TeamNameEntry } from './components/TeamNameEntry';
import { QuestionDisplay } from './components/QuestionDisplay';
import { WaitingScreen } from './components/WaitingScreen';
import { PlayerDisplayManager } from './components/PlayerDisplayManager';
import { NetworkContext } from './context/NetworkContext';
import { useNetworkConnection } from './hooks/useNetworkConnection';
import { getOrCreateDeviceId } from './lib/deviceId';
import type { HostMessage } from './types/network';

type DisplayMode = 'basic' | 'slideshow' | 'scores';

interface SlideshowImage {
  id: string;
  path: string;
  name: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  position: number;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'team-entry' | 'waiting' | 'approval' | 'declined' | 'question' | 'display'>('team-entry');
  const [teamName, setTeamName] = useState('');
  const [playerId] = useState(() => `player-${Math.random().toString(36).slice(2, 9)}`);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('basic');
  const [slideshowImages, setSlideshowImages] = useState<SlideshowImage[]>([]);
  const [rotationInterval, setRotationInterval] = useState(10000);
  const [leaderboardScores, setLeaderboardScores] = useState<LeaderboardEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const handleConnect = useCallback((ws: WebSocket) => {
    wsRef.current = ws;
  }, []);

  const handleMessage = useCallback((message: HostMessage) => {
    switch (message.type) {
      case 'TEAM_APPROVED':
        console.log('[Player] Team approved, displayData:', message.data?.displayData);
        setCurrentScreen('approval');

        // Extract display mode data from the approval message
        if (message.data?.displayData) {
          const { mode, images, rotationInterval, scores } = message.data.displayData;

          if (mode) {
            console.log('[Player] Setting initial display mode from approval:', mode);
            setDisplayMode(mode);
          }
          if (mode === 'slideshow' && images) {
            console.log('[Player] Setting initial slideshow images:', images.length);
            setSlideshowImages(images);
            if (rotationInterval) {
              setRotationInterval(rotationInterval);
            }
          }
          if (mode === 'scores' && scores) {
            console.log('[Player] Setting initial scores:', scores);
            setLeaderboardScores(scores);
          }
        } else {
          console.log('[Player] No displayData in TEAM_APPROVED, using defaults');
        }

        setTimeout(() => {
          setCurrentScreen('display');
        }, 2000);
        break;
      case 'APPROVAL_PENDING':
        setCurrentScreen('approval');
        break;
      case 'TEAM_DECLINED':
        setCurrentScreen('declined');
        break;
      case 'QUESTION':
        setCurrentQuestion(message.data);
        setCurrentScreen('question');
        break;
      case 'TIMER_START':
        setShowTimer(true);
        setTimeRemaining(message.data?.seconds || 30);
        break;
      case 'TIMER':
        setTimeRemaining(message.data?.seconds || 0);
        break;
      case 'TIMEUP':
        setShowTimer(false);
        break;
      case 'REVEAL':
        setCurrentQuestion((prev: any) => ({
          ...prev,
          revealed: true,
          revealedAnswer: message.data?.answer,
        }));
        break;
      case 'NEXT':
        setCurrentQuestion(null);
        setCurrentScreen('display');
        break;
      case 'PICTURE':
        setCurrentScreen('display');
        if (message.data?.image) {
          setCurrentQuestion((prev: any) => ({
            ...prev,
            imageUrl: message.data.image,
          }));
        }
        break;
      case 'DISPLAY_MODE':
      case 'DISPLAY_UPDATE':
        console.log('[Player] Received DISPLAY_MODE/UPDATE:', message);
        if (message.data?.mode) {
          console.log('[Player] Setting display mode to:', message.data.mode);

          // Clear state for modes being exited to prevent stale state interference
          if (message.data.mode !== 'slideshow') {
            console.log('[Player] Clearing slideshow state (exiting slideshow mode)');
            setSlideshowImages([]);
            setRotationInterval(10000);
          }

          if (message.data.mode !== 'scores') {
            console.log('[Player] Clearing scores state (exiting scores mode)');
            setLeaderboardScores([]);
          }

          // Set new display mode
          setDisplayMode(message.data.mode);

          // Always set the screen to 'display' to ensure UI updates
          setCurrentScreen('display');

          if (message.data.mode === 'slideshow' && message.data.images) {
            console.log('[Player] Setting slideshow images:', message.data.images.length);
            setSlideshowImages(message.data.images);
            if (message.data.rotationInterval) {
              setRotationInterval(message.data.rotationInterval);
            }
          } else if (message.data.mode === 'slideshow') {
            console.warn('[Player] Slideshow mode but no images data');
          }

          if (message.data.mode === 'scores' && message.data.scores) {
            console.log('[Player] Setting leaderboard scores:', message.data.scores);
            setLeaderboardScores(message.data.scores);
          } else if (message.data.mode === 'scores' && !message.data.scores) {
            console.warn('[Player] Scores mode but no scores data:', message.data);
            setLeaderboardScores([]); // Clear scores if none provided
          }

          if (message.data.mode === 'basic') {
            console.log('[Player] Switching to basic display mode');
          }
        } else {
          console.warn('[Player] DISPLAY_MODE received but no mode in data:', message.data);
        }
        break;
      case 'LEADERBOARD_UPDATE':
        if (message.data?.scores) {
          setLeaderboardScores(message.data.scores);
          if (displayMode === 'scores') {
            setCurrentScreen('display');
          }
        }
        break;
      case 'SLIDESHOW_UPDATE':
        if (message.data?.images) {
          setSlideshowImages(message.data.images);
          if (message.data.rotationInterval) {
            setRotationInterval(message.data.rotationInterval);
          }
          if (displayMode === 'slideshow') {
            setCurrentScreen('display');
          }
        }
        break;
    }
  }, [displayMode]);

  const { isConnected, error } = useNetworkConnection({
    playerId,
    onConnect: handleConnect,
    onMessage: handleMessage,
  });

  const handleTeamNameSubmit = (name: string) => {
    setTeamName(name);
    setCurrentScreen('approval');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName: name,
        timestamp: Date.now(),
      }));
    }
  };

  const handleAnswerSubmit = (answer: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYER_ANSWER',
        playerId,
        teamName,
        answer,
        timestamp: Date.now(),
      }));
    }
  };

  return (
    <NetworkContext.Provider value={{ isConnected, playerId, teamName }}>
      <div className="h-screen w-screen bg-gradient-to-b from-slate-900 to-slate-800">
        {!isConnected && currentScreen === 'team-entry' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Connecting to PopQuiz...</h1>
              {error && <p className="text-red-400 mb-4">{error}</p>}
              <div className="animate-spin inline-block h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
            </div>
          </div>
        )}

        {isConnected && currentScreen === 'team-entry' && (
          <TeamNameEntry onSubmit={handleTeamNameSubmit} />
        )}

        {isConnected && currentScreen === 'approval' && (
          <WaitingScreen teamName={teamName} />
        )}

        {isConnected && currentScreen === 'declined' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-6">
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
              <p className="text-slate-300 mb-6">The host has declined your team's entry. You can try again.</p>
              <button
                onClick={() => {
                  setTeamName('');
                  setCurrentScreen('team-entry');
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {isConnected && currentScreen === 'display' && (
          <PlayerDisplayManager
            mode={displayMode}
            images={slideshowImages}
            rotationInterval={rotationInterval}
            scores={leaderboardScores}
          />
        )}

        {isConnected && currentScreen === 'question' && currentQuestion && (
          <QuestionDisplay
            question={currentQuestion}
            timeRemaining={timeRemaining}
            showTimer={showTimer}
            onAnswerSubmit={handleAnswerSubmit}
          />
        )}
      </div>
    </NetworkContext.Provider>
  );
}
