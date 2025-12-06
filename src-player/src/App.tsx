import { useState, useEffect, useRef, useCallback } from 'react';
import { TeamNameEntry } from './components/TeamNameEntry';
import { QuestionDisplay } from './components/QuestionDisplay';
import { WaitingScreen } from './components/WaitingScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { NetworkContext } from './context/NetworkContext';
import { useNetworkConnection } from './hooks/useNetworkConnection';
import { getOrCreateDeviceId } from './lib/deviceId';
import type { HostMessage } from './types/network';
import type { SubmissionState } from './components/SubmissionFeedback';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'team-entry' | 'waiting' | 'approval' | 'declined' | 'question' | 'loading'>('team-entry');

  // Initialize playerId from localStorage or generate new one
  const [playerId] = useState(() => {
    const saved = localStorage.getItem('popquiz_player_id');
    if (saved) return saved;
    const newId = `player-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('popquiz_player_id', newId);
    return newId;
  });

  // Initialize teamName from localStorage
  const [teamName, setTeamName] = useState(() => {
    return localStorage.getItem('popquiz_team_name') || '';
  });

  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(30);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [playerSelectedIndex, setPlayerSelectedIndex] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextQuestionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleConnect = useCallback((ws: WebSocket) => {
    wsRef.current = ws;

    // Auto-rejoin if there's a saved team name (reconnection after disconnect)
    if (teamName && ws.readyState === WebSocket.OPEN) {
      console.log(`[Player] Auto-rejoining as team: ${teamName}`);
      ws.send(JSON.stringify({
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName,
        timestamp: Date.now(),
      }));
      setCurrentScreen('approval');
    }
  }, [teamName, playerId, deviceId]);

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
      case 'QUESTION_READY':
        // Question data received but not yet shown to players
        // Show input interface, hide question text
        // Clear any loading timers and transition from loading to question screen
        if (nextQuestionTimerRef.current) {
          clearTimeout(nextQuestionTimerRef.current);
        }
        setCurrentQuestion(message.data ? { ...message.data, shown: false } : null);
        setCurrentScreen('question');
        setSubmissionState('idle');
        break;
      case 'QUESTION':
        // Question is now being shown to players
        // Reveal question text and options (with 500ms delay after QUESTION_READY)
        // Clear any loading timers
        if (nextQuestionTimerRef.current) {
          clearTimeout(nextQuestionTimerRef.current);
        }
        setCurrentQuestion((prev: any) => {
          if (prev) {
            return { ...prev, shown: true };
          }
          // If no previous question, treat as full question with shown=true
          return { ...message.data, shown: true };
        });
        setCurrentScreen('question');
        break;
      case 'TIMER_START':
        setShowTimer(true);
        const totalSeconds = message.data?.seconds || 30;
        setTotalTimeRemaining(totalSeconds);
        setTimeRemaining(totalSeconds);
        break;
      case 'TIMER':
        setTimeRemaining(message.data?.seconds || 0);
        break;
      case 'TIMEUP':
        setShowTimer(false);
        break;
      case 'ANSWER_ACK':
        // Backend received and acknowledged the answer immediately
        // This provides fast feedback without waiting for host processing
        setSubmissionState('confirmed');
        // Auto-hide confirmation after 2 seconds
        setTimeout(() => {
          setSubmissionState('idle');
        }, 2000);
        break;
      case 'REVEAL':
        setCurrentQuestion((prev: any) => ({
          ...prev,
          revealed: true,
          revealedAnswer: message.data?.answer,
          correctIndex: message.data?.correctIndex,
          playerSelectedIndex,
        }));
        break;
      case 'ANSWER_CONFIRMED':
        // Host confirmed answer was received
        setSubmissionState('confirmed');
        // Auto-hide confirmation after 2 seconds
        setTimeout(() => {
          setSubmissionState('idle');
        }, 2000);
        break;
      case 'NEXT':
        // Clear question and show loading screen while next question is prepared
        if (nextQuestionTimerRef.current) {
          clearTimeout(nextQuestionTimerRef.current);
        }
        nextQuestionTimerRef.current = setTimeout(() => {
          setCurrentQuestion(null);
          setSubmissionState('idle');
          setShowTimer(false);
          setCurrentScreen('loading');
        }, 500);
        break;
      case 'PICTURE':
        // Update image but don't switch screen to waiting
        if (message.data?.image) {
          setCurrentQuestion((prev: any) => ({
            ...prev,
            imageUrl: message.data.image,
          }));
        }
        break;
    }
  }, []);

  const { isConnected, error, connectionStatus: wsConnectionStatus } = useNetworkConnection({
    playerId,
    onConnect: handleConnect,
    onMessage: handleMessage,
  });

  // Update app connection status based on WebSocket status
  useEffect(() => {
    if (!isConnected) {
      setConnectionStatus('disconnected');
    } else if (wsConnectionStatus === 'connecting') {
      setConnectionStatus('connecting');
    } else {
      setConnectionStatus('connected');
    }
  }, [isConnected, wsConnectionStatus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (nextQuestionTimerRef.current) {
        clearTimeout(nextQuestionTimerRef.current);
      }
    };
  }, []);

  const handleTeamNameSubmit = (name: string) => {
    setTeamName(name);
    // Persist team name to localStorage for auto-reconnect
    localStorage.setItem('popquiz_team_name', name);
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

  const handleAnswerSubmit = (answerPayload: any) => {
    setSubmissionState('submitting');
    // Capture the selected answer index for multi-choice questions (used for reveal animation)
    if (answerPayload.selectedAnswerIndex !== undefined) {
      setPlayerSelectedIndex(answerPayload.selectedAnswerIndex);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYER_ANSWER',
        playerId,
        teamName,
        answer: answerPayload.answer,
        timestamp: Date.now(),
      }));
    } else {
      setSubmissionState('error');
      setTimeout(() => {
        setSubmissionState('idle');
      }, 2000);
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
                  localStorage.removeItem('popquiz_team_name');
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

        {isConnected && currentScreen === 'loading' && (
          <LoadingScreen />
        )}

        {isConnected && currentScreen === 'question' && currentQuestion && (
          <QuestionDisplay
            question={currentQuestion}
            timeRemaining={timeRemaining}
            totalTimeRemaining={totalTimeRemaining}
            showTimer={showTimer}
            submissionState={submissionState}
            connectionStatus={connectionStatus}
            onAnswerSubmit={handleAnswerSubmit}
          />
        )}
      </div>
    </NetworkContext.Provider>
  );
}
