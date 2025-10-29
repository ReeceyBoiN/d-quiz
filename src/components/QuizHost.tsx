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
import { TimerProgressBar } from "./TimerProgressBar";
import { QuestionPanel } from "./QuestionPanel";
import { PrimaryControls } from "./PrimaryControls";
// CountdownTimer not used in QuizHost - using inline timer in external window

import { StoredImage, projectImageStorage } from "../utils/projectImageStorage";
import { useSettings } from "../utils/SettingsContext";
import { useQuizData } from "../utils/QuizDataContext";
import { useTimer } from "../hooks/useTimer";
import type { QuestionFlowState, HostFlow } from "../state/flowState";
import { getTotalTimeForQuestion, hasQuestionImage } from "../state/flowState";
import { sendPictureToPlayers, sendQuestionToPlayers, sendTimerToPlayers, sendRevealToPlayers, sendNextQuestion, sendEndRound, sendFastestToDisplay } from "../network/wsHost";
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

  // Teams state with 9 teams featuring Muslim names and random scores
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const initialTeams = [
      { id: "1", name: "Ahmad", type: "test" as const, icon: "â­", score: Math.floor(Math.random() * 200) + 50 },
      { id: "2", name: "Fatima", type: "test" as const, icon: "ðŸŽª", score: Math.floor(Math.random() * 200) + 50 },
      { id: "3", name: "Omar", type: "test" as const, icon: "ðŸŽ‰", score: Math.floor(Math.random() * 200) + 50 },
      { id: "4", name: "Aisha", type: "test" as const, icon: "ðŸ†", score: Math.floor(Math.random() * 200) + 50 },
      { id: "5", name: "Hassan", type: "test" as const, icon: "ðŸ’«", score: Math.floor(Math.random() * 200) + 50 },
      { id: "6", name: "Khadija", type: "test" as const, icon: "ðŸŽŠ", score: Math.floor(Math.random() * 200) + 50 },
      { id: "7", name: "Ali", type: "test" as const, icon: "ï¿½ï¿½ï¿½ï¿½", score: Math.floor(Math.random() * 200) + 50 },
      { id: "8", name: "Zainab", type: "test" as const, icon: "ðŸŽ¯", score: Math.floor(Math.random() * 200) + 50 },
      { id: "9", name: "Ibrahim", type: "test" as const, icon: "âœ¨", score: Math.floor(Math.random() * 200) + 50 }
    ];
    // Sort teams by score initially (highest first)
    return initialTeams.sort((a, b) => (b.score || 0) - (a.score || 0));
  });

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

  // Timer hook for countdown
  const timer = useTimer({
    onEnd: () => {
      // Timer reached zero: set flow to 'timeup', lock submissions
      setFlowState(prev => ({
        ...prev,
        flow: 'timeup',
        timeRemaining: 0,
      }));
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
  const [showTeamAnswers, setShowTeamAnswers] = useState(false);
  
  // Team answer status state for temporary background colors
  const [teamAnswerStatuses, setTeamAnswerStatuses] = useState<{[teamId: string]: 'correct' | 'incorrect' | 'no-answer'}>({});
  const [teamCorrectRankings, setTeamCorrectRankings] = useState<{[teamId: string]: number}>({});

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
      setShowKeypadInterface(true);
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
      }
    }
  }, [currentLoadedQuestionIndex, showQuizPackDisplay, loadedQuizQuestions, gameModeTimers, flowState.currentQuestionIndex, timer, flowState.isQuestionMode]);

  // Handle timer when flow state changes to 'running'
  useEffect(() => {
    if ((flowState.flow as any) === 'running') {
      const isSilent = flowState.answerSubmitted === 'silent'; // Check if silent timer was used
      timer.start(flowState.totalTime, isSilent);
    } else if (flowState.flow !== 'running' && flowState.flow !== 'timeup') {
      timer.stop();
    }
  }, [flowState.flow, flowState.totalTime, timer]);

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
    setShowTeamAnswers(false);
    // Clear team answer statuses and rankings
    setTeamAnswerStatuses({});
    setTeamCorrectRankings({});
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
    // If in quiz pack question mode, reset flow state
    if (showQuizPackDisplay && flowState.isQuestionMode) {
      setFlowState(prev => ({
        ...prev,
        isQuestionMode: false,
        flow: 'idle',
      }));
      timer.stop();
      return;
    }
    // Play explosion sound effect for regular game modes
    playExplosionSound();
    
    // Close all game modes
    closeAllGameModes();
    
    // Navigate back to home screen
    setActiveTab("home");
    
    // Reset external display to basic mode if it's open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, "basic");
    }
  };

  // Handle team answer updates from game interfaces
  const handleTeamAnswerUpdate = useCallback((answers: {[teamId: string]: string}) => {
    setTeamAnswers(answers);
    setShowTeamAnswers(Object.keys(answers).length > 0);
  }, []);

  // Handle team response time updates from game interfaces
  const handleTeamResponseTimeUpdate = useCallback((responseTimes: {[teamId: string]: number}) => {
    setTeamResponseTimes(responseTimes);
    // Also update last response times for persistence
    setLastResponseTimes(prev => ({ ...prev, ...responseTimes }));
  }, []);

  // Handle team answer status updates for keypad mode
  const updateTeamAnswerStatuses = useCallback((correctAnswer: string | null, questionType: string | null) => {
    if (!correctAnswer || !questionType) {
      setTeamAnswerStatuses({});
      setTeamCorrectRankings({});
      return;
    }

    const newStatuses: {[teamId: string]: 'correct' | 'incorrect' | 'no-answer'} = {};
    const correctTeams: {teamId: string, responseTime: number}[] = [];
    
    quizzes.forEach(team => {
      const teamAnswer = teamAnswers[team.id];
      
      if (!teamAnswer || teamAnswer.trim() === '') {
        newStatuses[team.id] = 'no-answer';
      } else if (teamAnswer === correctAnswer) {
        newStatuses[team.id] = 'correct';
        const responseTime = teamResponseTimes[team.id] || 0;
        correctTeams.push({ teamId: team.id, responseTime });
      } else {
        newStatuses[team.id] = 'incorrect';
      }
    });
    
    // Sort correct teams by response time (fastest first) and assign rankings
    const newRankings: {[teamId: string]: number} = {};
    correctTeams
      .sort((a, b) => a.responseTime - b.responseTime)
      .forEach((team, index) => {
        newRankings[team.teamId] = index + 1; // 1st, 2nd, 3rd, etc.
      });
    
    setTeamAnswerStatuses(newStatuses);
    setTeamCorrectRankings(newRankings);
  }, [quizzes, teamAnswers, teamResponseTimes]);

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
    setShowKeypadInterface(true);
    setActiveTab("teams"); // Change active tab when keypad is opened
    setKeypadInstanceKey(prev => prev + 1); // Force re-render with fresh defaults
  };

  // Handle keypad interface close
  const handleKeypadClose = () => {
    setShowKeypadInterface(false);
    setIsQuizPackMode(false);
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
        // Send picture (if available) or go straight to question
        if (hasQuestionImage(currentQuestion)) {
          sendPictureToPlayers(currentQuestion.imageDataUrl);
          // Also send to external display using proper message format
          if (externalWindow && !externalWindow.closed) {
            externalWindow.postMessage(
              { type: 'DISPLAY_UPDATE', mode: 'picture', data: { image: currentQuestion.imageDataUrl } },
              '*'
            );
          }
          setFlowState(prev => ({
            ...prev,
            flow: 'sent-picture',
            pictureSent: true,
          }));
        } else {
          // No picture, send question directly
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, currentQuestion.type);
          if (externalWindow && !externalWindow.closed) {
            externalWindow.postMessage(
              { type: 'DISPLAY_UPDATE', mode: 'question', data: { text: currentQuestion.q, options: currentQuestion.options, type: currentQuestion.type } },
              '*'
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
        // Send question after picture
        sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, currentQuestion.type);
        if (externalWindow && !externalWindow.closed) {
          externalWindow.postMessage(
            { type: 'DISPLAY_UPDATE', mode: 'question', data: { text: currentQuestion.q, options: currentQuestion.options, type: currentQuestion.type } },
            '*'
          );
        }
        setFlowState(prev => ({
          ...prev,
          flow: 'sent-question',
          questionSent: true,
        }));
        break;
      }

      case 'sent-question': {
        // Start audible timer
        sendTimerToPlayers(flowState.totalTime, false);
        if (externalWindow && !externalWindow.closed) {
          externalWindow.postMessage(
            { type: 'DISPLAY_UPDATE', mode: 'timer', data: { timerValue: flowState.totalTime, seconds: flowState.totalTime } },
            '*'
          );
        }
        setFlowState(prev => ({
          ...prev,
          flow: 'running',
        }));
        break;
      }

      case 'running':
      case 'timeup': {
        // Stop timer and reveal answer
        timer.stop();
        if (externalWindow && !externalWindow.closed) {
          externalWindow.postMessage(
            { type: 'DISPLAY_UPDATE', mode: 'correctAnswer', data: { answer: currentQuestion.answerText, correctIndex: currentQuestion.correctIndex, type: currentQuestion.type } },
            '*'
          );
        }
        sendRevealToPlayers(currentQuestion.answerText, currentQuestion.correctIndex, currentQuestion.type);
        setFlowState(prev => ({
          ...prev,
          flow: 'revealed',
        }));
        break;
      }

      case 'revealed': {
        // Show fastest team view
        if (externalWindow && !externalWindow.closed) {
          externalWindow.postMessage(
            { type: 'DISPLAY_UPDATE', mode: 'fastestTeam', data: { question: currentLoadedQuestionIndex + 1 } },
            '*'
          );
        }
        sendFastestToDisplay('TBD', currentLoadedQuestionIndex + 1);
        setFlowState(prev => ({
          ...prev,
          flow: 'fastest',
        }));
        break;
      }

      case 'fastest': {
        // Move to next question or end round
        if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
          setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex + 1);
          sendNextQuestion();
          // Flow state will be reset by the effect
        } else {
          setFlowState(prev => ({
            ...prev,
            flow: 'complete',
          }));
          sendEndRound();
          if (externalWindow && !externalWindow.closed) {
            externalWindow.postMessage({ type: 'END_ROUND' }, '*');
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
  ]);

  /**
   * Silent timer handler - starts timer without audio.
   */
  const handleSilentTimer = useCallback(() => {
    sendTimerToPlayers(flowState.totalTime, true);
    if (externalWindow && !externalWindow.closed) {
      externalWindow.postMessage(
        { type: 'TIMER', data: { seconds: flowState.totalTime } },
        '*'
      );
    }
    setFlowState(prev => ({
      ...prev,
      flow: 'running',
      answerSubmitted: 'silent',
    }));
  }, [flowState.totalTime, externalWindow]);

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
    if (showQuizPackDisplay && flowState.isQuestionMode) return "keypad"; // Quiz packs use keypad-style controls
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
    setFastestTeamData(fastestTeam);
    setShowFastestTeamDisplay(true);
    setActiveTab("teams"); // Switch to teams tab to show the display
  }, []);

  // Handle fastest team display close
  const handleFastestTeamClose = useCallback(() => {
    setShowFastestTeamDisplay(false);
    setActiveTab("home"); // Return to home when closed
  }, []);

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
          
          // Use text-to-speech for countdown - only at 5-second intervals
          if (voiceCountdown && newValue > 0) {
            if (newValue % 5 === 0) {
              const utterance = new SpeechSynthesisUtterance(newValue.toString());
              utterance.rate = 1;
              utterance.pitch = 1;
              utterance.volume = 1;
              speechSynthesis.speak(utterance);
            }
          }
          
          if (newValue < 0) {
            setShowAnswer(true);
            
            // Say "Time's up!" at the end
            if (voiceCountdown) {
              const finalUtterance = new SpeechSynthesisUtterance("Time's up!");
              finalUtterance.rate = 1;
              finalUtterance.pitch = 1;
              finalUtterance.volume = 1;
              speechSynthesis.speak(finalUtterance);
            }
            
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
  }, [isQuizActive, timeRemaining, showAnswer, voiceCountdown]);

  // Separate effect to save response times when timer ends
  useEffect(() => {
    if (timeRemaining === 0 && showAnswer) {
      setLastResponseTimes(prev => ({ ...prev, ...teamResponseTimes }));
    }
  }, [timeRemaining, showAnswer, teamResponseTimes]);

  // Mock response time generator for testing (only when timer is active) - throttled for performance
  useEffect(() => {
    let mockInterval: NodeJS.Timeout;
    
    if (isQuizActive && timeRemaining > 0) {
      mockInterval = setInterval(() => {
        setTeamResponseTimes(prev => {
          const newTimes = { ...prev };
          const teamIds = quizzesRef.current.map(q => q.id);
          const currentElapsed = currentQuestion.timeLimit - timeRemaining;
          
          // Only add response times for teams that haven't answered yet
          teamIds.forEach(teamId => {
            if (!newTimes[teamId] && Math.random() > 0.9) { // Reduced frequency to 10% per second for performance
              const responseTime = (currentElapsed + Math.random() * 2) * 1000; // Convert to milliseconds
              newTimes[teamId] = responseTime;
              
              // Also add a mock answer for the team
              setTeamAnswers(prevAnswers => {
                if (!prevAnswers[teamId]) {
                  const answers = ['A', 'B', 'C', 'D', 'E', 'F'];
                  const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
                  return { ...prevAnswers, [teamId]: randomAnswer };
                }
                return prevAnswers;
              });
            }
          });
          
          return newTimes;
        });
      }, 2000); // Reduced frequency to every 2 seconds for performance
    }
    
    return () => {
      if (mockInterval) {
        clearInterval(mockInterval);
      }
    };
  }, [isQuizActive, timeRemaining, currentQuestion.timeLimit]);

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

  const handleRevealAnswer = () => {
    setShowAnswer(true);
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
  };

  const handleResetQuestion = () => {
    setTimeRemaining(currentQuestion.timeLimit);
    setShowAnswer(false);
    setIsQuizActive(false);
    // Clear response times when resetting question
    setTeamResponseTimes({});
    setLastResponseTimes({});
  };

  const handleDisplayModeChange = (mode: "basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "timer" | "correctAnswer") => {
    setDisplayMode(mode);
    
    // Remember user's preference for non-leaderboard modes
    if (mode === "basic" || mode === "slideshow" || mode === "scores") {
      setUserSelectedDisplayMode(mode);
    }
    
    // Update external display if open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, mode);
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

  // Reset current round scores when default settings change
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

  const handlePlayerDevicesDisplayModeChange = (mode: "basic" | "slideshow" | "scores") => {
    setPlayerDevicesDisplayMode(mode);
  };

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

  const handleSpeedChange = (speed: number) => {
    setSlideshowSpeed(speed);
    
    // Update external display if open
    if (externalWindow && !externalWindow.closed) {
      updateExternalDisplay(externalWindow, displayMode);
    }
  };

  const openExternalDisplay = () => {
    if (externalWindow && !externalWindow.closed) {
      externalWindow.focus();
      return;
    }

    // Clear if previously closed
    if (externalWindow && externalWindow.closed) {
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }

    const newWindow = window.open(
      'about:blank',
      'externalDisplay',
      'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );

    if (newWindow) {
      setExternalWindow(newWindow);
      setIsExternalDisplayOpen(true);

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Quiz External Display</title>
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #1a252f;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              overflow: hidden;
            }
            @keyframes falling-emoji {
              from {
                transform: translateX(-50%) translateY(-60px) rotate(0deg);
                opacity: 1;
              }
              to {
                transform: translateX(-50%) translateY(calc(100vh + 60px)) rotate(360deg);
                opacity: 0.8;
              }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .falling-emoji {
              position: fixed;
              font-size: 4rem;
              z-index: 1000;
              pointer-events: none;
              animation: falling-emoji 4s linear forwards;
            }
          </style>
        </head>
        <body>
          <div id="root"></div>

          <script type="text/babel">
            const { useState, useEffect } = React;

            function ExternalDisplay() {
              const [displayData, setDisplayData] = useState({
                mode: 'basic',
                previousMode: 'basic',
                images: [],
                quizzes: [],
                slideshowSpeed: 5,
                leaderboardData: null,
                revealedTeams: [],
                timerValue: null,
                correctAnswer: null,
                questionInfo: null,
                fastestTeamData: null,
                gameInfo: null,
                targetNumber: null,
                answerRevealed: false,
                results: null,
                nearestWinsData: null,
                wheelSpinnerData: null,
                countdownStyle: 'circular',
                gameMode: 'keypad',
                gameModeTimers: { keypad: 30, buzzin: 30, nearestwins: 10 },
                teamName: null,
              });

              const [currentImageIndex, setCurrentImageIndex] = useState(0);
              const [currentColorIndex, setCurrentColorIndex] = useState(0);
              const [dynamicBackgroundColor, setDynamicBackgroundColor] = useState('#f1c40f');
              const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);

              const colors = [
                '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
                '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
                '#808080', '#000000', '#FFFFFF', '#90EE90', '#FFB6C1'
              ];

              const welcomeColors = [
                '#f39c12', '#e74c3c', '#e91e63',
                '#9b59b6', '#3498db', '#27ae60', '#f1c40f'
              ];

              const dynamicColors = [
                '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
                '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63'
              ];

              const getRandomDynamicColor = () =>
                dynamicColors[Math.floor(Math.random() * dynamicColors.length)];

              useEffect(() => {
                const handleMessage = (event) => {
                  if (event.data.type === 'DISPLAY_UPDATE') {
                    const newMode = event.data.mode || 'basic';
                    setDisplayData(prev => ({
                      ...prev,
                      ...event.data,
                      mode: newMode,
                    }));
                  }
                };
                window.addEventListener('message', handleMessage);
                return () => window.removeEventListener('message', handleMessage);
              }, []);

              const getHSLColor = (hue) => \`hsl(\${hue}, 85%, 60%)\`;

              const renderContent = () => {
                switch (displayData.mode) {
                  case 'basic':
                    return (
                      <div
                        className="h-full w-full flex items-center justify-center relative overflow-hidden"
                        style={{ backgroundColor: getHSLColor(currentColorIndex) }}
                      >
                        <div className="relative z-10 text-center">
                          <div className="bg-orange-500 text-black px-20 py-12 rounded-2xl shadow-2xl border-4 border-white">
                            <h1 className="text-[12rem] font-black tracking-wider drop-shadow-lg">POP</h1>
                            <h2 className="text-[12rem] font-black tracking-wider -mt-8 drop-shadow-lg">QUIZ!</h2>
                          </div>
                        </div>
                      </div>
                    );
                  default:
                    return (
                      <div className="h-full w-full flex items-center justify-center text-white">
                        External Display Active
                      </div>
                    );
                }
              };

              return (
                <div className="h-screen w-screen bg-gray-900 flex flex-col">
                  <div className="bg-gray-700 p-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                        <span className="text-sm font-semibold text-white">EXTERNAL DISPLAY</span>
                        <span className="text-xs px-2 py-1 rounded uppercase font-medium bg-orange-500 text-white">
                          {displayData.mode}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">1920x1080 â€¢ 16:9</div>
                    </div>
                  </div>
                  <div className="flex-1 bg-black relative overflow-hidden">
                    {renderContent()}
                    <div className="absolute bottom-4 right-4 text-xs text-white opacity-30 font-mono">EXT-1</div>
                  </div>
                </div>
              );
            }

            ReactDOM.render(<ExternalDisplay />, document.getElementById('root'));
          </script>
        </body>
        </html>
      `;

      newWindow.document.write(htmlContent);
      newWindow.document.close();

      const checkClosed = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(checkClosed);
          setExternalWindow(null);
          setIsExternalDisplayOpen(false);
        }
      }, 1000);

      setTimeout(() => {
        updateExternalDisplay(newWindow, displayMode);
      }, 1000);
    }
  };


 const openExternalDisplaySimple = () => {
  if (externalWindow && !externalWindow.closed) {
    externalWindow.focus();
    return;
  }

  if (externalWindow && externalWindow.closed) {
    setExternalWindow(null);
    setIsExternalDisplayOpen(false);
  }

  try {
    // Ensure a clean app reload instead of duplicating current route
    const fullUrl = `${window.location.origin}${window.location.pathname}?external=1`;

    let newWindow = null;
    try {
      newWindow = window.open(
        fullUrl,
        'externalDisplay',
        'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
      );
    } catch (e) {
      console.warn('Popup blocked or failed to open directly', e);
    }

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
      updateExternalDisplay(newWindow, displayMode);
    }, 800);
  } catch (err) {
    console.error('openExternalDisplaySimple error', err);
  }
};



 


  const closeExternalDisplay = () => {
    if (externalWindow) {
      externalWindow.close();
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

  const updateExternalDisplay = (window: Window, mode: string, data?: any) => {
    if (!window || window.closed) return;

    // Send message to external window
    window.postMessage({
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
        type: 'Multiple Choice', // This could be made dynamic based on question data
        total: mockQuestions.length
      },
      // Nearest wins specific data
      targetNumber: mode.includes('nearest-wins') ? data?.targetNumber : undefined,
      questionNumber: mode.includes('nearest-wins') ? data?.questionNumber : undefined,
      results: mode === 'nearest-wins-results' ? data?.results : undefined,
      answerRevealed: mode === 'nearest-wins-results' ? data?.answerRevealed : undefined,
      gameInfo: mode.includes('nearest-wins') ? data?.gameInfo : undefined,

    }, '*');
  };

  const handleExternalDisplayUpdate = useCallback((content: string, data?: any) => {
    console.log('QuizHost: handleExternalDisplayUpdate called with', { content, data });
    
    // Convert content to displayMode and update external display
    if (externalWindow && !externalWindow.closed) {
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
        
        // Question info
        questionInfo: content === 'question' ? data?.questionInfo : {
          number: currentQuestionIndex + 1,
          type: 'Multiple Choice',
          total: mockQuestions.length
        },
        
        // Basic display data for all modes
        currentMode: content,
        
        // Nearest wins specific data
        targetNumber: content.includes('nearest-wins') ? data?.targetNumber : undefined,
        questionNumber: content.includes('nearest-wins') ? data?.questionNumber : undefined,
        results: content === 'nearest-wins-results' ? data?.results : undefined,
        answerRevealed: content === 'nearest-wins-results' ? data?.answerRevealed : undefined,
        gameInfo: content.includes('nearest-wins') ? data?.gameInfo : undefined,
        
        // Wheel spinner specific data
        wheelSpinnerData: content === 'wheel-spinner' ? data : undefined,
        
        // Team welcome data
        teamName: content === 'team-welcome' ? data?.teamName : undefined,
        
        // Reset flag for clean transitions
        isReset: content === 'basic'
      };
      
      console.log('QuizHost: Sending message to external display', messageData);
      
      externalWindow.postMessage(messageData, '*');
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
    // Check if scores are paused
    if (scoresPaused) {
      console.log(`Scores are paused. Ignoring score change of ${change > 0 ? '+' : ''}${change} for team ${teamId}`);
      return;
    }
    
    setQuizzes(prevQuizzes => {
      const newQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId && quiz.score !== undefined) {
          // Check if team is blocked from earning points (only block positive changes)
          if (quiz.blocked && change > 0) {
            console.log(`Team ${teamId} (${quiz.name}) is blocked from earning points. Ignoring +${change} points.`);
            return quiz; // Return unchanged
          }
          const newScore = quiz.score + change;
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
                // Don't re-sort in random mode to maintain the randomized order
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
      }, 500); // 500ms delay
      
      return newQuizzes;
    });
  }, [scoresPaused, scoresHidden, teamLayoutMode]);

  // Handle awarding points to teams that answered correctly
  const handleAwardPoints = useCallback((correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string, teamResponseTimes?: {[teamId: string]: number}) => {
    // For keypad mode, use current round scores (fallback to defaults if null); for nearest wins mode, use winner points; for other modes, use game mode defaults
    const points = gameMode === 'keypad' ? (currentRoundPoints ?? defaultPoints) : 
                   gameMode === 'nearestwins' ? (currentRoundWinnerPoints ?? 30) :
                   gameModePoints[gameMode];
    const speedBonus = gameMode === 'keypad' ? (currentRoundSpeedBonus ?? defaultSpeedBonus) : defaultSpeedBonus;

    if (staggeredEnabled && teamResponseTimes && speedBonus > 0) {
      // Staggered points system: award decreasing bonus points based on speed ranking
      
      // Filter to only correct teams that have response times
      const correctTeamsWithTimes = correctTeamIds
        .filter(teamId => teamResponseTimes[teamId] !== undefined)
        .map(teamId => ({
          teamId,
          responseTime: teamResponseTimes[teamId]
        }))
        .sort((a, b) => a.responseTime - b.responseTime); // Sort by response time (fastest first)
      
      correctTeamsWithTimes.forEach((team, index) => {
        let pointsToAward = points; // Base points for correct answer
        
        // Calculate staggered speed bonus
        const staggeredBonus = Math.max(0, speedBonus - index);
        pointsToAward += staggeredBonus;
        
        handleScoreChange(team.teamId, pointsToAward);
        console.log(`Awarded ${pointsToAward} points to team ${team.teamId} (${points} base + ${staggeredBonus} staggered speed bonus, rank ${index + 1})`);
      });
      
      // Award base points to any correct teams that don't have response times
      const teamsWithoutTimes = correctTeamIds.filter(teamId => !teamResponseTimes[teamId]);
      teamsWithoutTimes.forEach(teamId => {
        handleScoreChange(teamId, points);
        console.log(`Awarded ${points} points to team ${teamId} (${points} base points only - no response time)`);
      });
      
    } else {
      // Standard points system (non-staggered)
      correctTeamIds.forEach(teamId => {
        let pointsToAward = points;
        
        // Award speed bonus to the fastest team if applicable
        if (fastestTeamId === teamId && speedBonus > 0) {
          pointsToAward += speedBonus;
        }
        
        handleScoreChange(teamId, pointsToAward);
        console.log(`Awarded ${pointsToAward} points to team ${teamId} (${points} base ${fastestTeamId === teamId ? `+ ${speedBonus} speed bonus` : ''})`);
      });
    }
  }, [gameModePoints, defaultSpeedBonus, currentRoundPoints, currentRoundSpeedBonus, currentRoundWinnerPoints, staggeredEnabled, handleScoreChange, defaultPoints]);

  // Handle Evil Mode penalties for teams that answered incorrectly or didn't answer
  const handleEvilModePenalty = useCallback((wrongTeamIds: string[], noAnswerTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner") => {
    // Get the penalty amount (same as the points value for the game mode)
    const penaltyPoints = gameMode === 'keypad' ? (currentRoundPoints ?? defaultPoints) : 
                         gameMode === 'nearestwins' ? (currentRoundWinnerPoints ?? 30) :
                         gameModePoints[gameMode];

    if (evilModeEnabled) {
      // Penalize teams that gave wrong answers
      wrongTeamIds.forEach(teamId => {
        handleScoreChange(teamId, -penaltyPoints);
        console.log(`Evil Mode: Deducted ${penaltyPoints} points from team ${teamId} for wrong answer`);
      });

      // If both Evil Mode and Punishment Mode are enabled, also penalize teams that didn't answer
      if (punishmentEnabled) {
        noAnswerTeamIds.forEach(teamId => {
          handleScoreChange(teamId, -penaltyPoints);
          console.log(`Evil Mode + Punishment: Deducted ${penaltyPoints} points from team ${teamId} for no answer`);
        });
      }
    }
  }, [evilModeEnabled, punishmentEnabled, currentRoundPoints, defaultPoints, currentRoundWinnerPoints, gameModePoints, handleScoreChange]);

  // Handle Fast Track - puts team in first place with 1 point lead
  const handleFastTrack = useCallback((teamId: string) => {
    // Check if scores are paused
    if (scoresPaused) {
      console.log(`Scores are paused. Ignoring Fast Track for team ${teamId}`);
      return;
    }
    
    setQuizzes(prevQuizzes => {
      // Find the highest score
      const highestScore = Math.max(...prevQuizzes.map(quiz => quiz.score || 0));
      
      // Set the fast tracked team's score to highest + 1
      const newQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId) {
          return { ...quiz, score: highestScore + 1 };
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
                // Don't re-sort in random mode to maintain the randomized order
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
      }, 500); // 500ms delay
      
      return newQuizzes;
    });
  }, [scoresPaused, scoresHidden, teamLayoutMode]);

  const handleScoreSet = (teamId: string, newScore: number) => {
    // Check if scores are paused
    if (scoresPaused) {
      console.log(`Scores are paused. Ignoring score set to ${newScore} for team ${teamId}`);
      return;
    }
    
    setQuizzes(prevQuizzes => {
      const newQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId) {
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
                // Don't re-sort in random mode to maintain the randomized order
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
      }, 500); // 500ms delay
      
      return newQuizzes;
    });
  };

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
          ? { ...quiz, blocked: blocked }
          : quiz
      )
    );
    console.log(`Team ${teamId} has been ${blocked ? 'blocked' : 'unblocked'} from earning points`);
  };

  // Handle scramble keypad
  const handleScrambleKeypad = (teamId: string) => {
    console.log(`ðŸ”€ handleScrambleKeypad called for team ${teamId}`);
    
    setQuizzes(prevQuizzes => {
      console.log('ðŸ”€ Previous quizzes state:', prevQuizzes.map(q => ({ id: q.id, name: q.name, scrambled: q.scrambled })));
      
      const targetTeam = prevQuizzes.find(q => q.id === teamId);
      if (!targetTeam) {
        console.error(`ðŸ”€ Team ${teamId} not found in quizzes array`);
        return prevQuizzes;
      }
      
      console.log(`ðŸ”€ Target team ${teamId} current scrambled state:`, targetTeam.scrambled);
      
      const updatedQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId) {
          // Create a completely new object to ensure React detects the change
          const newScrambledState = !quiz.scrambled;
          console.log(`ðŸ”€ Updating team ${teamId} (${quiz.name}) scrambled from ${quiz.scrambled} to ${newScrambledState}`);
          return { ...quiz, scrambled: newScrambledState };
        }
        return quiz;
      });
      
      // Debug logging
      const updatedTeam = updatedQuizzes.find(q => q.id === teamId);
      console.log(`ðŸ”€ After update - team ${teamId} scrambled state:`, updatedTeam?.scrambled);
      console.log('ðŸ”€ All teams scrambled states after update:', updatedQuizzes.map(q => ({ id: q.id, name: q.name, scrambled: q.scrambled })));
      
      return updatedQuizzes;
    });
  };

  // Handle global scramble keypad for all teams
  const handleGlobalScrambleKeypad = () => {
    // Check current state of teams
    const scrambledTeams = quizzes.filter(quiz => quiz.scrambled).length;
    const totalTeams = quizzes.length;
    
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
    // This will be implemented when device connection logic is added
    // For now, just log the action
  };

  // Clear all team scores
  const handleClearScores = () => {
    setQuizzes(prevQuizzes => 
      prevQuizzes.map(quiz => ({ ...quiz, score: 0 }))
    );
  };

  // Empty lobby - delete all teams
  const handleEmptyLobby = () => {
    setQuizzes([]);
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
        return 'Fastest Team';
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Top draining timer bar (visible when question sent) */}
          <TimerProgressBar
            isVisible={flowState.flow === 'sent-question' || (flowState.flow as any) === 'running' || flowState.flow === 'timeup'}
            timeRemaining={flowState.timeRemaining}
            totalTime={flowState.totalTime}
            position="top"
          />

          {/* Main question display */}
          <QuestionPanel
            question={currentQuestion}
            questionNumber={currentLoadedQuestionIndex + 1}
            totalQuestions={loadedQuizQuestions.length}
            showAnswer={flowState.flow === 'revealed' || flowState.flow === 'fastest' || flowState.flow === 'complete'}
            answerText={currentQuestion?.answerText}
            correctIndex={currentQuestion?.correctIndex}
            onPrimaryAction={handlePrimaryAction}
          />
        </div>
      );
    }

    // Fallback to old QuizPackDisplay for config screen
    else if (showQuizPackDisplay && !flowState.isQuestionMode) {
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
            onPointsChange={handleCurrentRoundPointsChange}
            onSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
          />
        </div>
      );
    }

    // Show keypad interface in center when active
    // Keep it mounted even when fastest team display is shown so we can advance to next question
    if (showKeypadInterface) {
      return (
        <div className="flex-1 relative min-h-0">
          {/* Keypad interface - always rendered when active */}
          <div className={showFastestTeamDisplay ? "invisible flex-1 overflow-hidden" : "flex-1 overflow-hidden"}>
            <KeypadInterface
              key={keypadInstanceKey}
              onBack={handleKeypadClose}
              onHome={() => setActiveTab("home")}
              externalWindow={externalWindow}
              onExternalDisplayUpdate={handleExternalDisplayUpdate}
              teams={quizzes}
              onTeamAnswerUpdate={handleTeamAnswerUpdate}
              onTeamResponseTimeUpdate={handleTeamResponseTimeUpdate}
              onAwardPoints={handleAwardPoints}
              onEvilModePenalty={handleEvilModePenalty}
              currentRoundPoints={currentRoundPoints}
              currentRoundSpeedBonus={currentRoundSpeedBonus}
              onCurrentRoundPointsChange={handleCurrentRoundPointsChange}
              onCurrentRoundSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
              onFastestTeamReveal={handleFastestTeamReveal}
              triggerNextQuestion={keypadNextQuestionTrigger}
              onAnswerStatusUpdate={handleTeamAnswerStatusUpdate}
              onFastTrack={handleFastTrack}
              loadedQuestions={loadedQuizQuestions}
              currentQuestionIndex={currentLoadedQuestionIndex}
              isQuizPackMode={isQuizPackMode}
            />
          </div>
          
          {/* Fastest team display - overlays keypad interface when shown */}
          {showFastestTeamDisplay && (
            <div className="absolute inset-0 z-10">
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
    
    // Show fastest team display standalone if keypad interface is not active
    if (showFastestTeamDisplay) {
      return (
        <div className="flex-1 overflow-hidden">
          <FastestTeamDisplay
            fastestTeam={fastestTeamData}
            teams={quizzes}
            hostLocation={hostLocation}
            onClose={handleFastestTeamClose}
            onScrambleKeypad={handleScrambleKeypad}
            onBlockTeam={handleBlockTeam}
          />
        </div>
      );
    }

    // Show buzz-in interface in center when active
    if (showBuzzInInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <BuzzInInterface 
            quizzes={quizzes}
            onClose={handleBuzzInClose}
            onEndRound={handleEndRound}
            onAwardPoints={handleAwardPoints}
          />
        </div>
      );
    }

    // Show nearest wins interface in center when active
    if (showNearestWinsInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <NearestWinsInterface 
            onBack={() => {
              setShowNearestWinsInterface(false);
              setActiveTab("home");
            }}
            onDisplayUpdate={handleExternalDisplayUpdate}
            teams={quizzes}
            onTeamAnswerUpdate={handleTeamAnswerUpdate}
            onAwardPoints={handleAwardPoints}
            currentRoundWinnerPoints={currentRoundWinnerPoints}
            onCurrentRoundWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
            externalWindow={externalWindow}
          />
        </div>
      );
    }

    // Show wheel spinner interface in center when active
    if (showWheelSpinnerInterface) {
      return (
        <div className="flex-1 overflow-hidden">
          <WheelSpinnerInterface 
            quizzes={quizzes}
            onBack={handleWheelSpinnerClose}
            onHome={() => setActiveTab("home")}
            onAwardPoints={handleAwardPoints}
            externalWindow={externalWindow}
            onExternalDisplayUpdate={handleExternalDisplayUpdate}
          />
        </div>
      );
    }

    // Show buzzers management in center when active
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
            teamResponseTimes={getCurrentGameMode() !== null && (showTeamAnswers || Object.keys(teamResponseTimes).length > 0) ? teamResponseTimes : {}}
            showAnswers={getCurrentGameMode() !== null && (showTeamAnswers || Object.keys(teamAnswers).length > 0 || Object.keys(teamResponseTimes).length > 0)}
            scoresPaused={scoresPaused}
            scoresHidden={scoresHidden}
            teamAnswerStatuses={teamAnswerStatuses}
            teamCorrectRankings={teamCorrectRankings}
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
        </div>
      </div>

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
        showQuizPackDisplay={showQuizPackDisplay && flowState.isQuestionMode}
        onEndRound={handleEndRound}
        onOpenBuzzersManagement={handleOpenBuzzersManagement}
        hostControllerEnabled={hostControllerEnabled}
        onToggleHostController={handleToggleHostController}
        onPrimaryAction={handlePrimaryAction}
        onSilentTimer={handleSilentTimer}
        primaryButtonLabel={primaryButtonLabel}
        flowState={flowState.flow}
      />


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

      {/* Next Question Button - appears at bottom right when fastest team display is shown */}
      {showFastestTeamDisplay && (
        <div className="fixed bottom-20 right-6 z-50">
          <Button 
            className="bg-[#3498db] hover:bg-[#2980b9] text-white border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl"
            onClick={() => {
              // Close fastest team display and trigger next question in KeypadInterface
              setShowFastestTeamDisplay(false);
              setKeypadNextQuestionTrigger(prev => prev + 1);
              console.log('Next Question clicked - advancing to question type selection');
            }}
          >
            Next Question
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Primary Controls for Quiz Pack Question Mode - rendered at root level for proper fixed positioning */}
      {showQuizPackDisplay && flowState.isQuestionMode && (
        <PrimaryControls
          flow={flowState.flow}
          isQuestionMode={flowState.isQuestionMode}
          currentQuestionIndex={currentLoadedQuestionIndex}
          totalQuestions={loadedQuizQuestions.length}
          onPrimaryAction={handlePrimaryAction}
          onSilentTimer={handleSilentTimer}
          primaryLabel={primaryButtonLabel}
        />
      )}
    </div>
  );
}
