import { useState, useEffect, useRef, useCallback } from 'react';
import { TeamNameEntry } from './components/TeamNameEntry';
import { QuestionDisplay } from './components/QuestionDisplay';
import { WaitingScreen } from './components/WaitingScreen';
import { NetworkContext } from './context/NetworkContext';
import { useNetworkConnection } from './hooks/useNetworkConnection';
import { getOrCreateDeviceId } from './lib/deviceId';
import type { HostMessage } from './types/network';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'team-entry' | 'waiting' | 'approval' | 'declined' | 'question'>('team-entry');
  const [teamName, setTeamName] = useState('');
  const [playerId] = useState(() => `player-${Math.random().toString(36).slice(2, 9)}`);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const handleConnect = useCallback((ws: WebSocket) => {
    wsRef.current = ws;
  }, []);

  const handleMessage = useCallback((message: HostMessage) => {
    switch (message.type) {
      case 'TEAM_APPROVED':
        setCurrentScreen('approval');
        setTimeout(() => {
          setCurrentScreen('waiting');
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
        setCurrentScreen('waiting');
        break;
      case 'PICTURE':
        setCurrentScreen('waiting');
        if (message.data?.image) {
          setCurrentQuestion((prev: any) => ({
            ...prev,
            imageUrl: message.data.image,
          }));
        }
        break;
    }
  }, []);

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
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin inline-block h-12 w-12 border-4 border-blue-400 border-t-transparent rounded-full mb-4"></div>
              <h1 className="text-2xl font-bold text-white mb-2">Joining Quiz...</h1>
              <p className="text-slate-300">Team: <span className="font-semibold text-blue-400">{teamName}</span></p>
              <p className="text-slate-400 text-sm mt-4">Waiting for host approval...</p>
            </div>
          </div>
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

        {isConnected && currentScreen === 'waiting' && (
          <WaitingScreen teamName={teamName} />
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
