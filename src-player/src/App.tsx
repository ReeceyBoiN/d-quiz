import { useState, useEffect, useRef, useCallback } from 'react';
import { TeamNameEntry } from './components/TeamNameEntry';
import { BuzzerSelectionModal } from './components/BuzzerSelectionModal';
import { QuestionDisplay } from './components/QuestionDisplay';
import { WaitingScreen } from './components/WaitingScreen';
import { PinEntryScreen } from './components/PinEntryScreen';
import { PlayerDisplayManager } from './components/PlayerDisplayManager';
import { SettingsBar } from './components/SettingsBar';
import { FastestTeamOverlay } from './components/FastestTeamOverlay';
import { HostTerminal } from './components/HostTerminal';
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

interface PendingApprovalData {
  displayMode: DisplayMode;
  slideshowImages: SlideshowImage[];
  rotationInterval: number;
  leaderboardScores: LeaderboardEntry[];
}

interface PendingMessage {
  type: string;
  data: any;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'team-entry' | 'buzzer-selection' | 'waiting' | 'approval' | 'declined' | 'question' | 'ready-for-question' | 'display' | 'host-terminal' | 'pin-entry'>('team-entry');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAccepted, setPinAccepted] = useState(false);
  const [selectedBuzzers, setSelectedBuzzers] = useState<Record<string, string>>({}); // deviceId -> buzzerSound mapping (other players)
  const [confirmedBuzzer, setConfirmedBuzzer] = useState<string | null>(null); // Current player's confirmed buzzer
  const [teamName, setTeamName] = useState('');
  const [playerId] = useState(() => `player-${Math.random().toString(36).slice(2, 9)}`);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [pendingApprovalData, setPendingApprovalData] = useState<PendingApprovalData | null>(null);
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);
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
  const [pendingDisplayMode, setPendingDisplayMode] = useState<any | null>(null);
  const [fastestTeamName, setFastestTeamName] = useState<string>('');
  const [fastestTeamPhoto, setFastestTeamPhoto] = useState<string | null>(null);
  const [fastestTeamGuess, setFastestTeamGuess] = useState<number | undefined>();
  const [fastestTeamDifference, setFastestTeamDifference] = useState<number | undefined>();
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | undefined>();
  const [submittedAnswer, setSubmittedAnswer] = useState<any>(null);
  const [timerEnded, setTimerEnded] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isKeypadScrambled, setIsKeypadScrambled] = useState(false);
  const [isHostController, setIsHostController] = useState(false); // Track if player is authenticated as host controller
  const [controllerAuthError, setControllerAuthError] = useState<string | null>(null); // Track controller auth failures
  const [flowState, setFlowState] = useState<{
    flow: string;
    isQuestionMode: boolean;
    totalTime?: number; // Settings-based timer duration from host
    currentQuestion?: any;
    currentLoadedQuestionIndex?: number;
    loadedQuizQuestions?: any[];
    isQuizPackMode?: boolean;
    selectedQuestionType?: 'letters' | 'numbers' | 'multiple-choice';
    answerSubmitted?: string;
    keypadCurrentScreen?: string; // Current screen in KeypadInterface (config, question-types, etc.)
  } | null>(null); // Track flow state for host controller

  const wsRef = useRef<WebSocket | null>(null);
  const displayModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastestTeamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerLockDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track 1-second delay before locking inputs
  const approvalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track approval screen transition timer
  const submittedAnswerRef = useRef<any>(null); // Store answer in ref for immediate access, bypassing async state updates
  const timerStartTimeRef = useRef<number | null>(null); // Store timer start time from host for accurate response time calculation
  const idleExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Grace-period exit when host is idle

  const IDLE_EXIT_GRACE_MS = 7000;

  // Visibility and focus detection refs (declared at top level to comply with React hooks rules)
  const visibilityStateRef = useRef<{ isVisible: boolean; isFocused: boolean }>({
    isVisible: !document.hidden,
    isFocused: document.hasFocus(),
  });
  const lastSentStateRef = useRef<{ away: boolean; timestamp: number } | null>(null);
  const messageQueueRef = useRef<Array<{ away: boolean; reason: string }>>([]);
  const visibilityDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { settings, isLoaded: playerSettingsLoaded, updateBuzzerSound } = usePlayerSettings();

  // Helper function to determine if we should ignore screen transitions during buzzer selection or pin entry
  const shouldIgnoreScreenTransition = useCallback((messageType: string, currentScreenState: string): boolean => {
    const shouldIgnore = currentScreenState === 'buzzer-selection' || currentScreenState === 'pin-entry';
    if (shouldIgnore) {
      console.log(`[Player] ⏸️  Deferring ${messageType} during ${currentScreenState}`);
    }
    return shouldIgnore;
  }, []);

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
        setFastestTeamGuess(undefined);
        setFastestTeamDifference(undefined);
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

  // Cleanup idle exit timer on component unmount
  useEffect(() => {
    return () => {
      if (idleExitTimeoutRef.current) {
        clearTimeout(idleExitTimeoutRef.current);
        idleExitTimeoutRef.current = null;
      }
    };
  }, []);

  // Clear stale PIN state when leaving pin-entry screen
  useEffect(() => {
    if (currentScreen !== 'pin-entry') {
      setPinError('');
      setPinAccepted(false);
    }
  }, [currentScreen]);

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

  const clearIdleExitTimeout = useCallback((reason: string) => {
    if (idleExitTimeoutRef.current) {
      clearTimeout(idleExitTimeoutRef.current);
      idleExitTimeoutRef.current = null;
      console.log(`[Player] Cleared idle exit timer (${reason})`);
    }
  }, []);

  const applyDisplayModeUpdate = useCallback((data: any, source: string): boolean => {
    if (isHostController) {
      console.log(`[Player] 🔐 Skipping ${source} display mode transition - authenticated host controller must stay on terminal interface`);
      return false;
    }

    if (!data?.mode) {
      console.warn(`[Player] ⚠️  DISPLAY_MODE received from ${source} but no mode in data:`, data);
      return false;
    }

    // Clear answer feedback when switching display modes
    setShowAnswerFeedback(false);
    setIsAnswerCorrect(undefined);

    const newMode = data.mode;
    const transitionDelay = data?.displayTransitionDelay || 0;
    console.log('[Player] Applying display mode update from', source, 'to:', newMode, 'with transition delay:', transitionDelay, 'ms');

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
    if (newMode === 'slideshow' && data.images) {
      console.log('[Player] Setting slideshow images:', data.images.length);
      setSlideshowImages(data.images);
      if (data.rotationInterval) {
        setRotationInterval(data.rotationInterval);
      }
    } else if (newMode === 'slideshow') {
      console.warn('[Player] ⚠️  Slideshow mode but no images data');
    }

    if (newMode === 'scores' && data.scores) {
      console.log('[Player] Setting leaderboard scores:', data.scores);
      setLeaderboardScores(data.scores);
    } else if (newMode === 'scores' && !data.scores) {
      console.warn('[Player] ⚠️  Scores mode but no scores data:', data);
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
      return true;
    }

    console.log('[Player] No transition delay, updating display immediately');
    setCurrentScreen('display');
    return true;
  }, [isHostController]);

  const applyPendingDisplayMode = useCallback((source: string) => {
    if (!pendingDisplayMode) {
      return false;
    }

    console.log(`[Player] Applying pending DISPLAY_MODE update after ${source}`);
    const applied = applyDisplayModeUpdate(pendingDisplayMode, source);
    if (applied) {
      setPendingDisplayMode(null);
    }
    return applied;
  }, [applyDisplayModeUpdate, pendingDisplayMode]);

  const resetQuestionState = useCallback(() => {
    console.log('[Player] Resetting question state');
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
    setFastestTeamGuess(undefined);
    setFastestTeamDifference(undefined);
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

    // Cancel any existing display mode timer
    if (displayModeTimerRef.current) {
      clearTimeout(displayModeTimerRef.current);
      displayModeTimerRef.current = null;
    }
  }, [clearTimerLockDelay]);

  const transitionToIdleDisplay = useCallback((source: string) => {
    if (isHostController) {
      console.log(`[Player] 🔐 Skipping ${source} transition - authenticated host controller must stay on terminal interface`);
      return;
    }
    setCurrentScreen('display');
  }, [isHostController]);

  const scheduleIdleExit = useCallback((source: string) => {
    if (isHostController) {
      console.log(`[Player] 🔐 Skipping idle exit scheduling from ${source} - authenticated host controller must stay on terminal interface`);
      return;
    }

    if (idleExitTimeoutRef.current) {
      clearTimeout(idleExitTimeoutRef.current);
    }

    console.log(`[Player] Host idle detected - scheduling idle exit in ${IDLE_EXIT_GRACE_MS} ms (${source})`);
    idleExitTimeoutRef.current = setTimeout(() => {
      console.log('[Player] Idle grace period elapsed - exiting question view');
      resetQuestionState();
      if (!applyPendingDisplayMode('IDLE_TIMEOUT')) {
        transitionToIdleDisplay('IDLE_TIMEOUT');
      }
    }, IDLE_EXIT_GRACE_MS);
  }, [applyPendingDisplayMode, isHostController, resetQuestionState, transitionToIdleDisplay]);

  const applyFlowStateUpdate = useCallback((data: any, source: string) => {
    try {
      const flow = data?.flow;
      const resolvedQuestionMode = data?.isQuestionMode ?? (flow === 'idle' ? false : undefined);

      if (flow !== undefined && resolvedQuestionMode !== undefined) {
        console.log('[Player] ✅ FLOW_STATE conditions met, updating local state');
        setFlowState({
          flow,
          isQuestionMode: resolvedQuestionMode,
          totalTime: data?.totalTime,
          currentQuestion: data?.currentQuestion,
          currentLoadedQuestionIndex: data?.currentLoadedQuestionIndex,
          loadedQuizQuestions: data?.loadedQuizQuestions,
          isQuizPackMode: data?.isQuizPackMode,
          selectedQuestionType: data?.selectedQuestionType,
          answerSubmitted: data?.answerSubmitted,
          keypadCurrentScreen: data?.keypadCurrentScreen,
        });
        console.log('[Player] ✨ flowState updated, GameControlsPanel should re-render', {
          flow,
          isQuestionMode: resolvedQuestionMode,
          totalTime: data?.totalTime,
          hasCurrentQuestion: !!data?.currentQuestion,
          loadedQuestionsCount: data?.loadedQuizQuestions?.length,
          isQuizPackMode: data?.isQuizPackMode,
          keypadCurrentScreen: data?.keypadCurrentScreen,
        });

        const isInGameScreen = currentScreen === 'question' || currentScreen === 'ready-for-question';
        if (flow === 'idle') {
          clearIdleExitTimeout(source);
          resetQuestionState();
          if (!applyPendingDisplayMode(`${source}_IDLE`)) {
            transitionToIdleDisplay(`${source}_IDLE`);
          }
        } else {
          clearIdleExitTimeout(source);
          if (!resolvedQuestionMode && isInGameScreen) {
            if (!applyPendingDisplayMode(source)) {
              transitionToIdleDisplay(source);
            }
          }
        }
      } else {
        console.log('[Player] ❌ FLOW_STATE missing required fields', {
          flow: data?.flow,
          isQuestionMode: data?.isQuestionMode,
        });
      }
    } catch (err) {
      console.error('[Player] ❌ Error handling FLOW_STATE:', err);
    }
  }, [applyPendingDisplayMode, clearIdleExitTimeout, currentScreen, resetQuestionState, transitionToIdleDisplay]);

  const handleMessage = useCallback((message: HostMessage) => {

    // Handle PLAYER_BUZZER_SELECT broadcasts from other players
    if ((message.type as any) === 'PLAYER_BUZZER_SELECT') {
      try {
        const buzzerMessage = message as any;
        console.log('[Player] Received PLAYER_BUZZER_SELECT from', buzzerMessage.teamName, ':', buzzerMessage.buzzerSound);
        setSelectedBuzzers((prev) => ({
          ...prev,
          [buzzerMessage.deviceId]: buzzerMessage.buzzerSound,
        }));
      } catch (err) {
        console.error('[Player] Error handling PLAYER_BUZZER_SELECT:', err);
      }
      return;
    }

    switch (message.type) {
      case 'CONTROLLER_AUTH_SUCCESS':
        try {
          // Set controller authentication status
          setIsHostController(true);
          setControllerAuthError(null);

          // Clear any cached team data
          localStorage.removeItem('popquiz_last_team_name');

          // Transition to host terminal screen
          setCurrentScreen('host-terminal');
        } catch (err) {
          console.error('[Player] ❌ Error in CONTROLLER_AUTH_SUCCESS handler:', err);
          setControllerAuthError('Failed to authenticate as host controller');
        }
        break;

      case 'PIN_REQUIRED':
        try {
          setWelcomeMessage(message.data?.message || '');
          setPinError('');
          setCurrentScreen('pin-entry');
        } catch (err) {
          console.error('[Player] Error in PIN_REQUIRED handler:', err);
        }
        break;

      case 'PIN_RESULT':
        try {
          if (message.data?.success) {
            // PIN accepted - stay on pin-entry screen with accepted state
            // TEAM_APPROVED will arrive shortly (auto-approve ~150ms, or when host manually approves)
            // Step 2 in TEAM_APPROVED handler will route from pin-entry → buzzer-selection
            setPinError('');
            setPinAccepted(true);
            console.log('[Player] PIN accepted, waiting for TEAM_APPROVED on pin-entry screen');
          } else {
            setPinError(message.data?.message || 'Incorrect PIN');
          }
        } catch (err) {
          console.error('[Player] Error in PIN_RESULT handler:', err);
        }
        break;

      case 'CONTROLLER_AUTH_FAILED':
        try {
          const errorMsg = message.data?.message || 'Host controller PIN authentication failed';

          // Set error state
          setIsHostController(false);
          setControllerAuthError(errorMsg);

          // Show error and reset to team entry
          setCurrentScreen('team-entry');
          setTeamName('');
        } catch (err) {
          console.error('[Player] ❌ Error in CONTROLLER_AUTH_FAILED handler:', err);
        }
        break;

      case 'TEAM_APPROVED':
        try {
          setIsApproved(true);
          // Cache team name for recovery on page refresh
          if (teamName) {
            localStorage.setItem('popquiz_last_team_name', teamName);
          }

          // Extract welcome message from approval data
          const displayData = message.data?.displayData;
          if (displayData?.welcomeMessage) {
            setWelcomeMessage(displayData.welcomeMessage);
          }

          // Check if there's a current game state (late joiner sync)
          const currentGameState = displayData?.currentGameState;

          // Check if we're currently in buzzer selection or pin-entry screen
          const isInBuzzerSelection = currentScreen === 'buzzer-selection';
          const isInPinEntry = currentScreen === 'pin-entry';

          if (currentGameState?.currentQuestion) {
            // Late joiner - show current question immediately

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
              setTotalTimerLength(currentGameState.timerState.totalTime);
              setTimeRemaining(currentGameState.timerState.timeRemaining);
              setShowTimer(true);
            }
          } else if (isInPinEntry || isInBuzzerSelection) {
            // PIN entry or buzzer selection in progress - save approval data without changing screen
            // If on pin-entry, transition to buzzer-selection so the player can pick their buzzer
            if (isInPinEntry) {
              console.log('[Player] TEAM_APPROVED received during pin-entry, transitioning to buzzer-selection');
              setCurrentScreen('buzzer-selection');
            }

            // Extract and save display mode data
            if (displayData) {
              try {
                const { mode, images, rotationInterval, scores } = displayData;
                const approvalData: PendingApprovalData = {
                  displayMode: mode || 'basic',
                  slideshowImages: images || [],
                  rotationInterval: rotationInterval || 10000,
                  leaderboardScores: scores || [],
                };
                setPendingApprovalData(approvalData);
              } catch (dataErr) {
                console.error('❌ [Player] Error extracting displayData during buzzer selection:', dataErr);
                setPendingApprovalData({
                  displayMode: 'basic',
                  slideshowImages: [],
                  rotationInterval: 10000,
                  leaderboardScores: [],
                });
              }
            } else {
              setPendingApprovalData({
                displayMode: 'basic',
                slideshowImages: [],
                rotationInterval: 10000,
                leaderboardScores: [],
              });
            }

            // Don't change screen - stay in buzzer-selection to let user select
          } else {
            // Normal approval flow - show approval screen
            setCurrentScreen('approval');

            // Extract display mode data from the approval message
            if (displayData) {
              try {
                const { mode, images, rotationInterval, scores } = displayData;

                if (mode) {
                  setDisplayMode(mode);
                }
                if (mode === 'slideshow' && images) {
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
            }

            // Clear any existing approval timer
            if (approvalTimerRef.current) {
              clearTimeout(approvalTimerRef.current);
            }

            // Set new approval screen transition timer
            approvalTimerRef.current = setTimeout(() => {
              try {
                setCurrentScreen('display');
                approvalTimerRef.current = null;
              } catch (screenErr) {
                console.error('❌ [Player] Error during approval screen transition:', screenErr);
              }
            }, 2000);
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
        if (shouldIgnoreScreenTransition('APPROVAL_PENDING', currentScreen)) {
          // Save message for later processing
          console.log('[Player] Saving APPROVAL_PENDING message for processing after buzzer selection');
          setPendingMessage({ type: 'APPROVAL_PENDING', data: message.data });
          return;
        }
        setCurrentScreen('approval');
        break;
      case 'TEAM_DECLINED':
        setIsApproved(false);
        // Clear cached team name so user can try a different name if needed
        localStorage.removeItem('popquiz_last_team_name');
        setCurrentScreen('declined');
        break;
      case 'QUESTION':
        if (shouldIgnoreScreenTransition('QUESTION', currentScreen)) {
          // Save question data for later processing
          console.log('[Player] Saving QUESTION message for processing after buzzer selection');
          setPendingMessage({ type: 'QUESTION', data: message.data });
          return;
        }

        clearIdleExitTimeout('QUESTION');

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

        // Extract scrambled flag from question
        const scrambledFlag = message.data?.scrambled ?? false;
        setIsKeypadScrambled(scrambledFlag);
        console.log('[Player] Question received, keypad scrambled:', scrambledFlag);

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
        clearIdleExitTimeout('TIMER_START');

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
          // Check if this is a nearest wins question - skip correctness feedback
          // Nearest wins isn't about right/wrong, it's about closest guess
          const revealType = message.data?.type?.toLowerCase();
          if (revealType === 'nearestwins' || revealType === 'nearest') {
            console.log('[Player] 📢 Nearest wins question - skipping correctness feedback');
            setShowAnswerFeedback(false);
            setIsAnswerCorrect(undefined);
          } else {
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
          }
        } catch (err) {
          console.error('[Player] ❌ Error determining answer correctness:', err);
        }
        break;
      case 'NEXT':
        if (shouldIgnoreScreenTransition('NEXT', currentScreen)) {
          // Save NEXT message for later processing
          console.log('[Player] Saving NEXT message for processing after buzzer selection');
          setPendingMessage({ type: 'NEXT', data: message.data });
          return;
        }

        clearIdleExitTimeout('NEXT');

        console.log('[Player] NEXT message received - clearing all question state immediately');
        resetQuestionState();
        if (!applyPendingDisplayMode('NEXT')) {
          transitionToIdleDisplay('NEXT');
        }
        break;
      case 'END_ROUND':
        if (shouldIgnoreScreenTransition('END_ROUND', currentScreen)) {
          console.log('[Player] Saving END_ROUND message for processing after buzzer selection');
          setPendingMessage({ type: 'END_ROUND', data: message.data });
          return;
        }

        clearIdleExitTimeout('END_ROUND');

        console.log('[Player] END_ROUND message received - clearing all question state');
        resetQuestionState();
        if (!applyPendingDisplayMode('END_ROUND')) {
          transitionToIdleDisplay('END_ROUND');
        }
        break;
      case 'PICTURE':
        if (shouldIgnoreScreenTransition('PICTURE', currentScreen)) {
          // Save PICTURE message for later processing
          console.log('[Player] Saving PICTURE message for processing after buzzer selection');
          setPendingMessage({ type: 'PICTURE', data: message.data });
          return;
        }

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

          // Protect buzzer selection from any screen transitions
          if (shouldIgnoreScreenTransition('DISPLAY_MODE', currentScreen)) {
            console.log('[Player] Saving DISPLAY_MODE message for processing after buzzer selection');
            setPendingMessage({ type: 'DISPLAY_MODE', data: message.data });
            return;
          }

          // Don't switch away from question/ready-for-question screens during active game
          // This prevents display modes (BASIC/SCORES/SLIDESHOW) from interrupting the question interface
          const isInGameScreen = currentScreen === 'question' || currentScreen === 'ready-for-question';
          if (isInGameScreen) {
            console.log('[Player] ⚠️  Ignoring DISPLAY_MODE message - question/input screen is currently active, deferring display mode change');
            console.log('[Player] 📥 Buffered DISPLAY_MODE payload until question ends');
            setPendingDisplayMode(message.data);
            break;
          }

          applyDisplayModeUpdate(message.data, 'DISPLAY_MODE');
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
          const { teamName, teamPhoto, guess, difference } = message.data || {};
          if (teamName) {
            setFastestTeamName(teamName);
            setFastestTeamPhoto(teamPhoto || null);
            setFastestTeamGuess(guess !== undefined ? Number(guess) : undefined);
            setFastestTeamDifference(difference !== undefined ? Number(difference) : undefined);
            setShowFastestTeam(true);
            console.log('[Player] Showing fastest team:', teamName, guess !== undefined ? `(guessed ${guess}, off by ${difference})` : '');
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
      case 'BUZZERS_FOLDER_CHANGED':
        try {
          console.log('[Player] BUZZERS_FOLDER_CHANGED message received:', message.data?.folderPath);

          // Clear the player's confirmed buzzer selection
          setConfirmedBuzzer(null);

          // Clear selected buzzers from other players
          setSelectedBuzzers({});

          // Clear buzzer from local settings
          updateBuzzerSound(null);

          // If player is in buzzer selection, show notification
          if (currentScreen === 'buzzer-selection') {
            console.log('[Player] Already in buzzer selection - buzzer list will auto-reload');
          } else {
            // Redirect to buzzer selection if approved
            if (isApproved && teamName) {
              console.log('[Player] Redirecting to buzzer selection after folder change');
              setCurrentScreen('buzzer-selection');
            }
          }

          console.log('[Player] ✅ BUZZERS_FOLDER_CHANGED handled - player must re-select buzzer');
        } catch (folderChangeErr) {
          console.error('❌ [Player] Error in BUZZERS_FOLDER_CHANGED handler:', folderChangeErr);
        }
        break;
      case 'SCRAMBLE_UPDATE':
        try {
          const scrambledState = message.data?.scrambled ?? false;
          console.log('[Player] SCRAMBLE_UPDATE message received - keypad scrambled:', scrambledState);
          setIsKeypadScrambled(scrambledState);
          console.log('[Player] ✅ Keypad scramble state updated instantly');
        } catch (scrambleErr) {
          console.error('❌ [Player] Error in SCRAMBLE_UPDATE handler:', scrambleErr);
        }
        break;
      case 'SCORE_UPDATE':
        console.log('[Player] SCORE_UPDATE message received:', message.data);
        // Score updates are handled on display side, just log here
        break;

      case 'FLOW_STATE':
        console.log('[Player] 📥 FLOW_STATE message received!', {
          flow: message.data?.flow,
          isQuestionMode: message.data?.isQuestionMode,
          hasCurrentQuestion: !!message.data?.currentQuestion,
          messageTimestamp: message.timestamp,
        });

        if (shouldIgnoreScreenTransition('FLOW_STATE', currentScreen)) {
          console.log('[Player] Saving FLOW_STATE message for processing after buzzer selection');
          setPendingMessage({ type: 'FLOW_STATE', data: message.data });
          return;
        }

        applyFlowStateUpdate(message.data, 'FLOW_STATE');
        break;
    }
  }, [teamName, currentQuestion, currentScreen, submittedAnswer, displayMode, clearTimerLockDelay, clearIdleExitTimeout, pendingApprovalData, shouldIgnoreScreenTransition, isApproved, updateBuzzerSound, isHostController, applyDisplayModeUpdate, applyPendingDisplayMode, resetQuestionState, transitionToIdleDisplay, scheduleIdleExit, applyFlowStateUpdate]);

  const { isConnected, error } = useNetworkConnection({
    playerId,
    onConnect: handleConnect,
    onMessage: handleMessage,
  });

  // Auto-rejoin when WS reconnects if team is still approved and has a name
  // Only triggers during true reconnection, NOT during initial team entry
  // Also handles reconnect during pin-entry (not yet approved) so host re-sends PIN_REQUIRED
  useEffect(() => {
    const canRejoin = isConnected &&
      teamName &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      currentScreen !== 'team-entry' &&
      currentScreen !== 'declined';

    // Either approved player reconnecting, or unapproved player on pin-entry reconnecting
    if (canRejoin && (isApproved || currentScreen === 'pin-entry')) {
      console.log(`[Player] Auto-rejoin triggered (approved=${isApproved}, screen=${currentScreen})`);
      const rejoinPayload: any = {
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName,
        timestamp: Date.now(),
      };

      if (settings.teamPhoto) {
        rejoinPayload.teamPhoto = settings.teamPhoto;
      }

      // Include buzzer sound if set in settings
      if (settings.buzzerSound) {
        rejoinPayload.buzzerSound = settings.buzzerSound;
      }

      wsRef.current.send(JSON.stringify(rejoinPayload));
    }
  }, [isConnected, isApproved, teamName, deviceId, playerId, settings, currentScreen]);

  // Player visibility/focus detection - detect when player switches tabs, minimizes window, etc
  useEffect(() => {
    if (!isConnected || !isApproved || !teamName) {
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
    setTeamName(name);
    // Clear selected buzzers for fresh buzzer selection and reset confirmed buzzer
    setSelectedBuzzers({});
    setConfirmedBuzzer(null);
    setCurrentScreen('buzzer-selection');

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

  const handleBuzzerConfirm = (buzzerSound: string) => {
    // Store confirmed buzzer in state
    setConfirmedBuzzer(buzzerSound);

    // Update local settings
    updateBuzzerSound(buzzerSound);

    // Send PLAYER_BUZZER_SELECT immediately to notify host of buzzer selection
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && teamName) {
      const buzzerSelectPayload = {
        type: 'PLAYER_BUZZER_SELECT',
        playerId,
        deviceId,
        teamName,
        buzzerSound: buzzerSound,
        timestamp: Date.now(),
      };

      wsRef.current.send(JSON.stringify(buzzerSelectPayload));
    }

    // Resend PLAYER_JOIN with buzzer included so host can approve with buzzer sound
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && teamName) {
      const updatedJoinPayload: any = {
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName,
        buzzerSound: buzzerSound, // Include buzzer in updated PLAYER_JOIN
        timestamp: Date.now(),
      };

      if (settings.teamPhoto) {
        updatedJoinPayload.teamPhoto = settings.teamPhoto;
      }

      console.log('[App] 🔊 Resending PLAYER_JOIN with confirmed buzzer:', buzzerSound);
      wsRef.current.send(JSON.stringify(updatedJoinPayload));
    }

    // Apply any pending approval data that was saved during buzzer selection
    if (pendingApprovalData) {
      console.log('[App] Applying pending approval data:', pendingApprovalData);
      setDisplayMode(pendingApprovalData.displayMode);
      setSlideshowImages(pendingApprovalData.slideshowImages);
      setRotationInterval(pendingApprovalData.rotationInterval);
      setLeaderboardScores(pendingApprovalData.leaderboardScores);
      setPendingApprovalData(null); // Clear pending data after applying
    }

    // Process any pending messages that arrived during buzzer selection
    if (pendingMessage) {
      console.log('[App] Processing pending message after buzzer confirmation:', pendingMessage.type);
      let handledPendingMessage = true;

      // Handle each message type appropriately
      switch (pendingMessage.type) {
        case 'QUESTION':
          console.log('[App] Applying pending QUESTION message');
          const normalizedPendingQuestion = {
            ...pendingMessage.data,
            type: normalizeQuestionType(pendingMessage.data?.type),
          };
          setCurrentQuestion(normalizedPendingQuestion);
          setGoWideEnabled(pendingMessage.data?.goWideEnabled ?? false);
          setAnswerRevealed(false);
          setCorrectAnswer(undefined);
          setSelectedAnswers([]);
          setCurrentScreen('question');
          break;

        case 'NEXT':
          console.log('[App] Applying pending NEXT message');
          resetQuestionState();
          if (!applyPendingDisplayMode('PENDING_NEXT')) {
            transitionToIdleDisplay('PENDING_NEXT');
          }
          break;

        case 'END_ROUND':
          console.log('[App] Applying pending END_ROUND message');
          resetQuestionState();
          if (!applyPendingDisplayMode('PENDING_END_ROUND')) {
            transitionToIdleDisplay('PENDING_END_ROUND');
          }
          break;

        case 'PICTURE':
          console.log('[App] Applying pending PICTURE message');
          setCurrentScreen('question');
          setShowAnswerFeedback(false);
          setIsAnswerCorrect(undefined);
          if (pendingMessage.data?.image) {
            setCurrentQuestion((prev: any) => ({
              ...prev,
              imageUrl: pendingMessage.data.image,
            }));
          }
          break;

        case 'DISPLAY_MODE':
          console.log('[App] Applying pending DISPLAY_MODE message');
          applyDisplayModeUpdate(pendingMessage.data, 'PENDING_DISPLAY_MODE');
          break;

        case 'APPROVAL_PENDING':
          console.log('[App] Applying pending APPROVAL_PENDING message');
          setCurrentScreen('approval');
          break;

        case 'FLOW_STATE':
          console.log('[App] Applying pending FLOW_STATE message');
          applyFlowStateUpdate(pendingMessage.data, 'PENDING_FLOW_STATE');
          break;

        default:
          console.log('[App] Unknown pending message type:', pendingMessage.type);
          handledPendingMessage = false;
      }

      setPendingMessage(null); // Clear pending message after applying
      if (handledPendingMessage) {
        return; // Exit early - don't show approval screen
      }
    }

    setCurrentScreen('approval');

    // Clear any existing approval timer before setting a new one
    if (approvalTimerRef.current) {
      clearTimeout(approvalTimerRef.current);
      console.log('[App] 🧹 Cleared existing approval timer');
    }

    // Set approval screen transition timer
    console.log('[App] ⏱️  Setting 2-second timer to transition from approval screen to display');
    approvalTimerRef.current = setTimeout(() => {
      try {
        console.log('[App] ✅ 2-second approval timer FIRED - transitioning to display screen');
        setCurrentScreen('display');
        approvalTimerRef.current = null;
      } catch (screenErr) {
        console.error('❌ [App] Error during approval screen transition:', screenErr);
      }
    }, 2000);

    // Send PLAYER_JOIN again with buzzer included (atomic team + buzzer creation)
    // This ensures backend receives team and buzzer together
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const joinPayloadWithBuzzer: any = {
        type: 'PLAYER_JOIN',
        playerId,
        deviceId,
        teamName,
        buzzerSound, // Include buzzer in PLAYER_JOIN
        timestamp: Date.now(),
      };

      // Include team photo if available
      if (settings.teamPhoto) {
        joinPayloadWithBuzzer.teamPhoto = settings.teamPhoto;
        console.log('[App] PLAYER_JOIN with buzzer includes teamPhoto: true, Length:', joinPayloadWithBuzzer.teamPhoto.length, 'bytes');
      } else {
        console.log('[App] PLAYER_JOIN with buzzer includes teamPhoto: false');
      }

      console.log('[App] 🔊 Sending PLAYER_JOIN with buzzer:', buzzerSound);
      console.log('[App] Sending PLAYER_JOIN payload with fields:', Object.keys(joinPayloadWithBuzzer).join(', '));
      wsRef.current.send(JSON.stringify(joinPayloadWithBuzzer));
    } else {
      console.warn('[App] Cannot send PLAYER_JOIN with buzzer - WebSocket not open');
    }

    // Also send PLAYER_BUZZER_SELECT for backward compatibility and other players to see buzzer selection
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const buzzerSelectPayload = {
        type: 'PLAYER_BUZZER_SELECT',
        playerId,
        deviceId,
        teamName,
        buzzerSound,
        timestamp: Date.now(),
      };

      console.log('[App] Sending PLAYER_BUZZER_SELECT for display to other players:', buzzerSelectPayload);
      wsRef.current.send(JSON.stringify(buzzerSelectPayload));
    }
  };

  const handleBuzzerCancel = () => {
    console.log('[App] Buzzer selection cancelled, returning to team entry');
    setTeamName('');
    setConfirmedBuzzer(null); // Clear confirmed buzzer when cancelling
    setCurrentScreen('team-entry');
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

          {isConnected && currentScreen === 'pin-entry' && (
            <PinEntryScreen
              teamName={teamName}
              welcomeMessage={welcomeMessage}
              accepted={pinAccepted}
              onSubmit={(pin) => {
                setPinError('');
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'PIN_SUBMIT',
                    playerId,
                    deviceId,
                    teamName,
                    pin,
                    timestamp: Date.now(),
                  }));
                }
              }}
              error={pinError}
            />
          )}

          {isConnected && currentScreen === 'buzzer-selection' && (
            <>
              <WaitingScreen teamName={teamName} welcomeMessage={welcomeMessage} />
              <BuzzerSelectionModal
                isOpen={currentScreen === 'buzzer-selection'}
                selectedBuzzers={selectedBuzzers}
                onConfirm={handleBuzzerConfirm}
                onCancel={handleBuzzerCancel}
              />
            </>
          )}

          {isConnected && currentScreen === 'approval' && (
            <WaitingScreen teamName={teamName} welcomeMessage={welcomeMessage} />
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

          {isConnected && currentScreen === 'host-terminal' && (
            <HostTerminal
              deviceId={deviceId}
              playerId={playerId}
              teamName={teamName}
              wsRef={wsRef}
              flowState={flowState}
            />
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
              scrambled={isKeypadScrambled}
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
                scrambled={isKeypadScrambled}
              />
              {showFastestTeam && (
                <FastestTeamOverlay
                  teamName={fastestTeamName}
                  teamPhoto={fastestTeamPhoto}
                  guess={fastestTeamGuess}
                  difference={fastestTeamDifference}
                />
              )}
            </>
          )}
        </div>

        {/* Settings bar always visible when connected (except in host terminal) */}
        {isConnected && currentScreen !== 'team-entry' && currentScreen !== 'host-terminal' && (
          <SettingsBar />
        )}
      </div>
    </NetworkContext.Provider>
  );
}
