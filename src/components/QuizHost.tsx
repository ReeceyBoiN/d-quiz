import React, { useState, useEffect, useRef, useCallback } from "react";
import { QuestionDisplay } from "./QuestionDisplay";
import { ScoreBoard } from "./ScoreBoard";
import { TopNavigation } from "./TopNavigation";
import { StatusBar } from "./BottomNavigation"; // Renamed from BottomNavigation
import { LeftSidebar } from "./LeftSidebar";
import { RightPanel } from "./RightPanel";
import { DisplayPreview } from "./DisplayPreview";
import { KeypadInterface } from "./KeypadInterface";
import { NearestWinsInterface } from "./NearestWinsInterface";
import { WheelSpinnerInterface } from "./WheelSpinnerInterface";
import { Settings } from "./Settings";
import { UserStatusTab } from "./UserStatusTab";
import { TeamWindow } from "./TeamWindow";
import { FastestTeamDisplay } from "./FastestTeamDisplay";
import { BuzzersManagement } from "./BuzzersManagement";

import { ImageSlideshow } from "./ImageSlideshow";
import { DisplaySettings } from "./DisplaySettings";
import { PlayerDevicesSettings } from "./PlayerDevicesSettings";
import { ScoresDisplay } from "./ScoresDisplay";
import { QuizPackDisplay } from "./QuizPackDisplay";
// BasicDisplay component removed - was not being used
import { LeaderboardReveal } from "./LeaderboardReveal";
import { PopoutDisplay, QuizStage } from "./PopoutDisplay";
import { BuzzInDisplay } from "./BuzzInDisplay";
import { BuzzInInterface } from "./BuzzInInterface";
import { GlobalGameModeSelector } from "./GlobalGameModeSelector";
import { QuestionPanel } from "./QuestionPanel";
import { QuestionNavigationBar } from "./QuestionNavigationBar";
// CountdownTimer not used in QuizHost - using inline timer in external window

import { StoredImage, projectImageStorage } from "../utils/projectImageStorage";
import { useSettings } from "../utils/SettingsContext";
import { useQuizData } from "../utils/QuizDataContext";
import { useTimer } from "../hooks/useTimer";
import type { QuestionFlowState, HostFlow } from "../state/flowState";
import { getTotalTimeForQuestion, hasQuestionImage } from "../state/flowState";
import { sendPictureToPlayers, sendQuestionToPlayers, sendTimerToPlayers, sendTimeUpToPlayers, sendRevealToPlayers, sendNextQuestion, sendEndRound, sendFastestToDisplay, registerNetworkPlayer, onNetworkMessage, broadcastMessage } from "../network/wsHost";
import { playCountdownAudio, stopCountdownAudio } from "../utils/countdownAudio";
import { playApplauseSound, playFailSound } from "../utils/audioUtils";
import { calculateTeamPoints, rankCorrectTeams, shouldAutoDisableGoWide, type ScoringConfig } from "../utils/scoringEngine";
import { getAnswerText, createHandleComputeAndAwardScores, createHandleApplyEvilModePenalty } from "../utils/quizHostHelpers";
import { saveGameState, createGameStateSnapshot, type RoundSettings } from "../utils/gameStatePersistence";
import { Resizable } from "re-resizable";
import { Button } from "./ui/button";
import { ChevronRight } from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "./ui/alert-dialog";



interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
}

interface Participant {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
  lastAnswerTime?: number;
  streak: number;
}

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  location?: { x: number; y: number }; // Physical location on 10x10 grid
  buzzerSound?: string; // Buzzer sound for this team
  backgroundColor?: string; // Background color for this team in the list
  photoUrl?: string; // Team photo URL
  disconnected?: boolean; // Whether the team is disconnected from their device
  blocked?: boolean; // Whether the team is blocked from earning points
  scrambled?: boolean; // Whether the team's keypad is scrambled
}

const fixEmojiString = (str: string | undefined): string => {
  if (!str) return '👤';
  const correctionMap: {[key: string]: string} = {};
  correctionMap['â­'] = '⭐';
  correctionMap['ðŸŽª'] = '🎪';
  correctionMap['ðŸŽ‰'] = '🎉';
  correctionMap['ðŸ†'] = '🏆';
  return correctionMap[str] || str;
};

/**
 * Normalize question types from quiz loader format to broadcast format
 * Maps quiz loader types (from parseQuestion) to standardized types for broadcasting to players
 *
 * Maps:
 * - 'letters' → 'letters'
 * - 'multi' → 'multiple-choice'
 * - 'numbers'/'nearest' → 'numbers'
 * - 'sequence' → 'sequence'
 * - 'buzzin' → 'buzzin'
 * - undefined/null → 'buzzin' (default fallback)
 */
const normalizeQuestionTypeForBroadcast = (type: string | undefined): string => {
  if (!type) return 'buzzin';

  const normalized = type.toLowerCase().trim();

  switch (normalized) {
    case 'letters':
      return 'letters';
    case 'multi':
      return 'multiple-choice';
    case 'multiple-choice':
      return 'multiple-choice';
    case 'numbers':
      return 'numbers';
    case 'nearest':
    case 'nearestwins':
      return 'numbers';
    case 'sequence':
      return 'sequence';
    case 'buzzin':
    case 'buzz-in':
    case 'buzz':
      return 'buzzin';
    default:
      console.warn(`[QuizHost] Unknown question type "${type}", defaulting to buzzin`);
      return 'buzzin';
  }
};

const mockQuestions: Question[] = [
  {
    id: 1,
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid", "Option E", "Option F"],
    correctAnswer: 2,
    timeLimit: 30
  },
  {
    id: 2,
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1,
    timeLimit: 25
  },
  {
    id: 3,
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctAnswer: 3,
    timeLimit: 20
  }
];

const mockParticipants: Participant[] = [
  { id: "1", name: "Alice Johnson", score: 150, isConnected: true, streak: 3 },
  { id: "2", name: "Bob Smith", score: 120, isConnected: true, streak: 1 },
  { id: "3", name: "Charlie Brown", score: 180, isConnected: false, streak: 5 },
  { id: "4", name: "Diana Prince", score: 90, isConnected: true, streak: 0 },
  { id: "5", name: "Eve Adams", score: 200, isConnected: true, streak: 7 }
];

/**
 * Validate response time based on timing constraints
 * @param responseTime - Time in milliseconds from timer start to submission
 * @param timeLimit - Total time allowed for the question in seconds
 * @returns Validated response time in milliseconds, or undefined if invalid
 */
function validateResponseTime(
  responseTime: number | undefined,
  timeLimit: number
): number | undefined {
  // No response time recorded
  if (responseTime === undefined || responseTime === null) {
    return undefined;
  }

  // Pre-timer submission (submitted before timer started) - convert to 0.0
  if (responseTime < 0) {
    console.log('[QuizHost] validateResponseTime: Pre-timer submission detected, converting to 0.0');
    return 0;
  }

  // Convert timeLimit from seconds to milliseconds for comparison
  const timeLimitMs = timeLimit * 1000;

  // Response within time limit - valid
  if (responseTime <= timeLimitMs) {
    return responseTime;
  }

  // Response after time limit - missed answer, invalid
  console.log('[QuizHost] validateResponseTime: Missed answer detected - responseTime(' + responseTime + 'ms) > timeLimit(' + timeLimitMs + 'ms)');
  return undefined;
}

export function QuizHost() {
  // Settings context
  const {
    goWideEnabled,
    evilModeEnabled,
    punishmentEnabled,
    updateGoWideEnabled,
    updateEvilModeEnabled,
    gameModePoints,
    defaultSpeedBonus,
    staggeredEnabled,
    defaultPoints,
    countdownStyle,
    gameModeTimers,
    voiceCountdown
  } = useSettings();

  // Quiz data context
  const { currentQuiz, setCurrentQuiz } = useQuizData();

  // Current round scores (for temporary modifications during a round)
  const [currentRoundPoints, setCurrentRoundPoints] = useState<number | null>(null);
  const [currentRoundSpeedBonus, setCurrentRoundSpeedBonus] = useState<number | null>(null);
  const [currentRoundWinnerPoints, setCurrentRoundWinnerPoints] = useState<number | null>(null);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [participants] = useState<Participant[]>(mockParticipants);
  
  // Navigation state - updated to include user-status
  const [activeTab, setActiveTab] = useState<"teams" | "livescreen" | "handset" | "leaderboard" | "leaderboard-reveal" | "home" | "user-status">("home"); // Start with home tab (quiz pack selection)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // Teams state - starts empty, teams are added via network connections or manual addition
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const [pendingSort, setPendingSort] = useState(false);
  const sortTimeoutRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);
  const quizzesRef = useRef(quizzes);
  

  
  // Display management state
  const [displayMode, setDisplayMode] = useState<"basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "timer" | "correctAnswer">("basic");
  const [userSelectedDisplayMode, setUserSelectedDisplayMode] = useState<"basic" | "slideshow" | "scores">("basic"); // Remember user's preference
  const [images, setImages] = useState<StoredImage[]>([]);

  // Player devices display mode state
  const [playerDevicesDisplayMode, setPlayerDevicesDisplayMode] = useState<"basic" | "slideshow" | "scores">("basic");
  const [playerDevicesSlideshowSeconds, setPlayerDevicesSlideshowSeconds] = useState<number>(10);
  const [showPlayerDevicesSettings, setShowPlayerDevicesSettings] = useState(false);
  const [playerDevicesImages, setPlayerDevicesImages] = useState<StoredImage[]>([]);

  // Host controller state
  const [showHostControllerCode, setShowHostControllerCode] = useState(false);
  const [hostControllerCode, setHostControllerCode] = useState<string>("");
  const [hostControllerEnabled, setHostControllerEnabled] = useState(false);

  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(5); // seconds
  
  // Leaderboard reveal state
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [revealedTeams, setRevealedTeams] = useState<Quiz[]>([]);

  // Timer progress bar state
  const [timerIsRunning, setTimerIsRunning] = useState(false);
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(10);
  const [timerTotalTime, setTimerTotalTime] = useState(10);

  // External display popup window state
  const [externalWindow, setExternalWindow] = useState<Window | null>(null);
  const [isExternalDisplayOpen, setIsExternalDisplayOpen] = useState(false);

  // Helper function to send messages to external display (handles both Electron and browser)
  const sendToExternalDisplay = (messageData: any) => {
    if (!externalWindow) return;

    const isElectronWindow = (externalWindow as any)._isElectronWindow;

    if (isElectronWindow) {
      // Send via IPC for Electron windows
      (window as any).api?.ipc?.send('external-display/update', messageData);
    } else {
      // Send via postMessage for browser windows
      if (!(externalWindow as any).closed) {
        externalWindow.postMessage(messageData, '*');
      }
    }
  };

  // Helper function to broadcast question to player devices via backend
  const broadcastQuestionToPlayers = async (questionData: any) => {
    try {
      if ((window as any).api?.network?.broadcastQuestion) {
        console.log('[QuizHost] Broadcasting question to players via IPC:', questionData);
        await (window as any).api.network.broadcastQuestion({
          question: questionData
        });
        console.log('[QuizHost] Question broadcasted to players');
      } else {
        console.warn('[QuizHost] api.network.broadcastQuestion not available');
      }
    } catch (err) {
      console.error('[QuizHost] Error broadcasting question:', err);
    }
  };

  // Sidebar width state for status bar positioning
  const [sidebarWidth, setSidebarWidth] = useState(345); // Match the defaultSize width
  
  // Keypad interface state
  const [showKeypadInterface, setShowKeypadInterface] = useState(false);
  const [keypadInstanceKey, setKeypadInstanceKey] = useState(0);
  const [keypadNextQuestionTrigger, setKeypadNextQuestionTrigger] = useState(0);
  const [isQuizPackMode, setIsQuizPackMode] = useState(false);

  // Loaded quiz state
  const [loadedQuizQuestions, setLoadedQuizQuestions] = useState<any[]>([]);
  const [currentLoadedQuestionIndex, setCurrentLoadedQuestionIndex] = useState(0);
  const [showQuizPackDisplay, setShowQuizPackDisplay] = useState(false);

  // Question flow state machine
  const [flowState, setFlowState] = useState<HostFlow>({
    isQuestionMode: false,
    flow: 'idle',
    totalTime: 30,
    timeRemaining: 30,
    currentQuestionIndex: 0,
    currentQuestion: null,
    pictureSent: false,
    questionSent: false,
    answerSubmitted: undefined,
  });

  const timerIsMountedRef = useRef(true);

  // Timer hook for countdown
  const timer = useTimer({
    onEnd: () => {
      // Timer reached zero: set flow to 'timeup', lock submissions
      setFlowState(prev => ({
        ...prev,
        flow: 'timeup',
        timeRemaining: 0,
      }));
      // Notify players that time is up
      sendTimeUpToPlayers();
    },
    onTick: (remaining) => {
      setFlowState(prev => ({
        ...prev,
        timeRemaining: remaining,
      }));


    },
  });

  // Settings state
  const [showSettings, setShowSettings] = useState(false);

  // Delete team confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<{id: string, name: string, score: number} | null>(null);

  // Buzz-in mode state
  const [showBuzzInMode, setShowBuzzInMode] = useState(false);
  const [buzzInConfig, setBuzzInConfig] = useState<{
    mode: "points" | "classic" | "advanced";
    points: number;
    soundCheck: boolean;
  } | null>(null);

  // Buzz-in interface state
  const [showBuzzInInterface, setShowBuzzInInterface] = useState(false);

  // Nearest wins interface state
  const [showNearestWinsInterface, setShowNearestWinsInterface] = useState(false);
  
  // Wheel spinner interface state
  const [showWheelSpinnerInterface, setShowWheelSpinnerInterface] = useState(false);
  
  // Emoji debug screen state
  const [showEmojiDebug, setShowEmojiDebug] = useState(false);
  
  // Team answers state
  const [teamAnswers, setTeamAnswers] = useState<{[teamId: string]: string}>({});
  const [teamResponseTimes, setTeamResponseTimes] = useState<{[teamId: string]: number}>({});
  const [lastResponseTimes, setLastResponseTimes] = useState<{[teamId: string]: number}>({});
  const [teamAnswerCounts, setTeamAnswerCounts] = useState<{[teamId: string]: number}>({});
  const [showTeamAnswers, setShowTeamAnswers] = useState(false);

  // Team answer status state for temporary background colors
  const [teamAnswerStatuses, setTeamAnswerStatuses] = useState<{[teamId: string]: 'correct' | 'incorrect' | 'no-answer'}>({});
  const [teamCorrectRankings, setTeamCorrectRankings] = useState<{[teamId: string]: number}>({});

  // Pending teams state for network players awaiting approval
  const [pendingTeams, setPendingTeams] = useState<Array<{deviceId: string, playerId: string, teamName: string, timestamp: number}>>([]);
  const [showPendingTeams, setShowPendingTeams] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Team window state
  const [selectedTeamForWindow, setSelectedTeamForWindow] = useState<string | null>(null);
  
  // Host location state
  const [hostLocation, setHostLocation] = useState<{ x: number; y: number } | null>(null);
  
  // Fastest team display state
  const [showFastestTeamDisplay, setShowFastestTeamDisplay] = useState(false);
  const [fastestTeamData, setFastestTeamData] = useState<{
    team: Quiz;
    responseTime: number;
  } | null>(null);

  // Pause scores state
  const [scoresPaused, setScoresPaused] = useState(false);
  
  // Hide scores & positions state
  const [scoresHidden, setScoresHidden] = useState(false);
  
  // Team layout mode state - cycles through: 'default' -> 'alphabetical' -> 'random' -> 'default'
  const [teamLayoutMode, setTeamLayoutMode] = useState<'default' | 'alphabetical' | 'random'>('default');

  // Buzzers management state
  const [showBuzzersManagement, setShowBuzzersManagement] = useState(false);

  // Hide question state - when true, don't send question to players/external display
  const [hideQuestionMode, setHideQuestionMode] = useState(false);

  // Fastest team reveal timing - ensure minimum 4 second display on external display
  const [fastestTeamRevealTime, setFastestTeamRevealTime] = useState<number | null>(null);
  const FASTEST_TEAM_MIN_DISPLAY_TIME = 4000; // 4 seconds in milliseconds
  const SEND_QUESTION_DISABLED_TIME = 2000; // 2 seconds button disable on fastest team
  const [isSendQuestionDisabled, setIsSendQuestionDisabled] = useState(false);

  // Action handlers from game mode components for nav bar integration
  const [gameActionHandlers, setGameActionHandlers] = useState<{
    reveal?: () => void;
    nextQuestion?: () => void;
    startTimer?: () => void;
    silentTimer?: () => void;
    revealFastestTeam?: () => void;
    previousQuestion?: () => void;
  } | null>(null);

  // Game timer state for navigation bar
  const [gameTimerRunning, setGameTimerRunning] = useState(false);
  const [gameTimerTimeRemaining, setGameTimerTimeRemaining] = useState(0);
  const [gameTimerTotalTime, setGameTimerTotalTime] = useState(0);
  const [gameTimerStartTime, setGameTimerStartTime] = useState<number | null>(null);
  const [currentQuestionTimerId, setCurrentQuestionTimerId] = useState<number | null>(null); // Track which question the timer is for

  // Debug effect to log gameTimerRunning state changes
  useEffect(() => {
    console.log('[QuizHost] gameTimerRunning changed:', gameTimerRunning);
  }, [gameTimerRunning]);

  // On-the-spot game state tracking for navigation bar flow button logic
  const [gameTimerFinished, setGameTimerFinished] = useState(false);
  const [gameAnswerRevealed, setGameAnswerRevealed] = useState(false);
  const [gameFastestRevealed, setGameFastestRevealed] = useState(false);
  const [teamsAnsweredCorrectly, setTeamsAnsweredCorrectly] = useState(false);
  const [gameAnswerSelected, setGameAnswerSelected] = useState(false);

  // Screen state tracking for on-the-spot game modes
  const [keypadCurrentScreen, setKeypadCurrentScreen] = useState<string>('config');
  const [nearestWinsCurrentScreen, setNearestWinsCurrentScreen] = useState<string>('config');

  // Game mode configuration state is now handled by settings context

  // Sync fastestTeamData with updated team data when quizzes change
  useEffect(() => {
    if (fastestTeamData) {
      const updatedTeam = quizzes.find(quiz => quiz.id === fastestTeamData.team.id);
      if (updatedTeam) {
        setFastestTeamData(prev =>
          prev ? { ...prev, team: updatedTeam } : null
        );
      }
    }
  }, [quizzes, fastestTeamData?.team.id]);

  // Handle loaded quiz - auto-open Keypad interface for both regular and quiz pack modes
  useEffect(() => {
    if (currentQuiz && currentQuiz.questions && currentQuiz.questions.length > 0) {
      setLoadedQuizQuestions(currentQuiz.questions);
      setCurrentLoadedQuestionIndex(0);
      closeAllGameModes();

      // Use KeypadInterface for both regular and quiz pack modes
      // In quiz pack mode, KeypadInterface will skip input screens and show pre-loaded answers
      const isQuizPack = currentQuiz.isQuizPack || false;
      setIsQuizPackMode(isQuizPack);

      if (isQuizPack) {
        // For quiz packs, show the quiz pack display (config or question screen)
        setShowQuizPackDisplay(true);
        setHideQuestionMode(false);
      } else {
        // For regular games, show the keypad interface
        setShowKeypadInterface(true);
      }
      setActiveTab("teams");
    }
  }, [currentQuiz]);

  // Update flow state when question index changes during quiz
  useEffect(() => {
    if (showQuizPackDisplay && flowState.isQuestionMode && loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion && flowState.currentQuestionIndex !== currentLoadedQuestionIndex) {
        const totalTime = getTotalTimeForQuestion(currentQuestion, gameModeTimers);
        setFlowState(prev => ({
          ...prev,
          flow: 'ready',
          totalTime,
          timeRemaining: totalTime,
          currentQuestionIndex: currentLoadedQuestionIndex,
          currentQuestion,
          pictureSent: false,
          questionSent: false,
          answerSubmitted: undefined,
        }));
        timer.reset(totalTime);

        // Clear old answers and response times from previous question for fresh state
        console.log('[QuizHost] QUESTION_CHANGE: Clearing response times and answers for new question index:', currentLoadedQuestionIndex);
        setTeamAnswers({});
        setTeamResponseTimes({});
        setLastResponseTimes({});
        setTeamAnswerCounts({});
        setShowTeamAnswers(false);
        setTeamAnswerStatuses({});
        setTeamCorrectRankings({});
        setGameTimerStartTime(null); // Reset timer start time for new question

        // Broadcast placeholder question to players immediately so they see answer pads right away
        try {
          let placeholderCount =
            currentQuestion.type === 'letters' ? 6 : // A-F
            currentQuestion.type === 'multi' || currentQuestion.type === 'multiple-choice' ? 4 : // 4 options
            currentQuestion.type === 'numbers' ? 4 : // 4 numbers
            currentQuestion.type === 'nearest' ? 4 : // 4 numbers
            currentQuestion.type === 'sequence' ? currentQuestion.options?.length || 3 : // Use actual options count
            1; // 1 for buzzin

          const placeholderOptions = Array.from({ length: placeholderCount }, (_, i) => `option_${i + 1}`);

          const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
          broadcastQuestionToPlayers({
            text: 'Waiting for question...',
            q: 'Waiting for question...',
            options: placeholderOptions,
            type: normalizedType,
            imageUrl: currentQuestion.imageDataUrl || null,
            isPlaceholder: true,
            goWideEnabled: goWideEnabled,
          });

          console.log('[QuizHost] Broadcasting placeholder question with type:', currentQuestion.type, '-> normalized:', normalizedType, 'options count:', placeholderCount);
        } catch (err) {
          console.error('[QuizHost] Error broadcasting placeholder question:', err);
        }
      }
    }
  }, [currentLoadedQuestionIndex, showQuizPackDisplay, loadedQuizQuestions, gameModeTimers, flowState.currentQuestionIndex, timer, flowState.isQuestionMode]);

  // Initialize state for the first question (index 0) when quiz pack first loads
  // This effect runs separately from the question-change effect because the change effect
  // doesn't trigger when currentLoadedQuestionIndex is 0 (since both indices start at 0)
  useEffect(() => {
    if (showQuizPackDisplay && flowState.isQuestionMode && loadedQuizQuestions.length > 0 && currentLoadedQuestionIndex === 0) {
      const currentQuestion = loadedQuizQuestions[0];
      // Only initialize once when flow state is still idle (hasn't been set to ready yet)
      if (currentQuestion && flowState.flow === 'idle') {
        console.log('[QuizHost] FIRST_QUESTION_INIT: Initializing state for question 0');
        const totalTime = getTotalTimeForQuestion(currentQuestion, gameModeTimers);
        setFlowState(prev => ({
          ...prev,
          flow: 'ready',
          totalTime,
          timeRemaining: totalTime,
          currentQuestionIndex: 0,
          currentQuestion,
          pictureSent: false,
          questionSent: false,
          answerSubmitted: undefined,
        }));
        timer.reset(totalTime);

        // Clear response times and timer for fresh first question state
        console.log('[QuizHost] FIRST_QUESTION_INIT: Clearing response times and timer start time');
        setTeamAnswers({});
        setTeamResponseTimes({});
        setLastResponseTimes({});
        setTeamAnswerCounts({});
        setShowTeamAnswers(false);
        setTeamAnswerStatuses({});
        setTeamCorrectRankings({});
        setGameTimerStartTime(null); // Ensure timer start time is null until timer actually starts

        // Broadcast placeholder question to players immediately so they see answer pads right away
        try {
          let placeholderCount =
            currentQuestion.type === 'letters' ? 6 : // A-F
            currentQuestion.type === 'multi' || currentQuestion.type === 'multiple-choice' ? 4 : // 4 options
            currentQuestion.type === 'numbers' ? 4 : // 4 numbers
            currentQuestion.type === 'nearest' ? 4 : // 4 numbers
            currentQuestion.type === 'sequence' ? currentQuestion.options?.length || 3 : // Use actual options count
            1; // 1 for buzzin

          const placeholderOptions = Array.from({ length: placeholderCount }, (_, i) => `option_${i + 1}`);

          const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
          broadcastQuestionToPlayers({
            text: 'Waiting for question...',
            q: 'Waiting for question...',
            options: placeholderOptions,
            type: normalizedType,
            imageUrl: currentQuestion.imageDataUrl || null,
            isPlaceholder: true,
            goWideEnabled: goWideEnabled,
          });

          console.log('[QuizHost] Broadcasting placeholder question for first question with type:', currentQuestion.type, '-> normalized:', normalizedType, 'options count:', placeholderCount);
        } catch (err) {
          console.error('[QuizHost] Error broadcasting placeholder question for first question:', err);
        }
      }
    }
  }, [showQuizPackDisplay, flowState.isQuestionMode, loadedQuizQuestions, gameModeTimers, timer, goWideEnabled]);

  // Handle timer when flow state changes to 'running'
  useEffect(() => {
    if ((flowState.flow as any) === 'running') {
      console.log('[QuizHost] Timer starting');

      const isSilent = flowState.answerSubmitted === 'silent'; // Check if silent timer was used
      timer.start(flowState.totalTime, isSilent);
      // Note: gameTimerStartTime is now set in handlePrimaryAction before sending timer to players
      // This ensures players and host use the same reference point for response time calculation

    } else if (flowState.flow !== 'running' && flowState.flow !== 'timeup') {
      timer.stop();
    }
  }, [flowState.flow, flowState.totalTime, timer, voiceCountdown, isQuizPackMode]);

  // Auto-show answer in app when timer ends (flow transitions to 'timeup')
  useEffect(() => {
    if (flowState.flow === 'timeup' && isQuizPackMode) {
      setShowAnswer(true);
    }
  }, [flowState.flow, isQuizPackMode]);

  // Update external display with timer countdown - keep question visible
  useEffect(() => {
    if (externalWindow && flowState.flow === 'running') {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
        const timeRemaining = Math.max(0, flowState.timeRemaining);

        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'timer-with-question',
          data: {
            text: hideQuestionMode ? null : currentQuestion.q,
            options: shouldIncludeOptions && !hideQuestionMode ? currentQuestion.options : [],
            type: currentQuestion.type,
            questionNumber: currentLoadedQuestionIndex + 1,
            totalQuestions: loadedQuizQuestions.length,
            hidden: hideQuestionMode,
            timerValue: timeRemaining,
            totalTime: flowState.totalTime,
            showProgressBar: true,
            imageDataUrl: currentQuestion.imageDataUrl || null
          },
          totalTime: flowState.totalTime,
          countdownStyle: countdownStyle
        });
      }
    }
  }, [flowState.timeRemaining, flowState.flow, currentLoadedQuestionIndex, hideQuestionMode, loadedQuizQuestions, externalWindow]);

  // Disable Send Question button for 2 seconds after Next Question is clicked
  useEffect(() => {
    if (isSendQuestionDisabled) {
      const timer = setTimeout(() => {
        setIsSendQuestionDisabled(false);
      }, SEND_QUESTION_DISABLED_TIME);
      return () => clearTimeout(timer);
    }
  }, [isSendQuestionDisabled]);

  // Close fastest team display when advancing to next question in on-the-spot mode
  useEffect(() => {
    // When keypad screen changes to 'question-types', close the fastest team display
    // This ensures the UI properly transitions when Next Question is clicked
    if (keypadCurrentScreen === 'question-types' && showFastestTeamDisplay) {
      setShowFastestTeamDisplay(false);
    }
  }, [keypadCurrentScreen, showFastestTeamDisplay]);

  // Cleanup effect for timer voice announcements on unmount
  useEffect(() => {
    return () => {
      console.log('[QuizHost] Unmounting');
      timerIsMountedRef.current = false;
    };
  }, []);

  // Handle network player joins
  useEffect(() => {
    let wsInstance: WebSocket | null = null;
    let isComponentMounted = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 15;
    let connectionTimeoutId: NodeJS.Timeout | null = null;

    const getDelayMs = (attempt: number): number => {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, etc. (capped at 30s)
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      return delayMs;
    };

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      try {
        // Check if we've exceeded max attempts
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('🛑 Max WebSocket reconnection attempts reached. Network player features unavailable.');
          setWsConnected(false);
          return;
        }

        // Get WebSocket URL - support both Electron and browser dev mode
        let backendWs: string | null = null;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // If hostname is empty (Electron file:// protocol), default to localhost
        const hostname = window.location.hostname || 'localhost';

        if ((window as any).api?.backend?.ws) {
          // Electron mode - get URL from IPC
          try {
            backendWs = (window as any).api.backend.ws();
            if (backendWs) {
              console.log('✓ WebSocket URL from Electron IPC:', backendWs);
            } else {
              console.log('⚠️  Electron IPC returned empty WebSocket URL (backend may still be initializing)');
            }
          } catch (err) {
            console.warn('⚠️  Failed to get WebSocket URL from IPC:', err);
            backendWs = null;
          }
        }

        // Fallback if in browser mode or if Electron returned null
        if (!backendWs) {
          backendWs = `${protocol}//${hostname}:4310/events`;
          console.log(`Using fallback WebSocket URL: ${backendWs}`);
        }

        console.log(`[WebSocket Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}] Connecting to: ${backendWs}`);
        wsInstance = new WebSocket(backendWs);

        // Set a timeout for connection attempt
        const connectionTimeout = setTimeout(() => {
          if (wsInstance && wsInstance.readyState === WebSocket.CONNECTING) {
            console.warn(`⏱️  WebSocket connection attempt timed out after 5 seconds`);
            wsInstance?.close();
          }
        }, 5000);

        wsInstance.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket connected successfully to backend');
          setWsConnected(true);
          reconnectAttempts = 0;
        };

        wsInstance.onmessage = async (event) => {
          if (!isComponentMounted) return;

          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket Message]', data);

            // Forward message to wsHost listeners (PLAYER_JOIN, PLAYER_ANSWER, etc)
            broadcastMessage({
              type: data.type,
              data,
              timestamp: data.timestamp || Date.now()
            });
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        wsInstance.onerror = (event) => {
          clearTimeout(connectionTimeout);
          const errorMsg = event instanceof Event
            ? `WebSocket connection failed (the app may need to run in Electron)`
            : (event as any)?.message || 'Unknown WebSocket error';
          console.error('❌ WebSocket error:', errorMsg, 'Attempting to connect to:', backendWs);
          setWsConnected(false);
          // Don't retry on error alone - wait for onclose to handle reconnection
        };

        wsInstance.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(`⚠️  WebSocket closed with code ${event.code}`);
          setWsConnected(false);

          if (isComponentMounted && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayMs = getDelayMs(reconnectAttempts - 1);
            console.log(`📍 Scheduling WebSocket reconnect in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

            if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
            connectionTimeoutId = setTimeout(connectWebSocket, delayMs);
          }
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        if (isComponentMounted && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delayMs = getDelayMs(reconnectAttempts - 1);
          if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
          connectionTimeoutId = setTimeout(connectWebSocket, delayMs);
        }
      }
    };

    // Wait 1 second before first connection attempt to allow backend to initialize
    const initialDelayId = setTimeout(() => {
      if (isComponentMounted) {
        console.log('Starting WebSocket connection process...');
        connectWebSocket();
      }
    }, 1000);

    return () => {
      isComponentMounted = false;
      clearTimeout(initialDelayId);
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
      if (wsInstance) {
        wsInstance.close();
      }
    };
  }, []);

  // Handler to approve a pending team
  const handleApproveTeam = async (deviceId: string, teamName: string) => {
    try {
      console.log('📋 handleApproveTeam called for:', { deviceId, teamName });

      // Fetch player data to get team photo
      let teamPhoto: string | undefined = undefined;
      try {
        const result = await (window as any).api?.ipc?.invoke?.('network/all-players');
        if (result?.ok && Array.isArray(result.data)) {
          const player = result.data.find((p: any) => p.deviceId === deviceId);
          if (player?.teamPhoto) {
            teamPhoto = player.teamPhoto;
            console.log('✅ Retrieved team photo for:', teamName);
          }
        }
      } catch (err) {
        console.warn('[QuizHost] Could not fetch team photo:', err);
      }

      // Add team to quizzes list
      const newTeam: Quiz = {
        id: deviceId,
        name: teamName,
        type: 'test' as const,
        icon: '👤',
        score: 0,
        photoUrl: teamPhoto || undefined,
      };

      if (!quizzesRef.current.find(q => q.id === deviceId)) {
        setQuizzes(prev => [...prev, newTeam]);
        console.log('Added team to quizzes');
      }

      // Approve via IPC (only works in Electron)
      if ((window as any).api?.network?.approveTeam) {
        console.log('Calling approveTeam IPC...');

        // Prepare display mode data to send to the newly approved player
        const displayData: any = {
          mode: playerDevicesDisplayMode
        };

        if (playerDevicesDisplayMode === 'slideshow') {
          displayData.images = playerDevicesImages.map((img, idx) => ({
            id: `img-${idx}`,
            path: img.url,
            name: img.name || `Image ${idx + 1}`
          }));
          displayData.rotationInterval = playerDevicesSlideshowSeconds * 1000; // Convert seconds to milliseconds
        } else if (playerDevicesDisplayMode === 'scores') {
          const sortedQuizzes = [...quizzes].sort((a, b) => (b.score || 0) - (a.score || 0));
          displayData.scores = sortedQuizzes.map((q, idx) => ({
            id: q.id,
            name: q.name,
            score: q.score || 0,
            position: idx + 1
          }));
        }

        // Send current game state to late joiner
        const currentGameState: any = {};

        // For quiz pack mode - send current question and timer state
        if (showQuizPackDisplay && loadedQuizQuestions.length > 0 && currentLoadedQuestionIndex < loadedQuizQuestions.length) {
          const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
          const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);

          currentGameState.currentQuestion = {
            text: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            imageDataUrl: currentQuestion.imageDataUrl || null,
            questionNumber: currentLoadedQuestionIndex + 1,
            totalQuestions: loadedQuizQuestions.length
          };

          // Send timer state if question is active
          if (flowState.flow === 'running' || flowState.flow === 'timeup') {
            currentGameState.timerState = {
              isRunning: flowState.flow === 'running',
              timeRemaining: Math.max(0, flowState.timeRemaining),
              totalTime: flowState.totalTime
            };
          }
        }

        // For on-the-spot modes - send current question and timer state
        if (gameTimerRunning) {
          currentGameState.timerState = {
            isRunning: gameTimerRunning,
            timeRemaining: gameTimerTimeRemaining,
            totalTime: gameTimerTotalTime
          };
        }

        displayData.currentGameState = currentGameState;

        const result = await (window as any).api.network.approveTeam({ deviceId, teamName, displayData });
        console.log('✅ approveTeam result:', result);
      } else {
        console.warn('⚠️  api.network.approveTeam not available');
      }

      // Remove from pending
      setPendingTeams(prev => prev.filter(t => t.deviceId !== deviceId));
      console.log('Removed from pending teams');
    } catch (err) {
      console.error('❌ Failed to approve team:', err);
    }
  };

  // Handler to decline a pending team
  const handleDeclineTeam = async (deviceId: string, teamName: string) => {
    try {
      console.log('🚫 handleDeclineTeam called for:', { deviceId, teamName });

      // Decline via IPC (only works in Electron)
      if ((window as any).api?.network?.declineTeam) {
        console.log('Calling declineTeam IPC...');
        const result = await (window as any).api.network.declineTeam({ deviceId, teamName });
        console.log('✅ declineTeam result:', result);
      } else {
        console.warn('⚠️  api.network.declineTeam not available');
      }

      // Remove from pending
      setPendingTeams(prev => prev.filter(t => t.deviceId !== deviceId));
      console.log('Removed from pending teams');
    } catch (err) {
      console.error('❌ Failed to decline team:', err);
    }
  };

  // Helper function to close all active game modes
  const closeAllGameModes = () => {
    setShowKeypadInterface(false);
    setShowBuzzInInterface(false);
    setShowBuzzInMode(false);
    setShowNearestWinsInterface(false);
    setShowWheelSpinnerInterface(false);
    setShowFastestTeamDisplay(false);
    setShowQuizPackDisplay(false);
    setIsQuizPackMode(false);
    setGameTimerRunning(false);
    setGameTimerTimeRemaining(0);
    setGameTimerTotalTime(0);
    setKeypadCurrentScreen('config');
    setNearestWinsCurrentScreen('config');
    setBuzzInConfig(null);
    // Reset current round scores
    setCurrentRoundPoints(null);
    setCurrentRoundSpeedBonus(null);
    setCurrentRoundWinnerPoints(null);
    // Save current response times to last response times before clearing
    setLastResponseTimes(prev => ({ ...prev, ...teamResponseTimes }));
    // Reset team answers when closing games
    setTeamAnswers({});
    setTeamResponseTimes({});
    setTeamAnswerCounts({});
    setShowTeamAnswers(false);
    // Clear team answer statuses and rankings
    setTeamAnswerStatuses({});
    setTeamCorrectRankings({});
    // Reset game timer start time
    setGameTimerStartTime(null);
  };

  // Play explosion sound effect using Web Audio API
  const playExplosionSound = () => {
    try {
      // Resume audio context if it's suspended (required for some browsers)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported');
        return;
      }
      
      const audioContext = new AudioContextClass();
      
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Create a more complex explosion sound
      const duration = 0.8;
      const sampleRate = audioContext.sampleRate;
      const frameCount = sampleRate * duration;
      const arrayBuffer = audioContext.createBuffer(2, frameCount, sampleRate);
      
      for (let channel = 0; channel < arrayBuffer.numberOfChannels; channel++) {
        const channelData = arrayBuffer.getChannelData(channel);
        
        for (let i = 0; i < frameCount; i++) {
          const t = i / sampleRate;
          
          // Create explosion-like sound with multiple frequency components
          let sample = 0;
          
          // Low rumble (bass explosion)
          sample += Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 3) * 0.8;
          sample += Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 4) * 0.6;
          
          // Mid explosion crack
          sample += Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 8) * 0.4;
          sample += Math.sin(2 * Math.PI * 400 * t) * Math.exp(-t * 12) * 0.3;
          
          // High frequency sizzle
          sample += (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.2;
          
          // Add some noise for texture
          sample += (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.1;
          
          // Apply envelope to make it sound more explosive
          const envelope = Math.exp(-t * 2.5);
          sample *= envelope;
          
          // Clip to prevent distortion
          sample = Math.max(-1, Math.min(1, sample * 0.3));
          
          channelData[i] = sample;
        }
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = arrayBuffer;
      
      // Add some reverb/echo effect
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      source.start();
      
      // Clean up after sound finishes
      setTimeout(() => {
        try {
          source.disconnect();
          gainNode.disconnect();
          audioContext.close();
        } catch (cleanupError) {
          console.warn('Error during audio cleanup:', cleanupError);
        }
      }, duration * 1000 + 100);
      
    } catch (error) {
      console.warn('Could not play explosion sound:', error);
      // Fallback: try to use a simple beep
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        
        setTimeout(() => {
          try {
            audioContext.close();
          } catch (cleanupError) {
            console.warn('Error during fallback audio cleanup:', cleanupError);
          }
        }, 400);
        
      } catch (fallbackError) {
        console.warn('Could not play fallback sound:', fallbackError);
      }
    }
  };

  // Handle END ROUND button - navigate to home and play explosion sound or end quiz pack
  const handleEndRound = () => {
    // Stop countdown audio if playing
    stopCountdownAudio();

    // Reset quiz pack flow state if applicable
    if (showQuizPackDisplay && flowState.isQuestionMode) {
      setFlowState(prev => ({
        ...prev,
        isQuestionMode: false,
        flow: 'idle',
      }));
      setHideQuestionMode(false);
      timer.stop();
    }

    // Clear loaded quiz questions to prevent on-the-spot mode from auto-detecting previous quiz pack question types
    setLoadedQuizQuestions([]);
    setCurrentLoadedQuestionIndex(0);

    // Reset quiz pack display and mode flags
    setShowQuizPackDisplay(false);
    setIsQuizPackMode(false);

    // Force KeypadInterface remount if it was active during the round
    // This ensures complete state reset (including question type) when transitioning modes
    if (showKeypadInterface) {
      setKeypadInstanceKey(prev => prev + 1);
    }

    // Play explosion sound effect
    playExplosionSound();

    // Close all game modes (keypad, buzz-in, nearest wins, wheel spinner)
    closeAllGameModes();

    // Reset all game-related state
    setTeamAnswers({});
    setTeamResponseTimes({});
    setLastResponseTimes({});
    setTeamAnswerCounts({});
    setShowTeamAnswers(false);
    setTeamAnswerStatuses({});
    setTeamCorrectRankings({});
    setShowAnswer(false);

    // Navigate back to home screen
    setActiveTab("home");

    // Reset external display to basic mode if it's open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, "basic");
    }
  };

  // Handle team answer updates from game interfaces
  const handleTeamAnswerUpdate = useCallback((answers: {[teamId: string]: string}) => {
    // If empty object is passed, clear answers; otherwise merge to preserve network player answers
    if (Object.keys(answers).length === 0) {
      setTeamAnswers({});
    } else {
      setTeamAnswers(prev => ({ ...prev, ...answers }));
    }
    setShowTeamAnswers(Object.keys(answers).length > 0);
  }, []);

  // Handle team response time updates from game interfaces
  const handleTeamResponseTimeUpdate = useCallback((responseTimes: {[teamId: string]: number}) => {
    // If empty object is passed, clear response times; otherwise merge to preserve network player timings
    if (Object.keys(responseTimes).length === 0) {
      setTeamResponseTimes({});
      setGameTimerStartTime(null); // Reset timer start time when clearing response times
      setCurrentQuestionTimerId(null); // Reset question timer ID
    } else {
      // Validate response times against the current question's time limit
      const validatedTimes: {[teamId: string]: number} = {};
      const timeLimit = flowState.totalTime; // Time limit in seconds from flow state

      Object.entries(responseTimes).forEach(([teamId, responseTime]) => {
        const validated = validateResponseTime(responseTime, timeLimit);
        if (validated !== undefined) {
          validatedTimes[teamId] = validated;
          console.log('[QuizHost] handleTeamResponseTimeUpdate: Team', teamId, 'response time validated:', validated, 'ms (', (validated / 1000).toFixed(2), 's)');
        } else {
          console.log('[QuizHost] handleTeamResponseTimeUpdate: Team', teamId, 'response time invalid:', responseTime, 'ms - not storing');
        }
      });

      // Only merge valid response times
      if (Object.keys(validatedTimes).length > 0) {
        setTeamResponseTimes(prev => ({ ...prev, ...validatedTimes }));
        // Also update last response times for persistence
        setLastResponseTimes(prev => ({ ...prev, ...validatedTimes }));
      }
    }
  }, [flowState.totalTime]);

  // Handle timer state updates from keypad interface
  const handleTimerStateChange = useCallback((isRunning: boolean, timeRemaining: number, totalTime: number) => {
    setTimerIsRunning(isRunning);
    setTimerTimeRemaining(timeRemaining);
    setTimerTotalTime(totalTime);
  }, []);



  // Handle keypad interface toggle
  const handleKeypadClick = () => {
    closeAllGameModes(); // Close any other active modes first
    resetCurrentRoundScores(); // Reset scores to defaults when starting a new keypad round
    // Clear loaded quiz questions to ensure on-the-spot mode doesn't auto-detect question type from previous quiz pack
    setLoadedQuizQuestions([]);
    setCurrentLoadedQuestionIndex(0);
    setIsQuizPackMode(false); // Ensure quiz pack mode is disabled for on-the-spot
    setShowKeypadInterface(true);
    setActiveTab("teams"); // Change active tab when keypad is opened
    setKeypadInstanceKey(prev => prev + 1); // Force re-render with fresh defaults
  };

  // Handle keypad interface close
  const handleKeypadClose = () => {
    setShowKeypadInterface(false);
    setIsQuizPackMode(false);
    setGameTimerRunning(false);
    setGameTimerTimeRemaining(0);
    setGameTimerTotalTime(0);
    setGameTimerStartTime(null); // Reset timer start time when closing keypad
    setGameTimerFinished(false);
    setGameAnswerRevealed(false);
    setGameFastestRevealed(false);
    setTeamsAnsweredCorrectly(false);
    setGameAnswerSelected(false);
    setKeypadCurrentScreen('config');
    setActiveTab("home"); // Return to home when keypad is closed
  };

  // Handle quiz pack display navigation
  const handleQuizPackPrevious = () => {
    if (currentLoadedQuestionIndex > 0) {
      setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex - 1);
    }
  };

  const handleQuizPackNext = () => {
    if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
      setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex + 1);
    }
  };

  const handleQuizPackClose = () => {
    setShowQuizPackDisplay(false);

    // Clear response times when closing quiz pack
    setTeamResponseTimes({});
    setLastResponseTimes({});

    // Reset external display to default mode when closing quiz pack
    if (externalWindow && !externalWindow.closed) {
      if (userSelectedDisplayMode === 'basic') {
        sendToExternalDisplay({ type: 'DISPLAY_UPDATE', mode: 'basic' });
      } else if (userSelectedDisplayMode === 'scores') {
        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'scores',
          quizzes: quizzes
        });
      } else if (userSelectedDisplayMode === 'slideshow') {
        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'slideshow',
          images: images,
          slideshowSpeed: slideshowSpeed
        });
      }
    }
    setHideQuestionMode(false);
    setActiveTab("home");
  };

  // ============= QUESTION FLOW STATE HANDLERS =============

  /**
   * Primary action handler - drives the main flow progression.
   * Triggered by blue button or Spacebar.
   */
  const handlePrimaryAction = useCallback(() => {
    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (!currentQuestion) return;

    switch (flowState.flow) {
      case 'ready': {
        // If hideQuestionMode is true, skip sending and go directly to sent-question
        if (hideQuestionMode) {
          setFlowState(prev => ({
            ...prev,
            flow: 'sent-question',
            questionSent: false, // Mark that question was NOT sent
            pictureSent: false,
          }));
        } else if (hasQuestionImage(currentQuestion)) {
          // Send picture (if available) or go straight to question
          sendPictureToPlayers(currentQuestion.imageDataUrl);
          // Also send to external display using proper message format
          if (externalWindow) {
            sendToExternalDisplay(
              { type: 'DISPLAY_UPDATE', mode: 'picture', data: { image: currentQuestion.imageDataUrl } }
            );
          }
          setFlowState(prev => ({
            ...prev,
            flow: 'sent-picture',
            pictureSent: true,
          }));
        } else {
          // No picture, send question directly
          const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, normalizedType);

          // Broadcast question to player devices via backend
          broadcastQuestionToPlayers({
            text: currentQuestion.q,
            q: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            imageUrl: currentQuestion.imageDataUrl || null,
            goWideEnabled: goWideEnabled,
          });

          if (externalWindow) {
            // Only include options for sequence and multiple-choice questions
            const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
            sendToExternalDisplay(
              {
                type: 'DISPLAY_UPDATE',
                mode: 'question-with-timer',
                data: {
                  text: hideQuestionMode ? null : currentQuestion.q,
                  options: shouldIncludeOptions && !hideQuestionMode ? currentQuestion.options : [],
                  type: currentQuestion.type,
                  questionNumber: currentLoadedQuestionIndex + 1,
                  totalQuestions: loadedQuizQuestions.length,
                  hidden: hideQuestionMode,
                  timerValue: flowState.totalTime,
                  totalTime: flowState.totalTime,
                  countdownStyle: countdownStyle,
                  showProgressBar: false,
                  imageDataUrl: currentQuestion.imageDataUrl || null
                },
                totalTime: flowState.totalTime,
                countdownStyle: countdownStyle
              }
            );
          }
          setFlowState(prev => ({
            ...prev,
            flow: 'sent-question',
            questionSent: true,
          }));
        }
        break;
      }

      case 'sent-picture': {
        // Send question after picture (unless hideQuestionMode is true)
        if (!hideQuestionMode) {
          const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, normalizedType);

          // Broadcast question to player devices via backend
          broadcastQuestionToPlayers({
            text: currentQuestion.q,
            q: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            imageUrl: currentQuestion.imageDataUrl || null,
            goWideEnabled: goWideEnabled,
          });

          if (externalWindow) {
            // Only include options for sequence and multiple-choice questions
            const shouldIncludeOptions = currentQuestion.type === 'sequence' || currentQuestion.type === 'multiple-choice';
            sendToExternalDisplay(
              {
                type: 'DISPLAY_UPDATE',
                mode: 'question-with-timer',
                data: {
                  text: currentQuestion.q,
                  options: shouldIncludeOptions ? currentQuestion.options : [],
                  type: currentQuestion.type,
                  questionNumber: currentLoadedQuestionIndex + 1,
                  totalQuestions: loadedQuizQuestions.length,
                  hidden: false,
                  timerValue: flowState.totalTime,
                  totalTime: flowState.totalTime,
                  countdownStyle: countdownStyle,
                  showProgressBar: false,
                  imageDataUrl: null
                },
                totalTime: flowState.totalTime,
                countdownStyle: countdownStyle
              }
            );
          }
        } else if (externalWindow) {
          // Send hidden question marker even in hide mode
          sendToExternalDisplay(
            {
              type: 'DISPLAY_UPDATE',
              mode: 'question-with-timer',
              data: {
                text: null,
                options: [],
                type: currentQuestion.type,
                questionNumber: currentLoadedQuestionIndex + 1,
                totalQuestions: loadedQuizQuestions.length,
                hidden: true,
                timerValue: flowState.totalTime,
                totalTime: flowState.totalTime,
                countdownStyle: countdownStyle,
                showProgressBar: false,
                imageDataUrl: null
              },
              totalTime: flowState.totalTime,
              countdownStyle: countdownStyle
            }
          );
        }
        setFlowState(prev => ({
          ...prev,
          flow: 'sent-question',
          questionSent: !hideQuestionMode,
        }));
        break;
      }

      case 'sent-question': {
        // Start audible timer and capture timer start time for response time calculation
        const now = Date.now();

        // Set timer start time for response time calculation (for both quiz pack and on-the-spot)
        setGameTimerStartTime(now);
        console.log('[QuizHost] SENT_QUESTION->RUNNING: Setting gameTimerStartTime to', now);

        sendTimerToPlayers(flowState.totalTime, false, now);
        // Play countdown audio with normal sound
        playCountdownAudio(flowState.totalTime, false).catch(error => {
          console.error('[QuizHost] Error playing countdown audio:', error);
        });
        // Start the local timer
        setIsQuizActive(true);
        setTimeRemaining(flowState.totalTime);
        setFlowState(prev => ({
          ...prev,
          flow: 'running',
        }));
        break;
      }

      case 'running':
      case 'timeup': {
        // User clicked "Reveal Answer" - send answer to external display and show fastest team in app
        timer.stop();

        // Calculate team answer statuses and statistics immediately (don't rely on async state updates)
        const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
        const correctAnswer = currentQuestion ? getAnswerText(currentQuestion) : null;

        // Calculate answer statistics inline to avoid async state update delays
        const newStatuses: {[teamId: string]: 'correct' | 'incorrect' | 'no-answer'} = {};
        quizzes.forEach(team => {
          const teamAnswer = teamAnswers[team.id];
          if (!teamAnswer) {
            newStatuses[team.id] = 'no-answer';
          } else if (teamAnswer.toLowerCase().trim() === correctAnswer?.toLowerCase().trim()) {
            newStatuses[team.id] = 'correct';
          } else {
            newStatuses[team.id] = 'incorrect';
          }
        });

        // Update state with the calculated statuses
        setTeamAnswerStatuses(newStatuses);

        // Award points to teams that answered correctly in quiz pack mode
        if (isQuizPackMode) {
          const correctTeamIds = Object.entries(newStatuses)
            .filter(([_, status]) => status === 'correct')
            .map(([teamId, _]) => teamId);

          if (correctTeamIds.length > 0) {
            // Calculate fastest team among correct answers for speed bonus
            let fastestTeamId: string | undefined;
            const correctTeamTimes = correctTeamIds
              .map(id => ({ id, time: teamResponseTimes[id] || Infinity }))
              .sort((a, b) => a.time - b.time);
            if (correctTeamTimes.length > 0) {
              fastestTeamId = correctTeamTimes[0].id;
            }

            // Award points using the full scoring factory
            handleComputeAndAwardScores(correctTeamIds, 'keypad', fastestTeamId, teamResponseTimes);
          }
        }

        // Send the answer to all players and external display
        if (externalWindow) {
          // For quiz pack mode, send results summary; for on-the-spot, send the answer
          if (isQuizPackMode && loadedQuizQuestions.length > 0) {
            // Calculate answer statistics for quiz pack using just-calculated statuses
            const correctCount = Object.values(newStatuses).filter(status => status === 'correct').length;
            const incorrectCount = Object.values(newStatuses).filter(status => status === 'incorrect').length;
            const noAnswerCount = Object.values(newStatuses).filter(status => status === 'no-answer').length;

            sendToExternalDisplay(
              {
                type: 'DISPLAY_UPDATE',
                mode: 'resultsSummary',
                data: {
                  text: currentQuestion.q,
                  answer: getAnswerText(currentQuestion),
                  correctIndex: currentQuestion.correctIndex,
                  type: currentQuestion.type,
                  questionNumber: currentLoadedQuestionIndex + 1,
                  totalQuestions: loadedQuizQuestions.length,
                  correctCount,
                  incorrectCount,
                  noAnswerCount,
                  totalTeams: quizzes.length
                }
              }
            );
          } else {
            sendToExternalDisplay(
              { type: 'DISPLAY_UPDATE', mode: 'correctAnswer', data: { answer: getAnswerText(currentQuestion), correctIndex: currentQuestion.correctIndex, type: currentQuestion.type } }
            );
          }
        }

        // Broadcast reveal to player devices
        broadcastAnswerReveal(currentQuestion);

        const isOnTheSpotMode = showKeypadInterface && !isQuizPackMode;

        if (isOnTheSpotMode) {
          // For on-the-spot: Show fastest team info and transition to fastest state
          // Find the fastest team among those who answered correctly
          const correctTeams = quizzes.filter(team => newStatuses[team.id] === 'correct');
          const fastestTeam = correctTeams.length > 0
            ? correctTeams.reduce((fastest, current) => {
                const currentTime = teamResponseTimes[current.id] || Infinity;
                const fastestTime = teamResponseTimes[fastest.id] || Infinity;
                return currentTime < fastestTime ? current : fastest;
              })
            : null;

          if (fastestTeam) {
            sendFastestToDisplay(fastestTeam.name, currentLoadedQuestionIndex + 1, fastestTeam.photoUrl);

            // Broadcast fastest team to player devices
            if ((window as any).api?.network?.broadcastFastest) {
              try {
                const fastestData = {
                  teamName: fastestTeam.name,
                  questionNumber: currentLoadedQuestionIndex + 1,
                  teamPhoto: fastestTeam.photoUrl || null
                };
                console.log('[QuizHost] Broadcasting fastest team to players:', fastestData);
                (window as any).api.network.broadcastFastest(fastestData);
              } catch (err) {
                console.error('[QuizHost] Error broadcasting fastest team:', err);
              }
            }

            if (externalWindow) {
              sendToExternalDisplay(
                { type: 'DISPLAY_UPDATE', mode: 'fastestTeam', data: { question: currentLoadedQuestionIndex + 1, teamName: fastestTeam.name, teamPhoto: fastestTeam.photoUrl } }
              );
            }
          }

          // Transition to fastest state
          setFastestTeamRevealTime(Date.now());
          setFlowState(prev => ({
            ...prev,
            flow: 'fastest',
          }));
        } else {
          // For quiz pack: Show results summary on external display, show fastest team info in app
          // Transition to revealed state (next click will show fastest team on external display)
          setFastestTeamRevealTime(Date.now());
          setFlowState(prev => ({
            ...prev,
            flow: 'revealed',
          }));
        }
        break;
      }

      case 'revealed': {
        // User clicked "Fastest Team" button - send fastest team to external display
        // This only happens in quiz pack mode (on-the-spot already sent it when answer was revealed)

        const isOnTheSpotMode = showKeypadInterface && !isQuizPackMode;

        if (!isOnTheSpotMode && isQuizPackMode) {
          // For quiz pack: Show fastest team on external display, player portals, AND host screen
          const correctTeams = quizzes.filter(team => teamAnswerStatuses[team.id] === 'correct');
          const fastestTeam = correctTeams.length > 0
            ? correctTeams.reduce((fastest, current) => {
                const currentTime = teamResponseTimes[current.id] || Infinity;
                const fastestTime = teamResponseTimes[fastest.id] || Infinity;
                return currentTime < fastestTime ? current : fastest;
              })
            : null;

          if (fastestTeam) {
            const fastestTeamResponseTime = teamResponseTimes[fastestTeam.id] || 0;

            // Show FastestTeamDisplay on host screen (same as keypad mode)
            handleFastestTeamReveal({
              team: fastestTeam,
              responseTime: fastestTeamResponseTime
            });

            // Send to player portals
            sendFastestToDisplay(fastestTeam.name, currentLoadedQuestionIndex + 1, fastestTeam.photoUrl);

            // Broadcast fastest team to player devices
            if ((window as any).api?.network?.broadcastFastest) {
              try {
                const fastestData = {
                  teamName: fastestTeam.name,
                  questionNumber: currentLoadedQuestionIndex + 1,
                  teamPhoto: fastestTeam.photoUrl || null
                };
                console.log('[QuizHost] Broadcasting fastest team to players:', fastestData);
                (window as any).api.network.broadcastFastest(fastestData);
              } catch (err) {
                console.error('[QuizHost] Error broadcasting fastest team:', err);
              }
            }

            // Send to external display
            if (externalWindow) {
              sendToExternalDisplay(
                { type: 'DISPLAY_UPDATE', mode: 'fastestTeam', data: { question: currentLoadedQuestionIndex + 1, teamName: fastestTeam.name, teamPhoto: fastestTeam.photoUrl } }
              );
            }
          }
        }

        // Transition to fastest state
        setFlowState(prev => ({
          ...prev,
          flow: 'fastest',
        }));
        break;
      }

      case 'fastest': {
        const isOnTheSpotMode = showKeypadInterface && !isQuizPackMode;

        if (isOnTheSpotMode) {
          // For on-the-spot: Close keypad interface and return to question selection
          handleKeypadClose();
          sendNextQuestion();
          // Reset team answers and statuses for next question
          setTeamAnswers({});
          setTeamResponseTimes({});
          setTeamAnswerCounts({});
          setTeamAnswerStatuses({});
          setTeamCorrectRankings({});
          setFastestTeamRevealTime(null); // Reset reveal time
          setFlowState(prev => ({
            ...prev,
            flow: 'idle',
            isQuestionMode: false,
          }));
        } else {
          // For quiz pack: Move to next question or end round
          if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
            // Clear team answers and statuses for next question
            setTeamAnswers({});
            setTeamResponseTimes({});
            setLastResponseTimes({});
            setTeamAnswerCounts({});
            setTeamAnswerStatuses({});
            setTeamCorrectRankings({});
            console.log('[QuizHost] ADVANCING QUESTION: Resetting gameTimerStartTime from', gameTimerStartTime, 'to null for next question');
            setGameTimerStartTime(null); // Reset timer start time for new question

            setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex + 1);
            setHideQuestionMode(false); // Reset hide question flag for next question
            setShowAnswer(false); // Reset answer visibility for next question
            setFastestTeamRevealTime(null); // Reset reveal time
            setShowFastestTeamDisplay(false); // Close fastest team display before showing next question
            setIsSendQuestionDisabled(true); // Disable Send Question for 2 seconds
            sendNextQuestion();

            // Revert external display to default mode with fade transition
            if (externalWindow) {
              if (userSelectedDisplayMode === 'basic') {
                sendToExternalDisplay({ type: 'DISPLAY_UPDATE', mode: 'basic' });
              } else if (userSelectedDisplayMode === 'scores') {
                sendToExternalDisplay({
                  type: 'DISPLAY_UPDATE',
                  mode: 'scores',
                  quizzes: quizzes
                });
              } else if (userSelectedDisplayMode === 'slideshow') {
                sendToExternalDisplay({
                  type: 'DISPLAY_UPDATE',
                  mode: 'slideshow',
                  images: images,
                  slideshowSpeed: slideshowSpeed
                });
              }
            }
            // Flow state will be reset by the effect
          } else {
            // Last question - call handleEndRound (performs full cleanup + broadcast)
            handleEndRound();
          }
        }
        break;
      }

      case 'complete': {
        // End round - return to home
        setShowQuizPackDisplay(false);
        setFlowState(prev => ({
          ...prev,
          isQuestionMode: false,
          flow: 'idle',
        }));
        setActiveTab("home");
        break;
      }

      default:
        break;
    }
  }, [
    flowState.flow,
    flowState.totalTime,
    currentLoadedQuestionIndex,
    loadedQuizQuestions,
    externalWindow,
    timer,
    hideQuestionMode,
    showKeypadInterface,
    isQuizPackMode,
    quizzes,
    teamAnswerStatuses,
    teamResponseTimes,
    handleKeypadClose,
    setTeamAnswers,
    setTeamResponseTimes,
    setTeamAnswerStatuses,
    setTeamCorrectRankings,
    setShowQuizPackDisplay,
    setActiveTab,
  ]);

  /**
   * Silent timer handler - starts timer with silent countdown audio.
   */


  /**
   * Wrapper for nav bar's onStartTimer - handles both quiz pack and on-the-spot modes
   */
  const handleNavBarStartTimer = useCallback(() => {
    if (isQuizPackMode || flowState.isQuestionMode) {
      // For quiz pack mode, use the primary action handler
      handlePrimaryAction();
    } else if (showKeypadInterface || showNearestWinsInterface || showBuzzInMode) {
      // For on-the-spot modes, determine which handler to call based on game state
      if (!gameTimerRunning && !gameTimerFinished) {
        // Timer not started yet - start the timer
        gameActionHandlers?.startTimer?.();
      } else if (gameTimerFinished && !gameAnswerRevealed) {
        // Timer finished, next action is reveal answer
        gameActionHandlers?.reveal?.();
      } else if (gameTimerFinished && gameAnswerRevealed && !gameFastestRevealed && teamsAnsweredCorrectly) {
        // Answer revealed and teams answered correctly, next action is fastest team
        gameActionHandlers?.reveal?.();
      } else if (gameFastestRevealed || (gameAnswerRevealed && !teamsAnsweredCorrectly)) {
        // Either fastest team revealed OR answer revealed but no correct teams - next action is next question
        gameActionHandlers?.nextQuestion?.();
      }
    }
  }, [isQuizPackMode, flowState.isQuestionMode, gameActionHandlers, handlePrimaryAction, gameTimerRunning, gameTimerFinished, gameAnswerRevealed, gameFastestRevealed, teamsAnsweredCorrectly, showKeypadInterface, showNearestWinsInterface, showBuzzInMode]);

  /**
   * Wrapper for nav bar's onSilentTimer - handles both quiz pack and on-the-spot modes
   */
  const handleNavBarSilentTimer = useCallback(() => {
    if (isQuizPackMode || flowState.isQuestionMode) {
      // For quiz pack mode: play silent timer audio and start timer
      const now = Date.now();

      // Play silent timer audio file (countdown without voice/beeps)
      playCountdownAudio(flowState.totalTime, true).catch(error => {
        console.error('[QuizHost] Error playing silent countdown audio:', error);
      });

      // Set the timer start time for accurate response time calculation
      setGameTimerStartTime(now);
      console.log('[QuizHost] SILENT_TIMER: Setting gameTimerStartTime to', now);

      // Send timer to players
      sendTimerToPlayers(flowState.totalTime, true, now);

      // Update external display with timer
      if (externalWindow) {
        sendToExternalDisplay({
          type: 'TIMER',
          data: { seconds: flowState.totalTime, totalTime: flowState.totalTime },
          totalTime: flowState.totalTime
        });
      }

      // Transition to running state which will trigger local timer start
      setFlowState(prev => ({
        ...prev,
        flow: 'running',
        answerSubmitted: 'silent',
      }));
    } else if (gameActionHandlers?.silentTimer) {
      // For on-the-spot modes, use the game-specific silent timer handler
      gameActionHandlers.silentTimer();
    }
  }, [isQuizPackMode, flowState.totalTime, flowState.isQuestionMode, externalWindow, gameActionHandlers]);

  /**
   * Hide question handler - prevents question from being sent to players and external display.
   * Used in quiz pack mode to hide the question while keeping it visible on host screen.
   * When enabling hide mode in 'ready' state, also progresses to 'sent-question' to show timer buttons.
   */
  const handleHideQuestion = useCallback(() => {
    // Toggle hide mode and progress flow if needed
    setHideQuestionMode(prev => {
      const newHideMode = !prev;
      // If enabling hide mode and in ready state, progress to sent-question state
      if (newHideMode && flowState.flow === 'ready') {
        setFlowState(prevFlow => ({
          ...prevFlow,
          flow: 'sent-question',
          questionSent: false,
          pictureSent: false,
        }));
      }
      return newHideMode;
    });
  }, [flowState.flow]);

  /**
   * Start quiz handler - called when "START QUIZ" is clicked in config screen.
   * Transitions from config screen to question mode.
   */
  const handleStartQuiz = useCallback(() => {
    // Initialize the flow state when START QUIZ is clicked
    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (currentQuestion) {
      const totalTime = getTotalTimeForQuestion(currentQuestion, gameModeTimers);
      setFlowState({
        isQuestionMode: true,
        flow: 'ready',
        totalTime,
        timeRemaining: totalTime,
        currentQuestionIndex: currentLoadedQuestionIndex,
        currentQuestion,
        pictureSent: false,
        questionSent: false,
        answerSubmitted: undefined,
      });
      timer.reset(totalTime);
    }
  }, [loadedQuizQuestions, currentLoadedQuestionIndex, gameModeTimers, timer]);

  // Handle start round with question data - broadcast question to players immediately
  // This allows players to see the correct input pads before the actual question text is sent
  const handleStartRoundWithQuestion = useCallback(
    (questionData: { type: string; options?: string[]; q: string; questionIndex: number }) => {
      try {
        // Ensure options array is populated so player portal can render the correct number of buttons
        let optionsToSend = questionData.options || [];

        // If options are not provided, generate placeholder options based on question type
        if (!optionsToSend || optionsToSend.length === 0) {
          const placeholderCount =
            questionData.type === 'letters' ? 6 : // A-F (6 letters for demo)
            questionData.type === 'multi' ? 4 : // Default 4 options for multiple choice
            questionData.type === 'numbers' ? 4 : // Default 4 options for numbers
            questionData.type === 'nearest' ? 4 : // Default 4 options for nearest
            questionData.type === 'sequence' ? 3 : // Default 3 options for sequence
            1; // 1 for buzzin or unknown types

          // Generate placeholder options
          optionsToSend = Array.from({ length: placeholderCount }, (_, i) => `option_${i + 1}`);
          console.log('[QuizHost] Generated placeholder options for type:', questionData.type, 'count:', placeholderCount);
        }

        // Broadcast a QUESTION message with placeholder text and question type to players
        // This will trigger players to show the appropriate input interface (letters/numbers/multiple-choice)
        // with a blank question area waiting for the actual question text
        const normalizedType = normalizeQuestionTypeForBroadcast(questionData.type);
        broadcastQuestionToPlayers({
          text: 'Waiting for question...',
          q: 'Waiting for question...',
          options: optionsToSend,
          type: normalizedType,
          questionIndex: questionData.questionIndex,
          isPlaceholder: true, // Mark this as a placeholder message
          timestamp: Date.now(),
          goWideEnabled: goWideEnabled,
        });
        console.log('[QuizHost] Broadcasted placeholder question to players with type:', questionData.type, '-> normalized:', normalizedType, 'options count:', optionsToSend.length);
      } catch (error) {
        console.error('[QuizHost] Error broadcasting placeholder question:', error);
      }
    },
    []
  );

  // Handle buzz-in interface toggle
  const handleBuzzInClick = () => {
    closeAllGameModes(); // Close any other active modes first
    setShowBuzzInInterface(true);
    setActiveTab("teams"); // Change active tab when buzz-in is opened
  };

  // Handle buzz-in interface close
  const handleBuzzInClose = () => {
    setShowBuzzInInterface(false);
    setActiveTab("home"); // Return to home when buzz-in is closed
  };

  // Handle buzz-in mode start
  const handleBuzzInStart = (mode: "points" | "classic" | "advanced", points: number, soundCheck: boolean) => {
    closeAllGameModes(); // Close any other active modes first
    setBuzzInConfig({ mode, points, soundCheck });
    setShowBuzzInMode(true);
    setActiveTab("teams"); // Switch to teams tab when buzz-in starts
  };

  // Handle buzz-in mode end
  const handleBuzzInEnd = () => {
    setShowBuzzInMode(false);
    setBuzzInConfig(null);
    setActiveTab("home"); // Return to home when buzz-in ends
  };

  // Handle wheel spinner click
  const handleWheelSpinnerClick = () => {
    closeAllGameModes(); // Close any other active modes first
    setShowWheelSpinnerInterface(true);
    setActiveTab("teams"); // Switch to teams tab when wheel spinner starts
  };

  // Handle wheel spinner interface close
  const handleWheelSpinnerClose = () => {
    setShowWheelSpinnerInterface(false);
    setActiveTab("home"); // Return to home when wheel spinner is closed
  };

  // Handle nearest wins click
  const handleNearestWinsClick = () => {
    closeAllGameModes(); // Close any other active modes first
    setCurrentRoundWinnerPoints(gameModePoints.nearestwins); // Initialize winner points to settings default value
    setShowNearestWinsInterface(true);
    setActiveTab("teams"); // Switch to teams tab when nearest wins starts
    
    // Ensure external display stays on basic mode when in config
    handleExternalDisplayUpdate('basic');
  };

  // Handle buzzers management open
  const handleOpenBuzzersManagement = () => {
    setShowBuzzersManagement(true);
    setActiveTab("teams"); // Switch to teams tab
  };

  // Handle buzzers management close
  const handleCloseBuzzersManagement = () => {
    setShowBuzzersManagement(false);
    setActiveTab("home"); // Return to home
  };

  // Handle showing team on external display for welcome
  const handleShowTeamOnDisplay = (teamName: string) => {
    handleExternalDisplayUpdate('team-welcome', { teamName });
  };

  // Helper function to get team colors
  const getTeamColor = (teamId: string) => {
    const colors = [
      "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
      "#1abc9c", "#e67e22", "#34495e", "#f1c40f", "#95a5a6"
    ];
    const index = parseInt(teamId) - 1;
    return colors[index % colors.length];
  };

  // Handle tab changes with keypad interface consideration
  const handleTabChange = (tab: "teams" | "livescreen" | "handset" | "leaderboard" | "leaderboard-reveal" | "home" | "user-status") => {
    // If team window is open and user clicks home, close team window
    if (selectedTeamForWindow && tab === "home") {
      setSelectedTeamForWindow(null);
    }
    // If keypad interface is open and user clicks home, close keypad interface
    if (showKeypadInterface && tab === "home") {
      setShowKeypadInterface(false);
    }
    // If quiz pack display is open and user clicks home, close quiz pack display and reset flow state
    if (showQuizPackDisplay && tab === "home") {
      setShowQuizPackDisplay(false);
      setFlowState(prev => ({
        ...prev,
        isQuestionMode: false,
        flow: 'idle',
      }));
    }
    // If buzz-in interface is open and user clicks home, close buzz-in interface
    if (showBuzzInInterface && tab === "home") {
      setShowBuzzInInterface(false);
    }
    // If buzz-in mode is open and user clicks home, close buzz-in mode
    if (showBuzzInMode && tab === "home") {
      setShowBuzzInMode(false);
    }
    // If nearest wins interface is open and user clicks home, close nearest wins interface
    if (showNearestWinsInterface && tab === "home") {
      setShowNearestWinsInterface(false);
      setNearestWinsCurrentScreen('config');
      setGameTimerRunning(false);
      setGameTimerTimeRemaining(0);
      setGameTimerTotalTime(0);
    }
    // If wheel spinner interface is open and user clicks home, close wheel spinner interface
    if (showWheelSpinnerInterface && tab === "home") {
      setShowWheelSpinnerInterface(false);
    }
    // If fastest team display is open and user clicks home, close fastest team display
    if (showFastestTeamDisplay && tab === "home") {
      setShowFastestTeamDisplay(false);
    }
    // If buzzers management is open and user clicks home, close buzzers management
    if (showBuzzersManagement && tab === "home") {
      setShowBuzzersManagement(false);
    }
    setActiveTab(tab);
  };

  // Helper function to determine current game mode
  const getCurrentGameMode = (): "keypad" | "buzzin" | "nearestwins" | "wheelspinner" | null => {
    if (showKeypadInterface) return "keypad";
    if (showQuizPackDisplay) return "keypad"; // Quiz packs use keypad-style controls (both config and question modes)
    if (showBuzzInInterface || showBuzzInMode) return "buzzin";
    if (showNearestWinsInterface) return "nearestwins";
    if (showWheelSpinnerInterface) return "wheelspinner";
    return null;
  };

  // Handle Go Wide mode toggle
  const handleGoWideToggle = () => {
    updateGoWideEnabled(!goWideEnabled);
  };

  // Handle Evil Mode toggle
  const handleEvilModeToggle = () => {
    updateEvilModeEnabled(!evilModeEnabled);
  };

  // Reset current round scores to default values (used when starting a new keypad round)
  const resetCurrentRoundScores = useCallback(() => {
    setCurrentRoundPoints(defaultPoints);
    setCurrentRoundSpeedBonus(defaultSpeedBonus);
  }, [defaultPoints, defaultSpeedBonus]);

  // Handlers for changing current round scores
  const handleCurrentRoundPointsChange = useCallback((points: number) => {
    setCurrentRoundPoints(points);
  }, []);

  const handleCurrentRoundSpeedBonusChange = useCallback((speedBonus: number) => {
    setCurrentRoundSpeedBonus(speedBonus);
  }, []);

  const handleCurrentRoundWinnerPointsChange = useCallback((winnerPoints: number) => {
    setCurrentRoundWinnerPoints(winnerPoints);
  }, []);

  // Handle fastest team reveal
  const handleFastestTeamReveal = useCallback((fastestTeam: { team: Quiz; responseTime: number }) => {
    // Ensure team data is synced with the latest info from quizzes array (includes photoUrl, name, etc.)
    const currentTeam = quizzes.find(q => q.id === fastestTeam.team.id);
    if (currentTeam) {
      setFastestTeamData({ team: currentTeam, responseTime: fastestTeam.responseTime });
    } else {
      setFastestTeamData(fastestTeam);
    }
    setShowFastestTeamDisplay(true);
    setActiveTab("teams"); // Switch to teams tab to show the display
  }, [quizzes]);

  // Handle fastest team display close
  const handleFastestTeamClose = useCallback(() => {
    setShowFastestTeamDisplay(false);
    setActiveTab("home"); // Return to home when closed
  }, []);

  // Handle game timer start - capture the start time and question context for accurate response time calculation
  const handleGameTimerStart = useCallback((startTime: number) => {
    // Only update gameTimerStartTime if this timer is for the current question
    // This prevents timer start times from previous questions from being used
    const questionId = currentLoadedQuestionIndex;

    // Check if this timer is for a different question than the last timer
    if (currentQuestionTimerId !== questionId) {
      setCurrentQuestionTimerId(questionId);
      console.log('[QuizHost] TIMER_START: New question timer - question index:', questionId, 'timer start time:', startTime);
    }

    setGameTimerStartTime(startTime);
    console.log('[QuizHost] TIMER_START: Game timer started at:', startTime, 'for question:', questionId, 'Current time:', Date.now(), 'Time since start:', Date.now() - startTime);
  }, [currentLoadedQuestionIndex, currentQuestionTimerId]);

  // Update team answer statuses and calculate rankings for background colors
  const handleTeamAnswerStatusUpdate = useCallback((correctAnswer: string | null, questionType: string | null) => {
    if (!correctAnswer || !questionType) {
      // Clear all statuses when no correct answer is provided
      setTeamAnswerStatuses({});
      setTeamCorrectRankings({});
      return;
    }

    const newStatuses: {[teamId: string]: 'correct' | 'incorrect' | 'no-answer'} = {};
    const correctTeamsWithTimes: Array<{teamId: string, responseTime: number}> = [];

    // Check each team's answer against the correct answer
    quizzes.forEach(team => {
      const teamAnswer = teamAnswers[team.id];
      const teamResponseTime = teamResponseTimes[team.id];

      if (!teamAnswer) {
        // No answer provided
        newStatuses[team.id] = 'no-answer';
      } else if (teamAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
        // Correct answer
        newStatuses[team.id] = 'correct';
        // Track correct teams with their response times for ranking
        if (teamResponseTime) {
          correctTeamsWithTimes.push({
            teamId: team.id,
            responseTime: teamResponseTime
          });
        }
      } else {
        // Incorrect answer
        newStatuses[team.id] = 'incorrect';
      }
    });

    // Calculate rankings for correct teams based on response time (fastest = 1st place)
    const newRankings: {[teamId: string]: number} = {};
    correctTeamsWithTimes
      .sort((a, b) => a.responseTime - b.responseTime) // Sort by response time (ascending - fastest first)
      .forEach((team, index) => {
        newRankings[team.teamId] = index + 1; // 1st place, 2nd place, etc.
      });

    // Update state
    setTeamAnswerStatuses(newStatuses);
    setTeamCorrectRankings(newRankings);

    console.log('Team answer statuses updated:', newStatuses);
    console.log('Team correct rankings updated:', newRankings);
  }, [quizzes, teamAnswers, teamResponseTimes]);

  // Apply dark theme by default on component mount
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Update quizzes ref to avoid stale closures
  useEffect(() => {
    quizzesRef.current = quizzes;
  }, [quizzes]);

  // Real-time resize handler for smooth navigation bar updates
  const handleResize = useCallback((event: any, direction: any, ref: HTMLElement) => {
    const newWidth = ref.offsetWidth;
    setSidebarWidth(newWidth);
  }, []);

  // Resize stop handler for final cleanup if needed
  const handleResizeStop = useCallback((event: any, direction: any, ref: HTMLElement) => {
    const newWidth = ref.offsetWidth;
    setSidebarWidth(newWidth);
  }, []);

  const currentQuestion = mockQuestions[currentQuestionIndex];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isQuizActive && timeRemaining >= 0 && !showAnswer) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          const newValue = prev - 1;
          
          if (newValue < 0) {
            setShowAnswer(true);
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isQuizActive, timeRemaining, showAnswer, voiceCountdown, isQuizPackMode]);

  // Separate effect to save response times when timer ends
  useEffect(() => {
    if (timeRemaining === 0 && showAnswer) {
      setLastResponseTimes(prev => ({ ...prev, ...teamResponseTimes }));
    }
  }, [timeRemaining, showAnswer, teamResponseTimes]);

  // Spacebar shortcut for Next Question button when fastest team display is shown
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();

        // Next Question button when fastest team display is shown
        if (showFastestTeamDisplay) {
          setShowFastestTeamDisplay(false);
          setKeypadNextQuestionTrigger(prev => prev + 1);
          console.log('Next Question (SPACEBAR) - advancing to question type selection');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showFastestTeamDisplay]);

  // Listen for network player registrations
  useEffect(() => {
    const handleNetworkPlayerJoin = (data: any) => {
      const { deviceId, playerId, teamName } = data;

      if (!deviceId) {
        console.warn('PLAYER_JOIN missing deviceId');
        return;
      }

      // Check if team with this deviceId already exists (reconnection case)
      const existingTeam = quizzesRef.current.find(q => q.id === deviceId);

      if (existingTeam) {
        // Reconnection - update existing team, keep score, mark as connected
        setQuizzes(prev => prev.map(q =>
          q.id === deviceId
            ? { ...q, name: teamName, disconnected: false }
            : q
        ));
        console.log(`🔄 Network player reconnected: ${teamName} (${deviceId}) - score preserved: ${existingTeam.score}`);
      } else {
        // New team - check if quiz is in progress (any team has points)
        const hasStartedQuiz = quizzesRef.current.some(q => (q.score || 0) > 0);

        if (!hasStartedQuiz) {
          // Quiz hasn't started - auto approve new team
          console.log('📋 Auto-approving new team (no points yet):', { deviceId, teamName });

          // Add team to quizzes first
          const newTeam: Quiz = {
            id: deviceId,
            name: teamName,
            type: 'test',
            score: 0,
            icon: '📱',
          };

          setQuizzes(prev => {
            const updated = [...prev, newTeam];
            // Sort by score after adding
            return updated.sort((a, b) => (b.score || 0) - (a.score || 0));
          });

          // Auto-approve the team
          setTimeout(() => handleApproveTeam(deviceId, teamName), 0);
          console.log(`✨ New network player auto-approved: ${teamName} (${deviceId})`);
        } else {
          // Quiz in progress - require manual approval
          console.log('⏸️ New team requires manual approval (quiz in progress):', { deviceId, teamName });
          setPendingTeams(prev => [...prev, { deviceId, playerId, teamName, timestamp: Date.now() }]);
        }
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // Empty dependency array - register once on mount

  // Listen for player answers via IPC polling
  useEffect(() => {
    const handleNetworkPlayerAnswer = (data: any) => {
      console.log('🎯 PLAYER_ANSWER received:', data);
      const deviceId = data.deviceId;
      const playerId = data.playerId;
      const { answer, timestamp, teamName } = data;

      if (!deviceId) {
        console.warn('PLAYER_ANSWER missing deviceId');
        return;
      }

      // Find the quiz using deviceId (primary), playerId (fallback 1), or teamName (last resort)
      const matchingQuiz =
        quizzes.find(q => q.id === deviceId) ||
        quizzes.find(q => q.id === playerId) ||
        quizzes.find(q => q.name === teamName);
      const teamId = matchingQuiz?.id || deviceId; // Fallback to deviceId

      if (matchingQuiz) {
        console.log(`[QuizHost] Matched quiz: ${matchingQuiz.name} via ${deviceId ? 'deviceId' : playerId ? 'playerId' : 'teamName'}`);
      }
      console.log('[QuizHost] Mapping player answer - deviceId:', deviceId, 'teamName:', teamName, 'teamId:', teamId);

      // Update team answers for real-time display in teams column
      setTeamAnswers(prev => {
        // Extract the answer value(s)
        // For go-wide mode with multiple answers, use allAnswers array
        // For single answer, use the single answer value
        let answerValue: string;
        if (answer?.allAnswers && Array.isArray(answer.allAnswers) && answer.allAnswers.length > 1) {
          // Go-wide mode with multiple answers - store as comma-separated string
          answerValue = answer.allAnswers.map((a: string) => String(a)).join(', ');
        } else {
          // Single answer mode
          answerValue = String(answer?.answer ?? answer ?? '');
        }
        const updated = { ...prev, [teamId]: answerValue };
        console.log('[QuizHost] Updated teamAnswers:', updated);
        return updated;
      });

      // Track answer count for scoring (1 or 2 for go-wide mode)
      if (answer?.answerCount) {
        setTeamAnswerCounts(prev => {
          const updated = { ...prev, [teamId]: answer.answerCount };
          console.log('[QuizHost] Updated teamAnswerCounts:', updated);
          return updated;
        });
      }

      // Compute response time from when timer started to when the player submitted their answer
      // timestamp is when the player submitted on their device
      let responseTime: number | undefined = undefined;
      if (gameTimerStartTime !== null && gameTimerStartTime !== undefined && timestamp) {
        // Correct calculation: answer submission time - timer start time
        responseTime = timestamp - gameTimerStartTime;
      } else if (gameTimerStartTime !== null && gameTimerStartTime !== undefined) {
        // Fallback: current time - timer start time (if timestamp is missing)
        responseTime = Date.now() - gameTimerStartTime;
      } else {
        // No timer started yet - don't calculate response time
        console.log('[QuizHost] PLAYER_ANSWER: No timer started for team', teamId, '- gameTimerStartTime is null');
      }

      // Validate response time against the current question's time limit
      if (responseTime !== undefined) {
        const validatedResponseTime = validateResponseTime(responseTime, flowState.totalTime);

        if (validatedResponseTime !== undefined) {
          setTeamResponseTimes(prev => {
            const updated = { ...prev, [teamId]: validatedResponseTime };
            console.log('[QuizHost] PLAYER_ANSWER: Team', teamId, 'response time validated:', validatedResponseTime, 'ms (', (validatedResponseTime / 1000).toFixed(2), 's) - calculation: timestamp(' + timestamp + ') - gameTimerStartTime(' + gameTimerStartTime + ')');
            return updated;
          });
        } else {
          console.log('[QuizHost] PLAYER_ANSWER: Team', teamId, 'response time invalid (missed or error):', responseTime, 'ms - gameTimerStartTime:', gameTimerStartTime, 'timestamp:', timestamp);
        }
      }

      // Ensure team answers are visible
      setShowTeamAnswers(true);
    };

    // Poll IPC for pending answers every 500ms
    const pollInterval = setInterval(async () => {
      try {
        const result = await (window as any).api?.ipc?.invoke?.('network/pending-answers');
        if (result?.ok && Array.isArray(result.data)) {
          // Process each pending answer
          result.data.forEach((answer: any) => {
            handleNetworkPlayerAnswer(answer);
          });
        }
      } catch (err) {
        console.error('[QuizHost] Error polling for pending answers:', err);
      }
    }, 500);

    // Also keep the wsHost listener for backward compatibility
    const unsubscribe = onNetworkMessage('PLAYER_ANSWER', handleNetworkPlayerAnswer);

    // Clean up both listeners and interval
    return () => {
      clearInterval(pollInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [quizzes, gameTimerStartTime, flowState.totalTime]); // Re-register listener when quizzes, timer, or question time limit changes - ensures handler has current gameTimerStartTime for accurate response time calculation

  /**
   * Centralized function to broadcast answer reveal to player devices
   * Used by both handleRevealAnswer and handlePrimaryAction to avoid duplicate broadcasts
   */
  const broadcastAnswerReveal = useCallback((question: any) => {
    if (!question || !(window as any).api?.network?.broadcastReveal) {
      return;
    }

    try {
      const revealData = {
        answer: getAnswerText(question),
        correctIndex: question.correctIndex,
        type: question.type,
        selectedAnswers: []
      };
      console.log('[QuizHost] Broadcasting reveal to players:', revealData);
      (window as any).api.network.broadcastReveal(revealData);
    } catch (err) {
      console.error('[QuizHost] Error broadcasting reveal:', err);
    }
  }, []);

  const handleRevealAnswer = () => {
    setShowAnswer(true);
    // Show team answers and response times in sidebar
    setShowTeamAnswers(true);

    // For quiz pack mode, calculate and award points when answer is revealed
    if (isQuizPackMode && loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        // Determine correct teams based on the question's correct answer
        const correctAnswer = getAnswerText(currentQuestion);
        const correctTeamIds = quizzes
          .filter(team => {
            const teamAnswer = teamAnswers[team.id];
            if (!teamAnswer || String(teamAnswer).trim() === '') return false;

            // For go-wide mode (comma-separated answers), check if ANY answer matches
            const answers = String(teamAnswer)
              .split(',')
              .map(a => a.trim().toLowerCase());
            const correctAnswerLower = String(correctAnswer).toLowerCase().trim();

            // Check if any of the team's answers matches the correct answer
            return answers.some(ans => ans === correctAnswerLower);
          })
          .map(team => team.id);

        // Determine fastest correct team
        let fastestTeamId: string | undefined;
        if (correctTeamIds.length > 0) {
          const correctTeamsWithTimes = correctTeamIds
            .map(teamId => ({ teamId, time: teamResponseTimes[teamId] || Infinity }))
            .sort((a, b) => a.time - b.time);
          fastestTeamId = correctTeamsWithTimes[0]?.teamId;
        }

        // Award points using unified scoring function
        handleComputeAndAwardScores(correctTeamIds, 'keypad', fastestTeamId, teamResponseTimes);

        // Apply evil mode penalties if enabled (evilModeEnabled and punishmentEnabled are from component-level useSettings)
        if (evilModeEnabled || punishmentEnabled) {
          const wrongTeamIds = quizzes
            .filter(team => {
              const teamAnswer = teamAnswers[team.id];
              // Team answered but it was wrong (not in correct team list)
              return teamAnswer && String(teamAnswer).trim() !== '' && !correctTeamIds.includes(team.id);
            })
            .map(team => team.id);

          const noAnswerTeamIds = quizzes
            .filter(team => {
              const teamAnswer = teamAnswers[team.id];
              // Team didn't answer or submitted empty answer
              return !teamAnswer || String(teamAnswer).trim() === '';
            })
            .map(team => team.id);

          handleApplyEvilModePenalty(wrongTeamIds, noAnswerTeamIds, 'keypad');
        }

        console.log(`[QuizPack] Scoring applied for question ${currentLoadedQuestionIndex + 1}`);
      }
    }

    // Send results summary to external display
    if (isQuizPackMode && externalWindow && loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'resultsSummary',
          data: {
            text: currentQuestion.q,
            answer: getAnswerText(currentQuestion),
            correctIndex: currentQuestion.correctIndex,
            type: currentQuestion.type,
            questionNumber: currentLoadedQuestionIndex + 1,
            totalQuestions: loadedQuizQuestions.length
          }
        });
      }
    }

    // Broadcast reveal to player devices
    if (loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      broadcastAnswerReveal(currentQuestion);
    }

    setIsQuizActive(false);
    // Save current response times when revealing answer
    setLastResponseTimes(prev => ({ ...prev, ...teamResponseTimes }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeRemaining(mockQuestions[currentQuestionIndex + 1].timeLimit);
      setShowAnswer(false);
      setIsQuizActive(false);
      // Clear response times for new question
      setTeamResponseTimes({});
      setLastResponseTimes({});
    }
  };

  const handleStartTimer = () => {
    setIsQuizActive(true);
    setTimeRemaining(currentQuestion.timeLimit);
    setShowAnswer(false);
    setShowTeamAnswers(true); // Enable answer display when timer starts
    // Clear response times when starting timer for new question
    setTeamResponseTimes({});
    setLastResponseTimes({});
    setGameTimerStartTime(null); // Reset timer start time for new question
  };

  const handleResetQuestion = () => {
    setTimeRemaining(currentQuestion.timeLimit);
    setShowAnswer(false);
    setIsQuizActive(false);
    // Clear response times when resetting question
    setTeamResponseTimes({});
    setLastResponseTimes({});
    setGameTimerStartTime(null); // Reset timer start time for new question
  };

  const handleDisplayModeChange = (mode: "basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "timer" | "correctAnswer") => {
    console.log('[handleDisplayModeChange] Display mode changing to:', mode);
    setDisplayMode(mode);

    // Remember user's preference for non-leaderboard modes
    if (mode === "basic" || mode === "slideshow" || mode === "scores") {
      console.log('[handleDisplayModeChange] Saving user preference:', mode);
      setUserSelectedDisplayMode(mode);
    }

    // Update external display if open
    if (externalWindow && !externalWindow.closed) {
      console.log('[handleDisplayModeChange] External window is open, updating display with mode:', mode);
      updateExternalDisplay(externalWindow, mode);
    } else {
      console.log('[handleDisplayModeChange] External window not available or closed', { hasWindow: !!externalWindow, isClosed: externalWindow?.closed });
    }
  };

  const handleImagesChange = (newImages: StoredImage[]) => {
    setImages(newImages);
    
    // Update external display if open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, displayMode);
    }
  };

  // Load images from persistent storage on component mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        // Try to migrate from IndexedDB if needed
        await projectImageStorage.migrateFromIndexedDB();
        const storedImages = await projectImageStorage.getAllImages();
        setImages(storedImages);
      } catch (error) {
        console.error('Failed to load images:', error);
      }
    };
    loadImages();
  }, []);

  // Initialize current round scores with defaults when quiz pack is loaded
  useEffect(() => {
    if (showQuizPackDisplay) {
      setCurrentRoundPoints(defaultPoints);
      setCurrentRoundSpeedBonus(defaultSpeedBonus);
    }
  }, [showQuizPackDisplay, defaultPoints, defaultSpeedBonus]);

  // Also reset current round scores when default settings change
  useEffect(() => {
    setCurrentRoundPoints(defaultPoints);
    setCurrentRoundSpeedBonus(defaultSpeedBonus);
  }, [defaultPoints, defaultSpeedBonus]);

  const handleDisplaySettings = () => {
    setShowDisplaySettings(true);
  };

  const handleHandsetSettings = () => {
    // Handle handset settings
    console.log("Opening handset settings");
  };

  const handlePlayerDevicesSettings = () => {
    setShowPlayerDevicesSettings(true);
  };

  // State and ref for debouncing mode changes
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modeChangedAtRef = useRef<number>(0); // Track when mode was last changed to avoid interfering broadcasts

  const handlePlayerDevicesDisplayModeChange = async (mode: "basic" | "slideshow" | "scores") => {
    console.log('[QuizHost] handlePlayerDevicesDisplayModeChange called with mode:', mode);

    // Track that mode was just changed (to prevent scores effect from interfering)
    modeChangedAtRef.current = Date.now();

    // Immediately update the UI for responsiveness
    setPlayerDevicesDisplayMode(mode);
    console.log('[QuizHost] UI state updated to:', mode);

    // Clear any existing timeout
    if (broadcastTimeoutRef.current) {
      console.log('[QuizHost] Clearing previous broadcast timeout (rapid click detected)');
      clearTimeout(broadcastTimeoutRef.current);
    }

    // Schedule the broadcast for 2 seconds from now
    // Use the mode parameter directly (not state) to capture the correct value in the closure
    console.log('[QuizHost] Scheduling broadcast in 2 seconds for mode:', mode);
    broadcastTimeoutRef.current = setTimeout(() => {
      console.log('[QuizHost] 2-second delay complete, broadcasting mode:', mode);
      if (mode) {
        broadcastPlayerDisplayMode(mode, true);
      }
      broadcastTimeoutRef.current = null;
    }, 2000);
  };

  const handlePlayerDevicesSlideshowSecondsChange = async (seconds: number) => {
    setPlayerDevicesSlideshowSeconds(seconds);
    // Broadcast speed change immediately for slideshow (not an explicit mode change, so no transition delay)
    broadcastPlayerDisplayMode(playerDevicesDisplayMode, false);
  };

  const broadcastPlayerDisplayMode = useCallback(async (mode: "basic" | "slideshow" | "scores", isExplicitChange: boolean = false) => {
    // Broadcast display mode to all connected player devices
    try {
      const api = (window as any).api;
      const hasApi = api?.network?.broadcastDisplayMode;

      if (hasApi) {
        const broadcastData: any = {
          displayMode: mode,
          displayTransitionDelay: isExplicitChange ? 2000 : 0, // 2s delay only for explicit user-triggered changes
        };

        if (mode === 'slideshow') {
          broadcastData.images = playerDevicesImages.map((img, idx) => ({
            id: `img-${idx}`,
            path: img.url,
            name: img.name || `Image ${idx + 1}`
          }));
          broadcastData.rotationInterval = playerDevicesSlideshowSeconds * 1000; // Convert seconds to milliseconds
        } else if (mode === 'scores') {
          // Get current scores from the current quizzes (using ref to avoid dependency)
          const currentQuizzes = quizzesRef.current;
          console.log('[QuizHost] Building scores from quizzes array, count:', currentQuizzes?.length || 0);
          const sortedQuizzes = [...currentQuizzes].sort((a, b) => (b.score || 0) - (a.score || 0));
          broadcastData.scores = sortedQuizzes.map((q, idx) => ({
            id: q.id,
            name: q.name,
            score: q.score || 0,
            position: idx + 1
          }));
          console.log('[QuizHost] Scores being broadcasted:', broadcastData.scores);
          console.log('[QuizHost] Full broadcastData for scores mode:', broadcastData);
        }

        console.log('[QuizHost] Full broadcast data:', broadcastData);
        await (window as any).api.network.broadcastDisplayMode(broadcastData);
        console.log('[QuizHost] Display mode broadcasted to players:', mode);
      } else {
        console.warn('[QuizHost] broadcastDisplayMode API not available (may be running in browser mode without backend)');
      }
    } catch (error) {
      console.error('[QuizHost] Error broadcasting display mode:', error);
    }
  }, [playerDevicesImages, playerDevicesSlideshowSeconds]);

  // Cleanup broadcast timeout on component unmount
  useEffect(() => {
    return () => {
      if (broadcastTimeoutRef.current) {
        console.log('[QuizHost] Cleaning up broadcast timeout on unmount');
        clearTimeout(broadcastTimeoutRef.current);
      }
    };
  }, []);

  const handlePlayerDevicesImagesChange = (images: StoredImage[]) => {
    setPlayerDevicesImages(images);
  };

  const handleToggleHostController = () => {
    if (!hostControllerEnabled) {
      // Generate a random 4-digit code
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setHostControllerCode(code);
      setShowHostControllerCode(true);
      setHostControllerEnabled(true);
    } else {
      // Disable controller
      setHostControllerEnabled(false);
      setShowHostControllerCode(false);
    }
  };

  const handleSettingsOpen = () => {
    setShowSettings(true);
  };

  // Re-broadcast scores to players when quizzes change and display mode is 'scores'
  useEffect(() => {
    if (playerDevicesDisplayMode === 'scores') {
      // Check if mode was just switched - if so, skip this broadcast to let the main handler's 2-second delay take effect
      const timeSinceModeChange = Date.now() - modeChangedAtRef.current;
      if (timeSinceModeChange < 3000) {
        console.log('[QuizHost] Mode just switched, skipping scores broadcast to avoid interfering with 2-second delay');
        return;
      }

      console.log('[QuizHost] Quiz scores changed, re-broadcasting to players in scores mode');
      // Use a small debounce to avoid sending too many updates
      const timeoutId = setTimeout(() => {
        broadcastPlayerDisplayMode('scores');
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [quizzes, playerDevicesDisplayMode, broadcastPlayerDisplayMode]);

  // Periodic heartbeat to sync player display mode - ensures reliability even if messages are missed
  // Broadcasts every 2 seconds to guarantee devices receive updates (respects the 2s debounce delay for initial broadcast)
  // IMPORTANT: Paused during active games to prevent display modes from interrupting question screens
  useEffect(() => {
    // Check if any game mode is currently active
    const isGameActive = showKeypadInterface || showBuzzInInterface || showNearestWinsInterface || showQuizPackDisplay || showWheelSpinnerInterface;

    // Don't broadcast display mode while a game is actively running
    // This prevents the BASIC/SCORES/SLIDESHOW modes from interrupting the question screen on player devices
    if (isGameActive) {
      console.log('[QuizHost] Game is active - pausing periodic display mode sync to prevent interruption');
      return;
    }

    const syncInterval = setInterval(() => {
      console.log('[QuizHost] Periodic sync (2s) - re-broadcasting current mode:', playerDevicesDisplayMode);
      broadcastPlayerDisplayMode(playerDevicesDisplayMode);
    }, 2000); // Every 2 seconds for reliable delivery

    return () => clearInterval(syncInterval);
  }, [playerDevicesDisplayMode, broadcastPlayerDisplayMode, showKeypadInterface, showBuzzInInterface, showNearestWinsInterface, showQuizPackDisplay, showWheelSpinnerInterface]);

  const handleSpeedChange = (speed: number) => {
    setSlideshowSpeed(speed);

    // Update external display if open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, displayMode);
    }
  };

  const openExternalDisplay = async () => {
    if (externalWindow && !externalWindow.closed) {
      externalWindow.focus();
      return;
    }

    // Clear if previously closed
    if (externalWindow && externalWindow.closed) {
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }

    // Check if we're in Electron
    const isElectron = Boolean((window as any).api);

    if (isElectron) {
      // In Electron: use IPC to create the external window in the main process
      try {
        await (window as any).api.ipc.invoke('app/open-external-display');
        // Use a special marker object to indicate we're using Electron's external window
        // The actual window is managed by Electron main process
        setExternalWindow({ _isElectronWindow: true } as any);
        setIsExternalDisplayOpen(true);

        // Wait for the external display window to load and set up listeners
        setTimeout(() => {
          console.log('[QuizHost] Sending initial display mode to external window:', userSelectedDisplayMode);
          updateExternalDisplay({ _isElectronWindow: true } as any, userSelectedDisplayMode);
        }, 800);
      } catch (error) {
        console.error('Failed to open external display:', error);
        alert('Failed to open external display window.');
      }
    } else {
      // In browser: use window.open with the app URL
      const appUrl = window.location.origin + '?external=1';

      const newWindow = window.open(
        appUrl,
        'externalDisplay',
        'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
      );

      if (newWindow) {
        setExternalWindow(newWindow);
        setIsExternalDisplayOpen(true);

        // Wait for the external display app to load and set up its message listener
        setTimeout(() => {
          console.log('[QuizHost] Sending initial display mode to browser window:', userSelectedDisplayMode);
          updateExternalDisplay(newWindow, userSelectedDisplayMode);
        }, 800);
      } else {
        alert('Please allow popups for this site to enable external display.');
      }
    }
  };

  const openExternalDisplaySimple = (): void => {
    if (externalWindow && !externalWindow.closed) {
      externalWindow.focus();
      return;
    }
    if (externalWindow && externalWindow.closed) {
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }

    const newWindow = window.open(
      'about:blank',
      'externalDisplay',
      'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );

    if (!newWindow) {
      alert('Please allow popups for this site to enable external display.');
      return;
    }

    setExternalWindow(newWindow);
    setIsExternalDisplayOpen(true);

    const checkClosed = setInterval(() => {
      if (newWindow.closed) {
        clearInterval(checkClosed);
        setExternalWindow(null);
        setIsExternalDisplayOpen(false);
      }
    }, 1000);

    setTimeout(() => {
      console.log('[QuizHost] Sending initial display mode to blank window:', userSelectedDisplayMode);
      updateExternalDisplay(newWindow, userSelectedDisplayMode);
    }, 800);
  };

  const closeExternalDisplay = () => {
    if (externalWindow) {
      // Only call .close() on browser windows, not on Electron marker objects
      if (!(externalWindow as any)._isElectronWindow && typeof (externalWindow as any).close === 'function') {
        externalWindow.close();
      }
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }
  };

  const toggleExternalDisplay = () => {
    if (isExternalDisplayOpen && externalWindow) {
      closeExternalDisplay();
    } else {
      // Use the simplified external display opener which loads the SPA route
      openExternalDisplay();
      //openExternalDisplaySimple();
    }
  };

  const updateExternalDisplay = (displayWindow: Window, mode: string, data?: any) => {
    if (!displayWindow) return;

    // Check if this is an Electron window marker
    const isElectronWindow = (displayWindow as any)._isElectronWindow;

    const messageData = {
      type: 'DISPLAY_UPDATE',
      mode: mode,
      data: data,
      images: images,
      quizzes: quizzes,
      slideshowSpeed: slideshowSpeed,
      leaderboardData: leaderboardData,
      revealedTeams: revealedTeams,
      timerValue: (mode === 'timer' || mode === 'nearest-wins-timer') ? data?.timerValue : null,
      correctAnswer: mode === 'correctAnswer' ? data : null,
      fastestTeamData: (mode === 'fastestTeam' || mode === 'fastTrack') ? data : null,
      countdownStyle: countdownStyle,
      gameMode: getCurrentGameMode(),
      gameModeTimers: gameModeTimers,
      questionInfo: data?.questionInfo || {
        number: currentQuestionIndex + 1,
        type: 'Multiple Choice',
        total: mockQuestions.length
      },
      targetNumber: mode.includes('nearest-wins') ? data?.targetNumber : undefined,
      questionNumber: mode.includes('nearest-wins') ? data?.questionNumber : undefined,
      results: mode === 'nearest-wins-results' ? data?.results : undefined,
      answerRevealed: mode === 'nearest-wins-results' ? data?.answerRevealed : undefined,
      gameInfo: mode.includes('nearest-wins') ? data?.gameInfo : undefined,
    };

    if (isElectronWindow) {
      // Send via IPC for Electron windows - use global window object, not the marker parameter
      console.log('[updateExternalDisplay] Sending to Electron external display with mode:', mode);
      (window as any).api?.ipc?.send('external-display/update', messageData);
    } else {
      // Send via postMessage for browser windows
      if (!displayWindow.closed) {
        console.log('[updateExternalDisplay] Sending to Browser external display with mode:', mode);
        displayWindow.postMessage(messageData, '*');
      }
    }
  };

  const handleExternalDisplayUpdate = useCallback((content: string, data?: any) => {
    console.log('QuizHost: handleExternalDisplayUpdate called with', { content, data });

    // Check if external window exists (either Electron or browser)
    const isElectronWindow = externalWindow && (externalWindow as any)._isElectronWindow;
    const isBrowserWindow = externalWindow && !isElectronWindow && !(externalWindow as any).closed;

    if (externalWindow && (isElectronWindow || isBrowserWindow)) {
      const messageData = {
        type: 'DISPLAY_UPDATE',
        mode: content,
        data: data,
        images: images,
        quizzes: quizzes,
        slideshowSpeed: slideshowSpeed,
        leaderboardData: leaderboardData,
        revealedTeams: revealedTeams,
        timerValue: (content === 'timer' || content === 'nearest-wins-timer') ? data?.timerValue : null,
        correctAnswer: content === 'correctAnswer' ? data : null,
        fastestTeamData: (content === 'fastestTeam' || content === 'fastTrack') ? data : null,
        countdownStyle: countdownStyle,
        gameMode: getCurrentGameMode(),
        gameModeTimers: gameModeTimers,

        questionInfo: content === 'question' ? data?.questionInfo : {
          number: currentQuestionIndex + 1,
          type: 'Multiple Choice',
          total: mockQuestions.length
        },

        currentMode: content,

        targetNumber: content.includes('nearest-wins') ? data?.targetNumber : undefined,
        questionNumber: content.includes('nearest-wins') ? data?.questionNumber : undefined,
        results: content === 'nearest-wins-results' ? data?.results : undefined,
        answerRevealed: content === 'nearest-wins-results' ? data?.answerRevealed : undefined,
        gameInfo: content.includes('nearest-wins') ? data?.gameInfo : undefined,

        wheelSpinnerData: content === 'wheel-spinner' ? data : undefined,

        teamName: content === 'team-welcome' ? data?.teamName : undefined,

        isReset: content === 'basic'
      };

      console.log('QuizHost: Sending message to external display', messageData);

      if (isElectronWindow) {
        // Send via IPC for Electron windows
        (window as any).api?.ipc?.send('external-display/update', messageData);
      } else if (isBrowserWindow) {
        // Send via postMessage for browser windows
        externalWindow.postMessage(messageData, '*');
      }
    }
  }, [externalWindow, images, quizzes, slideshowSpeed, leaderboardData, revealedTeams, currentQuestionIndex, getCurrentGameMode, countdownStyle, gameModeTimers]);



  // Reset external display when switching away from leaderboard-reveal tab
  useEffect(() => {
    if (activeTab !== "leaderboard-reveal") {
      // Return to user's preferred display mode
      setDisplayMode(userSelectedDisplayMode);
      setLeaderboardData(null);
      setRevealedTeams([]);
      
      // Update external display if open
      if (externalWindow && !externalWindow.closed) {
        updateExternalDisplay(externalWindow, userSelectedDisplayMode);
      }
    }
  }, [activeTab, userSelectedDisplayMode, externalWindow]);

  // Enhanced team management functions
  const handleQuizSelect = (quizId: string) => {
    const quiz = quizzes.find(q => q.id === quizId);
    setSelectedQuiz(quiz || null);
  };

  const handleScoreChange = useCallback((teamId: string, change: number) => {
    console.log('[Scoring] handleScoreChange called:', { teamId, change });
    // Check if scores are paused
    if (scoresPaused) {
      console.log(`[Scoring] Scores are paused. Ignoring score change of ${change > 0 ? '+' : ''}${change} for team ${teamId}`);
      return;
    }

    setQuizzes(prevQuizzes => {
      const newQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId && quiz.score !== undefined) {
          // Check if team is blocked from earning points (only block positive changes)
          if (quiz.blocked && change > 0) {
            console.log(`[Scoring] Team ${teamId} (${quiz.name}) is blocked from earning points. Ignoring +${change} points.`);
            return quiz; // Return unchanged
          }
          const newScore = quiz.score + change;
          console.log(`[Scoring] Team ${teamId} (${quiz.name}) score updated: ${quiz.score} -> ${newScore}`);
          return { ...quiz, score: newScore };
        }
        return quiz;
      });
      
      // Set pending sort state for visual feedback
      setPendingSort(true);
      
      // Clear existing timeout
      if (sortTimeoutRef.current) {
        clearTimeout(sortTimeoutRef.current);
      }
      
      // Set timeout to sort and clear pending state
      sortTimeoutRef.current = setTimeout(() => {
        setQuizzes(currentQuizzes => {
          const sortedTeams = [...currentQuizzes];
          
          if (scoresHidden) {
            // Sort alphabetically when scores are hidden
            sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
          } else {
            // Sort based on current team layout mode when scores are visible
            switch (teamLayoutMode) {
              case 'alphabetical':
                sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
                break;
              case 'random':
                // Fisher-Yates shuffle algorithm for proper randomization
                for (let i = sortedTeams.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [sortedTeams[i], sortedTeams[j]] = [sortedTeams[j], sortedTeams[i]];
                }
                break;
              case 'default':
              default:
                sortedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            }
          }
          
          return sortedTeams;
        });
        setPendingSort(false);
      }, 500);
      
      return newQuizzes;
    });
  }, [teamLayoutMode, scoresHidden, scoresPaused]);

  // Create handleComputeAndAwardScores from factory function with useCallback
  const handleComputeAndAwardScores = useCallback(
    (correctTeamIds: string[], gameMode: 'keypad' | 'buzzin' | 'nearestwins' | 'wheelspinner', fastestTeamId?: string, teamResponseTimes?: { [teamId: string]: number }, forcePlaySound?: boolean) => {
      console.log('[Scoring] handleComputeAndAwardScores called with:', { correctTeamIds, gameMode, fastestTeamId, teamResponseTimes, forcePlaySound });

      // Play sound for on-the-spot keypad mode or when forced
      if (gameMode === 'keypad' || forcePlaySound) {
        console.log('[Scoring] Playing sound - gameMode:', gameMode, 'forcePlaySound:', forcePlaySound, 'correctTeamIds.length:', correctTeamIds.length);
        if (correctTeamIds.length > 0) {
          console.log('[Scoring] Playing applause sound');
          playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
        } else {
          console.log('[Scoring] Playing fail sound');
          playFailSound().catch(err => console.warn('Failed to play fail sound:', err));
        }
      }

      const handler = createHandleComputeAndAwardScores(
        quizzes,
        teamAnswers,
        teamAnswerCounts,
        currentRoundPoints,
        currentRoundSpeedBonus,
        defaultPoints,
        defaultSpeedBonus,
        scoresPaused,
        staggeredEnabled,
        goWideEnabled,
        evilModeEnabled,
        punishmentEnabled,
        handleScoreChange
      );
      const result = handler(correctTeamIds, gameMode, fastestTeamId, teamResponseTimes);
      console.log('[Scoring] handleComputeAndAwardScores completed, result:', result);
      return result;
    },
    [
      quizzes,
      teamAnswers,
      teamAnswerCounts,
      currentRoundPoints,
      currentRoundSpeedBonus,
      defaultPoints,
      defaultSpeedBonus,
      scoresPaused,
      staggeredEnabled,
      goWideEnabled,
      evilModeEnabled,
      punishmentEnabled,
      handleScoreChange,
      playApplauseSound,
      playFailSound
    ]
  );

  // Keep backward compatibility alias
  const handleAwardPointsWithScoring = handleComputeAndAwardScores;

  // Create handleApplyEvilModePenalty from factory function with useCallback
  const handleApplyEvilModePenalty = useCallback(
    (wrongTeamIds: string[], noAnswerTeamIds: string[], gameMode: 'keypad' | 'buzzin' | 'nearestwins' | 'wheelspinner') => {
      const handler = createHandleApplyEvilModePenalty(
        quizzes,
        currentRoundPoints,
        defaultPoints,
        evilModeEnabled,
        punishmentEnabled,
        scoresPaused,
        handleScoreChange
      );
      return handler(wrongTeamIds, noAnswerTeamIds, gameMode);
    },
    [
      quizzes,
      currentRoundPoints,
      defaultPoints,
      evilModeEnabled,
      punishmentEnabled,
      scoresPaused,
      handleScoreChange
    ]
  );

  // Create handleNearestWinsAwardPoints wrapper for nearest wins mode
  const handleNearestWinsAwardPoints = useCallback(
    (correctTeamIds: string[], gameMode: 'nearestwins') => {
      if (gameMode === 'nearestwins' && correctTeamIds.length > 0) {
        // Award fixed points to the winner
        correctTeamIds.forEach(teamId => {
          handleScoreChange(teamId, currentRoundWinnerPoints || 0);
        });
      }
    },
    [currentRoundWinnerPoints, handleScoreChange]
  );

  const handleScoreSet = useCallback((teamId: string, newScore: number) => {
    // Check if scores are paused
    if (scoresPaused) {
      console.log(`Scores are paused. Cannot set score for team ${teamId}`);
      return;
    }
    
    setQuizzes(prevQuizzes => {
      const newQuizzes = prevQuizzes.map(quiz =>
        quiz.id === teamId ? { ...quiz, score: newScore } : quiz
      );
      
      // Set pending sort state for visual feedback
      setPendingSort(true);
      
      // Clear existing timeout
      if (sortTimeoutRef.current) {
        clearTimeout(sortTimeoutRef.current);
      }
      
      // Set timeout to sort and clear pending state
      sortTimeoutRef.current = setTimeout(() => {
        setQuizzes(currentQuizzes => {
          const sortedTeams = [...currentQuizzes];
          
          if (scoresHidden) {
            // Sort alphabetically when scores are hidden
            sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
          } else {
            // Sort based on current team layout mode when scores are visible
            switch (teamLayoutMode) {
              case 'alphabetical':
                sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
                break;
              case 'random':
                // Fisher-Yates shuffle algorithm for proper randomization
                for (let i = sortedTeams.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [sortedTeams[i], sortedTeams[j]] = [sortedTeams[j], sortedTeams[i]];
                }
                break;
              case 'default':
              default:
                sortedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            }
          }
          
          return sortedTeams;
        });
        setPendingSort(false);
      }, 500);
      
      return newQuizzes;
    });
  }, [teamLayoutMode, scoresHidden, scoresPaused]);

  const handleNameChange = (teamId: string, newName: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId ? { ...quiz, name: newName } : quiz
      )
    );
  };

  // Delete team functionality
  const handleDeleteTeam = (teamId: string, teamName: string, score: number) => {
    // If team has no points (score is 0), delete immediately
    if (score === 0) {
      setQuizzes(prevQuizzes => 
        prevQuizzes.filter(quiz => quiz.id !== teamId)
      );
    } else {
      // If team has points, show confirmation dialog
      setTeamToDelete({ id: teamId, name: teamName, score });
      setShowDeleteConfirm(true);
    }
  };

  const confirmDeleteTeam = () => {
    if (teamToDelete) {
      setQuizzes(prevQuizzes => 
        prevQuizzes.filter(quiz => quiz.id !== teamToDelete.id)
      );
      setTeamToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const cancelDeleteTeam = () => {
    setTeamToDelete(null);
    setShowDeleteConfirm(false);
  };

  // Handle hiding/showing scores and positions
  const handleToggleHideScores = () => {
    setScoresHidden(prev => {
      const newScoresHidden = !prev;
      
      // Re-sort teams based on new visibility state
      setQuizzes(currentQuizzes => {
        const sortedTeams = [...currentQuizzes];
        if (newScoresHidden) {
          // Sort alphabetically when scores are hidden
          sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          // Sort by score (highest first) when scores are visible
          sortedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
        }
        return sortedTeams;
      });
      
      return newScoresHidden;
    });
  };

  // Handle changing team layout mode - cycles through default -> alphabetical -> random
  const handleChangeTeamLayout = () => {
    setTeamLayoutMode(prevMode => {
      let newMode: 'default' | 'alphabetical' | 'random';
      
      // Cycle through the modes
      switch (prevMode) {
        case 'default':
          newMode = 'alphabetical';
          break;
        case 'alphabetical':
          newMode = 'random';
          break;
        case 'random':
          newMode = 'default';
          break;
        default:
          newMode = 'default';
      }
      
      // Re-sort teams based on new layout mode
      setQuizzes(currentQuizzes => {
        const sortedTeams = [...currentQuizzes];
        
        switch (newMode) {
          case 'alphabetical':
            sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'random':
            // Fisher-Yates shuffle algorithm for proper randomization
            for (let i = sortedTeams.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [sortedTeams[i], sortedTeams[j]] = [sortedTeams[j], sortedTeams[i]];
            }
            break;
          case 'default':
          default:
            sortedTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
            break;
        }
        
        return sortedTeams;
      });
      
      return newMode;
    });
  };

  // Handle team double-click to open team window
  const handleTeamDoubleClick = (teamId: string) => {
    setSelectedTeamForWindow(teamId);
  };

  // Handle closing team window
  const handleCloseTeamWindow = () => {
    setSelectedTeamForWindow(null);
  };

  // Handle team location change
  const handleTeamLocationChange = (teamId: string, location: { x: number; y: number }) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId ? { ...quiz, location } : quiz
      )
    );
  };

  // Handle buzzer change
  const handleBuzzerChange = (teamId: string, buzzerSound: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId ? { ...quiz, buzzerSound } : quiz
      )
    );
  };

  // Handle background color change
  const handleBackgroundColorChange = (teamId: string, backgroundColor: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId ? { ...quiz, backgroundColor } : quiz
      )
    );
  };

  // Handle photo upload
  const handlePhotoUpload = (teamId: string, photoUrl: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId ? { ...quiz, photoUrl } : quiz
      )
    );
  };

  // Handle kick team
  const handleKickTeam = (teamId: string) => {
    setQuizzes(prevQuizzes => prevQuizzes.filter(quiz => quiz.id !== teamId));
  };

  // Handle disconnect team
  const handleDisconnectTeam = (teamId: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId 
          ? { ...quiz, disconnected: true }
          : quiz
      )
    );
    console.log(`Team ${teamId} has been disconnected`);
  };

  // Handle reconnect team
  const handleReconnectTeam = (teamId: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId 
          ? { ...quiz, disconnected: false }
          : quiz
      )
    );
    console.log(`Team ${teamId} has been reconnected`);
  };

  // Handle block team
  const handleBlockTeam = (teamId: string, blocked: boolean) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId 
          ? { ...quiz, blocked }
          : quiz
      )
    );
    console.log(`Team ${teamId} has been ${blocked ? 'blocked' : 'unblocked'}`);
  };

  // Handle scramble team keypad
  const handleScrambleKeypad = (teamId: string) => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => 
        quiz.id === teamId 
          ? { ...quiz, scrambled: !quiz.scrambled }
          : quiz
      )
    );
    console.log(`Team ${teamId}'s keypad has been ${quizzes.find(q => q.id === teamId)?.scrambled ? 'unscrambled' : 'scrambled'}`);
  };

  // Handle global scramble keypad
  const handleGlobalScrambleKeypad = () => {
    const totalTeams = quizzes.length;
    const scrambledTeams = quizzes.filter(team => team.scrambled).length;
    
    // If more than half are scrambled, unscramble all
    // If half or less are scrambled, scramble all
    const shouldScrambleAll = scrambledTeams <= totalTeams / 2;
    
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => ({ ...quiz, scrambled: shouldScrambleAll }))
    );
    
    console.log(`${shouldScrambleAll ? 'Scrambled' : 'Unscrambled'} all team keypads`);
  };

  // Handle pause scores toggle
  const handlePauseScoresToggle = () => {
    setScoresPaused(prev => {
      const newState = !prev;
      console.log(`Scores ${newState ? 'paused' : 'unpaused'} - team scores ${newState ? 'cannot' : 'can'} be changed`);
      return newState;
    });
  };

  // Handle hot swap
  const handleHotSwap = (teamId: string) => {
    console.log(`Hot swapping device for team ${teamId}`);
  };

  // Clear all team scores
  const handleClearScores = () => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => ({ ...quiz, score: 0 }))
    );
  };

  // Empty lobby - delete all teams and clear crash recovery
  const handleEmptyLobby = async () => {
    setQuizzes([]);
    // Clear saved game state on crash recovery
    await clearGameState().catch(err => console.error('[Crash Recovery] Error clearing game state:', err));
  };

  // Handle host location change
  const handleHostLocationChange = (location: { x: number; y: number } | null) => {
    setHostLocation(location);
  };

  // Handle clear all locations (teams + host)
  const handleClearAllLocations = () => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => ({ ...quiz, location: undefined }))
    );
    setHostLocation(null);
  };

  // Determine primary button label based on flow state
  const getPrimaryButtonLabel = (): string => {
    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    const hasPicture = hasQuestionImage(currentQuestion);
    const isOnTheSpotMode = showKeypadInterface && !isQuizPackMode;

    switch (flowState.flow) {
      case 'ready':
        return hasPicture ? 'Send Picture' : 'Send Question';
      case 'sent-picture':
        return 'Send Question';
      case 'sent-question':
        return 'Start Timer';
      case 'running':
      case 'timeup':
        return 'Reveal Answer';
      case 'revealed':
        return isOnTheSpotMode ? 'Fastest Answer' : 'Fastest Team';
      case 'fastest':
        return currentLoadedQuestionIndex < loadedQuizQuestions.length - 1 ? 'Next Question' : 'End Round';
      case 'complete':
        return 'End Round';
      default:
        return 'Continue';
    }
  };

  const primaryButtonLabel = getPrimaryButtonLabel();

  const renderTabContent = () => {
    // Show team window when a team is double-clicked
    if (selectedTeamForWindow) {
      const team = quizzes.find(q => q.id === selectedTeamForWindow);
      if (team) {
        return (
          <TeamWindow 
            team={team} 
            hostLocation={hostLocation}
            onClose={handleCloseTeamWindow}
            onLocationChange={handleTeamLocationChange}
            onNameChange={handleNameChange}
            onBuzzerChange={handleBuzzerChange}
            onBackgroundColorChange={handleBackgroundColorChange}
            onPhotoUpload={handlePhotoUpload}
            onKickTeam={handleKickTeam}
            onDisconnectTeam={handleDisconnectTeam}
            onReconnectTeam={handleReconnectTeam}
            onBlockTeam={handleBlockTeam}
            onScrambleKeypad={handleScrambleKeypad}
            onHotSwap={handleHotSwap}
            onHostLocationChange={handleHostLocationChange}
            onClearAllLocations={handleClearAllLocations}
          />
        );
      }
    }

    // Show buzz-in display when active
    if (showBuzzInMode && buzzInConfig) {
      const teamData = quizzes.map(quiz => ({
        id: quiz.id,
        name: quiz.name,
        color: getTeamColor(quiz.id)
      }));
      
      return (
        <div className="flex-1 overflow-hidden">
          <BuzzInDisplay
            mode={buzzInConfig.mode}
            points={buzzInConfig.points}
            soundCheck={buzzInConfig.soundCheck}
            teams={teamData}
            onEndRound={handleBuzzInEnd}
          />
        </div>
      );
    }

    // Show quiz pack display in center when active
    if (showQuizPackDisplay && flowState.isQuestionMode) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];

      return (
        <div className="flex-1 relative min-h-0">
          {/* Main question display */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <QuestionPanel
              question={currentQuestion}
              questionNumber={currentLoadedQuestionIndex + 1}
              totalQuestions={loadedQuizQuestions.length}
              showAnswer={flowState.flow === 'timeup' || flowState.flow === 'revealed' || flowState.flow === 'fastest' || flowState.flow === 'complete'}
              answerText={currentQuestion?.answerText}
              correctIndex={currentQuestion?.correctIndex}
            />
          </div>
          {/* Show fastest team display as an overlay in quiz pack mode */}
          {showFastestTeamDisplay && (
            <div className="absolute inset-0 overflow-hidden z-50">
              <FastestTeamDisplay
                fastestTeam={fastestTeamData}
                teams={quizzes}
                hostLocation={hostLocation}
                onClose={handleFastestTeamClose}
                onFastestTeamLocationChange={handleTeamLocationChange}
                onHostLocationChange={handleHostLocationChange}
                onScrambleKeypad={handleScrambleKeypad}
                onBlockTeam={handleBlockTeam}
              />
            </div>
          )}
        </div>
      );
    }

    // Show keypad interface in center when active
    // When fastest team display is shown, it will overlay on top while keeping keypad mounted
    if (showKeypadInterface) {
      return (
        <div className="flex-1 relative min-h-0">
          {/* Keypad interface - always rendered when active */}
          <div className="flex-1 overflow-hidden">
            <KeypadInterface
              key={keypadInstanceKey}
              onBack={handleKeypadClose}
              onHome={() => setActiveTab("home")}
              externalWindow={externalWindow}
              onExternalDisplayUpdate={handleExternalDisplayUpdate}
              teams={quizzes}
              teamAnswers={teamAnswers}
              onTeamAnswerUpdate={handleTeamAnswerUpdate}
              onTeamResponseTimeUpdate={handleTeamResponseTimeUpdate}
              onAwardPoints={handleAwardPointsWithScoring}
              onEvilModePenalty={handleApplyEvilModePenalty}
              currentRoundPoints={currentRoundPoints}
              currentRoundSpeedBonus={currentRoundSpeedBonus}
              onCurrentRoundPointsChange={handleCurrentRoundPointsChange}
              onCurrentRoundSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
              onFastestTeamReveal={handleFastestTeamReveal}
              triggerNextQuestion={keypadNextQuestionTrigger}
              onAnswerStatusUpdate={handleTeamAnswerStatusUpdate}
              onFastTrack={handleScoreChange}
              loadedQuestions={loadedQuizQuestions}
              currentQuestionIndex={currentLoadedQuestionIndex}
              isQuizPackMode={isQuizPackMode}
              onGetActionHandlers={setGameActionHandlers}
              onGameTimerStateChange={setGameTimerRunning}
              onCurrentScreenChange={setKeypadCurrentScreen}
              onGameTimerUpdate={(remaining, total) => {
                setGameTimerTimeRemaining(remaining);
                setGameTimerTotalTime(total);
              }}
              onGameTimerFinished={setGameTimerFinished}
              onGameAnswerRevealed={setGameAnswerRevealed}
              onGameFastestRevealed={setGameFastestRevealed}
              onTeamsAnsweredCorrectly={setTeamsAnsweredCorrectly}
              onGameAnswerSelected={setGameAnswerSelected}
              onTimerStart={handleGameTimerStart}
            />
          </div>
          {/* Show fastest team display as an overlay on top of keypad */}
          {showFastestTeamDisplay && (
            <div className="absolute inset-0 flex-1 overflow-hidden z-50">
              <FastestTeamDisplay
                fastestTeam={fastestTeamData}
                teams={quizzes}
                hostLocation={hostLocation}
                onClose={handleFastestTeamClose}
                onFastestTeamLocationChange={handleTeamLocationChange}
                onHostLocationChange={handleHostLocationChange}
                onScrambleKeypad={handleScrambleKeypad}
                onBlockTeam={handleBlockTeam}
              />
            </div>
          )}
        </div>
      );
    }

    // Show fastest team display for quiz pack mode (when keypad is not active)
    if (showFastestTeamDisplay) {
      return (
        <div className="flex-1 overflow-hidden">
          <FastestTeamDisplay
            fastestTeam={fastestTeamData}
            teams={quizzes}
            hostLocation={hostLocation}
            onClose={handleFastestTeamClose}
            onFastestTeamLocationChange={handleTeamLocationChange}
            onHostLocationChange={handleHostLocationChange}
            onScrambleKeypad={handleScrambleKeypad}
            onBlockTeam={handleBlockTeam}
          />
        </div>
      );
    }

    // Fallback to old QuizPackDisplay for config screen
    if (showQuizPackDisplay && !flowState.isQuestionMode) {
      return (
        <div className="flex-1 overflow-hidden h-full w-full flex">
          <QuizPackDisplay
            questions={loadedQuizQuestions}
            currentQuestionIndex={currentLoadedQuestionIndex}
            onPreviousQuestion={handleQuizPackPrevious}
            onNextQuestion={handleQuizPackNext}
            onBack={handleQuizPackClose}
            totalTeams={quizzes.length}
            onStartQuiz={handleStartQuiz}
            onStartRoundWithQuestion={handleStartRoundWithQuestion}
            onPointsChange={handleCurrentRoundPointsChange}
            onSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
            currentRoundPoints={currentRoundPoints}
            currentRoundSpeedBonus={currentRoundSpeedBonus}
            onGameTimerStateChange={setGameTimerRunning}
          />
        </div>
      );
    }

    // Show buzz-in interface in center when active
    if (showBuzzInInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <BuzzInInterface
            teams={quizzes}
            onStartMode={handleBuzzInStart}
            onClose={handleBuzzInClose}
            externalWindow={externalWindow}
            onExternalDisplayUpdate={handleExternalDisplayUpdate}
            onAwardPoints={handleComputeAndAwardScores}
            onEvilModePenalty={handleApplyEvilModePenalty}
          />
        </div>
      );
    }

    // Show nearest wins interface in center when active
    if (showNearestWinsInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <NearestWinsInterface
            teams={quizzes}
            onClose={handleNearestWinsClick}
            currentRoundWinnerPoints={currentRoundWinnerPoints}
            onWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
            externalWindow={externalWindow}
            onExternalDisplayUpdate={handleExternalDisplayUpdate}
            onAwardPoints={handleNearestWinsAwardPoints}
            onGetActionHandlers={setGameActionHandlers}
            onGameTimerStateChange={setGameTimerRunning}
            onCurrentScreenChange={setNearestWinsCurrentScreen}
            onGameTimerUpdate={(remaining, total) => {
              setGameTimerTimeRemaining(remaining);
              setGameTimerTotalTime(total);
            }}
          />
        </div>
      );
    }

    // Show wheel spinner interface in center when active
    if (showWheelSpinnerInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <WheelSpinnerInterface
            teams={quizzes}
            onClose={handleWheelSpinnerClose}
            externalWindow={externalWindow}
            onExternalDisplayUpdate={handleExternalDisplayUpdate}
            onAwardPoints={handleScoreChange}
          />
        </div>
      );
    }

    // Show buzzers management when active
    if (showBuzzersManagement) {
      return (
        <div className="flex-1 overflow-hidden">
          <BuzzersManagement 
            teams={quizzes}
            onBuzzerChange={handleBuzzerChange}
            onClose={handleCloseBuzzersManagement}
            onShowTeamOnDisplay={handleShowTeamOnDisplay}
          />
        </div>
      );
    }

    switch (activeTab) {
      case "home":
        return (
          <div className="flex-1 overflow-hidden">
            <QuestionDisplay
              question={currentQuestion}
              timeRemaining={timeRemaining}
              showAnswer={showAnswer}
              
              onStart={handleStartTimer}
              onReveal={handleRevealAnswer}
              onNext={handleNextQuestion}
              onReset={handleResetQuestion}
              currentIndex={currentQuestionIndex}
              totalQuestions={mockQuestions.length}
            />
          </div>
        );
      case "handset":
        return (
          <div className="flex-1 overflow-hidden">
            <QuestionDisplay
              question={currentQuestion}
              timeRemaining={timeRemaining}
              showAnswer={showAnswer}
              
              onStart={handleStartTimer}
              onReveal={handleRevealAnswer}
              onNext={handleNextQuestion}
              onReset={handleResetQuestion}
              currentIndex={currentQuestionIndex}
              totalQuestions={mockQuestions.length}
            />
          </div>
        );
      case "leaderboard-reveal":
        return (
          <div className="flex-1 overflow-hidden">
            <LeaderboardReveal 
              quizzes={quizzes}
              onExternalDisplayUpdate={handleExternalDisplayUpdate}
            />
          </div>
        );
      case "user-status":
        return (
          <div className="flex-1 overflow-hidden">
            <UserStatusTab />
          </div>
        );
      default:
        return (
          <div className="flex-1 overflow-hidden">
            <QuestionDisplay
              question={currentQuestion}
              timeRemaining={timeRemaining}
              showAnswer={showAnswer}
              
              onStart={handleStartTimer}
              onReveal={handleRevealAnswer}
              onNext={handleNextQuestion}
              onReset={handleResetQuestion}
              currentIndex={currentQuestionIndex}
              totalQuestions={mockQuestions.length}
            />
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Main layout - Use theme-aware background */}
      <div className="flex h-full">
        {/* Left resizable sidebar */}
        <Resizable
          size={{ width: sidebarWidth, height: "100%" }}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          minWidth={200}
          maxWidth={600}
          enable={{ 
            top: false, 
            right: true, 
            bottom: false, 
            left: false, 
            topRight: false, 
            bottomRight: false, 
            bottomLeft: false, 
            topLeft: false 
          }}
          handleStyles={{
            right: {
              background: 'transparent',
              border: 'none',
              width: '8px',
              right: '-4px',
              cursor: 'col-resize',
            }
          }}
          className="flex-shrink-0"
        >
          <LeftSidebar
            quizzes={quizzes}
            selectedQuiz={selectedQuiz?.id || null}
            onQuizSelect={handleQuizSelect}
            onScoreChange={handleScoreChange}
            onScoreSet={handleScoreSet}
            onNameChange={handleNameChange}
            onDeleteTeam={handleDeleteTeam}
            onTeamDoubleClick={handleTeamDoubleClick}
            teamAnswers={getCurrentGameMode() !== null ? teamAnswers : {}}
            teamResponseTimes={getCurrentGameMode() !== null ? teamResponseTimes : {}}
            lastResponseTimes={getCurrentGameMode() !== null ? lastResponseTimes : {}}
            showAnswers={getCurrentGameMode() !== null && (showTeamAnswers || Object.keys(teamAnswers).length > 0 || Object.keys(teamResponseTimes).length > 0 || Object.keys(lastResponseTimes).length > 0)}
            scoresPaused={scoresPaused}
            scoresHidden={scoresHidden}
            teamAnswerStatuses={teamAnswerStatuses}
            teamCorrectRankings={teamCorrectRankings}
            pendingTeams={pendingTeams}
            onApprovePendingTeam={handleApproveTeam}
            onDeclinePendingTeam={handleDeclineTeam}
          />
        </Resizable>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top navigation - now on the right side */}
          <TopNavigation
            activeTab={selectedTeamForWindow ? "team-settings" as any : activeTab}
            onTabChange={handleTabChange}
            teamCount={participants.length}
            displayMode={userSelectedDisplayMode}
            onDisplayModeChange={handleDisplayModeChange}
            onHandsetSettings={handleHandsetSettings}
            onDisplaySettings={handleDisplaySettings}
            isExternalDisplayOpen={isExternalDisplayOpen}
            onExternalDisplayToggle={toggleExternalDisplay}
            onSettingsOpen={handleSettingsOpen}
            onPlayerDevicesSettings={handlePlayerDevicesSettings}
            playerDevicesDisplayMode={playerDevicesDisplayMode}
            onPlayerDevicesDisplayModeChange={handlePlayerDevicesDisplayModeChange}
          />

          {/* Content area with right panel */}
          <div className="flex flex-1 min-h-0">
            {/* Main content - theme-aware background */}
            <div className="flex-1 bg-background min-w-0 flex flex-col">
              {renderTabContent()}
            </div>

            {/* Right panel - fixed width - only show when no game modes are active and team window is closed and not in question mode */}
            {!showKeypadInterface && !showBuzzInInterface && !showNearestWinsInterface && !showWheelSpinnerInterface && !showBuzzInMode && !showFastestTeamDisplay && !selectedTeamForWindow && !showBuzzersManagement && !(showQuizPackDisplay && flowState.isQuestionMode) && (
              <div className="w-80 bg-background border-l border-border">
                <RightPanel
                  quizzes={quizzes}
                  onKeypadClick={handleKeypadClick}
                  onBuzzInClick={handleBuzzInClick}
                  onBuzzInStart={handleBuzzInStart}
                  onWheelSpinnerClick={handleWheelSpinnerClick}
                  onNearestWinsClick={handleNearestWinsClick}
                />
              </div>
            )}
          </div>

          {/* Question Navigation Bar - All Game Modes */}
          <QuestionNavigationBar
            isVisible={
              // Show for quiz pack mode when in question mode
              (flowState.isQuestionMode && showQuizPackDisplay) ||
              // Show for on-the-spot keypad when in a game-playing screen or results
              (showKeypadInterface && ['letters-game', 'multiple-choice-game', 'numbers-game', 'sequence-game', 'quiz-pack-question', 'results'].includes(keypadCurrentScreen)) ||
              // Show for on-the-spot nearest wins when playing
              (showNearestWinsInterface && nearestWinsCurrentScreen === 'playing') ||
              // Show for buzz in mode
              showBuzzInMode
            }
            isQuizPackMode={isQuizPackMode}
            flowState={flowState}
            onStartTimer={handleNavBarStartTimer}
            onSilentTimer={handleNavBarSilentTimer}
            onHideQuestion={handleHideQuestion}
            onReveal={
              isQuizPackMode || flowState.isQuestionMode
                ? () => {
                    handleRevealAnswer();
                    handlePrimaryAction();
                  }
                : gameActionHandlers?.reveal ?? (() => {})
            }
            onNextAction={() => {
              if (isQuizPackMode || flowState.isQuestionMode) {
                // Quiz pack mode - use primary action handler which manages flow state machine
                handlePrimaryAction();
              } else if (gameActionHandlers?.nextQuestion) {
                // On-the-spot mode - use game action handlers
                gameActionHandlers.nextQuestion();
              }
            }}
            onRevealFastestTeam={() => {
              if (isQuizPackMode || flowState.isQuestionMode) {
                // Quiz pack mode - use primary action handler to transition flow state
                handlePrimaryAction();
              } else if (gameActionHandlers?.revealFastestTeam) {
                // On-the-spot mode - use game action handlers
                gameActionHandlers.revealFastestTeam();
              }
            }}
            onPreviousQuestion={() => {
              if (isQuizPackMode) {
                handleQuizPackPrevious();
              } else if (gameActionHandlers?.previousQuestion) {
                gameActionHandlers.previousQuestion();
              }
            }}
            onNextQuestion={() => {
              if (isQuizPackMode) {
                handleQuizPackNext();
              } else if (gameActionHandlers?.nextQuestion) {
                gameActionHandlers.nextQuestion();
              }
            }}
            showNavigationArrows={
              // Show only during active gameplay
              (showQuizPackDisplay && flowState.isQuestionMode) || // Quiz pack: active question display
              (showKeypadInterface && ['letters-game', 'multiple-choice-game', 'numbers-game', 'sequence-game'].includes(keypadCurrentScreen)) || // On-the-spot: game screens only
              (showNearestWinsInterface && nearestWinsCurrentScreen === 'playing') // Nearest wins: playing screen
            }
            canGoToPreviousQuestion={
              isQuizPackMode
                ? currentLoadedQuestionIndex > 0 // Quiz pack: disabled on first question
                : true // On-the-spot: always enabled during gameplay
            }
            leftSidebarWidth={sidebarWidth}
            isTimerRunning={timer.isRunning}
            timerProgress={timer.progress}
            hideQuestionMode={hideQuestionMode}
            currentQuestion={loadedQuizQuestions[currentLoadedQuestionIndex]}
            questionNumber={currentLoadedQuestionIndex + 1}
            totalQuestions={loadedQuizQuestions.length}
            isOnTheSpotsMode={showKeypadInterface || showNearestWinsInterface || showBuzzInMode}
            isOnTheSpotTimerRunning={gameTimerRunning}
            timeRemaining={gameTimerRunning ? gameTimerTimeRemaining : timer.timeRemaining}
            totalTime={gameTimerRunning ? gameTimerTotalTime : timer.totalTime}
            onTheSpotTimerFinished={gameTimerFinished}
            onTheSpotAnswerRevealed={gameAnswerRevealed}
            onTheSpotFastestRevealed={gameFastestRevealed}
            isSendQuestionDisabled={isSendQuestionDisabled}
            hasTeamsAnsweredCorrectly={teamsAnsweredCorrectly}
            onTheSpotAnswerSelected={gameAnswerSelected}
          />

          {/* Status bar */}
          <StatusBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            teamCount={participants.length}
            displayMode={userSelectedDisplayMode}
            onDisplayModeChange={handleDisplayModeChange}
            onHandsetSettings={handleHandsetSettings}
            onDisplaySettings={handleDisplaySettings}
            leftSidebarWidth={sidebarWidth}
            currentGameMode={getCurrentGameMode()}
            isOnTheSpotTimerRunning={gameTimerRunning}
            isQuizPackTimerRunning={showQuizPackDisplay && timer.isRunning}
            goWideEnabled={goWideEnabled}
            evilModeEnabled={evilModeEnabled}
            onGoWideToggle={handleGoWideToggle}
            onEvilModeToggle={handleEvilModeToggle}
            onClearScores={handleClearScores}
            onEmptyLobby={handleEmptyLobby}
            onGlobalScrambleKeypad={handleGlobalScrambleKeypad}
            scoresPaused={scoresPaused}
            onPauseScoresToggle={handlePauseScoresToggle}
            scoresHidden={scoresHidden}
            onToggleHideScores={handleToggleHideScores}
            teamLayoutMode={teamLayoutMode}
            onChangeTeamLayout={handleChangeTeamLayout}
            teams={quizzes}
            currentRoundPoints={currentRoundPoints}
            currentRoundSpeedBonus={currentRoundSpeedBonus}
            onCurrentRoundPointsChange={handleCurrentRoundPointsChange}
            onCurrentRoundSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
            currentRoundWinnerPoints={currentRoundWinnerPoints}
            onCurrentRoundWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
            showKeypadInterface={showKeypadInterface}
            showBuzzInInterface={showBuzzInInterface}
            showNearestWinsInterface={showNearestWinsInterface}
            showWheelSpinnerInterface={showWheelSpinnerInterface}
            showBuzzInMode={showBuzzInMode}
            showQuizPackDisplay={showQuizPackDisplay}
            onEndRound={handleEndRound}
            onOpenBuzzersManagement={handleOpenBuzzersManagement}
            hostControllerEnabled={hostControllerEnabled}
            onToggleHostController={handleToggleHostController}
          />
        </div>
      </div>


      {/* Modals and overlays */}
      {showDisplaySettings && (
        <DisplaySettings
          images={images}
          onImagesChange={handleImagesChange}
          slideshowSpeed={slideshowSpeed}
          onSpeedChange={handleSpeedChange}
          onClose={() => setShowDisplaySettings(false)}
        />
      )}

      {showPlayerDevicesSettings && (
        <PlayerDevicesSettings
          images={playerDevicesImages}
          onImagesChange={handlePlayerDevicesImagesChange}
          playerDevicesDisplayMode={playerDevicesDisplayMode}
          onClose={() => setShowPlayerDevicesSettings(false)}
          onSlideshowSecondsChange={handlePlayerDevicesSlideshowSecondsChange}
          currentSlideshowSeconds={playerDevicesSlideshowSeconds}
        />
      )}

      {showSettings && (
        <Settings 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}

      {/* Host Controller Code Popup */}
      {showHostControllerCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHostControllerCode(false)}
          />
          
          {/* Code Display Bubble */}
          <div className="relative bg-card border-2 border-primary rounded-2xl shadow-2xl p-8 min-w-[300px]">
            <div className="text-center space-y-4">
              <h3 className="text-foreground font-semibold text-xl">Host Controller Code</h3>
              <div className="bg-primary/10 border-2 border-primary rounded-lg p-6">
                <p className="text-5xl font-mono font-bold text-primary tracking-widest">
                  {hostControllerCode}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                Share this code with the host controller device
              </p>
              <Button
                onClick={() => setShowHostControllerCode(false)}
                className="mt-4"
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team completely?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteTeam}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Next Question button is now handled by QuestionNavigationBar for unified control */}

    </div>
  );
}
