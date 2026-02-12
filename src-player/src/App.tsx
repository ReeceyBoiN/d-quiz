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
  const [timerEnded, setTimerEnded] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const displayModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastestTeamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerLockDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track 1-second delay before locking inputs
  const approvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track approval screen transition timer
  const submittedAnswerRef = useRef<any>(null); // Store answer in ref for immediate access, bypassing async state updates
  const timerStartTimeRef = useRef<number | null>(null); // Store timer start time from host for accurate response time calculation

  // Visibility and focus detection refs (declared at top level to comply with React hooks rules)
  const visibilityStateRef = useRef<{ isVisible: boolean; isFocused: boolean }>({
    isVisible: !document.hidden,
    isFocused: document.hasFocus(),
  });
  const lastSentStateRef = useRef<{ away: boolean; timestamp: number } | null>(null);
  const messageQueueRef = useRef<Array<{ away: boolean; reason: string }>>([]);
  const visibilityDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cleanup timer lock delay on component unmount
  useEffect(() => {
    return () => {
      if (timerLockDelayRef.current) {
        clearTimeout(timerLockDelayRef.current);
        timerLockDelayRef.current = null;
      }
    };
  }, []);

  // Cleanup approval timer on component unmount
  useEffect(() => {
    return () => {
      if (approvalTimerRef.current) {
        clearTimeout(approvalTimerRef.current);
        approvalTimerRef.current = null;
      }
    };
  }, []);

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

  // Clear any pending timer lock delay timeout
  const clearTimerLockDelay = useCallback(() => {
    if (timerLockDelayRef.current) {
      clearTimeout(timerLockDelayRef.current);
      timerLockDelayRef.current = null;
      console.log('[Player] Cleared pending timer lock delay');
    }
  }, []);

  const handleMessage = useCallback((message: HostMessage) => {
    console.log('[handleMessage] Callback executed');
    console.log('[handleMessage] - Current teamName:', teamName);
    console.log('[handleMessage] - Current isApproved:', isApproved);
    switch (message.type) {
      case 'TEAM_APPROVED':
        try {
          console.log('[Player] 🎉🎉🎉 TEAM_APPROVED HANDLER ENTERED 🎉🎉🎉');
          console.log('[Player] - Current teamName state:', teamName);
          console.log('[Player] - Current isApproved state:', isApproved);
          console.log('[Player] - Message object:', JSON.stringify(message).substring(0, 200));
          console.log('[Player] - message.data:', message.data);
          console.log('[Player] - displayData:', message.data?.displayData);

          console.log('[Player] 🔄 About to call setIsApproved(true)');
          setIsApproved(true);
          console.log('[Player] ✅ setIsApproved(true) called successfully (state update queued)');
          // Cache team name for recovery on page refresh
          if (teamName) {
            localStorage.setItem('popquiz_last_team_name', teamName);
            console.log('[Player] Cached team name for recovery:', teamName);
          }

          // Check if there's a current game state (late joiner sync)
          const displayData = message.data?.displayData;
          console.log('[Player] 📊 displayData received:', displayData ? 'YES' : 'NO');
          const currentGameState = displayData?.currentGameState;
          console.log('[Player] 🎮 currentGameState received:', currentGameState ? 'YES' : 'NO');
          console.log('[Player] ❓ currentQuestion in currentGameState:', currentGameState?.currentQuestion ? 'YES' : 'NO');

          if (currentGameState?.currentQuestion) {
            // Late joiner - show current question immediately
            console.log('[Player] 🚀 Late joiner: Showing current question immediately');

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
            console.log('[Player] ✅ Normal approval flow: Showing approval screen for team:', teamName);
            console.log('[Player] 🔄 About to call setCurrentScreen("approval")');
            setCurrentScreen('approval');
            console.log('[Player] ✅ setCurrentScreen("approval") called (state update queued)');

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

            // Clear any existing approval timer
            if (approvalTimerRef.current) {
              clearTimeout(approvalTimerRef.current);
              console.log('[Player] 🧹 Cleared existing approval timer');
            }

            // Set new approval screen transition timer
            console.log('[Player] ⏱️  Setting 2-second timer to transition from approval screen to display');
            approvalTimerRef.current = setTimeout(() => {
              try {
                console.log('[Player] ✅ 2-second approval timer FIRED - transitioning to display screen');
                console.log('[Player] 🔄 About to call setCurrentScreen("display")');
                setCurrentScreen('display');
                console.log('[Player] ✅ setCurrentScreen("display") called (state update queued)');
                approvalTimerRef.current = null;
              } catch (screenErr) {
                console.error('❌ [Player] Error during approval screen transition:', screenErr);
              }
            }, 2000);

            console.log('[Player] ✅ 2-second timer scheduled successfully for approval screen transition');
          }
        } catch (approvalErr) {
          console.error('❌ [Player] ERROR in TEAM_APPROVED handler:', approvalErr);
          console.error('[Player] Error type:', approvalErr instanceof Error ? 'Error object' : typeof approvalErr);
          if (approvalErr instanceof Error) {
            console.error('[Player] Error message:', approvalErr.message);
            console.error('[Player] Error stack:', approvalErr.stack);
          }
          throw approvalErr;
        }
        break;
      case 'APPROVAL_PENDING':
        setCurrentScreen('approval');
        break;
      case 'TEAM_DECLINED':
        setIsApproved(false);
        // Clear cached team name so user can try a different name if needed
        localStorage.removeItem('popquiz_last_team_name');
        setCurrentScreen('declined');
        break;
      case 'QUESTION':
        // Cancel any pending display mode timer when question arrives
        if (displayModeTimerRef.current) {
          clearTimeout(displayModeTimerRef.current);
          displayModeTimerRef.current = null;
          console.log('[Player] Cancelled display mode timer - question arrived');
        }

        // Clear any pending timer lock delay when new question arrives
        clearTimerLockDelay();

        // Clear previous timer start time for new question
        timerStartTimeRef.current = null;

        // Reset timer ended state for new question
        setTimerEnded(false);

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

        setCurrentQuestion((prev) => ({
          ...normalizedQuestionData,
          imageUrl: normalizedQuestionData.imageUrl ?? prev?.imageUrl
        }));
        // Transition to 'question' screen regardless of current screen state
        setCurrentScreen('question');
        break;
      case 'TIMER_START':
        // Clear any pending timer lock delay when new timer starts
        clearTimerLockDelay();

        const timerDuration = message.data?.seconds || 30;
        // Store the timer start time from host for accurate response time calculation
        // This ensures player and host use the same reference point
        const hostTimerStartTime = message.data?.timerStartTime;
        if (hostTimerStartTime) {
          timerStartTimeRef.current = hostTimerStartTime;
          console.log('[Player] Timer start received with host timestamp:', hostTimerStartTime, 'current device time:', Date.now(), 'diff:', Date.now() - hostTimerStartTime);
        }
        setTotalTimerLength(timerDuration);
        setTimeRemaining(timerDuration);
        setShowTimer(true);
        break;
      case 'TIMER':
        setTimeRemaining(message.data?.seconds || 0);
        break;
      case 'TIMEUP':
        setShowTimer(false);
        // Clear any existing timeout and set new delayed lock (1 second grace period for latency)
        clearTimerLockDelay();
        setCurrentQuestion((prev) => ({
          ...prev,
          imageUrl: undefined,  // Clear image when timer ends
        }));
        timerLockDelayRef.current = setTimeout(() => {
          console.log('[Player] Timer lock delay complete, disabling inputs');
          setTimerEnded(true);
        }, 1000);
        break;
      case 'LOCK':
        // Explicit lock handler for robustness - ensures timer is locked even if only LOCK is sent
        setShowTimer(false);
        // Clear any existing timeout and set new delayed lock (1 second grace period for latency)
        clearTimerLockDelay();
        timerLockDelayRef.current = setTimeout(() => {
          console.log('[Player] Lock delay complete, disabling inputs');
          setTimerEnded(true);
        }, 1000);
        break;
      case 'REVEAL':
        // Clear any pending timer lock delay when answer is revealed
        clearTimerLockDelay();

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
        // Clear any pending timer lock delay when moving to next question
        clearTimerLockDelay();

        setCurrentQuestion(null);
        setGoWideEnabled(false);
        setAnswerRevealed(false);
        setCorrectAnswer(undefined);
        setSelectedAnswers([]);
        setShowTimer(false);
        setTimerEnded(false);
        setShowFastestTeam(false);
        setFastestTeamName('');
        setFastestTeamPhoto(null);
        setShowAnswerFeedback(false);
        setIsAnswerCorrect(undefined);
        setSubmittedAnswer(null);
        submittedAnswerRef.current = null;
        timerStartTimeRef.current = null; // Clear stale timer reference to prevent using previous question's timestamp

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
        setCurrentScreen('question');
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
  }, [teamName, currentQuestion, currentScreen, submittedAnswer, displayMode, clearTimerLockDelay]);

  const { isConnected, error } = useNetworkConnection({
    playerId,
    onConnect: handleConnect,
    onMessage: handleMessage,
  });

  // Auto-rejoin when WS reconnects if team is still approved and has a name
  // Only triggers during true reconnection, NOT during initial team entry
  useEffect(() => {
    if (
      isConnected &&
      isApproved &&
      teamName &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      currentScreen !== 'team-entry' &&
      currentScreen !== 'declined'
    ) {
      // App still has team info in memory - auto-rejoin without re-entering name
      console.log(`[Player] Auto-rejoin: Device ${deviceId} reconnecting as "${teamName}"`);
      const rejoinPayload: any = {
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName,
        timestamp: Date.now(),
      };

      if (settings.teamPhoto) {
        rejoinPayload.teamPhoto = settings.teamPhoto;
        console.log('[App] Auto-rejoin PLAYER_JOIN payload includes teamPhoto: true, Length:', rejoinPayload.teamPhoto.length, 'bytes');
        console.log('[App] Team photo prefix (first 100 chars):', rejoinPayload.teamPhoto.substring(0, 100));
      } else {
        console.log('[App] Auto-rejoin PLAYER_JOIN payload includes teamPhoto: false');
      }

      console.log('[App] Auto-rejoin: Sending PLAYER_JOIN payload with fields:', Object.keys(rejoinPayload).join(', '));
      wsRef.current.send(JSON.stringify(rejoinPayload));
    }
  }, [isConnected, isApproved, teamName, deviceId, playerId, settings, currentScreen]);

  // Player visibility/focus detection - detect when player switches tabs, minimizes window, etc
  useEffect(() => {
    if (!isConnected || !isApproved || !teamName) {
      console.log('[Player] Visibility detection not active - isConnected:', isConnected, 'isApproved:', isApproved, 'teamName:', teamName);
      return;
    }

    // Using refs declared at component level to comply with React hooks rules
    const MESSAGE_COALESCE_INTERVAL = 500; // Minimum 500ms between same-state messages

    const sendVisibilityMessage = (away: boolean, reason: string, isRetry: boolean = false) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[Player] Cannot send visibility message - WebSocket not open, queuing message');
        // Add to queue if not already there
        if (!messageQueueRef.current.some(m => m.away === away)) {
          messageQueueRef.current.push({ away, reason });
          console.log('[Player] Message queued. Queue size:', messageQueueRef.current.length);
        }
        return;
      }

      // Check if we should send based on state coalescing
      const now = Date.now();
      const lastSent = lastSentStateRef.current;

      // Skip if we're trying to send the same state and not enough time has passed
      if (
        !isRetry &&
        lastSent &&
        lastSent.away === away &&
        (now - lastSent.timestamp) < MESSAGE_COALESCE_INTERVAL
      ) {
        console.log('[Player] Skipping duplicate message - same state sent', (now - lastSent.timestamp), 'ms ago');
        return;
      }

      const messageType = away ? 'PLAYER_AWAY' : 'PLAYER_ACTIVE';
      const message = {
        type: messageType,
        deviceId,
        playerId,
        teamName,
        reason,
        timestamp: now,
      };

      try {
        wsRef.current!.send(JSON.stringify(message));
        console.log(`[Player] 📡 Sending ${messageType}: ${reason} (${isRetry ? 'RETRY' : 'INITIAL'})`);

        // Update last sent state
        lastSentStateRef.current = { away, timestamp: now };

        // Clear queue on successful send
        if (isRetry && messageQueueRef.current.length > 0) {
          messageQueueRef.current = [];
          console.log('[Player] Queue cleared after successful retry');
        }
      } catch (err) {
        console.error('[Player] Error sending visibility message:', err);
        // Add to queue on error
        if (!messageQueueRef.current.some(m => m.away === away)) {
          messageQueueRef.current.push({ away, reason });
          console.log('[Player] Message queued due to send error. Queue size:', messageQueueRef.current.length);
        }
      }
    };

    // Process any queued messages (called on reconnect or when WS opens)
    const processMessageQueue = () => {
      if (messageQueueRef.current.length === 0) return;

      console.log('[Player] Processing queued visibility messages, count:', messageQueueRef.current.length);
      const queue = [...messageQueueRef.current];
      messageQueueRef.current = [];

      // Send the most recent state from the queue
      const lastMessage = queue[queue.length - 1];
      if (lastMessage) {
        sendVisibilityMessage(lastMessage.away, lastMessage.reason, true);
      }
    };

    // Handle visibility change (tab hidden/visible)
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      visibilityStateRef.current.isVisible = isVisible;

      const reason = isVisible ? 'tab_visible' : 'tab_hidden';
      console.log(`[Player Visibility] Tab ${isVisible ? 'VISIBLE' : 'HIDDEN'} | Event: visibilitychange | Timestamp: ${Date.now()}`);

      // Clear any pending visibility debounce timer
      if (visibilityDebounceTimerRef.current) {
        clearTimeout(visibilityDebounceTimerRef.current);
      }

      // Debounce visibility changes (100ms to coalesce rapid visibility changes)
      visibilityDebounceTimerRef.current = setTimeout(() => {
        // Send message based on visibility AND focus state
        // Player is away if tab is hidden OR window is not focused
        const isAway = !isVisible || !visibilityStateRef.current.isFocused;
        sendVisibilityMessage(isAway, reason);
      }, 100);
    };

    // Handle focus events with debouncing
    const handleFocus = () => {
      visibilityStateRef.current.isFocused = true;

      // Clear any pending focus debounce timer
      if (focusDebounceTimerRef.current) {
        clearTimeout(focusDebounceTimerRef.current);
      }

      console.log(`[Player Visibility] Window FOCUSED | Event: focus | Timestamp: ${Date.now()}`);

      // Debounce: wait 100ms to ensure focus is stable
      focusDebounceTimerRef.current = setTimeout(() => {
        // Only send PLAYER_ACTIVE if tab is also visible
        if (visibilityStateRef.current.isVisible) {
          console.log('[Player Visibility] Focus debounce complete - sending PLAYER_ACTIVE');
          sendVisibilityMessage(false, 'focus_gained');
        }
      }, 100);
    };

    const handleBlur = () => {
      visibilityStateRef.current.isFocused = false;

      // Clear any pending focus debounce timer
      if (focusDebounceTimerRef.current) {
        clearTimeout(focusDebounceTimerRef.current);
      }

      console.log(`[Player Visibility] Window BLURRED | Event: blur | Timestamp: ${Date.now()}`);

      // Debounce: wait 100ms to handle rapid focus/blur events
      focusDebounceTimerRef.current = setTimeout(() => {
        console.log('[Player Visibility] Blur debounce complete - sending PLAYER_AWAY');
        sendVisibilityMessage(true, 'focus_lost');
      }, 100);
    };

    // Attach event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    console.log('[Player] Visibility/focus detection activated');

    // Attempt to process any queued messages (in case we're reconnecting)
    processMessageQueue();

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);

      // Clear any pending debounce timers
      if (visibilityDebounceTimerRef.current) {
        clearTimeout(visibilityDebounceTimerRef.current);
      }
      if (focusDebounceTimerRef.current) {
        clearTimeout(focusDebounceTimerRef.current);
      }

      console.log('[Player] Visibility/focus detection deactivated');
    };
  }, [isConnected, isApproved, teamName, deviceId, playerId]);


  const handleTeamNameSubmit = (name: string) => {
    console.log('[App] handleTeamNameSubmit called with name:', name);
    console.log('[App] Current settings object:', settings);
    console.log('[App] settings.teamPhoto exists:', !!settings.teamPhoto);
    console.log('[App] settings.teamPhoto type:', typeof settings.teamPhoto);
    console.log('[App] settings.teamPhoto length:', settings.teamPhoto?.length);
    console.log('[App] Full settings state at submission:', JSON.stringify({
      teamPhoto: settings.teamPhoto ? `<base64 data: ${settings.teamPhoto.length} bytes>` : null,
      buzzerSound: settings.buzzerSound,
      theme: settings.theme,
      keypadColor: settings.keypadColor,
    }));

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
        console.log('[App] ✅ PLAYER_JOIN payload includes teamPhoto: true, Length:', joinPayload.teamPhoto.length, 'bytes');
        console.log('[App] Team photo prefix (first 100 chars):', joinPayload.teamPhoto.substring(0, 100));
      } else {
        console.log('[App] ❌ PLAYER_JOIN payload includes teamPhoto: false');
      }

      console.log('[App] Sending PLAYER_JOIN payload with fields:', Object.keys(joinPayload).join(', '));
      console.log('[App] Full payload:', joinPayload);
      wsRef.current.send(JSON.stringify(joinPayload));
    } else {
      console.log('[App] ❌ WebSocket not ready, readyState:', wsRef.current?.readyState);
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
      // Note: Host will use the received timerStartTime to calculate accurate response times
      // Response time = submission timestamp - host timerStartTime
      if (timerStartTimeRef.current) {
        const responseTime = Date.now() - timerStartTimeRef.current;
        console.log('[Player] Answer submitted after', (responseTime / 1000).toFixed(2), 'seconds from timer start');
      }
    }
  };

  const sendMessage = (message: any) => {
    const wsState = wsRef.current?.readyState;
    const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    const stateName = stateNames[wsState] || 'UNKNOWN';

    console.log(`[App] sendMessage called - WebSocket state: ${wsState} (${stateName}), Message type: ${message.type}`);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[App] ✅ WebSocket OPEN - Sending message:', message.type);
      console.log('[App] - bufferedAmount:', wsRef.current.bufferedAmount);
      wsRef.current.send(JSON.stringify(message));
      console.log('[App] - Message sent successfully');
    } else {
      console.warn('[App] ❌ Cannot send message - WebSocket not OPEN');
      console.warn('[App] - ReadyState:', wsState, `(${stateName})`);
      console.warn('[App] - wsRef.current exists:', !!wsRef.current);
      if (wsRef.current) {
        console.warn('[App] - bufferedAmount:', wsRef.current.bufferedAmount);
      }
    }
  };

  return (
    <NetworkContext.Provider value={{ isConnected, playerId, deviceId, teamName, playerSettings: settings, goWideEnabled, answerRevealed, correctAnswer, selectedAnswers, showAnswerFeedback, isAnswerCorrect, sendMessage }}>
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

          {isConnected && playerSettingsLoaded && currentScreen === 'team-entry' && (
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
              question={null}
              timeRemaining={timeRemaining}
              showTimer={showTimer}
              totalTimerLength={totalTimerLength}
              timerEnded={timerEnded}
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
                timerEnded={timerEnded}
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
