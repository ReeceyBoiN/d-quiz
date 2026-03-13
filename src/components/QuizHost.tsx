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
import { MusicRoundInterface } from "./MusicRoundInterface";

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
import { ensureFileUrl } from "../utils/photoUrlConverter";
import { useSettings } from "../utils/SettingsContext";
import { useQuizData } from "../utils/QuizDataContext";
import { useTimer } from "../hooks/useTimer";
import { useHostInfo } from "../hooks/useHostInfo";
import type { QuestionFlowState, HostFlow } from "../state/flowState";
import { getTotalTimeForQuestion, hasQuestionImage, initialFlow } from "../state/flowState";
import { sendPictureToPlayers, sendQuestionToPlayers, sendTimerToPlayers, sendTimeUpToPlayers, sendRevealToPlayers, sendNextQuestion, sendEndRound, sendFastestToDisplay, registerNetworkPlayer, onNetworkMessage, broadcastMessage, onAdminCommand, sendAdminResponse, sendFlowStateToController, sendScrambleUpdateToPlayers, sendFlowStateToPlayers, sendPrecacheToPlayers, sendBuzzLockedToPlayers, sendBuzzResetToPlayers, sendBuzzResultToPlayers, } from "../network/wsHost";
import { playCountdownAudio, stopCountdownAudio } from "../utils/countdownAudio";
import { playApplauseSound, playFailSound } from "../utils/audioUtils";
import { executeStartNormalTimer, executeStartSilentTimer, validateTimerDuration } from "../utils/unifiedTimerHandlers";
import { calculateTeamPoints, rankCorrectTeams, shouldAutoDisableGoWide, type ScoringConfig } from "../utils/scoringEngine";
import { getAnswerText, createHandleComputeAndAwardScores, createHandleApplyEvilModePenalty } from "../utils/quizHostHelpers";
import { saveGameState, loadGameState, clearGameState, createGameStateSnapshot, type RoundSettings } from "../utils/gameStatePersistence";
import { getBuzzerFilePath, getBuzzerUrl } from "../utils/api";
import { calculateAnswerStats, getFastestCorrectTeam, type Team as AnswerStatsTeam } from "../utils/answerStats";
import { Resizable } from "re-resizable";
import { Button } from "./ui/button";
import { ChevronRight, Zap } from "lucide-react";
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
    gameModeTimers,
    nearestWinsTimer,
    voiceCountdown,
    teamPhotosAutoApprove,
    hideQuizPackAnswers
  } = useSettings();

  // Get external display text size from localStorage
  const [externalDisplayTextSize, setExternalDisplayTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  useEffect(() => {
    const loadTextSize = () => {
      const saved = localStorage.getItem('quizHostSettings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setExternalDisplayTextSize(settings.externalDisplayTextSize || 'medium');
        } catch (e) {
          console.error('Failed to load external display text size:', e);
        }
      }
    };

    loadTextSize();

    // Listen for changes to settings
    const handleStorageChange = () => loadTextSize();
    window.addEventListener('settingsUpdated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('settingsUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Quiz data context
  const { currentQuiz, setCurrentQuiz } = useQuizData();

  // Host info (backend URL for API calls)
  const { hostInfo } = useHostInfo();

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
  const [authenticatedControllerId, setAuthenticatedControllerId] = useState<string | null>(null); // Tracks the device ID of the authenticated controller

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

  // New refs for fastest team auto-hide
  const lastExternalDisplayMessageRef = useRef<any>(null);
  const fastestTeamTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Buzzer volume state - persisted per buzzer file
  const [buzzerVolumes, setBuzzerVolumes] = useState<{[buzzerName: string]: number}>({});

  // Load buzzer volumes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('quiz-buzzer-volumes');
    if (saved) {
      try {
        const volumes = JSON.parse(saved);
        setBuzzerVolumes(volumes);
        console.log('[QuizHost] Loaded buzzer volumes from localStorage:', volumes);
      } catch (e) {
        console.error('[QuizHost] Failed to load buzzer volumes:', e);
      }
    }
  }, []);

  // Buzzer audio ref and playback helper
  const buzzerAudioRef = useRef<HTMLAudioElement>(null);
  const playFastestTeamBuzzer = useCallback(async (buzzerSound?: string) => {
    if (!buzzerSound) return;
    try {
      let audioUrl: string | null = null;
      try {
        audioUrl = await getBuzzerFilePath(buzzerSound);
      } catch (e) {
        if (hostInfo) audioUrl = getBuzzerUrl(hostInfo, buzzerSound);
      }
      if (!audioUrl) return;

      if (buzzerAudioRef.current) {
        // Reset audio element before playing to ensure clean state
        buzzerAudioRef.current.pause();
        buzzerAudioRef.current.currentTime = 0;

        // Set the audio source
        buzzerAudioRef.current.src = audioUrl;

        // Set volume based on saved buzzer volumes, default to 75%
        const savedVolume = buzzerVolumes[buzzerSound];
        const volume = typeof savedVolume === 'number' && savedVolume >= 0 && savedVolume <= 100
          ? savedVolume
          : 75;
        buzzerAudioRef.current.volume = volume / 100;

        console.log('[QuizHost] Playing buzzer:', buzzerSound, 'Volume:', volume, '%');

        try {
          await buzzerAudioRef.current.play();
        } catch (playErr) {
          console.error('[QuizHost] Error playing buzzer audio:', playErr);
        }
      }
    } catch (err) {
      console.error('[QuizHost] Error playing fastest team buzzer:', err);
    }
  }, [hostInfo, buzzerVolumes]);

  // Listen for external display window being closed via Ctrl+V
  useEffect(() => {
    const isElectron = Boolean((window as any).api?.ipc?.on);
    if (!isElectron) return;

    const removeListener = (window as any).api?.ipc?.on('external-display/closed', () => {
      console.log('[QuizHost] 📢 Received external-display/closed event - closing external window');
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  // Helper function to send messages to external display (handles both Electron and browser)
  const sendToExternalDisplay = (messageData: any) => {
    if (!externalWindow) return;

    if (messageData.mode !== 'fastestTeam') {
      lastExternalDisplayMessageRef.current = messageData;
      if (fastestTeamTimeoutRef.current) {
        clearTimeout(fastestTeamTimeoutRef.current);
        fastestTeamTimeoutRef.current = null;
      }
    }

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

  // Helper function to broadcast picture to player devices via backend
  const broadcastPictureToPlayers = async (imageDataUrl: string) => {
    try {
      if ((window as any).api?.network?.broadcastPicture) {
        console.log('[QuizHost] Broadcasting picture to players via IPC:', { imageSize: imageDataUrl.length });
        await (window as any).api.network.broadcastPicture({
          image: imageDataUrl
        });
        console.log('[QuizHost] Picture broadcasted to players');
      } else {
        console.warn('[QuizHost] api.network.broadcastPicture not available');
      }
    } catch (err) {
      console.error('[QuizHost] Error broadcasting picture:', err);
    }
  };

  // Helper function to send controller authentication message to specific player
  const sendControllerAuthToPlayer = async (deviceId: string, success: boolean, message?: string) => {
    const authMessage = message || (success ? 'Controller authenticated' : 'Controller authentication failed');
    console.log('[QuizHost] sendControllerAuthToPlayer called:', { deviceId, success, authMessage });

    try {
      if ((window as any).api?.network?.sendToPlayer) {
        console.log('[QuizHost] 📤 Sending controller auth message to player via IPC:', { deviceId, success });
        try {
          const result = await (window as any).api.network.sendToPlayer({
            deviceId,
            messageType: success ? 'CONTROLLER_AUTH_SUCCESS' : 'CONTROLLER_AUTH_FAILED',
            data: {
              message: authMessage
            }
          });
          console.log('[QuizHost] ✅ IPC send successful:', result);
          return;
        } catch (ipcErr) {
          console.error('[QuizHost] ❌ IPC send failed:', ipcErr);
          console.log('[QuizHost] Falling back to HTTP API...');
        }
      } else {
        console.warn('[QuizHost] ℹ️  api.network.sendToPlayer not available (expected in browser mode) - using HTTP API fallback');
      }

      // Try HTTP API fallback
      console.log('[QuizHost] 📤 Attempting to send via HTTP API...');
      const backendUrl = hostInfo?.baseUrl || `${window.location.protocol}//${window.location.hostname}:4310`;
      console.log('[QuizHost] Using backend URL:', backendUrl);

      const requestPayload = {
        deviceId,
        messageType: success ? 'CONTROLLER_AUTH_SUCCESS' : 'CONTROLLER_AUTH_FAILED',
        data: {
          message: authMessage
        }
      };

      console.log('[QuizHost] HTTP Request payload:', JSON.stringify(requestPayload, null, 2));

      const response = await fetch(`${backendUrl}/api/send-to-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QuizHost] ❌ HTTP API error:', response.status, errorText);
        console.log('[QuizHost] Falling back to broadcast...');
      } else {
        const result = await response.json();
        console.log('[QuizHost] ✅ Controller auth sent via HTTP API:', result);
        return;
      }
    } catch (err) {
      console.error('[QuizHost] ❌ Error in HTTP API send:', err);
    }

    // Fallback to local broadcast as last resort
    console.warn('[QuizHost] 📤 Falling back to local broadcast');
    try {
      broadcastMessage({
        type: success ? 'CONTROLLER_AUTH_SUCCESS' : 'CONTROLLER_AUTH_FAILED',
        data: { deviceId, message: authMessage }
      });
      console.log('[QuizHost] ✅ Broadcast fallback sent');
    } catch (broadcastErr) {
      console.error('[QuizHost] ❌ Broadcast fallback failed:', broadcastErr);
    }
  };

  // Authorized device IDs for waiting room PIN (devices that have entered PIN correctly)
  const [authorizedDeviceIds, setAuthorizedDeviceIds] = useState<Set<string>>(new Set());
  const authorizedDeviceIdsRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    authorizedDeviceIdsRef.current = authorizedDeviceIds;
  }, [authorizedDeviceIds]);

  // Helper function to send a message to a specific player device
  // Uses hostInfoBaseUrlRef to avoid stale closure issues when called from stable handlers
  const sendMessageToPlayer = useCallback(async (targetDeviceId: string, messageType: string, data: any) => {
    try {
      if ((window as any).api?.network?.sendToPlayer) {
        try {
          const result = await (window as any).api.network.sendToPlayer({
            deviceId: targetDeviceId,
            messageType,
            data
          });
          console.log(`[QuizHost] ✅ Sent ${messageType} to ${targetDeviceId} via IPC`);
          return;
        } catch (ipcErr) {
          console.error(`[QuizHost] ❌ IPC send ${messageType} failed:`, ipcErr);
        }
      }

      // HTTP API fallback - use ref to get latest baseUrl
      const backendUrl = hostInfoBaseUrlRef.current || `${window.location.protocol}//${window.location.hostname}:4310`;
      const response = await fetch(`${backendUrl}/api/send-to-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: targetDeviceId, messageType, data })
      });

      if (response.ok) {
        console.log(`[QuizHost] ✅ Sent ${messageType} to ${targetDeviceId} via HTTP`);
        return;
      }
    } catch (err) {
      console.error(`[QuizHost] ❌ Error sending ${messageType}:`, err);
    }

    // Broadcast fallback
    broadcastMessage({ type: messageType as any, data: { ...data, deviceId: targetDeviceId } });
  }, []);

  // Sidebar width state for status bar positioning
  const [sidebarWidth, setSidebarWidth] = useState(345); // Match the defaultSize width
  
  // Keypad interface state
  const [showKeypadInterface, setShowKeypadInterface] = useState(false);
  const [keypadInstanceKey, setKeypadInstanceKey] = useState(0);
  const [keypadNextQuestionTrigger, setKeypadNextQuestionTrigger] = useState(0);
  const [isQuizPackMode, setIsQuizPackMode] = useState(false);
  const [isBuzzinPackMode, setIsBuzzinPackMode] = useState(false);

  // Buzzin pack state machine
  const [buzzLockedOutTeams, setBuzzLockedOutTeams] = useState<Set<string>>(new Set());
  const [buzzWinnerTeamId, setBuzzWinnerTeamId] = useState<string | null>(null);

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

  // Monitoring refs for debugging loadedQuizQuestions clearing
  const prevQuestionsLengthRef = useRef(0);
  const quizLoadEffectRunCountRef = useRef(0);

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
    mode: "points" | "classic";
    points: number;
    soundCheck: boolean;
  } | null>(null);

  // Buzz-in interface state
  const [showBuzzInInterface, setShowBuzzInInterface] = useState(false);

  // Nearest wins interface state
  const [showNearestWinsInterface, setShowNearestWinsInterface] = useState(false);
  
  // Wheel spinner interface state
  const [showWheelSpinnerInterface, setShowWheelSpinnerInterface] = useState(false);

  // Music round interface state
  const [showMusicRoundInterface, setShowMusicRoundInterface] = useState(false);
  const [musicRoundBuzzes, setMusicRoundBuzzes] = useState<{ teamId: string; valid: boolean; responseTime?: number }[]>([]);

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
    guess?: number;
    difference?: number;
  } | null>(null);
  const [fastestTeamDisplayMode, setFastestTeamDisplayMode] = useState<'fastest' | 'closest'>('fastest');

  // Results summary display state for quiz pack mode (shown when timer ends)
  const [showResultsSummary, setShowResultsSummary] = useState(false);

  // Store fastest team ID for display in quiz pack mode
  const [fastestTeamIdForDisplay, setFastestTeamIdForDisplay] = useState<string | null>(null);

  // Pause scores state
  const [scoresPaused, setScoresPaused] = useState(false);
  
  // Hide scores & positions state
  const [scoresHidden, setScoresHidden] = useState(false);
  
  // Team layout mode state - cycles through: 'default' -> 'alphabetical' -> 'random' -> 'default'
  const [teamLayoutMode, setTeamLayoutMode] = useState<'default' | 'alphabetical' | 'random'>('default');

  // Buzzers management state
  const [showBuzzersManagement, setShowBuzzersManagement] = useState(false);

  // Bottom Navigation popup states - consolidated for auto-close on navigation
  const [bottomNavPopupStates, setBottomNavPopupStates] = useState({
    teamPhotos: false,
    clearScores: false,
    emptyLobby: false,
  });

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
    startTimer?: (customDuration?: number) => void;
    silentTimer?: (customDuration?: number) => void;
    revealFastestTeam?: () => void;
    previousQuestion?: () => void;
  } | null>(null);

  // Game timer state for navigation bar
  const [gameTimerRunning, setGameTimerRunning] = useState(false);
  const [gameTimerTimeRemaining, setGameTimerTimeRemaining] = useState(0);
  const [gameTimerTotalTime, setGameTimerTotalTime] = useState(0);
  const [gameTimerStartTime, setGameTimerStartTime] = useState<number | null>(null);
  const [currentQuestionTimerId, setCurrentQuestionTimerId] = useState<number | null>(null); // Track which question the timer is for

  // Create refs to access current values without re-registering listeners
  const gameTimerStartTimeRef = useRef<number | null>(null);
  const flowStateTotalTimeRef = useRef<number>(0);

  // Crash recovery and auto-save refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialStateRef = useRef(false);

  // Refs for listener handlers to avoid re-registration (memory leak fix)
  const authenticatedControllerIdRef = useRef<string | null>(null);
  const hostControllerEnabledRef = useRef(false);
  const hostControllerCodeRef = useRef<string>("");
  const handleApproveTeamRef = useRef<(deviceId: string, teamName: string) => Promise<void>>();
  const teamPhotosAutoApproveRef = useRef(false);

  // Sync refs with state changes to avoid listener re-registration
  useEffect(() => {
    gameTimerStartTimeRef.current = gameTimerStartTime;
  }, [gameTimerStartTime]);

  useEffect(() => {
    flowStateTotalTimeRef.current = flowState.totalTime;
  }, [flowState.totalTime]);

  // Keep listener refs in sync with state
  useEffect(() => {
    authenticatedControllerIdRef.current = authenticatedControllerId;
  }, [authenticatedControllerId]);

  useEffect(() => {
    hostControllerEnabledRef.current = hostControllerEnabled;
  }, [hostControllerEnabled]);

  useEffect(() => {
    hostControllerCodeRef.current = hostControllerCode;
  }, [hostControllerCode]);

  useEffect(() => {
    teamPhotosAutoApproveRef.current = teamPhotosAutoApprove;
  }, [teamPhotosAutoApprove]);

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

  // Sync gameAnswerSelected with flowState.answerSubmitted for on-the-spot mode
  // When an answer is submitted (from remote or host app), set gameAnswerSelected to true
  // This enables the "Reveal Answer" button to appear when timer finishes
  useEffect(() => {
    if (flowState.answerSubmitted) {
      setGameAnswerSelected(true);
    }
  }, [flowState.answerSubmitted]);

  // Helper function to normalize buzzer sound value
  const normalizeBuzzerSound = (buzzerSound: string): string => {
    if (!buzzerSound) return '';
    // Trim whitespace and remove .mp3 extension if present
    return buzzerSound.trim().replace(/\.mp3$/i, '') + '.mp3';
  };

  // Debounced auto-save function - called after team roster changes
  const debouncedSaveGameState = useCallback(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout to save after 2 seconds of inactivity
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        // Create snapshot of current team data and settings
        const roundSettings: RoundSettings = {
          pointsValue: currentRoundPoints ?? defaultPoints,
          speedBonusValue: currentRoundSpeedBonus ?? defaultSpeedBonus,
          evilModeEnabled,
          punishmentModeEnabled: punishmentEnabled,
          staggeredEnabled,
          goWideEnabled,
        };

        const snapshot = createGameStateSnapshot(
          quizzes,
          roundSettings,
          [],
          0
        );

        await saveGameState(snapshot);
        console.log('[Crash Recovery] Auto-save completed - teams:', quizzes.length);
      } catch (err) {
        console.error('[Crash Recovery] Error during auto-save:', err);
      }
    }, 2000); // 2 second debounce on team changes
  }, [quizzes, currentRoundPoints, defaultPoints, currentRoundSpeedBonus, defaultSpeedBonus, evilModeEnabled, punishmentEnabled, staggeredEnabled, goWideEnabled]);

  // Ref to keep latest debouncedSaveGameState function available in admin command handler
  const debouncedSaveGameStateRef = useRef(debouncedSaveGameState);

  // Update ref whenever debouncedSaveGameState changes (has its own deps)
  useEffect(() => {
    debouncedSaveGameStateRef.current = debouncedSaveGameState;
  }, [debouncedSaveGameState]);

  // Refs for admin listener dependencies - prevents infinite listener re-registration
  // These values are needed inside the admin command handler, but storing them in refs
  // allows us to register the listener ONCE on mount (empty deps array) instead of
  // re-registering every time a dependency changes
  const adminListenerDepsRef = useRef({
    authenticatedControllerId,
    hostControllerEnabled,
    hostControllerCode,
    baseUrl: hostInfo?.baseUrl,
    gameModeTimers,
    nearestWinsTimer: 10, // Will be updated via useEffect
    loadedQuizQuestions: [] as any[],
    currentLoadedQuestionIndex: 0,
    flowState: {
      isQuestionMode: false,
      flow: 'idle' as const,
      totalTime: 30,
      timeRemaining: 30,
      currentQuestionIndex: 0,
      currentQuestion: null,
      pictureSent: false,
      questionSent: false,
      answerSubmitted: undefined,
    },
    showKeypadInterface: false,
    showQuizPackDisplay: false,
    showBuzzInMode: false,
    showNearestWinsInterface: false,
    handlePrimaryAction: null as any, // Will be assigned in render
    handleRevealAnswer: null as any, // Will be assigned in render
    handleHideQuestion: null as any, // Will be assigned in render
    handleQuizPackNext: null as any, // Will be assigned in render
    handleQuizPackPrevious: null as any, // Will be assigned in render
    handleNavBarStartTimer: null as any, // Will be assigned in render
    setCurrentLoadedQuestionIndex: null as any, // Will be assigned in render
    setFlowState: null as any, // Will be assigned in render (for on-the-spot mode)
    setKeypadCurrentScreen: null as any, // Will be assigned in render (for on-the-spot mode)
    sendFlowStateToController: null as any, // Will be assigned in render (for on-the-spot mode)
  });

  // Update the refs whenever dependencies change, but DON'T trigger listener re-registration
  useEffect(() => {
    adminListenerDepsRef.current = {
      ...adminListenerDepsRef.current,
      authenticatedControllerId,
      hostControllerEnabled,
      hostControllerCode,
      baseUrl: hostInfo?.baseUrl,
      gameModeTimers,
      nearestWinsTimer,
      loadedQuizQuestions,
      currentLoadedQuestionIndex,
      flowState,
      showKeypadInterface,
      showQuizPackDisplay,
      showBuzzInMode,
      showNearestWinsInterface,
      isQuizPackMode,
      keypadCurrentScreen,
    };
  }, [authenticatedControllerId, hostControllerEnabled, hostControllerCode, hostInfo?.baseUrl, gameModeTimers, nearestWinsTimer, loadedQuizQuestions, currentLoadedQuestionIndex, flowState, showKeypadInterface, showQuizPackDisplay, showBuzzInMode, showNearestWinsInterface, isQuizPackMode, keypadCurrentScreen]);

  // Auto-load on component mount
  useEffect(() => {
    if (hasLoadedInitialStateRef.current) return; // Only load once
    hasLoadedInitialStateRef.current = true;

    const loadSavedState = async () => {
      try {
        const savedState = await loadGameState();
        if (savedState && savedState.teams && savedState.teams.length > 0) {
          // Restore teams from saved state
          const restoredTeams = savedState.teams.map(team => ({
            id: team.id,
            name: team.name,
            type: 'test' as const,
            score: team.score,
            photoUrl: team.photoUrl,
            buzzerSound: team.buzzSound,
            backgroundColor: team.backgroundColor,
          }));

          // Set restored teams
          setQuizzes(restoredTeams);

          // Restore round settings
          if (savedState.roundSettings) {
            setCurrentRoundPoints(savedState.roundSettings.pointsValue);
            setCurrentRoundSpeedBonus(savedState.roundSettings.speedBonusValue);
          }

          console.log('[Crash Recovery] Session restored with', restoredTeams.length, 'teams');
        }
      } catch (err) {
        console.error('[Crash Recovery] Error loading saved state:', err);
      }
    };

    loadSavedState();
  }, []);

  // Sync teamPhotosAutoApprove setting to backend on app startup
  useEffect(() => {
    if (teamPhotosAutoApprove !== undefined && (window as any).api?.ipc?.invoke) {
      (window as any).api.ipc.invoke('network/set-team-photos-auto-approve', { enabled: teamPhotosAutoApprove })
        .then(() => {
          console.log('[QuizHost] ✅ Synced auto-approve setting to backend on startup:', teamPhotosAutoApprove);
        })
        .catch((err: any) => {
          console.error('[QuizHost] ❌ Failed to sync auto-approve setting on startup:', err);
        });
    }
  }, []);

  // Periodic auto-save every 30 seconds
  useEffect(() => {
    // Start periodic save interval
    periodicSaveIntervalRef.current = setInterval(async () => {
      if (quizzes.length > 0) {
        try {
          const roundSettings: RoundSettings = {
            pointsValue: currentRoundPoints ?? defaultPoints,
            speedBonusValue: currentRoundSpeedBonus ?? defaultSpeedBonus,
            evilModeEnabled,
            punishmentModeEnabled: punishmentEnabled,
            staggeredEnabled,
            goWideEnabled,
          };

          const snapshot = createGameStateSnapshot(
            quizzes,
            roundSettings,
            [],
            0
          );

          await saveGameState(snapshot);
          console.log('[Crash Recovery] Periodic auto-save completed - teams:', quizzes.length);
        } catch (err) {
          console.error('[Crash Recovery] Error during periodic auto-save:', err);
        }
      }
    }, 30000); // Every 30 seconds

    // Cleanup on unmount
    return () => {
      if (periodicSaveIntervalRef.current) {
        clearInterval(periodicSaveIntervalRef.current);
      }
    };
  }, [quizzes, currentRoundPoints, defaultPoints, currentRoundSpeedBonus, defaultSpeedBonus, evilModeEnabled, punishmentEnabled, staggeredEnabled, goWideEnabled]);

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
    quizLoadEffectRunCountRef.current += 1;
    console.log('[QuizHost] 📌 Quiz load effect RUN #' + quizLoadEffectRunCountRef.current);
    console.log('[QuizHost] useEffect: currentQuiz changed');
    console.log('[QuizHost] - currentQuiz exists:', !!currentQuiz);
    if (currentQuiz) {
      console.log('[QuizHost] - currentQuiz.game:', currentQuiz.game);
      console.log('[QuizHost] - currentQuiz.title:', currentQuiz.title);
      console.log('[QuizHost] - currentQuiz.questions exists:', !!currentQuiz.questions);
      console.log('[QuizHost] - currentQuiz.questions type:', typeof currentQuiz.questions);
      console.log('[QuizHost] - currentQuiz.questions.length:', currentQuiz.questions?.length);
      console.log('[QuizHost] - currentQuiz.isQuizPack:', currentQuiz.isQuizPack);
    }

    if (currentQuiz && currentQuiz.questions && currentQuiz.questions.length > 0) {
      console.log('[QuizHost] ✅ Setting loadedQuizQuestions with', currentQuiz.questions.length, 'questions');
      setLoadedQuizQuestions(currentQuiz.questions);
      setCurrentLoadedQuestionIndex(0);
      closeAllGameModes();

      // Use KeypadInterface for both regular and quiz pack modes
      // In quiz pack mode, KeypadInterface will skip input screens and show pre-loaded answers
      const isQuizPack = currentQuiz.isQuizPack || false;
      const isBuzzinPack = currentQuiz.isBuzzinPack || false;
      setIsQuizPackMode(isQuizPack);
      setIsBuzzinPackMode(isBuzzinPack);

      if (isQuizPack) {
        // For quiz packs, show the quiz pack display (config or question screen)
        setShowQuizPackDisplay(true);
        setHideQuestionMode(false);
      } else {
        // For regular games, show the keypad interface
        setShowKeypadInterface(true);
      }
      setActiveTab("teams");
    } else {
      console.log('[QuizHost] ⚠️  Quiz effect skipped - conditions not met');
    }
  }, [currentQuiz]);

  // Monitor loadedQuizQuestions state changes to detect clearing with stack trace
  useEffect(() => {
    const currentLength = loadedQuizQuestions.length;
    console.log('[QuizHost] 📊 loadedQuizQuestions CHANGED: length is now', currentLength);

    if (prevQuestionsLengthRef.current > 0 && currentLength === 0) {
      console.log('[QuizHost] 🚨 QUESTIONS CLEARED: transitioned from', prevQuestionsLengthRef.current, 'to 0');
      console.log('[QuizHost] 📍 Stack trace for CLEARING event:');
      console.trace('[QuizHost] ⬆️  Call stack above');
    } else if (prevQuestionsLengthRef.current === 0 && currentLength > 0) {
      console.log('[QuizHost] ✅ QUESTIONS LOADED: transitioned from 0 to', currentLength);
    }

    prevQuestionsLengthRef.current = currentLength;
  }, [loadedQuizQuestions.length]);

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

        // Clear buzz state for new question
        setBuzzLockedOutTeams(new Set());
        setBuzzWinnerTeamId(null);
        // Broadcast buzz reset to all players so they start fresh
        if (isBuzzinPackMode) {
          sendBuzzResetToPlayers([]);
        }

        // Pre-cache picture question image on player devices before reveal
        if (hasQuestionImage(currentQuestion) && currentQuestion.imageDataUrl) {
          try {
            sendPrecacheToPlayers('picture-question', currentQuestion.imageDataUrl);
            console.log('[QuizHost] PRECACHE: Sent picture question image to players for pre-loading');
          } catch (err) {
            console.error('[QuizHost] Error sending precache for picture question:', err);
          }
        }

        // Broadcast placeholder question to players immediately so they see answer pads right away
        try {
          let placeholderCount =
            isBuzzinPackMode ? 1 : // Buzzin pack always shows buzz-in button
            currentQuestion.type === 'letters' ? 6 : // A-F
            currentQuestion.type === 'multi' || currentQuestion.type === 'multiple-choice' ? 4 : // 4 options
            currentQuestion.type === 'numbers' ? 4 : // 4 numbers
            currentQuestion.type === 'nearest' ? 4 : // 4 numbers
            currentQuestion.type === 'sequence' ? currentQuestion.options?.length || 3 : // Use actual options count
            1; // 1 for buzzin

          const placeholderOptions = Array.from({ length: placeholderCount }, (_, i) => `option_${i + 1}`);

          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
          const teamScrambleStates: Record<string, boolean> = {};
          quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
          broadcastQuestionToPlayers({
            text: 'Waiting for question...',
            q: 'Waiting for question...',
            options: placeholderOptions,
            type: normalizedType,
            isPlaceholder: true,
            goWideEnabled: goWideEnabled,
            teamScrambleStates,
          });

          console.log('[QuizHost] Broadcasting placeholder question with type:', currentQuestion.type, '-> normalized:', normalizedType, 'options count:', placeholderCount);
        } catch (err) {
          console.error('[QuizHost] Error broadcasting placeholder question:', err);
        }
      }
    }
  }, [currentLoadedQuestionIndex, showQuizPackDisplay, loadedQuizQuestions, gameModeTimers, flowState.currentQuestionIndex, timer, flowState.isQuestionMode, quizzes]);

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

        // Pre-cache picture question image on player devices before reveal
        if (hasQuestionImage(currentQuestion) && currentQuestion.imageDataUrl) {
          try {
            sendPrecacheToPlayers('picture-question', currentQuestion.imageDataUrl);
            console.log('[QuizHost] PRECACHE: Sent first question picture image to players for pre-loading');
          } catch (err) {
            console.error('[QuizHost] Error sending precache for first question picture:', err);
          }
        }

        // Broadcast placeholder question to players immediately so they see answer pads right away
        try {
          let placeholderCount =
            isBuzzinPackMode ? 1 : // Buzzin pack always shows buzz-in button
            currentQuestion.type === 'letters' ? 6 : // A-F
            currentQuestion.type === 'multi' || currentQuestion.type === 'multiple-choice' ? 4 : // 4 options
            currentQuestion.type === 'numbers' ? 4 : // 4 numbers
            currentQuestion.type === 'nearest' ? 4 : // 4 numbers
            currentQuestion.type === 'sequence' ? currentQuestion.options?.length || 3 : // Use actual options count
            1; // 1 for buzzin

          const placeholderOptions = Array.from({ length: placeholderCount }, (_, i) => `option_${i + 1}`);

          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
          const teamScrambleStates: Record<string, boolean> = {};
          quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
          broadcastQuestionToPlayers({
            text: 'Waiting for question...',
            q: 'Waiting for question...',
            options: placeholderOptions,
            type: normalizedType,
            isPlaceholder: true,
            goWideEnabled: goWideEnabled,
            teamScrambleStates,
          });

          console.log('[QuizHost] Broadcasting placeholder question for first question with type:', currentQuestion.type, '-> normalized:', normalizedType, 'options count:', placeholderCount);
        } catch (err) {
          console.error('[QuizHost] Error broadcasting placeholder question for first question:', err);
        }
      }
    }
  }, [showQuizPackDisplay, flowState.isQuestionMode, loadedQuizQuestions, gameModeTimers, timer, goWideEnabled, quizzes]);

  // Strict Mid-Session Settings Sync: Actively recalculate timer duration when settings change mid-session
  // but only if the timer hasn't started yet.
  useEffect(() => {
    // Only apply if in active question state but not running/finished
    if (flowState.isQuestionMode && (flowState.flow === 'ready' || flowState.flow === 'sent-question')) {
      const questionForTimer = flowState.currentQuestion || (flowState.selectedQuestionType ? { type: flowState.selectedQuestionType } : null);

      if (questionForTimer) {
        const calculatedTime = getTotalTimeForQuestion(questionForTimer, gameModeTimers);

        // If the settings-derived time differs from current flow state time, update it instantly
        if (calculatedTime !== flowState.totalTime) {
          console.log(`[QuizHost] Strict Mid-Session Settings Sync: Updating timer duration from ${flowState.totalTime}s to ${calculatedTime}s to match settings`);
          setFlowState(prev => ({
            ...prev,
            totalTime: calculatedTime,
            // Update timeRemaining if it hasn't ticked down yet
            timeRemaining: prev.timeRemaining === prev.totalTime ? calculatedTime : prev.timeRemaining
          }));
          timer.reset(calculatedTime); // ensure timer component resets to new duration
        }
      }
    }
  }, [gameModeTimers, flowState.isQuestionMode, flowState.flow, flowState.currentQuestion, flowState.selectedQuestionType, flowState.totalTime, timer]);

  // Handle timer when flow state changes to 'running'
  useEffect(() => {
    if ((flowState.flow as any) === 'running' && !showNearestWinsInterface) {
      console.log('[QuizHost] Timer starting');

      const isSilent = flowState.answerSubmitted === 'silent'; // Check if silent timer was used
      timer.start(flowState.totalTime, isSilent);
      // Note: gameTimerStartTime is now set in handlePrimaryAction before sending timer to players
      // This ensures players and host use the same reference point for response time calculation

    } else if (flowState.flow !== 'running' && flowState.flow !== 'timeup') {
      timer.stop();
    }
  }, [flowState.flow, flowState.totalTime, timer, voiceCountdown, isQuizPackMode]);

  // Auto-show answer and results summary in app when timer ends (flow transitions to 'timeup')
  useEffect(() => {
    if (flowState.flow === 'timeup' && isQuizPackMode) {
      setShowAnswer(true);
      setShowResultsSummary(true);
    }
  }, [flowState.flow, isQuizPackMode]);

  // Reset results summary and fastest team ID when flow changes to ensure clean state transitions
  useEffect(() => {
    if (flowState.flow !== 'timeup' && flowState.flow !== 'running' && flowState.flow !== 'revealed' && flowState.flow !== 'fastest') {
      setShowResultsSummary(false);
      setFastestTeamIdForDisplay(null); // Clear fastest team ID when leaving question mode
    }
  }, [flowState.flow]);

  // Update external display with timer countdown - keep question visible
  useEffect(() => {
    if (externalWindow && flowState.flow === 'running') {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        const normalizedType = normalizeQuestionTypeForBroadcast(currentQuestion.type);
        const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
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
          totalTime: flowState.totalTime
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

  // Sync on-the-spot mode game states to flow state
  useEffect(() => {
    if (!isQuizPackMode && (showKeypadInterface || showNearestWinsInterface || showBuzzInMode)) {
      if (!gameTimerRunning && gameTimerFinished && !gameAnswerRevealed && flowState.flow === 'running') {
        setFlowState(prev => ({ ...prev, flow: 'timeup' }));
      } else if (gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'revealed') {
        // For nearest wins, always treat as "teams answered correctly" since there's always a closest team
        if (showNearestWinsInterface) {
          setTeamsAnsweredCorrectly(true);
          setFlowState(prev => ({ ...prev, flow: 'revealed' }));
        } else if (!teamsAnsweredCorrectly) {
          setFlowState(prev => ({ ...prev, flow: 'fastest' }));
        } else {
          setFlowState(prev => ({ ...prev, flow: 'revealed' }));
        }
      } else if (gameFastestRevealed && flowState.flow !== 'fastest') {
        setFlowState(prev => ({ ...prev, flow: 'fastest' }));
      } else if (!gameTimerRunning && !gameTimerFinished && !gameAnswerRevealed && !gameFastestRevealed && flowState.flow !== 'idle' && flowState.flow !== 'sent-question') {
        setFlowState(prev => ({ ...prev, flow: 'idle' }));
      }
    }
  }, [gameTimerRunning, gameTimerFinished, gameAnswerRevealed, gameFastestRevealed, teamsAnsweredCorrectly, isQuizPackMode, showKeypadInterface, showNearestWinsInterface, showBuzzInMode, flowState.flow]);

  // Cleanup effect for timer voice announcements on unmount
  useEffect(() => {
    return () => {
      console.log('[QuizHost] Unmounting');
      timerIsMountedRef.current = false;
    };
  }, []);

  // Buzz detection effect - reactively detects first valid buzz in buzzin pack mode
  useEffect(() => {
    if (!isBuzzinPackMode || !flowState.isQuestionMode || buzzWinnerTeamId) return;

    const validBuzzes = Object.entries(teamAnswers)
      .filter(([, answer]) => answer === 'buzzed')
      .filter(([teamId]) => !buzzLockedOutTeams.has(teamId))
      .map(([teamId]) => ({ teamId, time: teamResponseTimes[teamId] || Infinity }))
      .sort((a, b) => a.time - b.time);

    if (validBuzzes.length === 0) return;

    const firstTeamId = validBuzzes[0].teamId;
    const team = quizzes.find(q => q.id === firstTeamId);

    setBuzzWinnerTeamId(firstTeamId);

    // Play team's buzzer sound
    if (team?.buzzerSound) {
      playFastestTeamBuzzer(team.buzzerSound);
    }

    // Broadcast lockout to all players
    sendBuzzLockedToPlayers(team?.name || `Team ${firstTeamId}`, firstTeamId);

    // Update external display with animated buzz-in view
    sendToExternalDisplay({
      type: 'DISPLAY_UPDATE',
      mode: 'buzzin-team',
      data: {
        teamName: team?.name || `Team ${firstTeamId}`,
        teamColor: team?.backgroundColor,
        responseTime: validBuzzes[0].time,
      },
    });

    console.log(`[QuizHost] Buzz detected: ${team?.name} (${firstTeamId}) at ${validBuzzes[0].time}ms`);
  }, [teamAnswers, teamResponseTimes, isBuzzinPackMode, flowState.isQuestionMode,
      buzzWinnerTeamId, buzzLockedOutTeams, quizzes]);

  // Close external display when host window closes (browser popout scenario)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show confirmation if there are teams (i.e., quiz in progress or lobby has teams)
      if (quizzes.length > 0) {
        e.preventDefault();
        // Most modern browsers ignore custom messages and show a generic dialog
        e.returnValue = '';
        return '';
      }
      // Close external display even without confirmation if no teams
      closeExternalDisplay();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [quizzes.length]);

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

    const connectWebSocket = async () => {
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
            // Await the async function to get the WebSocket URL
            backendWs = await (window as any).api.backend.ws();
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
            const DEBUG = (window as any).__DEBUG_MODE__;
            if (DEBUG) {
              console.log('[WebSocket Message]', data.type);
            }

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
            ? `WebSocket connection failed (expected in browser mode - run in Electron to enable player connectivity)`
            : (event as any)?.message || 'Unknown WebSocket error';
          // Log at debug level - this is expected in browser mode
          const isElectron = !!(window as any).api?.backend?.url;
          if (isElectron) {
            console.error('❌ WebSocket error:', errorMsg, 'Attempting to connect to:', backendWs);
          } else {
            console.debug('ℹ️ WebSocket unavailable in browser mode (expected, Electron needed for multiplayer):', backendWs);
          }
          setWsConnected(false);
          // Don't retry on error alone - wait for onclose to handle reconnection
        };

        wsInstance.onclose = (event) => {
          clearTimeout(connectionTimeout);
          const isElectron = !!(window as any).api?.backend?.url;
          if (isElectron) {
            console.warn(`⚠️  WebSocket closed with code ${event.code}`);
          } else {
            console.debug(`ℹ️  WebSocket closed with code ${event.code} (browser mode - no player connectivity)`);
          }
          setWsConnected(false);

          if (isComponentMounted && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayMs = getDelayMs(reconnectAttempts - 1);
            if (isElectron) {
              console.log(`📍 Scheduling WebSocket reconnect in ${delayMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            }

            if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
            connectionTimeoutId = setTimeout(connectWebSocket, delayMs);
          }
        };
      } catch (err) {
        const isElectron = !!(window as any).api?.backend?.url;
        if (isElectron) {
          console.error('Failed to initialize WebSocket:', err);
        } else {
          console.debug('WebSocket initialization skipped in browser mode (run in Electron for multiplayer)');
        }
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
        const isElectron = !!(window as any).api?.backend?.url;
        if (isElectron) {
          console.log('Starting WebSocket connection process...');
        } else {
          console.debug('WebSocket connection skipped - running in browser mode');
        }
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
      // PHASE 1: Enhanced host-side diagnostics
      const approvalStartTime = Date.now();
      console.log('📋 handleApproveTeam called for:', { deviceId, teamName, timestamp: new Date(approvalStartTime).toISOString() });

      // PHASE 1: Inspect deviceId for encoding issues
      console.log('[QuizHost] 🔍 deviceId Inspection:');
      console.log('  - Value:', `"${deviceId}"`);
      console.log('  - Length:', deviceId.length);
      console.log('  - Type:', typeof deviceId);
      console.log('  - Has leading/trailing spaces:', deviceId !== deviceId.trim() ? 'YES' : 'NO');
      console.log('  - Trimmed version:', `"${deviceId.trim()}"`);

      // Fetch player data to get team photo and buzzer sound
      let teamPhoto: string | undefined = undefined;
      let buzzerSound: string | undefined = undefined;
      try {
        console.log('[QuizHost] 🔍 Fetching all network players via IPC...');
        const fetchStartTime = Date.now();
        const result = await (window as any).api?.ipc?.invoke?.('network/all-players');
        const fetchEndTime = Date.now();

        console.log('[QuizHost] IPC call completed in:', fetchEndTime - fetchStartTime, 'ms');
        console.log('[QuizHost] IPC result:', {
          ok: result?.ok,
          hasData: !!result?.data,
          isArray: Array.isArray(result?.data),
          dataLength: Array.isArray(result?.data) ? result.data.length : 'N/A',
          error: result?.error || 'none'
        });

        if (Array.isArray(result?.data)) {
          console.log('[QuizHost] Total players returned:', result.data.length);
          result.data.forEach((p: any, idx: number) => {
            console.log(`[QuizHost] Player ${idx + 1}:`, {
              deviceId: p.deviceId,
              deviceIdLength: p.deviceId?.length,
              teamName: p.teamName,
              hasTeamPhoto: !!p.teamPhoto,
              hasBuzzerSound: !!p.buzzerSound,
              buzzerSound: p.buzzerSound || 'none',
              deviceIdMatches: p.deviceId === deviceId ? 'EXACT' : (p.deviceId?.trim() === deviceId?.trim() ? 'TRIMMED' : 'NO')
            });
          });
        }

        if (result?.ok && Array.isArray(result.data)) {
          const player = result.data.find((p: any) => p.deviceId === deviceId);
          console.log('[QuizHost] ✨ Exact match found:', !!player);

          // Try trimmed match if exact fails
          let finalPlayer = player;
          if (!finalPlayer) {
            const trimmedPlayer = result.data.find((p: any) => p.deviceId?.trim() === deviceId?.trim());
            if (trimmedPlayer) {
              console.log('[QuizHost] ✨ TRIMMED match found:', trimmedPlayer.deviceId);
              finalPlayer = trimmedPlayer;
            }
          }

          if (finalPlayer) {
            console.log('[QuizHost] Player details:', {
              deviceId: finalPlayer.deviceId,
              teamName: finalPlayer.teamName,
              hasTeamPhoto: !!finalPlayer.teamPhoto,
              photoValue: finalPlayer.teamPhoto ? (finalPlayer.teamPhoto.substring(0, 50) + '...') : 'null',
              hasBuzzerSound: !!finalPlayer.buzzerSound,
              buzzerSound: finalPlayer.buzzerSound || 'none',
              status: finalPlayer.status
            });
          }

          // CRITICAL FIX: Only use photo if it's explicitly approved (photoApprovedAt is set)
          // This prevents unapproved or auto-approved-but-now-disabled photos from being displayed
          if (finalPlayer?.teamPhoto && finalPlayer?.photoApprovedAt) {
            teamPhoto = ensureFileUrl(finalPlayer.teamPhoto);
            console.log('✅ Retrieved APPROVED team photo for:', teamName);
            console.log('[QuizHost] Original photo path:', finalPlayer.teamPhoto);
            console.log('[QuizHost] Photo approval timestamp:', new Date(finalPlayer.photoApprovedAt).toISOString());
            console.log('[QuizHost] Converted photo URL:', teamPhoto?.substring(0, 50) + '...');
          } else if (finalPlayer?.teamPhoto) {
            console.log('[QuizHost] ⚠️ Player has teamPhoto but NO photoApprovedAt - photo NOT APPROVED, skipping');
            console.log('[QuizHost] photoApprovedAt value:', finalPlayer.photoApprovedAt || 'null/undefined');
          } else {
            console.log('[QuizHost] ℹ️ Player found but has no teamPhoto');
          }

          if (finalPlayer?.buzzerSound) {
            buzzerSound = finalPlayer.buzzerSound;
            console.log('✅ Retrieved buzzer sound for team:', teamName);
            console.log('[QuizHost] Buzzer sound:', buzzerSound);
          } else {
            console.log('[QuizHost] ℹ️ Player found but has no buzzerSound (will use on-demand selection)');
          }
        } else {
          console.log('[QuizHost] ⚠️ IPC result was not successful or no data array');
          console.log('[QuizHost] Result details:', { ok: result?.ok, error: result?.error, hasData: !!result?.data });
        }
      } catch (err) {
        console.warn('[QuizHost] Could not fetch team photo or buzzer:', err);
        console.log('[QuizHost] Error type:', err instanceof Error ? err.constructor.name : typeof err);
        if (err instanceof Error) {
          console.log('[QuizHost] Error message:', err.message);
          console.log('[QuizHost] Error stack:', err.stack);
        }
      }

      // Add team to quizzes list
      const newTeam: Quiz = {
        id: deviceId,
        name: teamName,
        type: 'test' as const,
        score: 0,
        photoUrl: teamPhoto || undefined,
      };

      console.log('[QuizHost] 📸 Creating newTeam object:');
      console.log('[QuizHost] - photoUrl present:', !!newTeam.photoUrl);
      if (newTeam.photoUrl) {
        console.log('[QuizHost] - photoUrl value (first 50 chars):', newTeam.photoUrl?.substring(0, 50) + '...');
      }

      if (!quizzesRef.current.find(q => q.id === deviceId)) {
        // Apply buzzer from backend (primary source - initial selection during team creation)
        if (buzzerSound) {
          console.log('[QuizHost] 🔊 Applying buzzer from backend player entry:', buzzerSound);
          newTeam.buzzerSound = buzzerSound;
        } else {
          // Fallback: Check if there's a pending buzzer selection for this device
          // This handles the race condition where PLAYER_BUZZER_SELECT arrives before team approval
          const pendingBuzzer = (window as any).__pendingBuzzerSelections?.[deviceId];
          if (pendingBuzzer) {
            console.log('[QuizHost] 🔊 Found pending buzzer selection for device:', deviceId, '- applying on team creation:', pendingBuzzer);
            newTeam.buzzerSound = pendingBuzzer;
            // Clean up the pending buzzer
            delete (window as any).__pendingBuzzerSelections?.[deviceId];
          }
        }

        setQuizzes(prev => [...prev, newTeam]);
        console.log('✅ Added team to quizzes');
        // Trigger debounced auto-save for crash recovery
        debouncedSaveGameState();
      }

      // Approve via IPC (only works in Electron)
      if ((window as any).api?.network?.approveTeam) {
        console.log('[QuizHost] 📤 Calling approveTeam IPC...');

        // Prepare display mode data to send to the newly approved player
        const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
        const displayData: any = {
          mode: playerDevicesDisplayMode,
          welcomeMessage: currentSettings.waitingRoomMessage || '',
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
        // Only send the question if it has actually been sent/revealed to players
        // (flow states: 'sent-question', 'running', 'timeup', 'revealed', 'fastest')
        // In buzzin pack mode, also send during 'ready' so late joiners see the buzz-in button
        const questionSentFlows = ['sent-question', 'running', 'timeup', 'revealed', 'fastest'];
        const shouldSendQuestion = questionSentFlows.includes(flowState.flow) || (isBuzzinPackMode && flowState.flow === 'ready');
        if (showQuizPackDisplay && loadedQuizQuestions.length > 0 && currentLoadedQuestionIndex < loadedQuizQuestions.length && shouldSendQuestion) {
          const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);

          // In buzzin pack mode during 'ready' state, send placeholder text (question not revealed yet)
          const isPreSend = isBuzzinPackMode && flowState.flow === 'ready';
          currentGameState.currentQuestion = {
            text: isPreSend ? 'Waiting for question...' : currentQuestion.q,
            options: isPreSend ? ['option_1'] : (currentQuestion.options || []),
            type: normalizedType,
            imageDataUrl: isPreSend ? null : (currentQuestion.imageDataUrl || null),
            questionNumber: currentLoadedQuestionIndex + 1,
            totalQuestions: loadedQuizQuestions.length,
            isPlaceholder: isPreSend,
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

        console.log('[QuizHost] 📝 About to call approveTeam with:');
        console.log('[QuizHost] - deviceId:', `"${deviceId}"`, `(length: ${deviceId.length})`);
        console.log('[QuizHost] - teamName:', teamName);
        console.log('[QuizHost] - displayData.mode:', displayData.mode);
        console.log('[QuizHost] - displayData has photo field:', !!displayData.photos);
        console.log('[QuizHost] - displayData keys:', Object.keys(displayData));
        console.log('[QuizHost] - displayData size estimate:', JSON.stringify(displayData).length, 'bytes');

        const ipcCallStartTime = Date.now();
        const result = await (window as any).api.network.approveTeam({ deviceId, teamName, displayData });
        const ipcCallEndTime = Date.now();

        // PHASE 1: Log exact IPC result
        console.log('[QuizHost] 📊 IPC Call Results:');
        console.log('  - Call duration:', ipcCallEndTime - ipcCallStartTime, 'ms');
        console.log('  - Result status:', result?.ok ? '✅ SUCCESS' : '❌ FAILED');
        console.log('  - Result object:', {
          ok: result?.ok,
          error: result?.error || 'none',
          message: result?.message || 'none',
          hasOtherFields: Object.keys(result || {}).filter(k => k !== 'ok' && k !== 'error' && k !== 'message').length
        });

        if (!result?.ok) {
          console.error('[QuizHost] ❌ approveTeam failed:');
          console.error('  - Error:', result?.error);
          console.error('  - Message:', result?.message);
          console.error('  - IPC call took:', ipcCallEndTime - ipcCallStartTime, 'ms');
          console.error('  - Total approval flow so far:', ipcCallEndTime - approvalStartTime, 'ms');
        } else {
          console.log('[QuizHost] ✅ approveTeam succeeded after', ipcCallEndTime - approvalStartTime, 'ms total');

          // Broadcast PHOTO_APPROVAL_UPDATED event for auto-approved photos
          // This ensures the photo gets assigned to the team immediately in quizzes state
          if (teamPhoto) {
            try {
              console.log('[QuizHost] 📸 Broadcasting PHOTO_APPROVAL_UPDATED for auto-approved photo...');
              console.log('[QuizHost]   - deviceId:', deviceId);
              console.log('[QuizHost]   - teamName:', teamName);
              console.log('[QuizHost]   - photoUrl (first 50 chars):', teamPhoto.substring(0, 50) + '...');

              broadcastMessage({
                type: 'PHOTO_APPROVAL_UPDATED',
                data: {
                  deviceId,
                  teamName,
                  photoUrl: teamPhoto,
                  timestamp: Date.now()
                }
              });

              console.log('[QuizHost] ✅ Successfully broadcasted PHOTO_APPROVAL_UPDATED event');
            } catch (broadcastErr) {
              console.error('[QuizHost] ❌ Error broadcasting PHOTO_APPROVAL_UPDATED:', broadcastErr);
            }
          } else {
            console.log('[QuizHost] ℹ️ No teamPhoto to broadcast for PHOTO_APPROVAL_UPDATED');
          }
        }
      } else {
        console.warn('⚠️  api.network.approveTeam not available');
        console.log('[QuizHost] API object structure:', {
          hasApi: !!(window as any).api,
          hasNetwork: !!(window as any).api?.network,
          approveTeamType: typeof (window as any).api?.network?.approveTeam,
          apiKeys: Object.keys((window as any).api || {})
        });
      }

      // Remove from pending
      setPendingTeams(prev => {
        const filtered = prev.filter(t => t.deviceId !== deviceId);
        console.log('[QuizHost] ✨ Removed from pending teams. Remaining pending:', filtered.length);
        return filtered;
      });
    } catch (err) {
      console.error('❌ Failed to approve team:', err);
    }
  };

  // Keep handleApproveTeam ref in sync to avoid listener re-registration
  useEffect(() => {
    handleApproveTeamRef.current = handleApproveTeam;
  }, [handleApproveTeam]);

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
    setShowMusicRoundInterface(false);
    setShowFastestTeamDisplay(false);
    setShowQuizPackDisplay(false);
    setIsQuizPackMode(false);
    setIsBuzzinPackMode(false);
    // Reset buzzin pack state
    setBuzzLockedOutTeams(new Set());
    setBuzzWinnerTeamId(null);
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

  // Helper function to close all UI overlays (TeamWindow and BottomNavigation popups)
  // This is called when navigating to a different tab or opening new UI elements
  // NOTE: Does NOT close game modes - those are preserved in background
  const handleCloseAllOverlays = useCallback(() => {
    // Close team window modal
    setSelectedTeamForWindow(null);

    // Close all BottomNavigation popups
    setBottomNavPopupStates({
      teamPhotos: false,
      clearScores: false,
      emptyLobby: false,
    });
  }, []);

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
    console.log('[QuizHost] handleEndRound called - clearing loadedQuizQuestions');
    console.log('[QuizHost] - Current loadedQuizQuestions.length:', loadedQuizQuestions.length);

    // Stop countdown audio if playing
    stopCountdownAudio();

    // Reset flow state back to initial values to ensure a clean slate for next round
    setFlowState(prev => ({
      ...prev,
      isQuestionMode: false,
      flow: 'idle',
      answerSubmitted: undefined,
      pictureSent: false,
      questionSent: false,
    }));

    sendFlowStateToPlayers({
      flow: 'idle',
      isQuestionMode: false,
      totalTime: flowState.totalTime,
      currentQuestion: undefined,
      currentLoadedQuestionIndex: 0,
      loadedQuizQuestions: [],
      isQuizPackMode: false,
      selectedQuestionType: undefined,
      answerSubmitted: undefined,
      keypadCurrentScreen: undefined,
    });

    setHideQuestionMode(false);
    timer.stop();

    // Clear loaded quiz questions to prevent on-the-spot mode from auto-detecting previous quiz pack question types
    console.log('[QuizHost] ⚠️  About to clear loadedQuizQuestions');
    setLoadedQuizQuestions([]);
    setCurrentLoadedQuestionIndex(0);

    // Reset quiz pack display and mode flags
    setShowQuizPackDisplay(false);
    setIsQuizPackMode(false);
    setIsBuzzinPackMode(false);

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
    setFastestTeamIdForDisplay(null); // Clear stored fastest team ID

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
    console.log('[QuizHost] handleKeypadClick called - clearing loadedQuizQuestions');
    console.log('[QuizHost] - Current loadedQuizQuestions.length:', loadedQuizQuestions.length);

    closeAllGameModes(); // Close any other active modes first
    resetCurrentRoundScores(); // Reset scores to defaults when starting a new keypad round
    // Clear loaded quiz questions to ensure on-the-spot mode doesn't auto-detect question type from previous quiz pack
    console.log('[QuizHost] ⚠️  About to clear loadedQuizQuestions for keypad mode');
    setLoadedQuizQuestions([]);
    setCurrentLoadedQuestionIndex(0);
    setIsQuizPackMode(false); // Ensure quiz pack mode is disabled for on-the-spot
    setIsBuzzinPackMode(false);
    setShowKeypadInterface(true);
    setActiveTab("teams"); // Change active tab when keypad is opened
    setKeypadInstanceKey(prev => prev + 1); // Force re-render with fresh defaults
    setFlowState(prev => ({ ...prev, isQuestionMode: true })); // Enable question mode when starting on-the-spot
  };

  // Handle keypad interface close
  const handleKeypadClose = () => {
    setShowKeypadInterface(false);
    setIsQuizPackMode(false);
    setIsBuzzinPackMode(false);
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
    setFlowState(prev => ({
      ...prev,
      isQuestionMode: false,
      flow: 'idle',
      currentQuestion: null,
      selectedQuestionType: undefined
    })); // Reset flow state completely when closing
  };

  // Handle question type selection in on-the-spot mode (from KeypadInterface)
  const handleSelectQuestionType = (type: 'letters' | 'numbers' | 'multiple-choice' | 'sequence') => {
    console.log('[QuizHost] Host selected question type:', type);

    // Normalize type for getTotalTimeForQuestion (it uses 'multi' instead of 'multiple-choice')
    const questionTypeNormalized = type === 'letters' ? 'letters' :
                                    type === 'numbers' ? 'numbers' :
                                    type === 'multiple-choice' ? 'multi' :
                                    type === 'sequence' ? 'sequence' : 'letters';

    // Get the correct timer duration based on question type and settings
    const typedDuration = getTotalTimeForQuestion({ type: questionTypeNormalized }, gameModeTimers);

    console.log('[QuizHost] Setting flowState for selected type:', type, 'with duration:', typedDuration);

    // Create a placeholder question object to enable keypad rendering
    // This matches what the admin command handler does for consistency
    const placeholderQuestion = {
      type: type,
      q: `Select correct answer (${type})`,
      options: type === 'multiple-choice' ? ['', '', '', '', '', ''] : undefined,
    };

    // Update flowState to transition from idle -> sent-question with the selected type
    // This will trigger sendFlowStateToController to broadcast to remote
    // IMPORTANT: Preserve answerSubmitted to avoid losing confirmed answers during active game
    setFlowState(prev => ({
      ...prev,  // Preserve existing state including any confirmed answer
      flow: 'sent-question',
      isQuestionMode: true,
      selectedQuestionType: type,
      totalTime: typedDuration,
      timeRemaining: typedDuration,
      currentQuestion: placeholderQuestion,
      pictureSent: false,
      questionSent: true, // We're sending the question type to players
      // REMOVED: answerSubmitted: undefined - this was causing answer loss!
    }));

    // Transition the keypad UI to the selected question type's input screen
    // This ensures the remote and host app have consistent UI states
    const screenName = type === 'sequence' ? 'sequence-game' : `${type}-game`;
    // Only update screen if it's actually changing to prevent unnecessary state updates
    if (keypadCurrentScreen !== screenName) {
      setKeypadCurrentScreen(screenName);
    }
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
    console.log('[QuizHost] handlePrimaryAction called');
    console.log('[QuizHost] - loadedQuizQuestions.length:', loadedQuizQuestions.length);
    console.log('[QuizHost] - currentLoadedQuestionIndex:', currentLoadedQuestionIndex);

    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (!currentQuestion) {
      console.log('[QuizHost] ❌ No question found at index', currentLoadedQuestionIndex);
      return;
    }
    console.log('[QuizHost] ✅ Found question at index', currentLoadedQuestionIndex, ':', currentQuestion.q);

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
          // Send picture AND question together so players see options immediately when they tap the image
          sendPictureToPlayers(currentQuestion.imageDataUrl);

          // Broadcast picture to player devices via backend
          broadcastPictureToPlayers(currentQuestion.imageDataUrl);

          // Also send question data alongside picture
          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
          const teamScrambleStates: Record<string, boolean> = {};
          quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, normalizedType, teamScrambleStates);

          // Broadcast question to player devices via backend
          broadcastQuestionToPlayers({
            text: currentQuestion.q,
            q: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            goWideEnabled: goWideEnabled,
            teamScrambleStates,
          });

          // Send to external display with question + image together
          if (externalWindow) {
            const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
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
                  showProgressBar: false,
                  imageDataUrl: currentQuestion.imageDataUrl || null
                },
                totalTime: flowState.totalTime
              }
            );
          }
          setFlowState(prev => ({
            ...prev,
            flow: 'sent-question',
            pictureSent: true,
            questionSent: true,
          }));
        } else {
          // No picture, send question directly
          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
          // Build per-team scramble states map for all teams
          const teamScrambleStates: Record<string, boolean> = {};
          quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, normalizedType, teamScrambleStates);

          // Broadcast question to player devices via backend
          broadcastQuestionToPlayers({
            text: currentQuestion.q,
            q: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            goWideEnabled: goWideEnabled,
            teamScrambleStates,
          });

          if (externalWindow) {
            // Only include options for sequence and multiple-choice questions
            const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
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
                  showProgressBar: false,
                  imageDataUrl: currentQuestion.imageDataUrl || null
                },
                totalTime: flowState.totalTime
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
          const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(currentQuestion.type);
          // Build per-team scramble states map for all teams
          const teamScrambleStates2: Record<string, boolean> = {};
          quizzes.forEach(quiz => { teamScrambleStates2[quiz.name] = quiz.scrambled ?? false; });
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, normalizedType, teamScrambleStates2);

          // Broadcast question to player devices via backend
          broadcastQuestionToPlayers({
            text: currentQuestion.q,
            q: currentQuestion.q,
            options: currentQuestion.options || [],
            type: normalizedType,
            goWideEnabled: goWideEnabled,
            teamScrambleStates: teamScrambleStates2,
          });

          if (externalWindow) {
            // Only include options for sequence and multiple-choice questions
            const shouldIncludeOptions = normalizedType === 'sequence' || normalizedType === 'multiple-choice';
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
                  showProgressBar: false,
                  imageDataUrl: currentQuestion.imageDataUrl || null
                },
                totalTime: flowState.totalTime
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
                showProgressBar: false,
                imageDataUrl: null
              },
              totalTime: flowState.totalTime
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

        // Pre-cache team photos on player devices so they're ready for fastest team reveal
        try {
          const teamsWithPhotos = quizzes.filter(team => team.photoUrl);
          if (teamsWithPhotos.length > 0) {
            // Pre-cache the first team photo with a generic key
            // All team photos will be sent via the FASTEST message, but pre-caching
            // ensures the browser has already downloaded and decoded the image
            teamsWithPhotos.forEach(team => {
              sendPrecacheToPlayers('fastest-team-photo', team.photoUrl!);
            });
            console.log('[QuizHost] PRECACHE: Sent', teamsWithPhotos.length, 'team photo(s) to players for pre-loading');
          }
        } catch (err) {
          console.error('[QuizHost] Error sending precache for team photos:', err);
        }

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

        // Send the answer to all players and external display
        // Skip for nearest wins questions - handleRevealAnswer already sends the correct format
        const questionType_reveal = currentQuestion?.type?.toLowerCase() || '';
        const isNearestWinsReveal = questionType_reveal === 'nearest' || questionType_reveal === 'nearestwins';

        if (externalWindow && !isNearestWinsReveal) {
          // For quiz pack mode, send results summary; for on-the-spot, send the answer
          if (isQuizPackMode && loadedQuizQuestions.length > 0) {
            // Calculate answer statistics for quiz pack using just-calculated statuses
            const correctCount = Object.values(newStatuses).filter(status => status === 'correct').length;
            const incorrectCount = Object.values(newStatuses).filter(status => status === 'incorrect').length;
            const noAnswerCount = Object.values(newStatuses).filter(status => status === 'no-answer').length;

            // Get enhanced answer data
            const answerLetter = getAnswerText(currentQuestion);
            let answerText = '';
            let options = undefined;

            if (currentQuestion.type?.toLowerCase() === 'multi' && currentQuestion.options) {
              answerText = currentQuestion.options[currentQuestion.correctIndex] || '';
              options = currentQuestion.options;
            } else if (currentQuestion.type?.toLowerCase() === 'letters') {
              answerText = currentQuestion.answerText || '';
            }

            sendToExternalDisplay(
              {
                type: 'DISPLAY_UPDATE',
                mode: 'resultsSummary',
                data: {
                  text: currentQuestion.q,
                  answer: answerLetter,
                  answerLetter,
                  answerText,
                  correctIndex: currentQuestion.correctIndex,
                  type: currentQuestion.type,
                  options,
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

        // Broadcast reveal to player devices (skip for nearest wins - handleRevealAnswer already broadcasts)
        if (!isNearestWinsReveal) {
          broadcastAnswerReveal(currentQuestion);
        }

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

            // Play fastest team buzzer
            if (fastestTeam.buzzerSound) {
              playFastestTeamBuzzer(fastestTeam.buzzerSound);
            }

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

              fastestTeamTimeoutRef.current = setTimeout(() => {
                if (lastExternalDisplayMessageRef.current) {
                  sendToExternalDisplay(lastExternalDisplayMessageRef.current);
                }
              }, 5000);
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
          // For quiz pack: Use the stored fastest team ID that was calculated in handleRevealAnswer
          if (fastestTeamIdForDisplay) {
            const fastestTeam = quizzes.find(team => team.id === fastestTeamIdForDisplay);

            if (fastestTeam) {
              const fastestTeamResponseTime = teamResponseTimes[fastestTeam.id] || 0;
              console.log('[QuizHost] QUIZ_PACK: Using stored fastest team -', fastestTeam.name, 'with responseTime from teamResponseTimes:', fastestTeamResponseTime, 'ms, will display as:', (fastestTeamResponseTime / 1000).toFixed(2), 's');

              // Check if this is a nearest wins question
              const questionType = currentQuestion?.type?.toLowerCase() || '';
              const isNearestQuestion = questionType === 'nearest' || questionType === 'nearestwins';

              // For nearest wins, compute the winner's guess and difference
              let winnerGuess: number | undefined;
              let winnerDifference: number | undefined;
              if (isNearestQuestion) {
                const correctAnswer = getAnswerText(currentQuestion);
                const targetNumber = parseInt(String(correctAnswer).trim(), 10);
                const teamAnswer = teamAnswers[fastestTeam.id];
                if (teamAnswer && !isNaN(targetNumber)) {
                  winnerGuess = parseInt(String(teamAnswer).trim(), 10);
                  winnerDifference = isNaN(winnerGuess) ? undefined : Math.abs(winnerGuess - targetNumber);
                }
              }

              // Show FastestTeamDisplay on host screen (same as keypad mode)
              handleFastestTeamReveal({
                team: fastestTeam,
                responseTime: fastestTeamResponseTime,
                ...(isNearestQuestion ? { guess: winnerGuess, difference: winnerDifference, displayMode: 'closest' as const } : {})
              });

              // Send to player portals
              sendFastestToDisplay(fastestTeam.name, currentLoadedQuestionIndex + 1, fastestTeam.photoUrl);

              // Broadcast fastest team to player devices
              if ((window as any).api?.network?.broadcastFastest) {
                try {
                  const fastestData: any = {
                    teamName: fastestTeam.name,
                    questionNumber: currentLoadedQuestionIndex + 1,
                    teamPhoto: fastestTeam.photoUrl || null
                  };
                  // Include guess/difference for nearest wins so player devices show "guessed X, off by Y"
                  if (isNearestQuestion && winnerGuess !== undefined && winnerDifference !== undefined) {
                    fastestData.guess = winnerGuess;
                    fastestData.difference = winnerDifference;
                  }
                  console.log('[QuizHost] Broadcasting fastest team to players:', fastestData);
                  (window as any).api.network.broadcastFastest(fastestData);
                } catch (err) {
                  console.error('[QuizHost] Error broadcasting fastest team:', err);
                }
              }

              // Send to external display
              if (externalWindow) {
                if (isNearestQuestion) {
                  // For nearest wins, send nearest-wins-results with closestTeamRevealed flag
                  const correctAnswer = getAnswerText(currentQuestion);
                  const targetNumber = parseInt(String(correctAnswer).trim(), 10);

                  const submissions = quizzes
                    .filter(team => {
                      const teamAnswer = teamAnswers[team.id];
                      return teamAnswer && String(teamAnswer).trim() !== '';
                    })
                    .map(team => {
                      const teamAnswer = teamAnswers[team.id];
                      const guess = parseInt(String(teamAnswer).trim(), 10);
                      const difference = isNaN(guess) || isNaN(targetNumber) ? Infinity : Math.abs(guess - targetNumber);
                      return { id: team.id, name: team.name, guess, difference, rank: 0 };
                    })
                    .sort((a, b) => a.difference - b.difference);

                  let currentRank = 1;
                  submissions.forEach((team, index) => {
                    if (index > 0 && team.difference === submissions[index - 1].difference) {
                      team.rank = submissions[index - 1].rank;
                    } else {
                      team.rank = currentRank;
                    }
                    currentRank++;
                  });

                  const winners = submissions.filter(t => t.rank === 1);

                  sendToExternalDisplay({
                    type: 'DISPLAY_UPDATE',
                    mode: 'nearest-wins-results',
                    data: {
                      targetNumber,
                      correctAnswer: targetNumber,
                      results: {
                        winner: submissions[0] || null,
                        winners,
                        runnerUp: submissions.find(t => t.rank > 1) || null,
                        submissions
                      },
                      answerRevealed: true,
                      closestTeamRevealed: true,
                      questionNumber: currentLoadedQuestionIndex + 1,
                      totalQuestions: loadedQuizQuestions.length
                    }
                  });
                } else {
                  sendToExternalDisplay(
                    { type: 'DISPLAY_UPDATE', mode: 'fastestTeam', data: { question: currentLoadedQuestionIndex + 1, teamName: fastestTeam.name, teamPhoto: fastestTeam.photoUrl } }
                  );
                }

                fastestTeamTimeoutRef.current = setTimeout(() => {
                  if (lastExternalDisplayMessageRef.current) {
                    sendToExternalDisplay(lastExternalDisplayMessageRef.current);
                  }
                }, 5000);
              }
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
            setFastestTeamIdForDisplay(null); // Reset stored fastest team ID
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
  const handleNavBarStartTimer = useCallback((customDurationOrEvent?: number | any) => {
    // Prevent passing React event objects as duration
    const customDuration = typeof customDurationOrEvent === 'number' ? customDurationOrEvent : undefined;
    console.log('[QuizHost] handleNavBarStartTimer called with customDuration:', customDuration, 'isQuizPackMode:', isQuizPackMode, 'isQuestionMode:', flowState.isQuestionMode, 'showKeypadInterface:', showKeypadInterface, 'showNearestWinsInterface:', showNearestWinsInterface, 'showBuzzInMode:', showBuzzInMode, 'showQuizPackDisplay:', showQuizPackDisplay);

    // Pre-cache team photos on player devices before timer starts
    try {
      const teamsWithPhotos = quizzes.filter(team => team.photoUrl);
      if (teamsWithPhotos.length > 0) {
        teamsWithPhotos.forEach(team => {
          sendPrecacheToPlayers('fastest-team-photo', team.photoUrl!);
        });
        console.log('[QuizHost] handleNavBarStartTimer PRECACHE: Sent', teamsWithPhotos.length, 'team photo(s) to players');
      }
    } catch (err) {
      console.error('[QuizHost] Error sending precache for team photos in handleNavBarStartTimer:', err);
    }

    if (isQuizPackMode && showQuizPackDisplay) {
      console.log('[QuizHost] -> Quiz Pack Mode branch');
      // For quiz pack mode, use the timer parameters (custom duration from admin command or flow state)
      const timerDuration = validateTimerDuration(
        customDuration ?? flowState.totalTime,
        flowState.totalTime || 30
      );

      // Execute the unified timer handler (handles audio, player broadcast, external display)
      executeStartNormalTimer(timerDuration, sendToExternalDisplay).then(result => {
        // Set the timer start time for accurate response time calculation
        setGameTimerStartTime(result.timerStartTime);
        console.log('[QuizHost] NORMAL_TIMER: Set gameTimerStartTime to', result.timerStartTime, 'with duration:', result.timerDuration);

        // Transition to running state which will trigger local timer start
        setFlowState(prev => ({
          ...prev,
          ...result.flowStateUpdate,
        }));
      }).catch(error => {
        console.error('[QuizHost] Error executing normal timer handler:', error);
      });
    } else if (showKeypadInterface || showNearestWinsInterface || showBuzzInMode) {
      console.log('[QuizHost] -> On-the-Spot Mode branch', 'gameTimerRunning:', gameTimerRunning, 'gameTimerFinished:', gameTimerFinished, 'gameActionHandlers:', gameActionHandlers ? 'exists' : 'NULL');
      // For on-the-spot modes, determine which handler to call based on game state
      if (!gameTimerRunning && !gameTimerFinished) {
        // Timer not started yet - start the timer
        // Pass the customDuration (from admin command) or undefined to let the component use its own settings
        const durationToPass = customDuration;
        console.log('[QuizHost] Calling gameActionHandlers.startTimer with duration:', durationToPass);
        gameActionHandlers?.startTimer?.(durationToPass);
      } else if (gameTimerFinished && !gameAnswerRevealed) {
        // Timer finished, next action is reveal answer
        console.log('[QuizHost] Calling gameActionHandlers.reveal (timer finished, answer not revealed)');
        gameActionHandlers?.reveal?.();
      } else if (gameTimerFinished && gameAnswerRevealed && !gameFastestRevealed && teamsAnsweredCorrectly) {
        // Answer revealed and teams answered correctly, next action is fastest team
        console.log('[QuizHost] Calling gameActionHandlers.reveal (fastest team)');
        gameActionHandlers?.reveal?.();
      } else if (gameFastestRevealed || (gameAnswerRevealed && !teamsAnsweredCorrectly)) {
        // Either fastest team revealed OR answer revealed but no correct teams - next action is next question
        console.log('[QuizHost] Calling gameActionHandlers.nextQuestion');
        gameActionHandlers?.nextQuestion?.();
      } else {
        console.log('[QuizHost] No handler matched in on-the-spot mode. State: gameTimerFinished:', gameTimerFinished, 'gameAnswerRevealed:', gameAnswerRevealed, 'gameFastestRevealed:', gameFastestRevealed);
      }
    } else {
      console.log('[QuizHost] -> No matching mode! isQuizPackMode:', isQuizPackMode, 'isQuestionMode:', flowState.isQuestionMode, 'showKeypadInterface:', showKeypadInterface, 'showNearestWinsInterface:', showNearestWinsInterface, 'showBuzzInMode:', showBuzzInMode);
    }
  }, [isQuizPackMode, showQuizPackDisplay, flowState.totalTime, gameActionHandlers, gameTimerRunning, gameTimerFinished, gameAnswerRevealed, gameFastestRevealed, teamsAnsweredCorrectly, showKeypadInterface, showNearestWinsInterface, showBuzzInMode, externalWindow, quizzes]);

  /**
   * Wrapper for nav bar's onSilentTimer - handles both quiz pack and on-the-spot modes
   */
  const handleNavBarSilentTimer = useCallback((customDurationOrEvent?: number | any) => {
    // Prevent passing React event objects as duration
    const customDuration = typeof customDurationOrEvent === 'number' ? customDurationOrEvent : undefined;
    console.log('[QuizHost] handleNavBarSilentTimer called with customDuration:', customDuration, 'isQuizPackMode:', isQuizPackMode, 'isQuestionMode:', flowState.isQuestionMode, 'showKeypadInterface:', showKeypadInterface, 'showQuizPackDisplay:', showQuizPackDisplay);

    // Pre-cache team photos on player devices before timer starts
    try {
      const teamsWithPhotos = quizzes.filter(team => team.photoUrl);
      if (teamsWithPhotos.length > 0) {
        teamsWithPhotos.forEach(team => {
          sendPrecacheToPlayers('fastest-team-photo', team.photoUrl!);
        });
        console.log('[QuizHost] handleNavBarSilentTimer PRECACHE: Sent', teamsWithPhotos.length, 'team photo(s) to players');
      }
    } catch (err) {
      console.error('[QuizHost] Error sending precache for team photos in handleNavBarSilentTimer:', err);
    }

    // For quiz pack mode: check isQuizPackMode (quiz pack specific) AND showQuizPackDisplay (UI is visible)
    // Note: flowState.isQuestionMode can be true for both quiz pack AND on-the-spot modes, so don't use it here
    if (isQuizPackMode && showQuizPackDisplay) {
      console.log('[QuizHost] -> Quiz Pack Mode branch for silent timer');
      // For quiz pack mode: play silent timer audio and start timer
      const timerDuration = validateTimerDuration(
        customDuration ?? flowState.totalTime,
        flowState.totalTime || 30
      );

      // Execute the unified timer handler (handles audio, player broadcast, external display)
      executeStartSilentTimer(timerDuration, sendToExternalDisplay).then(result => {
        // Set the timer start time for accurate response time calculation
        setGameTimerStartTime(result.timerStartTime);
        console.log('[QuizHost] SILENT_TIMER: Set gameTimerStartTime to', result.timerStartTime, 'with duration:', result.timerDuration);

        // Transition to running state which will trigger local timer start
        setFlowState(prev => ({
          ...prev,
          ...result.flowStateUpdate,
        }));
      }).catch(error => {
        console.error('[QuizHost] Error executing silent timer handler:', error);
      });
    } else if (gameActionHandlers?.silentTimer) {
      console.log('[QuizHost] -> On-the-Spot Mode branch for silent timer');
      // For on-the-spot modes, use the game-specific silent timer handler
      // Pass the customDuration (from admin command) or undefined to let the component use its own settings
      const durationToPass = customDuration;
      gameActionHandlers.silentTimer(durationToPass);
    }
  }, [isQuizPackMode, flowState.totalTime, showQuizPackDisplay, showKeypadInterface, externalWindow, gameActionHandlers, quizzes]);

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
        const normalizedType = isBuzzinPackMode ? 'buzzin' : normalizeQuestionTypeForBroadcast(questionData.type);
        const teamScrambleStates: Record<string, boolean> = {};
        quizzes.forEach(quiz => { teamScrambleStates[quiz.name] = quiz.scrambled ?? false; });
        broadcastQuestionToPlayers({
          text: 'Waiting for question...',
          q: 'Waiting for question...',
          options: isBuzzinPackMode ? ['option_1'] : optionsToSend,
          type: normalizedType,
          questionIndex: questionData.questionIndex,
          isPlaceholder: true, // Mark this as a placeholder message
          timestamp: Date.now(),
          goWideEnabled: goWideEnabled,
          teamScrambleStates,
        });
        console.log('[QuizHost] Broadcasted placeholder question to players with type:', questionData.type, '-> normalized:', normalizedType, 'options count:', isBuzzinPackMode ? 1 : optionsToSend.length);
      } catch (error) {
        console.error('[QuizHost] Error broadcasting placeholder question:', error);
      }
    },
    [quizzes, goWideEnabled, isBuzzinPackMode]
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
  const handleBuzzInStart = (mode: "points" | "classic", points: number, soundCheck: boolean) => {
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

  // Handle music round click
  const handleMusicRoundClick = () => {
    closeAllGameModes();

    // Reset flow state to idle so players/host remote know no game is active
    setFlowState(prev => ({
      ...prev,
      isQuestionMode: false,
      flow: 'idle',
      answerSubmitted: undefined,
      pictureSent: false,
      questionSent: false,
    }));

    sendFlowStateToPlayers({
      flow: 'idle',
      isQuestionMode: false,
      totalTime: flowState.totalTime,
      currentQuestion: undefined,
      currentLoadedQuestionIndex: 0,
      loadedQuizQuestions: [],
      isQuizPackMode: false,
      selectedQuestionType: undefined,
      answerSubmitted: undefined,
      keypadCurrentScreen: undefined,
    });

    // Reset external display to default view
    handleExternalDisplayUpdate('basic');

    setShowMusicRoundInterface(true);
    setActiveTab("teams");
  };

  // Handle music round close
  const handleMusicRoundClose = () => {
    setShowMusicRoundInterface(false);
    setMusicRoundBuzzes([]);
    setActiveTab("home");
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
    setFlowState(prev => ({ ...prev, isQuestionMode: true })); // Keep player devices in question mode

    // Ensure external display stays on basic mode when in config
    handleExternalDisplayUpdate('basic');
  };

  // Handle nearest wins interface close
  const handleNearestWinsClose = () => {
    setShowNearestWinsInterface(false);
    setActiveTab("home"); // Return to home when nearest wins is closed
    setFlowState(prev => ({ ...prev, isQuestionMode: false, flow: 'idle' })); // Reset player devices
  };

  // Handle buzzers management open
  const handleOpenBuzzersManagement = () => {
    // Close all UI overlays before opening buzzers management
    handleCloseAllOverlays();
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
    // Close all UI overlays (TeamWindow and BottomNav popups) when switching tabs
    // This ensures new content appears on top and old modals don't linger behind
    handleCloseAllOverlays();

    // If user clicks home, completely reset game states and close all interfaces
    if (tab === "home") {
      // Force reset the flow state so remote knows we're back on home
      setFlowState(prev => ({
        ...prev,
        flow: 'idle',
        isQuestionMode: false,
        currentQuestion: null,
        selectedQuestionType: undefined,
      }));

      // Close all interfaces
      setShowKeypadInterface(false);
      setShowQuizPackDisplay(false);
      setShowBuzzInInterface(false);
      setShowBuzzInMode(false);
      setShowNearestWinsInterface(false);
      setShowWheelSpinnerInterface(false);
      setShowMusicRoundInterface(false);
      setShowFastestTeamDisplay(false);
      setShowBuzzersManagement(false);

      // Reset timers and screens
      setNearestWinsCurrentScreen('config');
      setGameTimerRunning(false);
      setGameTimerTimeRemaining(0);
      setGameTimerTotalTime(0);
      setGameTimerStartTime(null);
      setGameTimerFinished(false);
      setGameAnswerRevealed(false);
      setGameFastestRevealed(false);
      setTeamsAnsweredCorrectly(false);
      setGameAnswerSelected(false);
      setKeypadCurrentScreen('config');
      setIsQuizPackMode(false);
      setIsBuzzinPackMode(false);
    }

    setActiveTab(tab);
  };

  // Helper function to determine current game mode
  const getCurrentGameMode = (): "keypad" | "buzzin" | "nearestwins" | "wheelspinner" | null => {
    if (showKeypadInterface) return "keypad";
    if (showQuizPackDisplay) {
      // Check if current quizpack question is a nearest wins type
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      const qType = currentQuestion?.type?.toLowerCase();
      if (qType === 'nearest' || qType === 'nearestwins') return "nearestwins";
      // Buzzin pack questions use buzzin game mode for correct timer/scoring
      if (isBuzzinPackMode || qType === 'buzzin') return "buzzin";
      return "keypad"; // Quiz packs use keypad-style controls by default
    }
    if (showBuzzInInterface || showBuzzInMode) return "buzzin";
    if (showNearestWinsInterface) return "nearestwins";
    if (showWheelSpinnerInterface) return "wheelspinner";
    if (showMusicRoundInterface) return null; // Music round doesn't use game mode config
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
  const handleFastestTeamReveal = useCallback((fastestTeam: { team: Quiz; responseTime: number; guess?: number; difference?: number; displayMode?: 'fastest' | 'closest' }) => {
    // Ensure team data is synced with the latest info from quizzes array (includes photoUrl, name, etc.)
    const currentTeam = quizzes.find(q => q.id === fastestTeam.team.id);
    const teamToUse = currentTeam || fastestTeam.team;
    console.log('[QuizHost] Setting fastestTeamData - responseTime value:', fastestTeam.responseTime, 'typeof:', typeof fastestTeam.responseTime, 'displayMode:', fastestTeam.displayMode);
    setFastestTeamData({ team: teamToUse, responseTime: fastestTeam.responseTime, guess: fastestTeam.guess, difference: fastestTeam.difference });
    setFastestTeamDisplayMode(fastestTeam.displayMode || 'fastest');

    // Play the team's buzzer sound
    if (teamToUse.buzzerSound) {
      playFastestTeamBuzzer(teamToUse.buzzerSound);
    }

    setShowFastestTeamDisplay(true);
    setActiveTab("teams"); // Switch to teams tab to show the display
  }, [quizzes, playFastestTeamBuzzer]);

  // Handle fastest team display close
  const handleFastestTeamClose = useCallback(() => {
    setShowFastestTeamDisplay(false);
    setActiveTab("home"); // Return to home when closed
  }, []);

  // Handle buzzer volume changes - updates state and persists to localStorage
  const handleBuzzerVolumeChange = useCallback((buzzerSound: string, volume: number) => {
    const updatedVolumes = { ...buzzerVolumes, [buzzerSound]: volume };
    setBuzzerVolumes(updatedVolumes);
    localStorage.setItem('quiz-buzzer-volumes', JSON.stringify(updatedVolumes));
    console.log('[QuizHost] Buzzer volume changed for:', buzzerSound, 'to:', volume, '%');
  }, [buzzerVolumes]);

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

  // Refs for handleNetworkPlayerJoin to avoid re-registration
  const flowStateRef = useRef(flowState);
  const currentLoadedQuestionIndexRef = useRef(currentLoadedQuestionIndex);
  const loadedQuizQuestionsRef = useRef(loadedQuizQuestions);
  const isQuizPackModeRef = useRef(isQuizPackMode);
  const hostInfoBaseUrlRef = useRef(hostInfo?.baseUrl);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);
  useEffect(() => {
    currentLoadedQuestionIndexRef.current = currentLoadedQuestionIndex;
  }, [currentLoadedQuestionIndex]);
  useEffect(() => {
    loadedQuizQuestionsRef.current = loadedQuizQuestions;
  }, [loadedQuizQuestions]);
  useEffect(() => {
    isQuizPackModeRef.current = isQuizPackMode;
  }, [isQuizPackMode]);
  useEffect(() => {
    hostInfoBaseUrlRef.current = hostInfo?.baseUrl;
  }, [hostInfo?.baseUrl]);

  // Wrap PLAYER_JOIN handler in useCallback with minimal deps to prevent re-registration
  // Uses refs to access frequently-changing state without triggering re-registration
  const handleNetworkPlayerJoin = useCallback((data: any) => {
    const { deviceId, playerId, teamName } = data;

    if (!deviceId) {
      console.warn('PLAYER_JOIN missing deviceId');
      return;
    }

    // LOGGING: Log the PLAYER_JOIN message details
    console.log('[QuizHost] 📨 Received PLAYER_JOIN from backend:');
    console.log('[QuizHost] - deviceId:', deviceId);
    console.log('[QuizHost] - teamName:', teamName);
    console.log('[QuizHost] - Message fields:', Object.keys(data));
    console.log('[QuizHost] - Has teamPhoto field:', !!data.teamPhoto);
    if (data.teamPhoto) {
      console.log('[QuizHost] - teamPhoto type:', typeof data.teamPhoto);
      console.log('[QuizHost] - teamPhoto length:', data.teamPhoto.length);
    }

    // Use refs to access latest state values without dependencies
    const currentHostControllerEnabled = hostControllerEnabledRef.current;
    const currentHostControllerCode = hostControllerCodeRef.current;

    // PIN VALIDATION: Check if this player is trying to authenticate as host controller
    console.log('[QuizHost] 🔐 PIN Validation Status:');
    console.log('[QuizHost] - hostControllerEnabled:', currentHostControllerEnabled, `(type: ${typeof currentHostControllerEnabled})`);
    console.log('[QuizHost] - hostControllerCode:', currentHostControllerCode, `(type: ${typeof currentHostControllerCode}, length: ${currentHostControllerCode?.length})`);
    console.log('[QuizHost] - teamName:', teamName, `(type: ${typeof teamName}, length: ${teamName?.length})`);
    console.log('[QuizHost] - PIN Match (teamName === hostControllerCode):', teamName === currentHostControllerCode);

    // Detailed comparison for debugging
    if (teamName !== currentHostControllerCode && currentHostControllerCode) {
      console.log('[QuizHost] - Character-by-character comparison:');
      console.log('[QuizHost]   - teamName chars:', teamName.split('').map((c, i) => `${i}:"${c}(${c.charCodeAt(0)})`).join(', '));
      console.log('[QuizHost]   - code chars:', currentHostControllerCode.split('').map((c, i) => `${i}:"${c}(${c.charCodeAt(0)})`).join(', '));
    }

    if (currentHostControllerEnabled && currentHostControllerCode && teamName === currentHostControllerCode) {
      console.log('[QuizHost] 🔐 ✅ Controller authentication attempt detected!');
      console.log('[QuizHost] - PIN match: team name matches controller code');
      console.log('[QuizHost] - Setting as authenticated controller for deviceId:', deviceId);

      // Send authentication success message to the player
      console.log('[QuizHost] 📤 Sending CONTROLLER_AUTH_SUCCESS to device:', deviceId);
      sendControllerAuthToPlayer(deviceId, true, 'Host controller PIN accepted');

      // Set the authenticated controller ID
      setAuthenticatedControllerId(deviceId);

      // Send initial flow state to the controller via IPC (read current state directly)
      const currentFlowState = flowStateRef.current;
      console.log('[QuizHost] 📤 Sending initial flow state to controller:', { flow: currentFlowState.flow, isQuestionMode: currentFlowState.isQuestionMode, totalTime: currentFlowState.totalTime, deviceId });
      sendFlowStateToController(currentFlowState.flow, currentFlowState.isQuestionMode, {
        totalTime: currentFlowState.totalTime,
        currentQuestion: currentFlowState.currentQuestion,
        currentLoadedQuestionIndex: currentLoadedQuestionIndexRef.current,
        loadedQuizQuestions: loadedQuizQuestionsRef.current,
        isQuizPackMode: isQuizPackModeRef.current,
      }, deviceId, hostInfoBaseUrlRef.current);

      // Do not add controller to quizzes list - they are not a regular team
      console.log('[QuizHost] ✨ Controller authenticated, will not add to regular teams list');
      return;
    } else {
      console.log('[QuizHost] ⚠️ Controller authentication failed - conditions not met:');
      if (!currentHostControllerEnabled) console.log('[QuizHost]   - hostControllerEnabled is false');
      if (!currentHostControllerCode) console.log('[QuizHost]   - hostControllerCode is empty');
      if (teamName !== currentHostControllerCode) console.log('[QuizHost]   - teamName does not match hostControllerCode');
    }

    // Check if waiting room PIN is required
    // Read settings directly from localStorage for latest values (refs pattern)
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const pinEnabled = currentSettings.waitingRoomPinEnabled === true;
    const pinCode = currentSettings.waitingRoomPin || '';
    const welcomeMsg = currentSettings.waitingRoomMessage || '';

    // Check if team with this deviceId already exists (reconnection case)
    const existingTeam = quizzesRef.current.find(q => q.id === deviceId);

    if (existingTeam) {
      // Reconnection - update existing team, keep score, mark as connected
      // PIN is bypassed for reconnecting players (they already joined this session)
      setQuizzes(prev => prev.map(q =>
        q.id === deviceId
          ? { ...q, name: teamName, disconnected: false }
          : q
      ));
      console.log(`🔄 Network player reconnected: ${teamName} (${deviceId}) - score preserved: ${existingTeam.score}`);
      // Trigger debounced auto-save for crash recovery
      debouncedSaveGameStateRef.current?.();
    } else {
      // New team - check if PIN is required before allowing join
      if (pinEnabled && pinCode) {
        if (!authorizedDeviceIdsRef.current.has(deviceId)) {
          console.log(`[QuizHost] 🔐 PIN required for new team: ${teamName} (${deviceId})`);
          sendMessageToPlayer(deviceId, 'PIN_REQUIRED', {
            message: welcomeMsg,
          });
          return;
        }
        console.log(`[QuizHost] 🔐 Device already authorized (PIN bypass): ${deviceId}`);
      }
      // New team - check if quiz is in progress (any team has points)
      const hasStartedQuiz = quizzesRef.current.some(q => (q.score || 0) > 0);

      if (!hasStartedQuiz) {
        // Quiz hasn't started - auto approve new team
        console.log('📋 Auto-approving new team (no points yet):', { deviceId, teamName });

        // Add team to quizzes first (without photo - will be set via PHOTO_APPROVAL_UPDATED broadcast)
        const newTeam: Quiz = {
          id: deviceId,
          name: teamName,
          type: 'test',
          score: 0,
        };

        setQuizzes(prev => {
          const updated = [...prev, newTeam];
          // Sort by score after adding
          return updated.sort((a, b) => (b.score || 0) - (a.score || 0));
        });
        // Trigger debounced auto-save for crash recovery
        debouncedSaveGameStateRef.current?.();

        // Auto-approve the team
        // PHASE 3 FIX: Increase setTimeout from 0 to 150ms to prevent race condition
        // The backend needs time to fully process PLAYER_JOIN and store the player in networkPlayers
        // before we attempt approval. This ensures synchronization between client and server.
        console.log(`[QuizHost] ⏱️ Scheduling auto-approval for: ${teamName} (${deviceId}) - will delay by 150ms to ensure backend is ready`);
        setTimeout(() => {
          console.log(`[QuizHost] ✨ Executing delayed auto-approval for: ${teamName} (${deviceId})`);
          handleApproveTeamRef.current?.(deviceId, teamName);
        }, 150);
        console.log(`✨ New network player scheduled for auto-approval: ${teamName} (${deviceId})`);
      } else {
        // Quiz in progress - require manual approval
        console.log('⏸️ New team requires manual approval (quiz in progress):', { deviceId, teamName });
        const normalizedDeviceId = deviceId?.trim();
        setPendingTeams(prev => {
          // STRONG DEDUPLICATION: Remove any existing entry with same deviceId, then add new entry
          // This prevents duplicates even if PLAYER_JOIN is received multiple times
          const filtered = prev.filter(t => t.deviceId?.trim() !== normalizedDeviceId);

          if (filtered.length < prev.length) {
            // Team was already in pending list - remove it and re-add with updated timestamp
            console.log(`[QuizHost] 🔄 Team already pending approval: ${teamName} (${deviceId}) - updating entry with fresh timestamp`);
          }

          return [...filtered, { deviceId, playerId, teamName, timestamp: Date.now() }];
        });
      }
    }
  }, []); // Empty deps - callback is stable

  // Register PLAYER_JOIN listener with stable handler
  useEffect(() => {
    const unsubscribe = onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);
    return unsubscribe;
  }, [handleNetworkPlayerJoin]); // Only depends on stable handler

  // Handle PIN_SUBMIT from players
  const handlePinSubmit = useCallback((data: any) => {
    const { deviceId, playerId, teamName, pin } = data;
    if (!deviceId || !pin) {
      console.warn('[QuizHost] PIN_SUBMIT missing required fields');
      return;
    }

    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const expectedPin = currentSettings.waitingRoomPin || '';

    if (pin === expectedPin) {
      console.log(`[QuizHost] 🔐 ✅ PIN correct for ${teamName} (${deviceId})`);
      // Add device to authorized set
      setAuthorizedDeviceIds(prev => {
        const updated = new Set(prev);
        updated.add(deviceId);
        return updated;
      });
      // Also update the ref immediately so the join handler sees it
      authorizedDeviceIdsRef.current = new Set([...authorizedDeviceIdsRef.current, deviceId]);

      // Send success to player
      sendMessageToPlayer(deviceId, 'PIN_RESULT', { success: true });

      // Re-process the join now that device is authorized
      handleNetworkPlayerJoin({ deviceId, playerId, teamName, ...data });
    } else {
      console.log(`[QuizHost] 🔐 ❌ PIN incorrect for ${teamName} (${deviceId})`);
      sendMessageToPlayer(deviceId, 'PIN_RESULT', { success: false, message: 'Incorrect PIN' });
    }
  }, [handleNetworkPlayerJoin]);

  // Register PIN_SUBMIT listener
  useEffect(() => {
    const unsubscribe = onNetworkMessage('PIN_SUBMIT', handlePinSubmit);
    return unsubscribe;
  }, [handlePinSubmit]);

  // Wrap PLAYER_DISCONNECT handler in useCallback - uses refs to avoid re-registration
  const handleNetworkPlayerDisconnect = useCallback((data: any) => {
    const { deviceId, playerId } = data;

    if (!deviceId) {
      console.warn('PLAYER_DISCONNECT missing deviceId');
      return;
    }

    // LOGGING: Log the PLAYER_DISCONNECT message details
    console.log('[QuizHost] 📨 Received PLAYER_DISCONNECT from backend:');
    console.log('[QuizHost] - deviceId:', deviceId);
    console.log('[QuizHost] - playerId:', playerId);

    // Check if this was the authenticated controller and clear it (use ref to check without dependency)
    if (deviceId === authenticatedControllerIdRef.current) {
      console.log('[QuizHost] 🔓 Authenticated controller disconnected, clearing controller status');
      setAuthenticatedControllerId(null);
    }

    // Check if team with this deviceId exists
    const existingTeam = quizzesRef.current.find(q => q.id === deviceId);

    if (existingTeam) {
      // Mark team as disconnected, but preserve all data (name, score, etc)
      setQuizzes(prev => prev.map(q =>
        q.id === deviceId
          ? { ...q, disconnected: true }
          : q
      ));
      console.log(`📡 Network player disconnected: ${existingTeam.name} (${deviceId}) - data preserved, score: ${existingTeam.score}`);
      // Trigger debounced auto-save for crash recovery
      debouncedSaveGameStateRef.current?.();
    } else {
      console.log(`⚠️ PLAYER_DISCONNECT received for unknown team: ${deviceId}`);
    }
  }, [setAuthenticatedControllerId, setQuizzes]); // Only depends on setters which don't change

  // Register PLAYER_DISCONNECT listener with stable handler
  useEffect(() => {
    const unsubscribe = onNetworkMessage('PLAYER_DISCONNECT', handleNetworkPlayerDisconnect);
    return unsubscribe;
  }, [handleNetworkPlayerDisconnect]); // Only depends on stable handler

  // Listen for player away state (tab switch, window blur, etc)
  useEffect(() => {
    const handleNetworkPlayerAway = (data: any) => {
      const { deviceId, playerId, teamName, reason } = data;

      if (!deviceId) {
        console.warn('[QuizHost] ⚠️  PLAYER_AWAY missing deviceId');
        return;
      }

      // LOGGING: Log the PLAYER_AWAY message details
      console.log('[QuizHost] 📡 Received PLAYER_AWAY from backend:');
      console.log('[QuizHost] - deviceId:', deviceId);
      console.log('[QuizHost] - playerId:', playerId);
      console.log('[QuizHost] - teamName:', teamName);
      console.log('[QuizHost] - reason:', reason);

      // Check if team with this deviceId exists
      const existingTeam = quizzesRef.current.find(q => q.id === deviceId);

      if (existingTeam) {
        // Mark team as disconnected (will appear grey), but preserve all data
        setQuizzes(prev => prev.map(q =>
          q.id === deviceId
            ? { ...q, disconnected: true }
            : q
        ));
        console.log(`[QuizHost] 🚶 Player away: ${existingTeam.name} (${deviceId}) - reason: ${reason} - data preserved, score: ${existingTeam.score}`);
      } else {
        console.log(`[QuizHost] ⚠️  PLAYER_AWAY received for unknown team: ${deviceId}`);
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onNetworkMessage('PLAYER_AWAY', handleNetworkPlayerAway);

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // Empty dependency array - register once on mount

  // Listen for player active state (returned from tab/window away)
  useEffect(() => {
    const handleNetworkPlayerActive = (data: any) => {
      const { deviceId, playerId, teamName, reason } = data;

      if (!deviceId) {
        console.warn('[QuizHost] ⚠️  PLAYER_ACTIVE missing deviceId');
        return;
      }

      // LOGGING: Log the PLAYER_ACTIVE message details
      console.log('[QuizHost] 📡 Received PLAYER_ACTIVE from backend:');
      console.log('[QuizHost] - deviceId:', deviceId);
      console.log('[QuizHost] - playerId:', playerId);
      console.log('[QuizHost] - teamName:', teamName);
      console.log('[QuizHost] - reason:', reason);

      // Check if team with this deviceId exists
      const existingTeam = quizzesRef.current.find(q => q.id === deviceId);

      if (existingTeam) {
        // Mark team as active (remove grey appearance), restore normal state
        setQuizzes(prev => prev.map(q =>
          q.id === deviceId
            ? { ...q, disconnected: false }
            : q
        ));
        console.log(`[QuizHost] ✅ Player active: ${existingTeam.name} (${deviceId}) - reason: ${reason} - data preserved, score: ${existingTeam.score}`);
        // Trigger debounced auto-save for crash recovery
        debouncedSaveGameState();
      } else {
        console.log(`[QuizHost] ⚠️  PLAYER_ACTIVE received for unknown team: ${deviceId}`);
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onNetworkMessage('PLAYER_ACTIVE', handleNetworkPlayerActive);

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // Empty dependency array - register once on mount

  // Listen for admin commands from host controller
  // CRITICAL: This effect registers the listener ONCE on mount with empty deps array.
  // It uses refs (adminListenerDepsRef) to access current dependency values inside the handler,
  // instead of including dependencies in the effect deps array.
  // This prevents infinite listener re-registration when dependencies change.
  // The refs are updated by a separate useEffect whenever dependencies change.
  useEffect(() => {
    console.log('[QuizHost] 🔌 Registering admin command listener (ONCE on mount)');

    const handleAdminCommand = (data: any) => {
      const { deviceId, playerId, commandType, commandData } = data;
      const deps = adminListenerDepsRef.current;

      const DEBUG = (window as any).__DEBUG_MODE__;
      if (DEBUG) {
        console.log('[QuizHost] 🎮 Admin command:', { commandType, deviceId });
      }

      // SECURITY: Verify that this command is from the authenticated controller
      // Trim both strings to handle any whitespace issues
      const incomingId = (deviceId || '').trim();
      const storedId = (deps.authenticatedControllerId || '').trim();
      if (incomingId && storedId && incomingId !== storedId) {
        console.warn('[QuizHost] ⚠️  SECURITY: Admin command from non-authenticated device:', incomingId);
        console.warn('[QuizHost] ⚠️  Expected controller:', storedId);
        sendAdminResponse(deviceId, commandType, false, 'Not authenticated as controller', undefined, deps.baseUrl);
        return;
      }

      // SECURITY: Verify commandType is a valid string
      if (typeof commandType !== 'string' || !commandType.trim()) {
        console.warn('[QuizHost] ⚠️  SECURITY: Invalid commandType received:', commandType);
        sendAdminResponse(deviceId, commandType, false, 'Invalid command type', undefined, deps.baseUrl);
        return;
      }

      try {
        let success = false;
        let responseData: any = null;

        // Route to appropriate handler based on command type
        switch (commandType) {
          // Universal question controls
          case 'send-question':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Send Question', {
                index: deps.currentLoadedQuestionIndex,
                total: deps.loadedQuizQuestions?.length
              });
            }

            // Prevent rapid double-clicks
            if (deps.flowState.flow === 'sent-question' || deps.flowState.flow === 'running') {
              console.log('[QuizHost] Ignoring send-question: Already sent or running');
              success = true;
              break;
            }

            // Call the primary action handler which manages game flow progression
            deps.handlePrimaryAction();
            success = true;
            break;

          case 'send-picture':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Send Picture');
            }
            if (deps.isQuizPackMode && deps.loadedQuizQuestions.length > 0) {
              const currentQuestion = deps.loadedQuizQuestions[deps.currentLoadedQuestionIndex];
              // Check if question has an image
              if (currentQuestion && hasQuestionImage(currentQuestion)) {
                deps.handlePrimaryAction();
                success = true;
              } else {
                console.warn('[QuizHost] ⚠️  send-picture called but question has no image');
                success = false;
              }
            } else {
              console.warn('[QuizHost] ⚠️  send-picture called outside quiz pack mode or no questions loaded');
              success = false;
            }
            break;

          case 'hide-question':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Hide Question');
            }
            // Call handleHideQuestion to toggle hide mode and progress flow if in ready state
            deps.handleHideQuestion();
            success = true;
            break;

          case 'next-question':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Next Question', {
                isQuizPackMode: deps.isQuizPackMode,
                flow: deps.flowState.flow,
                index: deps.currentLoadedQuestionIndex,
                total: deps.loadedQuizQuestions.length,
              });
            }

            // For quiz pack mode, use handlePrimaryAction to ensure proper state transitions and cleanup
            if (deps.isQuizPackMode) {
              // handlePrimaryAction will handle the state machine:
              // - In 'fastest' state: advances to next question with full cleanup
              // - In last question: ends the round
              // This ensures all team answers are cleared, timers are reset, etc.
              deps.handlePrimaryAction();
              success = true;
            } else if (!deps.isQuizPackMode) {
              // For on-the-spot, reset flow and broadcast next
              // Use default keypad timer as placeholder until user selects next question type
              const defaultOnTheSpotTimer = deps.gameModeTimers.keypad || 30;
              deps.setFlowState(prev => ({
                ...prev,
                flow: 'idle',
                isQuestionMode: true, // Keep in question mode for next type selection
                totalTime: defaultOnTheSpotTimer, // Use settings default, not hardcoded
                selectedQuestionType: undefined, // Clear question type for next round
                answerSubmitted: undefined, // Clear submitted answer
              }));

              if (deps.gameActionHandlers?.nextQuestion) {
                deps.gameActionHandlers.nextQuestion();
              }

              sendNextQuestion();
              // Reset team answers/times for next round
              setTeamAnswers({});
              setTeamResponseTimes({});
              setTeamAnswerCounts({});
              setTeamAnswerStatuses({});
              setTeamCorrectRankings({});
              setFastestTeamRevealTime(null);
              success = true;
            }
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;

          case 'reveal-answer':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Reveal Answer');
            }

            // Prevent rapid double-clicks/feedback loops
            if (deps.flowState.flow === 'revealed' || deps.flowState.flow === 'fastest') {
              console.log('[QuizHost] Ignoring reveal-answer: Already revealed');
              success = true;
              break;
            }

            // Trigger reveal answer and transition flowState
            // For on-the-spot mode (keypad), call gameActionHandlers.reveal() to trigger KeypadInterface's reveal
            // For quiz pack mode, call handleRevealAnswer() to handle quiz pack scoring
            if (!deps.isQuizPackMode && deps.gameActionHandlers?.reveal) {
              if (DEBUG) {
                console.log('[QuizHost] Reveal Answer: Using gameActionHandlers.reveal for on-the-spot mode');
              }
              deps.gameActionHandlers.reveal();
            } else {
              if (DEBUG) {
                console.log('[QuizHost] Reveal Answer: Using handleRevealAnswer for quiz pack mode');
              }
              deps.handleRevealAnswer();
              // Also call handlePrimaryAction to transition flowState from running/timeup to revealed/fastest
              deps.handlePrimaryAction();
            }
            success = true;
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;

          case 'show-fastest':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Show Fastest Team');
            }

            // Prevent rapid double-clicks
            if (deps.flowState.flow === 'fastest') {
              console.log('[QuizHost] Ignoring show-fastest: Already showing fastest');
              success = true;
              break;
            }

            // For on-the-spot mode (keypad), call gameActionHandlers.revealFastestTeam() to trigger KeypadInterface's fastest team logic
            if (!deps.isQuizPackMode && deps.gameActionHandlers?.revealFastestTeam) {
              if (DEBUG) {
                console.log('[QuizHost] Show Fastest Team: Using gameActionHandlers.revealFastestTeam for on-the-spot mode');
              }
              deps.gameActionHandlers.revealFastestTeam();
            } else {
              // For quiz pack mode, handlePrimaryAction handles state progression
              deps.handlePrimaryAction();
            }

            success = true;
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;

          case 'skip-question':
            if (DEBUG) {
              console.log('[QuizHost] Executing: Skip Question');
            }
            sendNextQuestion(); // Skip by going to next
            success = true;
            break;

          case 'end-round':
            if (DEBUG) {
              console.log('[QuizHost] Executing: End Round');
            }
            sendEndRound();
            success = true;
            break;

          // Timer controls
          case 'start-silent-timer': {
            if (DEBUG) {
              console.log('[QuizHost] Executing: Start Silent Timer', { commandData });
            }

            // Prevent feedback loops/rapid clicks
            if (deps.flowState.flow === 'running') {
              console.log('[QuizHost] Ignoring start-silent-timer: Timer already running');
              success = true;
              break;
            }

            // Determine correct timer duration strictly from host settings
            // This ensures the remote trigger uses exactly the same timer as UI buttons
            let timerDuration = deps.flowState.totalTime || 30;

            if (!deps.isQuizPackMode && deps.gameModeTimers) {
              if (deps.showKeypadInterface) {
                timerDuration = deps.gameModeTimers.keypad || timerDuration;
              } else if (deps.showNearestWinsInterface) {
                timerDuration = deps.gameModeTimers.nearestwins || timerDuration;
              } else if (deps.showBuzzInMode) {
                timerDuration = deps.gameModeTimers.buzzin || timerDuration;
              }
            }

            console.log('[QuizHost] Silent timer - resolved duration (Host Authoritative):', {
              ignoredRemoteSeconds: commandData?.seconds,
              hostTotalTime: deps.flowState.totalTime,
              finalTimerDuration: timerDuration,
              isQuestionMode: deps.flowState.isQuestionMode,
              flowState: deps.flowState.flow
            });

            // Call handler with explicit duration (same as UI would use)
            deps.handleNavBarSilentTimer(timerDuration);

            success = true;
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;
          }

          case 'start-normal-timer': {
            if (DEBUG) {
              console.log('[QuizHost] Executing: Start Normal Timer', { commandData });
            }

            // Prevent feedback loops/rapid clicks
            if (deps.flowState.flow === 'running') {
              console.log('[QuizHost] Ignoring start-normal-timer: Timer already running');
              success = true;
              break;
            }

            // Determine correct timer duration strictly from host settings
            // This ensures the remote trigger uses exactly the same timer as UI buttons
            let timerDuration = deps.flowState.totalTime || 30;

            if (!deps.isQuizPackMode && deps.gameModeTimers) {
              if (deps.showKeypadInterface) {
                timerDuration = deps.gameModeTimers.keypad || timerDuration;
              } else if (deps.showNearestWinsInterface) {
                timerDuration = deps.gameModeTimers.nearestwins || timerDuration;
              } else if (deps.showBuzzInMode) {
                timerDuration = deps.gameModeTimers.buzzin || timerDuration;
              }
            }

            console.log('[QuizHost] Normal timer - resolved duration (Host Authoritative):', {
              ignoredRemoteSeconds: commandData?.seconds,
              hostTotalTime: deps.flowState.totalTime,
              finalTimerDuration: timerDuration,
              isQuestionMode: deps.flowState.isQuestionMode,
              flowState: deps.flowState.flow,
              showKeypadInterface: deps.showKeypadInterface,
              showNearestWinsInterface: deps.showNearestWinsInterface,
              showBuzzInMode: deps.showBuzzInMode
            });

            // Call handler with explicit duration (same as UI would use)
            console.log('[QuizHost] Calling handleNavBarStartTimer with duration:', timerDuration, 'gameActionHandlers:', gameActionHandlers ? 'exists' : 'NULL', 'gameTimerRunning:', gameTimerRunning, 'gameTimerFinished:', gameTimerFinished);
            deps.handleNavBarStartTimer(timerDuration);

            success = true;
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;
          }

          case 'stop-timer':
            console.log('[QuizHost] Executing: Stop Timer');

            // Prevent redundant stop commands which could cause feedback loops
            if (deps.flowState.flow !== 'running') {
              console.log('[QuizHost] Ignoring stop-timer: Timer not running');
              success = true;
              break;
            }

            // Stop countdown audio on host
            stopCountdownAudio();
            // Clear timer start time
            setGameTimerStartTime(null);
            // Update host flowState to 'timeup' (same as when timer naturally expires)
            deps.setFlowState(prev => ({
              ...prev,
              flow: 'timeup',
              timeRemaining: 0,
            }));
            // Notify players that time is up
            sendTimeUpToPlayers();
            success = true;
            // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
            // This prevents duplicate broadcasts
            break;

          case 'pause-timer':
            console.log('[QuizHost] Executing: Pause Timer');
            // Would need timer pause functionality
            success = true;
            break;

          case 'resume-timer':
            console.log('[QuizHost] Executing: Resume Timer');
            // Would need timer resume functionality
            success = true;
            break;

          // Team management
          case 'edit-team-name':
            console.log('[QuizHost] Executing: Edit Team Name');
            if (commandData?.teamId && commandData?.newName) {
              // SECURITY: Validate team name
              let newName = String(commandData.newName).trim();

              // SECURITY: Enforce name length limits (1-50 characters)
              if (!newName || newName.length === 0 || newName.length > 50) {
                console.warn('[QuizHost] ⚠️  SECURITY: Invalid team name length:', newName.length);
                success = false;
                break;
              }

              // SECURITY: Verify team exists before modifying
              const targetTeam = quizzesRef.current.find(q => q.id === commandData.teamId);
              if (!targetTeam) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted team name edit on non-existent team:', commandData.teamId);
                success = false;
                break;
              }

              // SECURITY: Prevent changing to the controller PIN (would cause confusion)
              if (deps.hostControllerEnabled && newName === deps.hostControllerCode) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted to rename team to controller PIN');
                success = false;
                break;
              }

              console.log('[QuizHost] Validated team name change - old:', targetTeam.name, 'new:', newName);
              setQuizzes(prev => prev.map(quiz =>
                quiz.id === commandData.teamId
                  ? { ...quiz, name: newName }
                  : quiz
              ));
              success = true;
            } else {
              console.warn('[QuizHost] ⚠️  SECURITY: Missing required fields for team name edit');
              success = false;
            }
            break;

          case 'adjust-score':
            console.log('[QuizHost] Executing: Adjust Score');
            if (commandData?.teamId && commandData?.points !== undefined) {
              // SECURITY: Validate points is a number
              let points = commandData.points;
              if (typeof points !== 'number' || !Number.isFinite(points)) {
                console.warn('[QuizHost] ⚠️  SECURITY: Invalid points value, rejecting command');
                success = false;
                break;
              }
              // SECURITY: Clamp points to reasonable bounds (prevent huge additions/subtractions)
              // Max adjustment per command: ±1000 points
              points = Math.max(-1000, Math.min(1000, Math.floor(points)));

              // SECURITY: Verify team exists before modifying
              const targetTeam = quizzesRef.current.find(q => q.id === commandData.teamId);
              if (!targetTeam) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted score adjustment on non-existent team:', commandData.teamId);
                success = false;
                break;
              }

              console.log('[QuizHost] Validated score adjustment - points:', points, 'team:', targetTeam.name);
              setQuizzes(prev => prev.map(quiz =>
                quiz.id === commandData.teamId
                  ? { ...quiz, score: Math.max(0, (quiz.score || 0) + points) }
                  : quiz
              ));
              success = true;
              debouncedSaveGameStateRef.current?.();
            } else {
              console.warn('[QuizHost] ⚠️  SECURITY: Missing required fields for score adjustment');
              success = false;
            }
            break;

          case 'approve-photo':
            console.log('[QuizHost] Executing: Approve Photo');
            if (commandData?.teamId || commandData?.deviceId) {
              const targetTeamId = commandData?.teamId || commandData?.deviceId;
              const targetTeam = quizzesRef.current.find(q => q.id === targetTeamId);
              if (!targetTeam) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted photo approval on non-existent team:', targetTeamId);
                success = false;
                break;
              }
              console.log('[QuizHost] Approving photo for team:', targetTeam.name);
              // Call handleApproveTeam to actually approve the team photo
              handleApproveTeam(targetTeamId, targetTeam.name);
              success = true;
            } else {
              console.warn('[QuizHost] ⚠️  SECURITY: Missing teamId/deviceId for approve-photo command');
              success = false;
            }
            break;

          case 'decline-photo':
            console.log('[QuizHost] Executing: Decline Photo');
            if (commandData?.teamId || commandData?.deviceId) {
              const targetTeamId = commandData?.teamId || commandData?.deviceId;
              const targetTeam = quizzesRef.current.find(q => q.id === targetTeamId);
              if (!targetTeam) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted photo decline on non-existent team:', targetTeamId);
                success = false;
                break;
              }
              console.log('[QuizHost] Declining photo for team:', targetTeam.name);
              // Call handleDeclineTeam to decline the photo
              handleDeclineTeam(targetTeamId);
              success = true;
            } else {
              console.warn('[QuizHost] ⚠️  SECURITY: Missing teamId/deviceId for decline-photo command');
              success = false;
            }
            break;

          case 'remove-team':
            console.log('[QuizHost] Executing: Remove Team');
            if (commandData?.teamId) {
              // SECURITY: Verify team exists before removing
              const teamToRemove = quizzesRef.current.find(q => q.id === commandData.teamId);
              if (!teamToRemove) {
                console.warn('[QuizHost] ⚠️  SECURITY: Attempted removal of non-existent team:', commandData.teamId);
                success = false;
                break;
              }

              console.log('[QuizHost] Removing team:', teamToRemove.name);
              setQuizzes(prev => prev.filter(quiz => quiz.id !== commandData.teamId));
              success = true;
              debouncedSaveGameStateRef.current?.();
            } else {
              console.warn('[QuizHost] ⚠️  SECURITY: Missing teamId for remove-team command');
              success = false;
            }
            break;


          // Quiz pack navigation commands
          case 'previous-question':
            console.log('[QuizHost] Executing: Previous Question');
            console.log('[QuizHost]   - isQuizPackMode:', deps.isQuizPackMode);
            if (deps.isQuizPackMode) {
              deps.handleQuizPackPrevious();
              success = true;
              // Explicitly broadcast the updated question to the remote controller
              // (state update and flowState update will occur, but we need to send it now)
              setTimeout(() => {
                deps.sendFlowStateToController?.(
                  deps.flowState.flow,
                  deps.flowState.isQuestionMode,
                  {
                    totalTime: deps.flowState.totalTime,
                    currentQuestion: deps.flowState.currentQuestion,
                    currentLoadedQuestionIndex: deps.currentLoadedQuestionIndex,
                    loadedQuizQuestions: deps.loadedQuizQuestions,
                    isQuizPackMode: deps.isQuizPackMode,
                    selectedQuestionType: deps.flowState.selectedQuestionType,
                    answerSubmitted: deps.flowState.answerSubmitted,
                  },
                  deps.authenticatedControllerId,
                  deps.baseUrl
                );
              }, 0);
            } else {
              console.warn('[QuizHost] ⚠️  Previous question only available in quiz pack mode');
              success = false;
            }
            break;

          case 'next-question-nav':
            console.log('[QuizHost] Executing: Next Question (Navigation)');
            console.log('[QuizHost]   - isQuizPackMode:', deps.isQuizPackMode);
            if (deps.isQuizPackMode) {
              deps.handleQuizPackNext();
              success = true;
              // Explicitly broadcast the updated question to the remote controller
              // (state update and flowState update will occur, but we need to send it now)
              setTimeout(() => {
                deps.sendFlowStateToController?.(
                  deps.flowState.flow,
                  deps.flowState.isQuestionMode,
                  {
                    totalTime: deps.flowState.totalTime,
                    currentQuestion: deps.flowState.currentQuestion,
                    currentLoadedQuestionIndex: deps.currentLoadedQuestionIndex,
                    loadedQuizQuestions: deps.loadedQuizQuestions,
                    isQuizPackMode: deps.isQuizPackMode,
                    selectedQuestionType: deps.flowState.selectedQuestionType,
                    answerSubmitted: deps.flowState.answerSubmitted,
                  },
                  deps.authenticatedControllerId,
                  deps.baseUrl
                );
              }, 0);
            } else {
              console.warn('[QuizHost] ⚠️  Next question navigation only available in quiz pack mode');
              success = false;
            }
            break;

          // On-the-spot mode commands
          case 'select-question-type':
            const selectedType = commandData?.type;
            // Validate question type
            if (!selectedType || !['letters', 'numbers', 'multiple-choice', 'sequence'].includes(selectedType)) {
              console.warn('[QuizHost] ⚠️  SECURITY: Invalid question type:', selectedType);
              success = false;
              break;
            }

            if (!isQuizPackMode) {
              // Set up on-the-spot mode with selected question type
              // Determine correct timer duration based on question type and settings
              const selectedTypeForTimer = selectedType as 'letters' | 'numbers' | 'multiple-choice' | 'sequence';
              const questionTypeNormalized = selectedTypeForTimer === 'letters' ? 'letters' :
                                              selectedTypeForTimer === 'numbers' ? 'numbers' :
                                              selectedTypeForTimer === 'multiple-choice' ? 'multi' :
                                              selectedTypeForTimer === 'sequence' ? 'sequence' : 'letters';
              const typedDuration = getTotalTimeForQuestion({ type: questionTypeNormalized }, deps.gameModeTimers);

              // Create a placeholder question object to enable keypad rendering
              const placeholderQuestion = {
                type: selectedType,
                q: `Select correct answer (${selectedType})`,
                options: selectedType === 'multiple-choice' ? ['', '', '', '', '', ''] : undefined,
              };

              // For on-the-spot, we transition directly to 'sent-question' state so timer buttons appear
              // (we skip 'ready' state because there's no pre-written question to send)
              const newFlowState = {
                flow: 'sent-question' as const,
                isQuestionMode: true,
                totalTime: typedDuration, // Use Settings-based duration, not hardcoded
                selectedQuestionType: selectedType as 'letters' | 'numbers' | 'multiple-choice' | 'sequence',
                currentQuestion: placeholderQuestion,
              };
              deps.setFlowState(newFlowState);

              // Transition the keypad UI to the selected question type's input screen
              const screenName = selectedType === 'sequence' ? 'sequence-game' : `${selectedType}-game`;
              // Only update screen if it's actually changing to prevent unnecessary state updates and feedback loops
              if (deps.keypadCurrentScreen !== screenName) {
                deps.setKeypadCurrentScreen?.(screenName);
              }

              success = true;
              // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
              // This prevents duplicate broadcasts and eliminates the feedback loop
            } else {
              console.warn('[QuizHost] ⚠️  Question type selection only available in on-the-spot mode');
              success = false;
            }
            break;

          case 'set-expected-answer':
            const expectedAnswer = commandData?.answer;
            // Validate answer is a string
            if (typeof expectedAnswer !== 'string' || expectedAnswer.trim().length === 0) {
              console.warn('[QuizHost] ⚠️  SECURITY: Invalid expected answer');
              success = false;
              break;
            }

            if (!isQuizPackMode) {
              // Store expected answer in flowState for use when revealing answer/scoring
              // Update the local flow state with the expected answer
              setFlowState(prev => ({
                ...prev,
                answerSubmitted: expectedAnswer,
              }));
              // ✅ Let the useEffect (line ~4153) handle the FLOW_STATE broadcast when flowState changes
              // This prevents duplicate broadcasts and eliminates the feedback loop
              success = true;
            } else {
              console.warn('[QuizHost] ⚠️  Answer input only available in on-the-spot mode');
              success = false;
            }
            break;

          default:
            console.warn('[QuizHost] Unknown admin command:', commandType);
            break;
        }

        // Send response back to controller
        console.log('[QuizHost] Sending admin response:', { commandType, success });
        sendAdminResponse(deviceId, commandType, success, success ? 'Command executed' : 'Command failed', responseData, deps.baseUrl);
      } catch (err) {
        console.error('[QuizHost] Error handling admin command:', err);
        sendAdminResponse(deviceId, commandType, false, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, undefined, deps.baseUrl);
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onAdminCommand(handleAdminCommand);

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // EMPTY DEPENDENCY ARRAY - listener registers ONCE on mount, never re-registers

  // Wrap TEAM_PHOTO_UPDATED handler in useCallback - uses refs to avoid re-registration
  const handleNetworkTeamPhotoUpdated = useCallback((data: any) => {
    try {
      console.log('[QuizHost] 📸 TEAM_PHOTO_UPDATED received:', data);
      const { deviceId, playerId, teamName, photoPath, photoApprovedAt } = data;

      if (!photoPath) {
        console.warn('[QuizHost] ⚠️  TEAM_PHOTO_UPDATED: No photoPath in payload');
        return;
      }

      // Will handle auto-approval after we have convertedPhotoUrl
      const normalizedDeviceId = (deviceId || '').trim();

      // Determine team to match - try by deviceId, then playerId, then teamName
      let existingTeam = quizzesRef.current.find(q => q.id === deviceId);
      let matchMethod = '';

      if (existingTeam) {
        matchMethod = 'deviceId';
        console.log('[QuizHost] 📸 Matched team by deviceId:', deviceId, '→', existingTeam.name);
      } else if (playerId) {
        existingTeam = quizzesRef.current.find(q => q.id === playerId);
        if (existingTeam) {
          matchMethod = 'playerId';
          console.log('[QuizHost] 📸 Matched team by playerId:', playerId, '→', existingTeam.name);
        }
      }

      if (!existingTeam && teamName) {
        console.log('[QuizHost] 📸 No ID match found, trying teamName fallback:', teamName);
        existingTeam = quizzesRef.current.find(q => q.name === teamName);
        if (existingTeam) {
          matchMethod = 'teamName';
          console.log('[QuizHost] 📸 Found team by name:', teamName, 'with ID:', existingTeam.id);
        } else {
          // Log available teams for debugging
          const availableTeams = quizzesRef.current.map(q => ({ id: q.id, name: q.name }));
          console.warn('[QuizHost] ⚠️  Team matching failed. Received teamName:', teamName, 'but not found in available teams:', availableTeams);
        }
      }

      // Convert photo path to file:// URL if needed
      const convertedPhotoUrl = (() => {
        if (!photoPath) return undefined;
        if (typeof photoPath !== 'string') return undefined;

        // Accept data URLs (no conversion needed)
        if (photoPath.startsWith('data:')) return photoPath;

        // Accept already-proper file:// URLs (starts with file://)
        if (photoPath.startsWith('file://')) return photoPath;

        // Accept http(s) URLs as-is
        if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;

        // Convert local paths to proper file:// URL
        // Handle Windows backslashes by converting to forward slashes
        let normalizedPath = photoPath.replace(/\\/g, '/');

        // Add file:// protocol if not already there
        // Windows paths like C:/Users/... need file:///C:/...
        if (normalizedPath.includes(':') && !normalizedPath.startsWith('file://')) {
          // Windows absolute path
          return `file:///${normalizedPath}`;
        } else if (normalizedPath.startsWith('/')) {
          // Unix absolute path
          return `file://${normalizedPath}`;
        } else {
          // Relative path - convert to file URL
          return `file://${normalizedPath}`;
        }
      })();

      if (!convertedPhotoUrl) {
        console.warn('[QuizHost] ⚠️  TEAM_PHOTO_UPDATED: Could not convert photo URL');
        return;
      }

      console.log('[QuizHost] 📸 Converted photo URL (first 50 chars):', convertedPhotoUrl.substring(0, 50) + '...');
      console.log('[QuizHost] 📸 Photo approval status from backend - photoApprovedAt:', photoApprovedAt ? new Date(photoApprovedAt).toISOString() : null);

      // AUTO-APPROVAL: Check if the backend has already approved this photo (indicated by photoApprovedAt being present)
      // This signals that auto-approve was enabled when the photo was submitted
      // If photoApprovedAt exists, broadcast PHOTO_APPROVAL_UPDATED immediately
      if (photoApprovedAt && normalizedDeviceId && teamName && convertedPhotoUrl) {
        console.log('[QuizHost] 📸 Backend APPROVED this photo - broadcasting PHOTO_APPROVAL_UPDATED for:', teamName);

        // Use async IIFE to broadcast the approval event
        (async () => {
          try {
            // Broadcast the approval event immediately with the converted photoUrl
            const { broadcastMessage } = await import('../network/wsHost');
            broadcastMessage({
              type: 'PHOTO_APPROVAL_UPDATED',
              data: {
                deviceId: normalizedDeviceId,
                teamName: teamName,
                photoUrl: convertedPhotoUrl
              }
            });
            console.log('[QuizHost] ✅ Photo approved by backend: broadcasted PHOTO_APPROVAL_UPDATED for team:', teamName);
          } catch (err) {
            console.error('[QuizHost] Error broadcasting backend-approved photo:', err);
          }
        })();
      } else if (!photoApprovedAt) {
        console.log('[QuizHost] 📸 Photo is pending approval (not approved by backend) - not auto-approving');
      }

      // NOTE: We intentionally do NOT update photoUrl here from TEAM_PHOTO_UPDATED (unless auto-approved above)
      // TEAM_PHOTO_UPDATED is sent immediately when a photo is uploaded (BEFORE approval)
      // We only display the photo in TeamWindow when PHOTO_APPROVAL_UPDATED is received (AFTER approval)
      // This prevents pending/unapproved photos from appearing as already-accepted in the team info tab

      if (existingTeam && !teamPhotosAutoApproveRef.current) {
        // IMPORTANT: Clear the existing photoUrl if the team has one
        // This ensures the old photo disappears immediately when a new one is submitted
        // The team info tab will be empty while the new photo is pending approval
        if (existingTeam.photoUrl) {
          console.log('[QuizHost] 📸 Clearing existing photoUrl for team:', existingTeam.name, '(new photo pending approval)');
          setQuizzes(prev => {
            const updated = prev.map(q =>
              q.id === existingTeam.id
                ? { ...q, photoUrl: undefined }
                : q
            );
            return updated;
          });
        }
        console.log('[QuizHost] 📸 Ignoring photoUrl update for team:', existingTeam.name, '(pending approval - will display on PHOTO_APPROVAL_UPDATED)');
      } else {
        console.warn('[QuizHost] ⚠️  TEAM_PHOTO_UPDATED: Team not found by ID or name. deviceId:', deviceId, 'playerId:', playerId, 'teamName:', teamName);
      }
    } catch (err) {
      console.error('[QuizHost] ❌ Error handling TEAM_PHOTO_UPDATED:', err);
    }
  }, [setQuizzes]); // Only depends on setQuizzes which doesn't change

  // Register TEAM_PHOTO_UPDATED listener with stable handler
  useEffect(() => {
    const unsubscribe = onNetworkMessage('TEAM_PHOTO_UPDATED', handleNetworkTeamPhotoUpdated);
    return unsubscribe;
  }, [handleNetworkTeamPhotoUpdated]); // Only depends on stable handler

  // Send flow state to host controller whenever it changes
  useEffect(() => {
    if (hostControllerEnabled && authenticatedControllerId) {
      const DEBUG = (window as any).__DEBUG_MODE__;
      if (DEBUG) {
        console.log('[QuizHost] 📡 FLOW_STATE:', {
          flow: flowState.flow,
          isQuestionMode: flowState.isQuestionMode,
          isQuizPackMode,
        });
      }
      sendFlowStateToController(flowState.flow, flowState.isQuestionMode, {
        totalTime: flowState.totalTime,
        currentQuestion: flowState.currentQuestion,
        currentLoadedQuestionIndex,
        loadedQuizQuestions,
        isQuizPackMode,
        selectedQuestionType: flowState.selectedQuestionType,
        answerSubmitted: flowState.answerSubmitted,
        keypadCurrentScreen,
      }, authenticatedControllerId, hostInfo?.baseUrl);
    }
  }, [flowState.flow, flowState.isQuestionMode, flowState.currentQuestion, flowState.answerSubmitted, flowState.selectedQuestionType, hostControllerEnabled, authenticatedControllerId, currentLoadedQuestionIndex, loadedQuizQuestions, isQuizPackMode, hostInfo?.baseUrl, keypadCurrentScreen]);

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
      // Use refs to access current quiz data without re-registering listener
      const matchingQuiz =
        quizzesRef.current.find(q => q.id === deviceId) ||
        quizzesRef.current.find(q => q.id === playerId) ||
        quizzesRef.current.find(q => q.name === teamName);
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
      // Use refs to access current values without re-registering listener
      let responseTime: number | undefined = undefined;
      if (gameTimerStartTimeRef.current !== null && gameTimerStartTimeRef.current !== undefined && timestamp) {
        // Correct calculation: answer submission time - timer start time
        responseTime = timestamp - gameTimerStartTimeRef.current;
        console.log('[QuizHost] CALCULATION: timestamp=', timestamp, 'gameTimerStartTime=', gameTimerStartTimeRef.current, 'responseTime=', responseTime, 'ms');
      } else if (gameTimerStartTimeRef.current !== null && gameTimerStartTimeRef.current !== undefined) {
        // Fallback: current time - timer start time (if timestamp is missing)
        const now = Date.now();
        responseTime = now - gameTimerStartTimeRef.current;
        console.log('[QuizHost] CALCULATION (FALLBACK): now=', now, 'gameTimerStartTime=', gameTimerStartTimeRef.current, 'responseTime=', responseTime, 'ms');
      } else {
        // No timer started yet - don't calculate response time
        console.log('[QuizHost] PLAYER_ANSWER: No timer started for team', teamId, '- gameTimerStartTime is null');
      }

      // Validate response time against the current question's time limit
      // Use ref to access current flowState.totalTime without re-registering listener
      if (responseTime !== undefined) {
        const validatedResponseTime = validateResponseTime(responseTime, flowStateTotalTimeRef.current);

        if (validatedResponseTime !== undefined) {
          setTeamResponseTimes(prev => {
            const updated = { ...prev, [teamId]: validatedResponseTime };
            console.log('[QuizHost] PLAYER_ANSWER: Team', teamId, 'response time validated:', validatedResponseTime, 'ms (', (validatedResponseTime / 1000).toFixed(2), 's) - calculation: timestamp(' + timestamp + ') - gameTimerStartTime(' + gameTimerStartTime + ')');
            console.log('[QuizHost] PLAYER_ANSWER: Updated teamResponseTimes:', JSON.stringify(updated));
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
  }, []); // Keep listener registered indefinitely - it accesses current values through refs to avoid re-registration race conditions

  // PHASE 2: Listen for debug error and info messages from server
  useEffect(() => {
    const handleDebugError = (data: any) => {
      console.error('[🔴 SERVER ERROR]', data.source + ':', data.error);
      console.error('[🔴 SERVER ERROR] Full details:', data);
    };

    const handleDebugInfo = (data: any) => {
      console.info('[✅ SERVER INFO]', data.source + ':', data.message);
      console.info('[✅ SERVER INFO] Full details:', data);
    };

    // Register listeners for debug messages
    const unsubscribeError = onNetworkMessage('DEBUG_ERROR', handleDebugError);
    const unsubscribeInfo = onNetworkMessage('DEBUG_INFO', handleDebugInfo);

    // Clean up listeners on unmount
    return () => {
      if (unsubscribeError) unsubscribeError();
      if (unsubscribeInfo) unsubscribeInfo();
    };
  }, []); // Empty dependency array - register once on mount

  // Listen for player buzzer selections
  useEffect(() => {
    const handleNetworkPlayerBuzzerSelect = (data: any) => {
      const { deviceId, teamName, buzzerSound } = data;

      if (!deviceId) {
        console.warn('[QuizHost] PLAYER_BUZZER_SELECT missing deviceId');
        return;
      }

      // Normalize the buzzer sound value for consistency
      const normalizedBuzzerSound = normalizeBuzzerSound(buzzerSound);

      console.log('[QuizHost] 📨 Received PLAYER_BUZZER_SELECT from backend:');
      console.log('[QuizHost] - deviceId:', deviceId);
      console.log('[QuizHost] - teamName:', teamName);
      console.log('[QuizHost] - buzzerSound (raw):', buzzerSound);
      console.log('[QuizHost] - buzzerSound (normalized):', normalizedBuzzerSound);

      // Check if team exists in quizzes
      const teamExists = quizzesRef.current.some(q => q.id === deviceId);
      console.log('[QuizHost] 🔍 Team exists in quizzes:', teamExists);
      console.log('[QuizHost] 📋 Current quizzes count:', quizzesRef.current.length);
      if (quizzesRef.current.length > 0) {
        console.log('[QuizHost] 📋 Team IDs in quizzes:', quizzesRef.current.map(q => q.id).join(', '));
      }

      if (teamExists) {
        // Update quizzes state with normalized buzzer selection
        const beforeQuiz = quizzesRef.current.find(q => q.id === deviceId);
        console.log('[QuizHost] Before update - Team buzzer:', beforeQuiz?.buzzerSound);

        setQuizzes(prev => {
          const updated = prev.map(q =>
            q.id === deviceId
              ? { ...q, buzzerSound: normalizedBuzzerSound }
              : q
          );
          console.log('[QuizHost] ✅ Updated quizzes state - team buzzer now:', updated.find(q => q.id === deviceId)?.buzzerSound);
          return updated;
        });
        console.log(`✅ Updated buzzer selection for team "${teamName}": ${normalizedBuzzerSound}`);
      } else {
        // Team doesn't exist yet - store as pending buzzer selection to be applied when team is created
        if (!(window as any).__pendingBuzzerSelections) {
          (window as any).__pendingBuzzerSelections = {};
        }
        (window as any).__pendingBuzzerSelections[deviceId] = normalizedBuzzerSound;
        console.log(`⏳ Stored pending buzzer selection for device "${deviceId}": ${normalizedBuzzerSound} (team not in quizzes yet)`);
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onNetworkMessage('PLAYER_BUZZER_SELECT', handleNetworkPlayerBuzzerSelect);
    console.log('[QuizHost] 📝 Registered PLAYER_BUZZER_SELECT listener');

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // Empty dependency array - register once on mount

  // Listen for photo approval updates from BottomNavigation
  useEffect(() => {
    const handlePhotoApprovalUpdated = (data: any) => {
      const { deviceId, teamName, photoUrl } = data;

      if (!deviceId || !photoUrl) {
        console.warn('[QuizHost] PHOTO_APPROVAL_UPDATED missing required fields');
        return;
      }

      console.log('[QuizHost] 📸 Received PHOTO_APPROVAL_UPDATED from BottomNavigation:');
      console.log('[QuizHost] - deviceId:', deviceId);
      console.log('[QuizHost] - teamName:', teamName);
      console.log('[QuizHost] - photoUrl (first 50 chars):', photoUrl?.substring(0, 50));

      // Check if team exists in quizzes
      const teamExists = quizzesRef.current.some(q => q.id === deviceId);
      console.log('[QuizHost] 🔍 Team exists in quizzes:', teamExists);

      if (teamExists) {
        // Update quizzes state with approved photo URL
        const beforeQuiz = quizzesRef.current.find(q => q.id === deviceId);
        console.log('[QuizHost] Before update - Team photo:', beforeQuiz?.photoUrl ? 'present' : 'missing');

        setQuizzes(prev => {
          const updated = prev.map(q =>
            q.id === deviceId
              ? { ...q, photoUrl: photoUrl }
              : q
          );
          console.log('[QuizHost] ✅ Updated quizzes state - team photo now:', updated.find(q => q.id === deviceId)?.photoUrl ? 'present' : 'missing');
          return updated;
        });
        console.log(`✅ Synced approved photo for team "${teamName}": ${photoUrl?.substring(0, 50)}...`);
      } else {
        // RACE CONDITION FIX: Team might not be in quizzes yet if auto-approval is still processing
        // Schedule a retry after a short delay to allow PLAYER_JOIN + auto-approval to complete
        console.log(`⚠️ Team "${teamName}" (${deviceId}) not found in quizzes yet - scheduling retry...`);

        const retryTimeoutId = setTimeout(() => {
          const teamNowExists = quizzesRef.current.some(q => q.id === deviceId);
          console.log(`[QuizHost] 🔄 Retry check: Team now exists in quizzes?`, teamNowExists);

          if (teamNowExists) {
            // Team is now available, sync the photo
            setQuizzes(prev => {
              const updated = prev.map(q =>
                q.id === deviceId
                  ? { ...q, photoUrl: photoUrl }
                  : q
              );
              console.log('[QuizHost] ✅ Retried photo sync successful - team photo now present');
              return updated;
            });
            console.log(`✅ Synced approved photo for team "${teamName}" (retry succeeded): ${photoUrl?.substring(0, 50)}...`);
          } else {
            // Still not found after retry - log warning but don't fail
            // The photo will still be saved in backend, user can refresh team info to see it
            console.warn(`⚠️ Team "${teamName}" (${deviceId}) still not in quizzes after retry - photo saved in backend but display sync delayed`);
          }
        }, 300); // 300ms retry delay allows async operations to complete

        // Store retry timeout for cleanup if component unmounts
        return () => clearTimeout(retryTimeoutId);
      }
    };

    // Register listener and get unsubscribe function
    const unsubscribe = onNetworkMessage('PHOTO_APPROVAL_UPDATED', handlePhotoApprovalUpdated);
    console.log('[QuizHost] 📝 Registered PHOTO_APPROVAL_UPDATED listener');

    // Clean up listener on unmount
    return unsubscribe;
  }, []); // Empty dependency array - register once on mount

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

    // Declare all team data variables at function scope so they can be used in multiple blocks
    let fastestTeamId: string | undefined;
    let fastestTeamResponseTime = 0;
    let correctTeamIds: string[] = [];
    let wrongTeamIds: string[] = [];
    let noAnswerTeamIds: string[] = [];

    // For quiz pack mode, calculate and award points when answer is revealed
    // Skip auto-scoring for buzzin pack mode - host manually judges via CORRECT/WRONG buttons
    if (isQuizPackMode && !isBuzzinPackMode && loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        // Determine correct teams based on the question's correct answer
        const correctAnswer = getAnswerText(currentQuestion);
        const questionType = currentQuestion.type?.toLowerCase() || '';

        // Check if this is a nearest wins question
        if (questionType === 'nearest' || questionType === 'nearestwins') {
          // NEAREST WINS SCORING: closest guess to the target number wins
          const targetNumber = parseInt(String(correctAnswer).trim(), 10);

          if (!isNaN(targetNumber)) {
            // Calculate differences for all teams that submitted answers
            const teamsWithDifferences = quizzes
              .filter(team => {
                const teamAnswer = teamAnswers[team.id];
                return teamAnswer && String(teamAnswer).trim() !== '';
              })
              .map(team => {
                const teamAnswer = teamAnswers[team.id];
                const guessNum = parseInt(String(teamAnswer).trim(), 10);
                const difference = isNaN(guessNum) ? Infinity : Math.abs(guessNum - targetNumber);
                return { teamId: team.id, guess: guessNum, difference };
              })
              .sort((a, b) => a.difference - b.difference);

            // Find the closest team(s) - could be ties
            if (teamsWithDifferences.length > 0) {
              const bestDifference = teamsWithDifferences[0].difference;
              correctTeamIds = teamsWithDifferences
                .filter(t => t.difference === bestDifference)
                .map(t => t.teamId);

              playApplauseSound().catch(err => console.warn('Failed to play applause:', err));

              // Award winner points to the closest team(s)
              const pointsToAward = currentRoundWinnerPoints || 0;
              correctTeamIds.forEach(teamId => {
                handleScoreChange(teamId, pointsToAward);
              });

              console.log(`[QuizPack] Nearest wins: target=${targetNumber}, winners=${correctTeamIds.length}, points=${pointsToAward}, bestDiff=${bestDifference}`);
            }

            // Store for display
            setFastestTeamIdForDisplay(correctTeamIds[0] || null);

            wrongTeamIds = quizzes
              .filter(team => {
                const teamAnswer = teamAnswers[team.id];
                return teamAnswer && String(teamAnswer).trim() !== '' && !correctTeamIds.includes(team.id);
              })
              .map(team => team.id);

            noAnswerTeamIds = quizzes
              .filter(team => {
                const teamAnswer = teamAnswers[team.id];
                return !teamAnswer || String(teamAnswer).trim() === '';
              })
              .map(team => team.id);
          }

          console.log(`[QuizPack] Nearest wins scoring applied for question ${currentLoadedQuestionIndex + 1}`);
        } else {
          // STANDARD SCORING: exact match comparison

        // Helper function to compare answers based on question type
        const isAnswerCorrect = (teamAns: string, correctAns: string): boolean => {
          // For numbers type, use numeric comparison (like player-side does)
          if (questionType === 'numbers') {
            const submittedNum = parseInt(String(teamAns).trim(), 10);
            const correctNum = parseInt(String(correctAns).trim(), 10);
            return !isNaN(submittedNum) && !isNaN(correctNum) && submittedNum === correctNum;
          }

          // For all other types, use string comparison (case-insensitive)
          return String(teamAns).trim().toLowerCase() === String(correctAns).toLowerCase().trim();
        };

        correctTeamIds = quizzes
          .filter(team => {
            const teamAnswer = teamAnswers[team.id];
            if (!teamAnswer || String(teamAnswer).trim() === '') return false;

            // For sequence type, compare the full comma-separated string directly
            if (questionType === 'sequence') {
              return isAnswerCorrect(String(teamAnswer), correctAnswer);
            }

            // For go-wide mode (comma-separated answers), check if ANY answer matches
            const answers = String(teamAnswer).split(',').map(a => a.trim());

            // Check if any of the team's answers matches the correct answer
            return answers.some(ans => isAnswerCorrect(ans, correctAnswer));
          })
          .map(team => team.id);

        // Determine fastest correct team
        if (correctTeamIds.length > 0) {
          const correctTeamsWithTimes = correctTeamIds
            .map(teamId => ({ teamId, time: teamResponseTimes[teamId] || Infinity }))
            .sort((a, b) => a.time - b.time);
          fastestTeamId = correctTeamsWithTimes[0]?.teamId;
          fastestTeamResponseTime = correctTeamsWithTimes[0]?.time || 0;
        }

        // Store fastest team ID for use in flow progression
        setFastestTeamIdForDisplay(fastestTeamId || null);

        // Always calculate team answer stats for display
        wrongTeamIds = quizzes
          .filter(team => {
            const teamAnswer = teamAnswers[team.id];
            // Team answered but it was wrong (not in correct team list)
            return teamAnswer && String(teamAnswer).trim() !== '' && !correctTeamIds.includes(team.id);
          })
          .map(team => team.id);

        noAnswerTeamIds = quizzes
          .filter(team => {
            const teamAnswer = teamAnswers[team.id];
            // Team didn't answer or submitted empty answer
            return !teamAnswer || String(teamAnswer).trim() === '';
          })
          .map(team => team.id);

        // Award points using unified scoring function
        handleComputeAndAwardScores(correctTeamIds, 'keypad', fastestTeamId, teamResponseTimes);

        // Apply evil mode penalties if enabled (evilModeEnabled and punishmentEnabled are from component-level useSettings)
        if (evilModeEnabled || punishmentEnabled) {
          handleApplyEvilModePenalty(wrongTeamIds, noAnswerTeamIds, 'keypad');
        }

        console.log(`[QuizPack] Scoring applied for question ${currentLoadedQuestionIndex + 1}`);
        }
      }
    }

    // Send results summary to external display
    if (isQuizPackMode && externalWindow && loadedQuizQuestions.length > 0) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
      if (currentQuestion) {
        // Get enhanced answer data
      const answerLetter = getAnswerText(currentQuestion);
      let answerText = '';
      let options = undefined;

      if (currentQuestion.type?.toLowerCase() === 'multi' && currentQuestion.options) {
        answerText = currentQuestion.options[currentQuestion.correctIndex] || '';
        options = currentQuestion.options;
      } else if (currentQuestion.type?.toLowerCase() === 'letters') {
        answerText = currentQuestion.answerText || '';
      } else if (currentQuestion.type?.toLowerCase() === 'nearest' || currentQuestion.type?.toLowerCase() === 'nearestwins') {
        answerText = answerLetter; // The target number
      }

      // For nearest wins questions, send nearest-wins-results display instead
      if (currentQuestion.type?.toLowerCase() === 'nearest' || currentQuestion.type?.toLowerCase() === 'nearestwins') {
        const targetNumber = parseInt(answerLetter, 10);

        // Build results with differences for each team
        const submissions = quizzes
          .filter(team => {
            const teamAnswer = teamAnswers[team.id];
            return teamAnswer && String(teamAnswer).trim() !== '';
          })
          .map(team => {
            const teamAnswer = teamAnswers[team.id];
            const guess = parseInt(String(teamAnswer).trim(), 10);
            const difference = isNaN(guess) || isNaN(targetNumber) ? Infinity : Math.abs(guess - targetNumber);
            return { id: team.id, name: team.name, guess, difference, rank: 0 };
          })
          .sort((a, b) => a.difference - b.difference);

        // Assign ranks with ties
        let currentRank = 1;
        submissions.forEach((team, index) => {
          if (index > 0 && team.difference === submissions[index - 1].difference) {
            team.rank = submissions[index - 1].rank;
          } else {
            team.rank = currentRank;
          }
          currentRank++;
        });

        const winners = submissions.filter(t => t.rank === 1);

        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'nearest-wins-results',
          data: {
            targetNumber,
            correctAnswer: targetNumber,
            results: {
              winner: submissions[0] || null,
              winners,
              runnerUp: submissions.find(t => t.rank > 1) || null,
              submissions
            },
            answerRevealed: true,
            questionNumber: currentLoadedQuestionIndex + 1,
            totalQuestions: loadedQuizQuestions.length
          }
        });
      } else {
        // Standard results summary for non-nearest-wins questions

      // Build fastest team data if available
      let fastestTeamData: { teamName: string; responseTime: number } | undefined;
      if (fastestTeamId) {
        const fastestTeam = quizzes.find(q => q.id === fastestTeamId);
        if (fastestTeam) {
          fastestTeamData = {
            teamName: fastestTeam.name,
            responseTime: fastestTeamResponseTime
          };
        }
      }

      sendToExternalDisplay({
        type: 'DISPLAY_UPDATE',
        mode: 'resultsSummary',
        data: {
          text: currentQuestion.q,
          answer: answerLetter,
          answerLetter,
          answerText,
          correctIndex: currentQuestion.correctIndex,
          type: currentQuestion.type,
          options,
          questionNumber: currentLoadedQuestionIndex + 1,
          totalQuestions: loadedQuizQuestions.length,
          correctCount: correctTeamIds.length,
          incorrectCount: wrongTeamIds.length,
          noAnswerCount: noAnswerTeamIds.length,
          fastestTeam: fastestTeamData
        }
      });
      }
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

  // Clear authenticated controller when host controller is disabled
  useEffect(() => {
    if (!hostControllerEnabled && authenticatedControllerId) {
      console.log('[QuizHost] Host controller disabled, clearing authenticated controller');
      setAuthenticatedControllerId(null);
    }
  }, [hostControllerEnabled]);

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

  // Periodic safety-net sync for player display mode
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
      console.log('[QuizHost] Periodic safety-net sync (1s) - re-broadcasting current mode:', playerDevicesDisplayMode);
      broadcastPlayerDisplayMode(playerDevicesDisplayMode);
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [playerDevicesDisplayMode, broadcastPlayerDisplayMode, showKeypadInterface, showBuzzInInterface, showNearestWinsInterface, showQuizPackDisplay, showWheelSpinnerInterface]);

  // Periodic safety-net sync for player flow state
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const currentFlowState = flowStateRef.current;
      console.log('[QuizHost] Periodic flow state sync (1s) - broadcasting current flow state:', currentFlowState.flow);
      sendFlowStateToPlayers({
        flow: currentFlowState.flow,
        isQuestionMode: currentFlowState.isQuestionMode,
        totalTime: currentFlowState.totalTime,
        currentQuestion: currentFlowState.currentQuestion,
        currentLoadedQuestionIndex: currentLoadedQuestionIndexRef.current,
        loadedQuizQuestions: loadedQuizQuestionsRef.current,
        isQuizPackMode: isQuizPackModeRef.current,
        selectedQuestionType: currentFlowState.selectedQuestionType,
        answerSubmitted: currentFlowState.answerSubmitted,
        keypadCurrentScreen,
      });
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [keypadCurrentScreen]);

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

    // Determine the correct question index based on whether we're in quiz pack mode
    const correctQuestionIndex = showQuizPackDisplay ? currentLoadedQuestionIndex : currentQuestionIndex;

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
      gameMode: getCurrentGameMode(),
      gameModeTimers: gameModeTimers,
      questionInfo: data?.questionInfo || {
        number: correctQuestionIndex + 1,
        type: 'Multiple Choice',
        total: showQuizPackDisplay ? loadedQuizQuestions.length : mockQuestions.length
      },
      targetNumber: mode.includes('nearest-wins') ? data?.targetNumber : undefined,
      questionNumber: mode.includes('nearest-wins') ? data?.questionNumber : undefined,
      results: mode === 'nearest-wins-results' ? data?.results : undefined,
      answerRevealed: mode === 'nearest-wins-results' ? data?.answerRevealed : undefined,
      gameInfo: mode.includes('nearest-wins') ? data?.gameInfo : undefined,
      textSize: externalDisplayTextSize,
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
        gameMode: getCurrentGameMode(),
        gameModeTimers: gameModeTimers,

        questionInfo: data?.questionInfo || {
          number: (showQuizPackDisplay ? currentLoadedQuestionIndex : currentQuestionIndex) + 1,
          type: 'Multiple Choice',
          total: showQuizPackDisplay ? loadedQuizQuestions.length : mockQuestions.length
        },

        currentMode: content,

        targetNumber: content.includes('nearest-wins') ? data?.targetNumber : undefined,
        questionNumber: content.includes('nearest-wins') ? data?.questionNumber : undefined,
        results: content === 'nearest-wins-results' ? data?.results : undefined,
        answerRevealed: content === 'nearest-wins-results' ? data?.answerRevealed : undefined,
        gameInfo: content.includes('nearest-wins') ? data?.gameInfo : undefined,

        wheelSpinnerData: content === 'wheel-spinner' ? data : undefined,

        teamName: content === 'team-welcome' ? data?.teamName : undefined,

        isReset: content === 'basic',
        textSize: externalDisplayTextSize
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
  }, [externalWindow, images, quizzes, slideshowSpeed, leaderboardData, revealedTeams, currentQuestionIndex, getCurrentGameMode, gameModeTimers, externalDisplayTextSize]);



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
        // Trigger debounced auto-save for crash recovery
        debouncedSaveGameState();
      }, 500);

      return newQuizzes;
    });
  }, [teamLayoutMode, scoresHidden, scoresPaused, debouncedSaveGameState]);

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
        playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
        // Award fixed points to the winner
        correctTeamIds.forEach(teamId => {
          handleScoreChange(teamId, currentRoundWinnerPoints || 0);
        });
      }
    },
    [currentRoundWinnerPoints, handleScoreChange, playApplauseSound]
  );

  // Buzzin pack handlers - host judges verbal answers
  const handleBuzzCorrect = useCallback((teamId: string) => {
    const team = quizzes.find(q => q.id === teamId);
    const teamName = team?.name || `Team ${teamId}`;

    // Award points directly
    const pointsToAward = currentRoundPoints || defaultPoints;
    handleScoreChange(teamId, pointsToAward);
    playApplauseSound().catch(err => console.warn('Failed to play applause:', err));
    sendBuzzResultToPlayers(teamName, true);
    sendToExternalDisplay({
      type: 'DISPLAY_UPDATE',
      mode: 'buzzin-correct',
      data: { teamName, teamColor: team?.backgroundColor },
    });

    // Clear buzz state for next question
    setBuzzWinnerTeamId(null);
    setBuzzLockedOutTeams(new Set());
    // Clear team answers so the panel goes back to waiting
    setTeamAnswers({});
    setTeamResponseTimes({});
    console.log(`[QuizHost] Buzzin pack: Awarded ${pointsToAward} points to team ${teamName}`);
  }, [currentRoundPoints, defaultPoints, handleScoreChange, quizzes]);

  const handleBuzzWrong = useCallback((teamId: string) => {
    const team = quizzes.find(q => q.id === teamId);
    const teamName = team?.name || `Team ${teamId}`;

    if (evilModeEnabled && punishmentEnabled) {
      const pointsToDeduct = currentRoundPoints || defaultPoints;
      handleScoreChange(teamId, -pointsToDeduct);
      console.log(`[QuizHost] Buzzin pack: Deducted ${pointsToDeduct} points from ${teamName} (punishment)`);
    }
    playFailSound().catch(err => console.warn('Failed to play fail sound:', err));

    // Add wrong team to permanently locked out set for this question
    setBuzzLockedOutTeams(prev => {
      const updated = new Set(prev);
      updated.add(teamId);
      return updated;
    });
    setBuzzWinnerTeamId(null);

    // Clear only this team's buzz so detection effect can find next buzzer
    setTeamAnswers(prev => {
      const next = { ...prev };
      delete next[teamId];
      return next;
    });
    setTeamResponseTimes(prev => {
      const next = { ...prev };
      delete next[teamId];
      return next;
    });

    // Send result to players
    sendBuzzResultToPlayers(teamName, false);

    // Check if all teams are now locked out
    const newLockedOut = new Set([...buzzLockedOutTeams, teamId]);
    const allTeamsLocked = quizzes.every(q => newLockedOut.has(q.id));

    if (allTeamsLocked) {
      console.log('[QuizHost] Buzzin pack: All teams locked out - no correct answer');
      sendToExternalDisplay({
        type: 'DISPLAY_UPDATE',
        mode: 'buzzin-wrong',
        data: { teamName, allLockedOut: true },
      });
    } else {
      // Broadcast reset with locked-out team list so remaining teams can re-buzz
      sendBuzzResetToPlayers(Array.from(newLockedOut));
      sendToExternalDisplay({
        type: 'DISPLAY_UPDATE',
        mode: 'buzzin-wrong',
        data: { teamName },
      });
      // After a brief delay, return external display to waiting
      setTimeout(() => {
        sendToExternalDisplay({
          type: 'DISPLAY_UPDATE',
          mode: 'buzzin-waiting',
          data: { lockedOutCount: newLockedOut.size, totalTeams: quizzes.length },
        });
      }, 1500);
    }

    console.log(`[QuizHost] Buzzin pack: ${teamName} WRONG - locked out. ${newLockedOut.size}/${quizzes.length} teams locked.`);
  }, [evilModeEnabled, punishmentEnabled, currentRoundPoints, defaultPoints, handleScoreChange, quizzes, buzzLockedOutTeams]);

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
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Delete team functionality
  const handleDeleteTeam = (teamId: string, teamName: string, score: number) => {
    // If team has no points (score is 0), delete immediately
    if (score === 0) {
      setQuizzes(prevQuizzes =>
        prevQuizzes.filter(quiz => quiz.id !== teamId)
      );
      // Trigger debounced auto-save for crash recovery
      debouncedSaveGameState();
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
      // Trigger debounced auto-save for crash recovery
      debouncedSaveGameState();
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

  // Handle closing team window and all associated popups
  const handleCloseTeamWindow = () => {
    setSelectedTeamForWindow(null);
    // Also close any open BottomNavigation popups when closing team window
    setBottomNavPopupStates({
      teamPhotos: false,
      clearScores: false,
      emptyLobby: false,
    });
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
    const normalizedBuzzerSound = normalizeBuzzerSound(buzzerSound);
    console.log('[QuizHost] 🔊 Buzzer change for team:', teamId, 'buzzer:', normalizedBuzzerSound);

    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId ? { ...quiz, buzzerSound: normalizedBuzzerSound } : quiz
      )
    );
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Handle background color change
  const handleBackgroundColorChange = (teamId: string, backgroundColor: string) => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId ? { ...quiz, backgroundColor } : quiz
      )
    );
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Handle photo upload
  const handlePhotoUpload = (teamId: string, photoUrl: string) => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId ? { ...quiz, photoUrl } : quiz
      )
    );
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Handle kick team
  const handleKickTeam = (teamId: string) => {
    setQuizzes(prevQuizzes => prevQuizzes.filter(quiz => quiz.id !== teamId));
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
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
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
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
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
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
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Handle scramble team keypad
  const handleScrambleKeypad = (teamId: string) => {
    setQuizzes(prevQuizzes => {
      const updated = prevQuizzes.map(quiz =>
        quiz.id === teamId
          ? { ...quiz, scrambled: !quiz.scrambled }
          : quiz
      );
      // Build per-team scramble states map from the updated state
      const teamScrambleStates: Record<string, boolean> = {};
      updated.forEach(quiz => {
        teamScrambleStates[quiz.name] = quiz.scrambled ?? false;
      });
      // Broadcast scramble state change to players with per-team map
      sendScrambleUpdateToPlayers(teamScrambleStates);
      console.log(`[QuizHost] Broadcasted per-team SCRAMBLE_UPDATE:`, teamScrambleStates);
      return updated;
    });

    console.log(`Team ${teamId}'s keypad scramble toggled`);

    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Handle global scramble keypad
  const handleGlobalScrambleKeypad = () => {
    const totalTeams = quizzes.length;
    const scrambledTeams = quizzes.filter(team => team.scrambled).length;

    // If more than half are scrambled, unscramble all
    // If half or less are scrambled, scramble all
    const shouldScrambleAll = scrambledTeams <= totalTeams / 2;

    setQuizzes(prevQuizzes => {
      const updated = prevQuizzes.map(quiz => ({ ...quiz, scrambled: shouldScrambleAll }));
      // Build per-team scramble states map
      const teamScrambleStates: Record<string, boolean> = {};
      updated.forEach(quiz => {
        teamScrambleStates[quiz.name] = shouldScrambleAll;
      });
      // Broadcast scramble state change to all players with per-team map
      sendScrambleUpdateToPlayers(teamScrambleStates);
      console.log(`[QuizHost] Broadcasted global SCRAMBLE_UPDATE:`, teamScrambleStates);
      return updated;
    });

    console.log(`${shouldScrambleAll ? 'Scrambled' : 'Unscrambled'} all team keypads`);

    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
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
    // Trigger debounced auto-save for crash recovery
    debouncedSaveGameState();
  };

  // Empty lobby - delete all teams and clear crash recovery
  const handleEmptyLobby = async () => {
    setQuizzes([]);
    // Clear authorized device IDs so PIN is required again for all devices
    setAuthorizedDeviceIds(new Set());
    authorizedDeviceIdsRef.current = new Set();
    // Clear saved game state on crash recovery
    await clearGameState().catch(err => console.error('[Crash Recovery] Error clearing game state:', err));

    // Cleanup team photos from disk
    try {
      if ((window as any).api?.ipc?.invoke) {
        const result = await (window as any).api.ipc.invoke('network/cleanup-team-photos');
        console.log('[QuizHost] Team photos cleanup result:', result);
      }
    } catch (err) {
      console.warn('[QuizHost] Error cleaning up team photos:', err);
    }
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

  // Helper function to get correct answer from loaded question
  const getCorrectAnswer = (): string | null => {
    if (!isQuizPackMode || loadedQuizQuestions.length === 0) return null;
    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (!currentQuestion) return null;

    // For multiple-choice and letters: convert correctIndex to letter (A, B, C, etc.)
    if ((currentQuestion.type?.toLowerCase() === 'multi' ||
         currentQuestion.type?.toLowerCase() === 'letters') &&
        currentQuestion.correctIndex !== undefined) {
      return String.fromCharCode(65 + currentQuestion.correctIndex);
    }
    // For sequence: return the sequence item at correctIndex
    if (currentQuestion.type?.toLowerCase() === 'sequence' &&
        currentQuestion.options &&
        currentQuestion.correctIndex !== undefined) {
      return currentQuestion.options[currentQuestion.correctIndex] || null;
    }
    // For other types: use answerText if available
    return currentQuestion.answerText || null;
  };

  // Helper function to get full answer display with letter and option text
  const getFullAnswerDisplay = (): string | null => {
    if (!isQuizPackMode || loadedQuizQuestions.length === 0) return null;
    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (!currentQuestion) return null;

    const correctAnswer = getCorrectAnswer();
    if (!correctAnswer) return null;

    // For multi-choice: combine letter with option text
    if (currentQuestion.type?.toLowerCase() === 'multi' &&
        currentQuestion.correctIndex !== undefined &&
        currentQuestion.options) {
      const answerLetter = String.fromCharCode(65 + currentQuestion.correctIndex);
      const answerOption = currentQuestion.options[currentQuestion.correctIndex];
      return answerOption ? `${answerLetter} - ${answerOption}` : correctAnswer;
    }

    // For letters and other types: combine letter with answerText
    if ((currentQuestion.type?.toLowerCase() === 'letters') &&
        currentQuestion.correctIndex !== undefined) {
      const answerLetter = String.fromCharCode(65 + currentQuestion.correctIndex);
      const answerText = currentQuestion.answerText;
      return answerText ? `${answerLetter} - ${answerText}` : answerLetter;
    }

    // For other types: return the answer as-is
    return correctAnswer;
  };

  // Render results summary overlay for quiz pack mode
  const renderQuizPackResultsSummary = () => {
    if (!showResultsSummary || !isQuizPackMode || loadedQuizQuestions.length === 0) return null;

    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];
    if (!currentQuestion) return null;

    const correctAnswer = getCorrectAnswer();
    const fullAnswerDisplay = getFullAnswerDisplay();
    const stats = calculateAnswerStats(teamAnswers, quizzes, correctAnswer, currentQuestion.type || null);

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-40 flex-col">
        <div className="bg-[#2c3e50] rounded-lg p-8 max-w-2xl w-full mx-4 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-white">Question {currentLoadedQuestionIndex + 1} Results</h2>
          </div>

          {/* Results Summary Stats */}
          <div className="text-center">
            <h3 className="text-xl text-[#95a5a6] mb-4">Results Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#27ae60] p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{stats.correct}</div>
                <div className="text-sm text-white opacity-80">Correct</div>
              </div>
              <div className="bg-[#e74c3c] p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{stats.wrong}</div>
                <div className="text-sm text-white opacity-80">Wrong</div>
              </div>
              <div className="bg-[#95a5a6] p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{stats.noAnswer}</div>
                <div className="text-sm text-white opacity-80">No Answer</div>
              </div>
            </div>
          </div>

          {/* Answer Display */}
          <div className={`p-4 rounded-lg ${
            flowState.flow === 'revealed' || flowState.flow === 'fastest'
              ? 'bg-[#2c3e50] border-2 border-[#f39c12]'
              : 'bg-[#34495e]'
          }`}>
            <div className="text-lg text-[#95a5a6] text-center">
              Correct Answer:
            </div>
            <div className={`text-2xl font-bold mt-2 text-center ${
              flowState.flow === 'revealed' || flowState.flow === 'fastest' ? 'text-[#f39c12]' : 'text-[#3498db]'
            }`}>
              {fullAnswerDisplay || 'Unknown'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
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

    // Show quiz pack display in center when in question mode
    if (showQuizPackDisplay && flowState.isQuestionMode) {
      const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex];

      // For buzzin pack mode, use buzzWinnerTeamId from state machine
      const buzzinWinnerTeam = buzzWinnerTeamId ? quizzes.find(q => q.id === buzzWinnerTeamId) : null;
      const buzzinWinnerTime = buzzWinnerTeamId ? teamResponseTimes[buzzWinnerTeamId] : null;
      const allTeamsLockedOut = isBuzzinPackMode && quizzes.length > 0 && quizzes.every(q => buzzLockedOutTeams.has(q.id));

      return (
        <div className="flex-1 relative min-h-0">
          {/* Main question display - hidden when results summary is shown */}
          {!showResultsSummary && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Buzzin pack header bar */}
              {isBuzzinPackMode && (
                <div className="bg-[#f39c12] px-6 py-3 flex items-center gap-3 border-b-2 border-[#e67e22]">
                  <Zap className="h-5 w-5 text-white" />
                  <span className="text-white font-bold text-lg tracking-wide">BUZZ-IN ROUND</span>
                  {buzzLockedOutTeams.size > 0 && (
                    <span className="ml-auto text-white/80 text-sm">{buzzLockedOutTeams.size} of {quizzes.length} teams locked out</span>
                  )}
                </div>
              )}
              <QuestionPanel
                question={currentQuestion}
                questionNumber={currentLoadedQuestionIndex + 1}
                totalQuestions={loadedQuizQuestions.length}
                showAnswer={flowState.flow === 'timeup' || flowState.flow === 'revealed' || flowState.flow === 'fastest' || flowState.flow === 'complete'}
                answerText={currentQuestion?.answerText}
                correctIndex={currentQuestion?.correctIndex}
              />
              {/* Buzzed Team Panel for buzzin pack mode */}
              {isBuzzinPackMode && (
                <div className="bg-slate-800 border-t-2 border-slate-600 px-6 py-4">
                  {allTeamsLockedOut ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Zap className="h-8 w-8 text-red-400" />
                        <p className="text-lg font-medium text-red-300">All teams locked out — no correct answer</p>
                      </div>
                      <Button
                        onClick={() => {
                          // Skip to next question
                          if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
                            setCurrentLoadedQuestionIndex(prev => prev + 1);
                          }
                        }}
                        className="px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-bold text-lg rounded-lg"
                      >
                        SKIP
                      </Button>
                    </div>
                  ) : buzzWinnerTeamId && buzzinWinnerTeam ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Zap className="h-8 w-8 text-[#f39c12]" />
                        <div>
                          <p className="text-sm text-slate-400 uppercase tracking-wider">First to Buzz</p>
                          <p className="text-2xl font-bold text-white">{buzzinWinnerTeam.name}</p>
                          <p className="text-sm text-slate-400">{buzzinWinnerTime ? `${(buzzinWinnerTime / 1000).toFixed(2)}s response time` : ''}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleBuzzCorrect(buzzWinnerTeamId)}
                          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg"
                        >
                          CORRECT
                        </Button>
                        <Button
                          onClick={() => handleBuzzWrong(buzzWinnerTeamId)}
                          className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg"
                        >
                          WRONG
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 justify-center py-2">
                      <Zap className="h-6 w-6 text-slate-500 animate-pulse" />
                      <p className="text-slate-400 text-lg font-medium">Waiting for teams to buzz in...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Show results summary overlay when timer ends */}
          {renderQuizPackResultsSummary()}
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
                buzzerVolumes={buzzerVolumes}
                onBuzzerVolumeChange={handleBuzzerVolumeChange}
                displayMode={fastestTeamDisplayMode}
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
              teamResponseTimes={teamResponseTimes}
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
              onGameTimerStateChange={(isRunning, duration) => {
                setGameTimerRunning(isRunning);
                if (isRunning) setGameTimerFinished(false);
                if (isRunning && !isQuizPackMode) {
                  setFlowState(prev => ({
                    ...prev,
                    flow: 'running',
                    ...(duration !== undefined ? { totalTime: duration } : {})
                  }));
                }
              }}
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
              onSelectQuestionType={handleSelectQuestionType}
              externalCurrentScreen={keypadCurrentScreen}
              externalQuestionType={flowState.selectedQuestionType as any}
              answerSubmitted={flowState.answerSubmitted}
              onAnswerConfirmed={(answer) => {
                // When user confirms answer locally, update flowState
                setFlowState(prev => ({
                  ...prev,
                  answerSubmitted: answer
                }));
              }}
              showCountdownTimer={false}
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
                buzzerVolumes={buzzerVolumes}
                onBuzzerVolumeChange={handleBuzzerVolumeChange}
                displayMode={fastestTeamDisplayMode}
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
            buzzerVolumes={buzzerVolumes}
            onBuzzerVolumeChange={handleBuzzerVolumeChange}
            displayMode={fastestTeamDisplayMode}
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
            onWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
            currentRoundWinnerPoints={currentRoundWinnerPoints}
            onGameTimerStateChange={(isRunning, duration) => {
              setGameTimerRunning(isRunning);
              if (isRunning && !isQuizPackMode) {
                setFlowState(prev => ({
                  ...prev,
                  flow: 'running',
                  ...(duration !== undefined ? { totalTime: duration } : {})
                }));
              }
            }}
            isBuzzinPack={isBuzzinPackMode}
            teamAnswers={teamAnswers}
            teamResponseTimes={teamResponseTimes}
            teams={quizzes.map(q => ({ id: q.id, name: q.name, color: q.backgroundColor }))}
            onBuzzCorrect={handleBuzzCorrect}
            onBuzzWrong={handleBuzzWrong}
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
            teamAnswers={teamAnswers}
            onTeamAnswerUpdate={handleTeamAnswerUpdate}
            onBack={handleNearestWinsClose}
            currentRoundWinnerPoints={currentRoundWinnerPoints}
            onCurrentRoundWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
            externalWindow={externalWindow}
            onExternalDisplayUpdate={handleExternalDisplayUpdate}
            onAwardPoints={handleNearestWinsAwardPoints}
            onGetActionHandlers={setGameActionHandlers}
            remoteSubmittedAnswer={flowState.answerSubmitted}
            onFlowStateChange={(flow) => setFlowState(prev => ({...prev, flow: flow as any, isQuestionMode: flow === 'idle' || flow === 'complete' ? false : true}))}
            onAnswerConfirmed={(ans) => setFlowState(prev => ({ ...prev, answerSubmitted: ans }))}
            onGameTimerStateChange={(isRunning, duration) => {
              setGameTimerRunning(isRunning);
              if (isRunning && !isQuizPackMode) {
                setFlowState(prev => ({
                  ...prev,
                  flow: 'running',
                  ...(duration !== undefined ? { totalTime: duration } : {})
                }));
              }
            }}
            onCurrentScreenChange={setNearestWinsCurrentScreen}
            onGameTimerUpdate={(remaining, total) => {
              setGameTimerTimeRemaining(remaining);
              setGameTimerTotalTime(total);
            }}
            onGameTimerFinished={setGameTimerFinished}
            onGameAnswerRevealed={setGameAnswerRevealed}
            onGameFastestRevealed={setGameFastestRevealed}
            onPlayTeamBuzzer={(teamId) => {
              const team = quizzes.find(q => q.id === teamId);
              if (team?.buzzerSound) {
                playFastestTeamBuzzer(team.buzzerSound);
              }
            }}
          />
        </div>
      );
    }

    // Show music round interface when active
    if (showMusicRoundInterface) {
      return (
        <div className="flex-1 relative min-h-0 flex flex-col">
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <MusicRoundInterface
              onClose={handleMusicRoundClose}
              teams={quizzes}
              onScoreChange={handleScoreChange}
              onEndRound={() => {
                closeAllGameModes();
                sendEndRound();
                handleExternalDisplayUpdate('basic');
                setActiveTab("home");
              }}
              onShowFastestTeam={(team, responseTime) => {
                handleFastestTeamReveal({ team: team as any, responseTime, displayMode: 'fastest' });
              }}
              onExternalDisplayUpdate={handleExternalDisplayUpdate}
              onBuzzUpdate={setMusicRoundBuzzes}
            />
          </div>
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
                buzzerVolumes={buzzerVolumes}
                onBuzzerVolumeChange={handleBuzzerVolumeChange}
                displayMode={fastestTeamDisplayMode}
              />
            </div>
          )}
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
            buzzerVolumes={buzzerVolumes}
            onBuzzerVolumeChange={handleBuzzerVolumeChange}
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
              onPlayTeamBuzzer={(buzzerSound) => playFastestTeamBuzzer(buzzerSound)}
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

  // Ensure admin handler has access to current handler functions
  // These assignments happen after the functions are defined, so no temporal dead zone issues
  adminListenerDepsRef.current.handlePrimaryAction = handlePrimaryAction;
  adminListenerDepsRef.current.handleRevealAnswer = handleRevealAnswer;
  adminListenerDepsRef.current.handleHideQuestion = handleHideQuestion;
  adminListenerDepsRef.current.handleQuizPackNext = handleQuizPackNext;
  adminListenerDepsRef.current.handleQuizPackPrevious = handleQuizPackPrevious;
  adminListenerDepsRef.current.handleNavBarStartTimer = handleNavBarStartTimer;
  adminListenerDepsRef.current.handleNavBarSilentTimer = handleNavBarSilentTimer;
  adminListenerDepsRef.current.gameActionHandlers = gameActionHandlers;
  adminListenerDepsRef.current.isQuizPackMode = isQuizPackMode;
  adminListenerDepsRef.current.setCurrentLoadedQuestionIndex = setCurrentLoadedQuestionIndex;
  adminListenerDepsRef.current.setFlowState = setFlowState;
  adminListenerDepsRef.current.setKeypadCurrentScreen = setKeypadCurrentScreen;
  adminListenerDepsRef.current.sendFlowStateToController = (deviceId?: string) => {
    sendFlowStateToController(flowState.flow, flowState.isQuestionMode, {
      totalTime: flowState.totalTime,
      currentQuestion: flowState.currentQuestion,
      currentLoadedQuestionIndex,
      loadedQuizQuestions,
      isQuizPackMode,
      selectedQuestionType: flowState.selectedQuestionType,
      answerSubmitted: flowState.answerSubmitted,
      keypadCurrentScreen,
    }, deviceId, hostInfo?.baseUrl);
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
            musicRoundBuzzes={musicRoundBuzzes}
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
            wsConnected={wsConnected}
          />

          {/* Content area with right panel */}
          <div className="flex flex-1 min-h-0">
            {/* Main content - theme-aware background */}
            <div className="flex-1 bg-background min-w-0 flex flex-col relative">
              {/* Always render tab content to keep game mode components mounted */}
              <div className={selectedTeamForWindow ? "flex-1 flex flex-col min-h-0 invisible" : "flex-1 flex flex-col min-h-0"}>
                {renderTabContent()}
              </div>

              {/* Team window overlay - renders on top without unmounting game content */}
              {selectedTeamForWindow && (() => {
                const team = quizzes.find(q => q.id === selectedTeamForWindow);
                if (!team) return null;
                return (
                  <div className="absolute inset-0 z-40 bg-background overflow-auto">
                    <TeamWindow
                      team={team}
                      teams={quizzes}
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
                  </div>
                );
              })()}
            </div>

            {/* Right panel - fixed width - only show when no game modes are active and team window is closed and not in question mode */}
            {!showKeypadInterface && !showBuzzInInterface && !showNearestWinsInterface && !showWheelSpinnerInterface && !showMusicRoundInterface && !showBuzzInMode && !showFastestTeamDisplay && !selectedTeamForWindow && !showBuzzersManagement && !(showQuizPackDisplay && flowState.isQuestionMode) && (
              <div className="w-80 bg-background border-l border-border">
                <RightPanel
                  quizzes={quizzes}
                  onKeypadClick={handleKeypadClick}
                  onBuzzInClick={handleBuzzInClick}
                  onBuzzInStart={handleBuzzInStart}
                  onWheelSpinnerClick={handleWheelSpinnerClick}
                  onNearestWinsClick={handleNearestWinsClick}
                  onMusicRoundClick={handleMusicRoundClick}
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
              // Show for on-the-spot nearest wins when playing or showing results
              (showNearestWinsInterface && (nearestWinsCurrentScreen === 'playing' || nearestWinsCurrentScreen === 'results')) ||
              // Show for buzz in mode
              showBuzzInMode
            }
            isQuizPackMode={isQuizPackMode}
            flowState={flowState}
            onStartTimer={handleNavBarStartTimer}
            onSilentTimer={handleNavBarSilentTimer}
            onHideQuestion={handleHideQuestion}
            onSendQuestion={handlePrimaryAction}
            onReveal={() => {
              if (isQuizPackMode) {
                handleRevealAnswer();
                handlePrimaryAction();
              } else {
                gameActionHandlers?.reveal?.();
              }
            }}
            onNextAction={() => {
              if (isQuizPackMode) {
                // Quiz pack mode - use primary action handler which manages flow state machine
                handlePrimaryAction();
              } else if (showNearestWinsInterface) {
                // NearestWins handleNextRound handles everything: resets state,
                // sends QUESTION to players, and manages flow
                gameActionHandlers?.nextQuestion?.();
              } else {
                // On-the-spot mode - use game action handlers AND update flow state
                gameActionHandlers?.nextQuestion?.();
                const defaultOnTheSpotTimer = gameModeTimers.keypad || 30;
                setFlowState(prev => ({
                  ...prev,
                  flow: 'idle',
                  isQuestionMode: true,
                  totalTime: defaultOnTheSpotTimer,
                  selectedQuestionType: undefined,
                  answerSubmitted: undefined,
                }));
                sendNextQuestion();
              }
            }}
            onRevealFastestTeam={() => {
              if (isQuizPackMode) {
                // Quiz pack mode - use primary action handler to transition flow state
                handlePrimaryAction();
              } else {
                // On-the-spot mode - use game action handlers AND update flow state
                gameActionHandlers?.revealFastestTeam?.();
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
              } else if (showNearestWinsInterface) {
                // NearestWins handleNextRound handles everything: resets state,
                // sends QUESTION to players, and manages flow
                gameActionHandlers?.nextQuestion?.();
              } else {
                gameActionHandlers?.nextQuestion?.();
                const defaultOnTheSpotTimer = gameModeTimers.keypad || 30;
                setFlowState(prev => ({
                  ...prev,
                  flow: 'idle',
                  isQuestionMode: true,
                  totalTime: defaultOnTheSpotTimer,
                  selectedQuestionType: undefined,
                  answerSubmitted: undefined,
                }));
                sendNextQuestion();
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
            showMusicRoundInterface={showMusicRoundInterface}
            showBuzzInMode={showBuzzInMode}
            showQuizPackDisplay={showQuizPackDisplay}
            onEndRound={handleEndRound}
            onOpenBuzzersManagement={handleOpenBuzzersManagement}
            hostControllerEnabled={hostControllerEnabled}
            hostControllerCode={hostControllerCode}
            hostControllerAuthenticated={authenticatedControllerId !== null}
            onToggleHostController={handleToggleHostController}
            // Bottom navigation popup states
            bottomNavPopupStates={bottomNavPopupStates}
            onBottomNavPopupToggle={(popupName, isOpen) => {
              // Close all overlays first if opening a popup
              if (isOpen) {
                handleCloseAllOverlays();
              }
              // Then update the specific popup state
              setBottomNavPopupStates(prev => ({
                ...prev,
                [popupName as keyof typeof bottomNavPopupStates]: isOpen
              }));
            }}
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
      <audio ref={buzzerAudioRef} />
    </div>
  );
}
