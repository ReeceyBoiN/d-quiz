import { useState, useEffect, useRef, useCallback } from 'react';
import { TeamNameEntry } from './components/TeamNameEntry';
import { QuestionDisplay } from './components/QuestionDisplay';
import { WaitingScreen } from './components/WaitingScreen';
import { PlayerDisplayManager } from './components/PlayerDisplayManager';
import { SettingsBar } from './components/SettingsBar';
import { FastestTeamOverlay } from './components/FastestTeamOverlay';
import { NetworkContext } from './context/NetworkContext';
import { useNetworkConnection } from './hooks/useNetworkConnection';
import { usePlayerSettings } from './hooks/usePlayerSettings';
import { getOrCreateDeviceId } from './lib/deviceId';
import type { HostMessage } from './types/network';
import { normalizeQuestionType } from './types/network';

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
  const [currentScreen, setCurrentScreen] = useState<'team-entry' | 'waiting' | 'approval' | 'declined' | 'question' | 'ready-for-question' | 'display'>('team-entry');
  const [teamName, setTeamName] = useState('');
  const [playerId] = useState(() => `player-${Math.random().toString(36).slice(2, 9)}`);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTimerLength, setTotalTimerLength] = useState(30);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('basic');
  const [slideshowImages, setSlideshowImages] = useState<SlideshowImage[]>([]);
  const [rotationInterval, setRotationInterval] = useState(10000);
  const [leaderboardScores, setLeaderboardScores] = useState<LeaderboardEntry[]>([]);
  const [goWideEnabled, setGoWideEnabled] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | number | (string | number)[] | undefined>();
  const [selectedAnswers, setSelectedAnswers] = useState<any[]>([]);
  const [showFastestTeam, setShowFastestTeam] = useState(false);
  const [fastestTeamName, setFastestTeamName] = useState<string>('');
  const [fastestTeamPhoto, setFastestTeamPhoto] = useState<string | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | undefined>();
  const [submittedAnswer, setSubmittedAnswer] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const displayModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastestTeamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedAnswerRef = useRef<any>(null); // Store answer in ref for immediate access, bypassing async state updates

  const { settings, isLoaded: playerSettingsLoaded } = usePlayerSettings();

  // Handle 5-second display of fastest team overlay
  useEffect(() => {
    if (showFastestTeam) {
      console.log('[Player] Starting 5-second fastest team display timer');
      // Clear any existing timer
      if (fastestTeamTimerRef.current) {
        clearTimeout(fastestTeamTimerRef.current);
      }
      // Set 5-second timer to hide fastest team overlay
      fastestTeamTimerRef.current = setTimeout(() => {
        console.log('[Player] 5-second fastest team display timer ended');
        setShowFastestTeam(false);
        setFastestTeamName('');
        setFastestTeamPhoto(null);
      }, 5000);
    }

    return () => {
      if (fastestTeamTimerRef.current) {
        clearTimeout(fastestTeamTimerRef.current);
      }
    };
  }, [showFastestTeam]);

  // Helper function to determine if player's answer is correct
  const determineAnswerCorrectness = (submittedAnswerObj: any, correctAnswer: any, questionType?: string): boolean => {
    // If no answer was submitted, it's incorrect
    if (!submittedAnswerObj) {
      console.log('[Player] ❌ No answer submitted, marking as incorrect');
      return false;
    }

    // If no correct answer provided, can't determine correctness
    if (!correctAnswer && correctAnswer !== 0) {
      console.log('[Player] ❌ No correct answer provided, marking as incorrect');
      return false;
    }

    console.log('[Player] 🔍 Correctness check - submittedAnswerObj:', submittedAnswerObj, 'correctAnswer:', correctAnswer, 'questionType param:', questionType);

    const normalizeString = (str: any): string => {
      if (str === null || str === undefined) return '';
      return String(str).toLowerCase().trim();
    };

    // Extract the actual answer value from the submitted answer object
    let submittedValue = submittedAnswerObj?.answer ?? submittedAnswerObj;
    const allAnswers = submittedAnswerObj?.allAnswers;

    // Determine type with priority: use submittedAnswerObj.questionType first, then parameter
    let type = '';
    if (submittedAnswerObj?.questionType) {
      type = submittedAnswerObj.questionType.toLowerCase().trim();
    } else if (questionType) {
      type = questionType.toLowerCase().trim();
    }

    console.log('[Player] 🔍 Type detection - extracted type:', type, 'from submittedAnswerObj.questionType:', submittedAnswerObj?.questionType, 'from param:', questionType);
    console.log('[Player] 🔍 Submitted value:', submittedValue, 'All answers:', allAnswers);

    // Validate submitted value
    if (!submittedValue && submittedValue !== 0) {
      console.log('[Player] ❌ No submitted value found after extraction, marking as incorrect');
      return false;
    }

    // Normalize correct answer
    const normalizedCorrect = normalizeString(correctAnswer);

    // Handle go-wide mode (multiple answers)
    if (allAnswers && Array.isArray(allAnswers) && allAnswers.length > 0) {
      console.log('[Player] 🔍 Checking go-wide mode answers:', allAnswers, 'against:', correctAnswer);
      // Player is correct if ANY of their answers match the correct answer
      return allAnswers.some((ans: any) => {
        const normalizedAns = normalizeString(ans);
        const matches = normalizedAns === normalizedCorrect;
        console.log('[Player] 🔍 Go-wide comparison:', normalizedAns, '===', normalizedCorrect, '=', matches);
        return matches;
      });
    }

    // Handle single answer based on question type
    if (type === 'numbers') {
      console.log('[Player] 🔍 NUMBERS MODE comparison - submittedValue:', submittedValue, 'type:', typeof submittedValue);
      // For numbers, do numeric comparison
      const submittedNum = typeof submittedValue === 'number' ? submittedValue : parseInt(String(submittedValue), 10);
      const correctNum = parseInt(String(correctAnswer), 10);
      const isCorrect = !isNaN(submittedNum) && !isNaN(correctNum) && submittedNum === correctNum;
      console.log('[Player] ✅ Numbers comparison:', submittedNum, '===', correctNum, '=', isCorrect, '(submittedNum type:', typeof submittedNum, 'correctNum type:', typeof correctNum, ')');
      return isCorrect;
    }

    // For all other types (letters, multiple-choice, sequence, etc.), do string comparison
    const normalizedSubmitted = normalizeString(submittedValue);
    const isCorrect = normalizedSubmitted === normalizedCorrect;
    console.log('[Player] ✅ String comparison:', normalizedSubmitted, '===', normalizedCorrect, '=', isCorrect);
    return isCorrect;
  };

  const handleConnect = useCallback((ws: WebSocket) => {
    console.log('[Player] handleConnect callback - storing WebSocket reference');
    wsRef.current = ws;
    console.log('[Player] WebSocket stored, readyState:', ws.readyState, '(1=open)');
  }, []);

  const handleMessage = useCallback((message: HostMessage) => {
    switch (message.type) {
      case 'TEAM_APPROVED':
        try {
          console.log('[Player] Team approved, displayData:', message.data?.displayData);

          // Check if there's a current game state (late joiner sync)
          const displayData = message.data?.displayData;
          const currentGameState = displayData?.currentGameState;

          if (currentGameState?.currentQuestion) {
            // Late joiner - show current question immediately
            console.log('[Player] Late joiner: Showing current question');

            const questionData = {
              ...currentGameState.currentQuestion,
              type: normalizeQuestionType(currentGameState.currentQuestion.type)
            };
            setCurrentQuestion(questionData);
            setGoWideEnabled(false);
            setAnswerRevealed(false);
            setCorrectAnswer(undefined);
            setSelectedAnswers([]);

            // Show the question screen immediately
            setCurrentScreen('question');

            // If timer is running, show it with remaining time
            if (currentGameState.timerState?.isRunning) {
              console.log('[Player] Late joiner: Timer is running, showing timer with remaining time:', currentGameState.timerState.timeRemaining);
              setTotalTimerLength(currentGameState.timerState.totalTime);
              setTimeRemaining(currentGameState.timerState.timeRemaining);
              setShowTimer(true);
            }
          } else {
            // Normal approval flow - show approval screen
            console.log('[Player] Normal approval: Showing approval screen');
            setCurrentScreen('approval');

            // Extract display mode data from the approval message
            if (displayData) {
              try {
                const { mode, images, rotationInterval, scores } = displayData;

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
              } catch (dataErr) {
                console.error('❌ [Player] Error extracting displayData from TEAM_APPROVED:', dataErr);
              }
            } else {
              console.log('[Player] No displayData in TEAM_APPROVED, using defaults');
            }

            const approvalTimer = setTimeout(() => {
              try {
                console.log('[Player] Approval screen delay complete, transitioning to display');
                setCurrentScreen('display');
              } catch (screenErr) {
                console.error('❌ [Player] Error during approval screen transition:', screenErr);
              }
            }, 2000);

            return () => clearTimeout(approvalTimer);
          }
        } catch (approvalErr) {
          console.error('❌ [Player] Error in TEAM_APPROVED handler:', approvalErr);
          if (approvalErr instanceof Error) {
            console.error('[Player] Error stack:', approvalErr.stack);
          }
        }
        break;
      case 'APPROVAL_PENDING':
        setCurrentScreen('approval');
        break;
      case 'TEAM_DECLINED':
        setCurrentScreen('declined');
        break;
      case 'QUESTION':
        // Cancel any pending display mode timer when question arrives
        if (displayModeTimerRef.current) {
          clearTimeout(displayModeTimerRef.current);
          displayModeTimerRef.current = null;
          console.log('[Player] Cancelled display mode timer - question arrived');
        }

        // Extract go wide flag from question
        const goWideFlag = message.data?.goWideEnabled ?? false;
        setGoWideEnabled(goWideFlag);
        console.log('[Player] Question received, go wide enabled:', goWideFlag);

        // Reset reveal state
        setAnswerRevealed(false);
        setCorrectAnswer(undefined);
        setSelectedAnswers([]);

        // Normalize the question type from host to standard player type
        const normalizedQuestionData = {
          ...message.data,
          type: normalizeQuestionType(message.data?.type),
        };
        console.log('[Player] Original type:', message.data?.type, '-> Normalized type:', normalizedQuestionData.type);
        console.log('[Player] Question options count:', normalizedQuestionData.options?.length || 0, 'Options:', normalizedQuestionData.options);

        setCurrentQuestion(normalizedQuestionData);
        // Transition to 'question' screen regardless of current screen state
        setCurrentScreen('question');
        break;
      case 'TIMER_START':
        const timerDuration = message.data?.seconds || 30;
        setTotalTimerLength(timerDuration);
        setTimeRemaining(timerDuration);
        setShowTimer(true);
        break;
      case 'TIMER':
        setTimeRemaining(message.data?.seconds || 0);
        break;
      case 'TIMEUP':
        setShowTimer(false);
        break;
      case 'REVEAL':
        console.log('[Player] 📢 REVEAL message received - full data:', message.data);
        const revealedCorrectAnswer = message.data?.answer ?? message.data?.correctAnswer;
        console.log('[Player] 📢 Extracted revealed correct answer:', revealedCorrectAnswer);
        console.log('[Player] 📢 Current submitted answer state:', submittedAnswer);
        console.log('[Player] 📢 Current question:', currentQuestion);
        console.log('[Player] 📢 Submitted answer from REF:', submittedAnswerRef.current);

        // Use REF value (synchronously captured at submission) instead of state (which may not have updated yet)
        // This bypasses React's async state batching to ensure the answer is available immediately
        const cachedSubmittedAnswer = submittedAnswerRef.current ?? submittedAnswer;
        const cachedQuestionType = currentQuestion?.type;
        const cachedCurrentQuestion = { ...currentQuestion };

        setAnswerRevealed(true);
        setCorrectAnswer(revealedCorrectAnswer);
        if (message.data?.selectedAnswers) {
          setSelectedAnswers(message.data.selectedAnswers);
        }
        setCurrentQuestion((prev: any) => ({
          ...prev,
          revealed: true,
          revealedAnswer: revealedCorrectAnswer,
        }));

        // Determine if player's answer is correct using CACHED values
        // This ensures we use the values from submission, not potentially cleared state
        try {
          console.log('[Player] 📢 Calling determineAnswerCorrectness with CACHED values:', {
            submittedAnswer: cachedSubmittedAnswer,
            revealedCorrectAnswer: revealedCorrectAnswer,
            questionType: cachedQuestionType,
            questionTypeDebug: {
              raw: cachedQuestionType,
              normalized: cachedQuestionType?.toLowerCase()
            }
          });

          const isCorrect = determineAnswerCorrectness(
            cachedSubmittedAnswer,
            revealedCorrectAnswer,
            cachedQuestionType
          );
          console.log('[Player] ✅ Answer correctness result:', isCorrect, 'submitted:', cachedSubmittedAnswer, 'correct:', revealedCorrectAnswer, 'cached question type:', cachedQuestionType);
          setShowAnswerFeedback(true);
          setIsAnswerCorrect(isCorrect);
        } catch (err) {
          console.error('[Player] ❌ Error determining answer correctness:', err);
        }
        break;
      case 'NEXT':
        console.log('[Player] NEXT message received - clearing all question state immediately');
        setCurrentQuestion(null);
        setGoWideEnabled(false);
        setAnswerRevealed(false);
        setCorrectAnswer(undefined);
        setSelectedAnswers([]);
        setShowTimer(false);
        setShowFastestTeam(false);
        setFastestTeamName('');
        setFastestTeamPhoto(null);
        setShowAnswerFeedback(false);
        setIsAnswerCorrect(undefined);
        setSubmittedAnswer(null);
        submittedAnswerRef.current = null;

        // Cancel fastest team timer if running
        if (fastestTeamTimerRef.current) {
          clearTimeout(fastestTeamTimerRef.current);
          fastestTeamTimerRef.current = null;
        }

        // Show keypad with blank question area immediately
        setCurrentScreen('ready-for-question');

        // Cancel any existing display mode timer
        if (displayModeTimerRef.current) {
          clearTimeout(displayModeTimerRef.current);
          displayModeTimerRef.current = null;
        }
        break;
      case 'PICTURE':
        setCurrentScreen('display');
        setShowAnswerFeedback(false);
        setIsAnswerCorrect(undefined);
        if (message.data?.image) {
          setCurrentQuestion((prev: any) => ({
            ...prev,
            imageUrl: message.data.image,
          }));
        }
        break;
      case 'DISPLAY_MODE':
      case 'DISPLAY_UPDATE':
        try {
          console.log('[Player] Received DISPLAY_MODE/UPDATE:', message);

          // Don't switch away from question/ready-for-question screens during active game
          // This prevents display modes (BASIC/SCORES/SLIDESHOW) from interrupting the question interface
          const isInGameScreen = currentScreen === 'question' || currentScreen === 'ready-for-question';
          if (isInGameScreen) {
            console.log('[Player] ⚠️  Ignoring DISPLAY_MODE message - question/input screen is currently active, deferring display mode change');
            break;
          }

          // Clear answer feedback when switching display modes
          setShowAnswerFeedback(false);
          setIsAnswerCorrect(undefined);

          if (message.data?.mode) {
            try {
              const newMode = message.data.mode;
              const transitionDelay = message.data?.displayTransitionDelay || 0;
              console.log('[Player] Setting display mode to:', newMode, 'with transition delay:', transitionDelay, 'ms');

              // Clear state for modes being exited to prevent stale state interference
              if (newMode !== 'slideshow') {
                console.log('[Player] Clearing slideshow state (exiting slideshow mode)');
                setSlideshowImages([]);
                setRotationInterval(10000);
              }

              if (newMode !== 'scores') {
                console.log('[Player] Clearing scores state (exiting scores mode)');
                setLeaderboardScores([]);
              }

              // Update display mode state immediately
              console.log('[Player] Updating display mode state immediately to:', newMode);
              setDisplayMode(newMode);

              // Populate mode-specific data immediately
              if (newMode === 'slideshow' && message.data.images) {
                console.log('[Player] Setting slideshow images:', message.data.images.length);
                setSlideshowImages(message.data.images);
                if (message.data.rotationInterval) {
                  setRotationInterval(message.data.rotationInterval);
                }
              } else if (newMode === 'slideshow') {
                console.warn('[Player] ⚠️  Slideshow mode but no images data');
              }

              if (newMode === 'scores' && message.data.scores) {
                console.log('[Player] Setting leaderboard scores:', message.data.scores);
                setLeaderboardScores(message.data.scores);
              } else if (newMode === 'scores' && !message.data.scores) {
                console.warn('[Player] ⚠️  Scores mode but no scores data:', message.data);
                setLeaderboardScores([]); // Clear scores if none provided
              }

              if (newMode === 'basic') {
                console.log('[Player] Switching to basic display mode');
              }

              // Delay the visual screen transition based on host's directive
              if (transitionDelay > 0) {
                console.log('[Player] Delaying screen transition for', transitionDelay, 'ms (preventing immediate team visibility)');
                // Clear any existing timer before setting new one
                if (displayModeTimerRef.current) {
                  clearTimeout(displayModeTimerRef.current);
                }
                const transitionTimer = setTimeout(() => {
                  try {
                    console.log('[Player] Screen transition delay complete, updating display');
                    setCurrentScreen('display');
                  } catch (transitionErr) {
                    console.error('❌ [Player] Error during screen transition:', transitionErr);
                  }
                }, transitionDelay);

                // Store timer in ref so QUESTION handler can cancel it
                displayModeTimerRef.current = transitionTimer;
              } else {
                console.log('[Player] No transition delay, updating display immediately');
                setCurrentScreen('display');
              }
            } catch (modeErr) {
              console.error('❌ [Player] Error processing mode change:', modeErr);
              if (modeErr instanceof Error) {
                console.error('[Player] Error stack:', modeErr.stack);
              }
            }
          } else {
            console.warn('[Player] ⚠️  DISPLAY_MODE received but no mode in data:', message.data);
          }
        } catch (displayErr) {
          console.error('❌ [Player] Error in DISPLAY_MODE/UPDATE handler:', displayErr);
          if (displayErr instanceof Error) {
            console.error('[Player] Error stack:', displayErr.stack);
          }
        }
        break;
      case 'LEADERBOARD_UPDATE':
        if (message.data?.scores) {
          setLeaderboardScores(message.data.scores);
        }
        break;
      case 'SLIDESHOW_UPDATE':
        if (message.data?.images) {
          setSlideshowImages(message.data.images);
          if (message.data.rotationInterval) {
            setRotationInterval(message.data.rotationInterval);
          }
        }
        break;
      case 'FASTEST':
        try {
          console.log('[Player] FASTEST message received:', message.data);
          const { teamName, teamPhoto } = message.data || {};
          if (teamName) {
            setFastestTeamName(teamName);
            setFastestTeamPhoto(teamPhoto || null);
            setShowFastestTeam(true);
            console.log('[Player] Showing fastest team:', teamName);
          } else {
            console.warn('[Player] ⚠️  FASTEST message received but no teamName in data');
          }
        } catch (fastestErr) {
          console.error('❌ [Player] Error in FASTEST handler:', fastestErr);
        }
        break;
      case 'AUTO_DISABLE_GO_WIDE':
        console.log('[Player] AUTO_DISABLE_GO_WIDE message received:', message.data?.disabled);
        setGoWideEnabled(!message.data?.disabled);
        break;
      case 'SCORE_UPDATE':
        console.log('[Player] SCORE_UPDATE message received:', message.data);
        // Score updates are handled on display side, just log here
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
      const joinPayload: any = {
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName: name,
        timestamp: Date.now(),
      };

      // Include team photo if available
      if (settings.teamPhoto) {
        joinPayload.teamPhoto = settings.teamPhoto;
      }

      wsRef.current.send(JSON.stringify(joinPayload));
    }
  };

  const handleAnswerSubmit = (answer: any) => {
    // Store answer in BOTH state (for UI updates) AND ref (for immediate access in REVEAL handler)
    // The ref ensures answer is available synchronously when REVEAL arrives, bypassing React's async state updates
    submittedAnswerRef.current = answer;
    console.log('[Player] Answer submitted - stored in ref:', answer);
    setSubmittedAnswer(answer);

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
    <NetworkContext.Provider value={{ isConnected, playerId, teamName, playerSettings: settings, goWideEnabled, answerRevealed, correctAnswer, selectedAnswers, showAnswerFeedback, isAnswerCorrect }}>
      <div className="h-screen w-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
        <div className="flex-1 overflow-hidden">
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

          {isConnected && currentScreen === 'ready-for-question' && (
            <QuestionDisplay
              question={undefined}
              timeRemaining={timeRemaining}
              showTimer={showTimer}
              totalTimerLength={totalTimerLength}
              onAnswerSubmit={handleAnswerSubmit}
            />
          )}

          {isConnected && currentScreen === 'question' && currentQuestion && (
            <>
              <QuestionDisplay
                question={currentQuestion}
                timeRemaining={timeRemaining}
                showTimer={showTimer}
                totalTimerLength={totalTimerLength}
                onAnswerSubmit={handleAnswerSubmit}
              />
              {showFastestTeam && (
                <FastestTeamOverlay
                  teamName={fastestTeamName}
                  teamPhoto={fastestTeamPhoto}
                />
              )}
            </>
          )}
        </div>

        {/* Settings bar always visible when connected */}
        {isConnected && currentScreen !== 'team-entry' && (
          <SettingsBar />
        )}
      </div>
    </NetworkContext.Provider>
  );
}
