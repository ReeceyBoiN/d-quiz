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
      { id: "1", name: "Ahmad", type: "test" as const, icon: "⭐", score: Math.floor(Math.random() * 200) + 50 },
      { id: "2", name: "Fatima", type: "test" as const, icon: "🎪", score: Math.floor(Math.random() * 200) + 50 },
      { id: "3", name: "Omar", type: "test" as const, icon: "🎉", score: Math.floor(Math.random() * 200) + 50 },
      { id: "4", name: "Aisha", type: "test" as const, icon: "🏆", score: Math.floor(Math.random() * 200) + 50 },
      { id: "5", name: "Hassan", type: "test" as const, icon: "💫", score: Math.floor(Math.random() * 200) + 50 },
      { id: "6", name: "Khadija", type: "test" as const, icon: "🎊", score: Math.floor(Math.random() * 200) + 50 },
      { id: "7", name: "Ali", type: "test" as const, icon: "����", score: Math.floor(Math.random() * 200) + 50 },
      { id: "8", name: "Zainab", type: "test" as const, icon: "🎯", score: Math.floor(Math.random() * 200) + 50 },
      { id: "9", name: "Ibrahim", type: "test" as const, icon: "✨", score: Math.floor(Math.random() * 200) + 50 }
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

  // Handle loaded quiz - auto-open Keypad interface or QuizPackDisplay when quiz is loaded
  useEffect(() => {
    if (currentQuiz && currentQuiz.questions && currentQuiz.questions.length > 0) {
      setLoadedQuizQuestions(currentQuiz.questions);
      setCurrentLoadedQuestionIndex(0);
      closeAllGameModes();

      // Show QuizPackDisplay for quiz packs, otherwise show KeypadInterface
      if (currentQuiz.isQuizPack) {
        setShowQuizPackDisplay(true);
      } else {
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
      }
    }
  }, [currentLoadedQuestionIndex, showQuizPackDisplay, loadedQuizQuestions, gameModeTimers, flowState.currentQuestionIndex, timer, flowState.isQuestionMode]);

  // Handle timer when flow state changes to 'running'
  useEffect(() => {
    if (flowState.flow === 'running') {
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

    // If window exists but is closed, clear the state
    if (externalWindow && externalWindow.closed) {
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }

    const newWindow = window.open('about:blank', 'externalDisplay', 
      'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );
    
    if (newWindow) {
      setExternalWindow(newWindow);
      setIsExternalDisplayOpen(true);

      // Create a simplified HTML page for better performance
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                teamName: null
              });
              const [currentImageIndex, setCurrentImageIndex] = useState(0);
              const [currentColorIndex, setCurrentColorIndex] = useState(0);
              const [dynamicBackgroundColor, setDynamicBackgroundColor] = useState('#f1c40f');
              const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);
              
              // Array of 15 vibrant colors to cycle through for basic mode
              const colors = [
                '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
                '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
                '#808080', '#000000', '#FFFFFF', '#90EE90', '#FFB6C1'
              ];
              
              // Array of welcome background colors
              const welcomeColors = [
                '#f39c12',    // Orange
                '#e74c3c',    // Red
                '#e91e63',    // Pink  
                '#9b59b6',    // Purple
                '#3498db',    // Blue
                '#27ae60',    // Green
                '#f1c40f',    // Yellow
              ];
              
              // Array of vibrant colors for timer/results backgrounds
              const dynamicColors = [
                '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
                '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
                '#00bcd4', '#4caf50', '#ff9800', '#673ab7', '#607d8b',
                '#8bc34a', '#ffc107', '#795548', '#ff5722', '#009688'
              ];
              
              // Function to get random color
              const getRandomDynamicColor = () => {
                return dynamicColors[Math.floor(Math.random() * dynamicColors.length)];
              };

              useEffect(() => {
                const handleMessage = (event) => {
                  if (event.data.type === 'DISPLAY_UPDATE') {
                    const newMode = event.data.mode || 'basic';
                    
                    setDisplayData(prevData => {
                      // Only generate new random color when transitioning INTO timer/correctAnswer/questionWaiting mode from a different mode
                      if ((newMode === 'timer' || newMode === 'correctAnswer' || newMode === 'questionWaiting') && prevData.mode !== newMode) {
                        setDynamicBackgroundColor(getRandomDynamicColor());
                      }
                      
                      return {
                        mode: newMode,
                        previousMode: (newMode === 'timer' || newMode === 'correctAnswer') ? prevData.mode : newMode,
                        images: event.data.images || [],
                        quizzes: event.data.quizzes || [],
                        slideshowSpeed: event.data.slideshowSpeed || 5,
                        leaderboardData: event.data.leaderboardData || null,
                        revealedTeams: event.data.revealedTeams || [],
                        timerValue: event.data.timerValue || null,
                        correctAnswer: event.data.correctAnswer || null,
                        questionInfo: event.data.questionInfo || null,
                        fastestTeamData: event.data.fastestTeamData || null,
                        gameInfo: event.data.gameInfo || null,
                        targetNumber: event.data.targetNumber || null,
                        answerRevealed: event.data.answerRevealed || false,
                        results: event.data.results || null,
                        nearestWinsData: event.data.nearestWinsData || null,
                        wheelSpinnerData: event.data.wheelSpinnerData || null,
                        countdownStyle: event.data.countdownStyle || prevData.countdownStyle || 'circular',
                        gameMode: event.data.gameMode || prevData.gameMode || 'keypad',
                        gameModeTimers: event.data.gameModeTimers || prevData.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 },
                        teamName: (event.data.data && event.data.data.teamName) || event.data.teamName || null
                      };
                    });
                  }
                };

                window.addEventListener('message', handleMessage);
                return () => window.removeEventListener('message', handleMessage);
              }, []);
              
              // Color cycling effect for basic mode
              useEffect(() => {
                if (displayData.mode === 'basic') {
                  const startTime = Date.now();
                  const duration = 5 * 60 * 1000; // 5 minutes in milliseconds
                  
                  const updateColor = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = (elapsed % duration) / duration; // 0 to 1 over 5 minutes
                    const hue = progress * 360; // 0 to 360 degrees
                    
                    setCurrentColorIndex(hue); // Store hue value for use in render
                  };
                  
                  // Update color every 500ms for performance (was 50ms)
                  const colorInterval = setInterval(updateColor, 500);
                  updateColor(); // Initial call
                  
                  return () => clearInterval(colorInterval);
                }
              }, [displayData.mode]);

              // Emoji waterfall effect for basic mode - slowed down
              useEffect(() => {
                if (displayData.mode === 'basic') {
                  console.log('♪ Starting emoji waterfall for basic mode');
                  
                  const emojis = [
                    '🎯', '🎪', '🎉', '🏆', '⭐', '💫', '🎊', '🎈',
                    '🎺', '🐼', '🎨', '🎭', '🎸', '🎲', '🎳', '🎮',
                    '🎱', '🎰', '��', '🌮', '��', '🍦', '🍪', '���',
                    '🧁', '🍓', '🍊', '��', '🍍', '🐶', '🐱', '🐭',
                    '���', '🐰', '🦊', '🐻', '🐨', '🐯', '🌸', '🌺',
                    '🌻', '🌷', '🌹', '🌵', '🌲', '🌳', '🍀', '🍃',
                    '✨', '��', '☀️', '🌤️', '⛅', '🌦️', '❄️', '🚀',
                    '🛸', '🎡', '🎢', '🎠', '🔥', '💖', '🌈', '⚡'
                  ];
                  
                  const spawnEmoji = () => {
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    const randomLeft = Math.random() * 80 + 10; // 10% to 90%
                    
                    console.log('★ Spawning emoji:', randomEmoji, 'at', randomLeft + '%');
                    
                    const emojiDiv = document.createElement('div');
                    emojiDiv.textContent = randomEmoji;
                    emojiDiv.className = 'falling-emoji';
                    emojiDiv.style.left = randomLeft + '%';
                    emojiDiv.style.top = '-60px';
                    
                    document.body.appendChild(emojiDiv);
                    
                    // Remove emoji after animation completes
                    setTimeout(() => {
                      if (emojiDiv.parentNode) {
                        emojiDiv.parentNode.removeChild(emojiDiv);
                        console.log('× Removed emoji:', randomEmoji);
                      }
                    }, 5000);
                  };
                  
                  // Spawn first emoji immediately for testing
                  spawnEmoji();
                  
                  // Then spawn every 2 seconds (subtle gimmick)
                  const emojiInterval = setInterval(spawnEmoji, 2000);
                  
                  return () => {
                    clearInterval(emojiInterval);
                    // Clean up any remaining emojis
                    const existingEmojis = document.querySelectorAll('.falling-emoji');
                    existingEmojis.forEach(emoji => emoji.remove());
                  };
                }
              }, [displayData.mode]);

              // Slideshow effect
              useEffect(() => {
                if (displayData.mode === 'slideshow' && displayData.images.length > 0) {
                  const interval = setInterval(() => {
                    setCurrentImageIndex(prev => (prev + 1) % displayData.images.length);
                  }, displayData.slideshowSpeed * 1000);

                  return () => clearInterval(interval);
                }
              }, [displayData.mode, displayData.images.length, displayData.slideshowSpeed]);

              // Reset image index when images change
              useEffect(() => {
                setCurrentImageIndex(0);
              }, [displayData.images]);

              // Welcome background color animation
              useEffect(() => {
                if (displayData.mode === 'team-welcome') {
                  const interval = setInterval(() => {
                    setWelcomeColorIndex((prev) => (prev + 1) % 7);
                  }, 3000); // Change color every 3 seconds

                  return () => clearInterval(interval);
                }
              }, [displayData.mode]);

              const getHSLColor = (hue) => {
                return 'hsl(' + hue + ', 85%, 60%)';
              };
              

              // Render countdown timer based on style
              const renderCountdownTimer = (currentTime, style, totalTime = 30) => {
                const timerNum = currentTime || 0;
                
                switch (style) {
                  case 'digital':
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-black border-4 border-green-400 rounded-lg p-8" style=\{{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}>
                          <div className="text-center font-mono text-green-400 text-[12rem] font-bold" style=\{{ textShadow: '0 0 10px currentColor' }}>
                            {String(timerNum).padStart(2, '0')}
                          </div>
                        </div>
                        <div className="text-center text-2xl text-green-300 mt-4">seconds</div>
                      </div>
                    );
                  
                  case 'pulsing':
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <div 
                          className="bg-blue-500 rounded-full flex flex-col items-center justify-center text-white font-bold"
                          style=\{{ 
                            width: '30rem', 
                            height: '30rem',
                            animation: timerNum <= 10 ? 'pulse 0.5s ease-in-out infinite' : 'pulse 2s ease-in-out infinite'
                          }}
                        >
                          <div className="text-[12rem]">{timerNum}</div>
                          <div className="text-2xl mt-2">seconds</div>
                        </div>
                      </div>
                    );
                  
                  case 'progress-bar':
                    const progress = timerNum / totalTime;
                    return (
                      <div className="flex flex-col items-center justify-center gap-8 w-full max-w-4xl mx-auto">
                        <div className="w-full h-12 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-1000 ease-linear"
                            style=\{{ 
                              width: (progress * 100) + '%',
                              background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)'
                            }}
                          />
                        </div>
                        <div className="text-[12rem] font-bold text-blue-500">{timerNum}</div>
                        <div className="text-2xl text-white">seconds</div>
                      </div>
                    );
                  
                  case 'matrix':
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <div 
                          className="bg-black border border-green-400 rounded-lg relative overflow-hidden"
                          style=\{{ width: '30rem', height: '30rem' }}
                        >
                          <div className="absolute inset-0 z-10 flex items-center justify-center text-green-400 font-mono text-[12rem] font-bold" style=\{{ textShadow: '0 0 10px currentColor' }}>
                            {String(timerNum).padStart(2, '0')}
                          </div>
                        </div>
                        <div className="text-green-400 text-2xl mt-4">seconds</div>
                      </div>
                    );
                  
                  case 'liquid':
                    const liquidProgress = timerNum / totalTime;
                    return (
                      <div className="flex flex-col items-center justify-center gap-8">
                        <div 
                          className="relative rounded-full border-4 border-gray-300 overflow-hidden"
                          style=\{{ width: '30rem', height: '30rem' }}
                        >
                          <div className="absolute inset-0 bg-gray-200"></div>
                          <div 
                            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-linear"
                            style=\{{ 
                              height: (liquidProgress * 100) + '%',
                              background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-[12rem] font-bold text-white z-10" style=\{{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                            {timerNum}
                          </div>
                        </div>
                        <div className="text-2xl text-white">seconds</div>
                      </div>
                    );
                  
                  case 'gradient':
                    const hue = (timerNum / totalTime) * 120; // 0 to 120 degrees (red to green)
                    return (
                      <div className="flex flex-col items-center justify-center gap-8">
                        <div 
                          className="relative rounded-full overflow-hidden"
                          style=\{{ width: '30rem', height: '30rem' }}
                        >
                          <div 
                            className="absolute inset-0 rounded-full"
                            style=\{{
                              background: 'conic-gradient(from 0deg, hsl(' + hue + ', 70%, 50%) 0%, hsl(60, 70%, 50%) 25%, hsl(30, 70%, 50%) 50%, hsl(0, 70%, 50%) 75%, hsl(' + hue + ', 70%, 50%) 100%)',
                              animation: 'spin 3s linear infinite'
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-[12rem] font-bold text-white z-10" style=\{{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                            {timerNum}
                          </div>
                        </div>
                        <div className="text-2xl text-white">seconds</div>
                      </div>
                    );
                  
                  case 'circular':
                  default:
                    // Circular progress (default)
                    const radius = 45;
                    const circumference = 2 * Math.PI * radius;
                    const circularProgress = timerNum / totalTime;
                    const strokeOffset = circumference * (1 - circularProgress);
                    
                    return (
                      <div className="relative inline-block">
                        <svg 
                          style=\{{ width: '30rem', height: '30rem' }}
                          className="transform -rotate-90" 
                          viewBox="0 0 100 100"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="#e74c3c"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeOffset}
                            style=\{{ transition: 'stroke-dashoffset 1s linear' }}
                          />
                        </svg>
                        
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-[12rem] font-bold text-red-500">
                              {timerNum}
                            </div>
                            <div className="text-3xl text-white mt-2">
                              seconds
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                }
              };

              const renderContent = () => {
                switch (displayData.mode) {
                  case 'questionWaiting':
                    // Question waiting mode - shows question number with big question mark
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header with question number */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">
                            Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
                          </h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="text-center">
                            <div className="text-3xl text-gray-400 mb-8">Get ready...</div>
                            
                            {/* Big question mark */}
                            <div className="text-[25rem] font-bold text-white mb-4 animate-pulse leading-none">
                              ?
                            </div>
                            
                            <div className="text-2xl text-gray-400 animate-pulse">
                              Question will begin shortly
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  case 'basic':
                    return (
                      <div 
                        className="h-full w-full flex items-center justify-center relative overflow-hidden"
                        style={{ backgroundColor: getHSLColor(currentColorIndex) }}
                      >
                        {/* Background pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-10 left-10 w-32 h-32 bg-orange-400 rounded-full animate-pulse"></div>
                          <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-1000"></div>
                          <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse delay-2000"></div>
                          <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse delay-500"></div>
                        </div>
                        
                        {/* Main content */}
                        <div className="relative z-10 text-center transform -rotate-6">
                          <div className="bg-orange-500 text-black px-20 py-12 rounded-2xl shadow-2xl border-4 border-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
                            <h1 className="text-[12rem] font-black tracking-wider drop-shadow-lg">
                              POP
                            </h1>
                            <h2 className="text-[12rem] font-black tracking-wider -mt-8 drop-shadow-lg">
                              QUIZ!
                            </h2>
                          </div>
                          
                          {/* Decorative elements */}
                          <div className="absolute -top-8 -left-8 text-6xl animate-bounce">🎯</div>
                          <div className="absolute -top-8 -right-8 text-6xl animate-bounce delay-300">🧠</div>
                          <div className="absolute -bottom-8 -left-8 text-6xl animate-bounce delay-700">🎵</div>
                          <div className="absolute -bottom-8 -right-8 text-6xl animate-bounce delay-1000">🏆</div>
                        </div>
                        
                        {/* Floating elements */}
                        <div className="absolute top-1/4 left-1/4 text-4xl animate-spin">⭐</div>
                        <div className="absolute top-3/4 right-1/4 text-4xl animate-spin delay-500">✨</div>
                        <div className="absolute top-1/2 left-1/6 text-3xl animate-pulse">🎵</div>
                        <div className="absolute top-1/3 right-1/6 text-3xl animate-pulse delay-300">⚡</div>
                      </div>
                    );
                  case 'scores':
                    return (
                      <div className="h-full w-full flex items-center justify-center p-8">
                        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-4xl">
                          <h1 className="text-4xl font-bold text-orange-400 text-center mb-8">★ LIVE SCORES ★</h1>
                          <div className="space-y-4">
                            {displayData.quizzes
                              .sort((a, b) => (b.score || 0) - (a.score || 0))
                              .map((team, index) => (
                                <div key={team.id} className="flex items-center justify-between bg-gray-700 p-4 rounded">
                                  <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold text-blue-400">#{index + 1}</span>
                                    <span className="text-xl text-white">{team.name}</span>
                                  </div>
                                  <span className="text-2xl font-bold text-green-400">{team.score || 0}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  case 'slideshow':
                    if (displayData.images.length === 0) {
                      return (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="text-center">
                            <h1 className="text-4xl font-bold text-white mb-4">Image Slideshow</h1>
                            <p className="text-lg text-gray-400">No images uploaded</p>
                            <p className="text-sm text-gray-500 mt-2">Upload images in Display Settings to start slideshow</p>
                          </div>
                        </div>
                      );
                    }

                    const currentImage = displayData.images[currentImageIndex];
                    return (
                      <div className="h-full w-full relative overflow-hidden bg-black">
                        {/* Current Image */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            src={currentImage.url}
                            alt={currentImage.name}
                            className="max-h-full max-w-full object-contain"
                            style={{ 
                              transition: 'opacity 0.5s ease-in-out',
                              filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))'
                            }}
                          />
                        </div>
                        
                        {/* Slideshow Info Overlay */}
                        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm">
                          <div className="text-center">
                            <div className="font-semibold">{currentImageIndex + 1} / {displayData.images.length}</div>
                            <div className="text-xs opacity-75">{displayData.slideshowSpeed}s interval</div>
                          </div>
                        </div>

                        {/* Image Name Overlay */}
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                          <div className="font-medium">{currentImage.name}</div>
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
                          <div 
                            className="h-full bg-blue-500 transition-all ease-linear"
                            style={{
                              width: ((currentImageIndex + 1) / displayData.images.length * 100) + '%'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  case 'leaderboard-intro':
                    return (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-8xl mb-8 animate-bounce">♕</div>
                          <h1 className="text-6xl font-bold text-orange-400 mb-4">AND THE SCORES ARE...</h1>
                          <p className="text-2xl text-white opacity-80">Get ready for the results!</p>
                        </div>
                      </div>
                    );
                  case 'leaderboard-reveal':
                    if (!displayData.leaderboardData?.team) {
                      return (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-8xl mb-8 animate-bounce">♕</div>
                            <h1 className="text-6xl font-bold text-orange-400 mb-4">WAITING FOR REVEAL...</h1>
                            <p className="text-2xl text-white opacity-80">Host will start revealing teams soon!</p>
                          </div>
                        </div>
                      );
                    }
                    
                    const { team, position, revealedTeamsWithPositions } = displayData.leaderboardData;
                    // Sort revealed teams by position in ASCENDING order (lower position numbers at top)
                    // This way 1st place appears at top, 2nd below it, etc, with 9th place at bottom
                    const teamsToDisplay = revealedTeamsWithPositions 
                      ? [...revealedTeamsWithPositions].sort((a, b) => (a.actualPosition || a.position || 0) - (b.actualPosition || b.position || 0))
                      : [...displayData.revealedTeams].sort((a, b) => (a.actualPosition || 0) - (b.actualPosition || 0));
                    
                    return (
                      <div className="h-full w-full flex flex-col">
                        {/* Header - takes minimal space */}
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-6 flex-shrink-0">
                          <h1 className="text-5xl font-bold text-center">♕ LEADERBOARD ♕</h1>
                        </div>
                        
                        {/* Leaderboard content - takes remaining space */}
                        <div className="flex-1 bg-gray-800 overflow-hidden flex flex-col">
                          {/* Column headers */}
                          <div className="bg-orange-500 px-8 py-4 flex-shrink-0">
                            <div className="grid grid-cols-12 gap-4 text-white text-3xl font-bold">
                              <div className="col-span-2 text-center">Position</div>
                              <div className="col-span-7">Team Name</div>
                              <div className="col-span-3 text-center">Score</div>
                            </div>
                          </div>
                          
                          {/* Teams list - fills remaining space */}
                          <div className="flex-1 overflow-y-auto">
                            {teamsToDisplay
                              .map((revealedTeam) => {
                              const isCurrentTeam = team && revealedTeam.id === team.id;
                              // Use actualPosition if available, otherwise use position
                              const teamPosition = revealedTeam.actualPosition || revealedTeam.position || position;
                              return (
                                <div
                                  key={revealedTeam.id}
                                  className={'grid grid-cols-12 gap-4 px-8 py-8 border-b-2 border-gray-600 ' + 
                                    (isCurrentTeam ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white')}
                                >
                                  <div className="col-span-2 flex items-center justify-center">
                                    {teamPosition === 1 && <div className="text-6xl">①</div>}
                                    {teamPosition === 2 && <div className="text-6xl">②</div>}
                                    {teamPosition === 3 && <div className="text-6xl">③</div>}
                                    {teamPosition > 3 && (
                                      <div className="text-4xl font-bold px-6 py-3 rounded-full border-4 border-blue-400 text-blue-400">
                                        {teamPosition}
                                      </div>
                                    )}
                                  </div>
                                  <div className="col-span-7 flex items-center">
                                    <span className="text-4xl font-bold">{revealedTeam.name}</span>
                                  </div>
                                  <div className="col-span-3 flex items-center justify-center">
                                    <div className="text-5xl font-bold text-blue-400">
                                      {revealedTeam.score || 0}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  case 'timer':
                    // Timer mode - clean layout without any branding with dynamic color
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header with clean Timer title */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">
                            Question {(displayData.questionInfo && displayData.questionInfo.number) || 1} • Timer
                          </h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="flex items-center justify-center">
                            {renderCountdownTimer(displayData.timerValue, displayData.countdownStyle, displayData.gameModeTimers && displayData.gameMode ? displayData.gameModeTimers[displayData.gameMode] : 30)}
                          </div>
                        </div>
                      </div>
                    );
                  case 'correctAnswer':
                    // Correct Answer mode - clean layout without any branding with dynamic color
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header with clean Results title */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">
                            Question {(displayData.questionInfo && displayData.questionInfo.number) || 1} • Results
                          </h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          {/* Stats summary with colored boxes */}
                          {displayData.correctAnswer && displayData.correctAnswer.stats && (
                            <div className="text-center mb-8">
                              <div className="flex justify-center items-center gap-4 mb-8">
                                {/* Correct answers box */}
                                {displayData.correctAnswer.stats.correct > 0 && (
                                  <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                                    {displayData.correctAnswer.stats.correct} Correct
                                  </div>
                                )}
                                
                                {/* Wrong answers box */}
                                {displayData.correctAnswer.stats.wrong > 0 && (
                                  <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                                    {displayData.correctAnswer.stats.wrong} Wrong
                                  </div>
                                )}
                                
                                {/* No answer box if applicable */}
                                {displayData.correctAnswer.stats.noAnswer > 0 && (
                                  <div className="bg-gray-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                                    {displayData.correctAnswer.stats.noAnswer} No Answer
                                  </div>
                                )}
                              </div>
                              <div className="w-full h-px bg-gray-600 my-8"></div>
                            </div>
                          )}

                          {/* The correct answer is... */}
                          <div className="text-center">
                            <div className="text-3xl text-gray-400 mb-8">The correct answer is...</div>
                            
                            {/* Large answer display */}
                            <div className="text-8xl font-bold text-white mb-4">
                              {displayData.correctAnswer && displayData.correctAnswer.revealed ? (displayData.correctAnswer.correctAnswer || 'No Answer') : '...'}
                            </div>
                            
                            {!(displayData.correctAnswer && displayData.correctAnswer.revealed) && (
                              <div className="text-2xl text-gray-400 animate-pulse">
                                Waiting for reveal...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  case 'nearest-wins-question':
                    // Nearest wins question mode - shows question number
                    return (
                      <div className="h-full w-full flex items-center justify-center bg-[#2c3e50]">
                        <div className="text-center">
                          <div className="text-6xl font-bold text-[#f39c12] mb-8">
                            Nearest Wins Question {displayData.questionNumber || 1}
                          </div>
                          <div className="text-4xl text-white mb-8">
                            Guess as close as you can!
                          </div>
                          <div className="text-2xl text-[#95a5a6]">
                            Teams: Submit your best guess now
                          </div>
                        </div>
                      </div>
                    );
                  case 'nearest-wins-timer':
                    // Nearest wins timer mode - use the same styled timer system
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header with Timer title */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">Nearest Wins • Timer</h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="flex items-center justify-center">
                            {renderCountdownTimer(displayData.timerValue, displayData.countdownStyle, displayData.gameInfo?.totalTime || displayData.gameModeTimers?.nearestwins || 10)}
                          </div>
                        </div>
                      </div>
                    );
                  case 'nearest-wins-results':
                    // Nearest wins results mode
                    return (
                      <div className="h-full w-full flex flex-col p-8 bg-gradient-to-br from-green-600 to-green-800">
                        {/* Header */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-white">
                            ◉ NEAREST WINS • Results
                          </h1>
                        </div>

                        {/* Main content area */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="text-center">

                            
                            {displayData.answerRevealed && displayData.results ? (
                              <>
                                <div className="text-4xl text-gray-400 mb-8">♕ WINNER ♕</div>
                                <div className="text-8xl font-bold text-green-400 mb-4">
                                  {displayData.results.winner.name}
                                </div>
                                <div className="text-4xl text-white mb-4">
                                  Guess: {displayData.results.winner.guess}
                                </div>
                                <div className="text-2xl text-gray-400">
                                  Difference: {displayData.results.winner.difference}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-4xl text-gray-400 mb-8">Results are in...</div>
                                <div className="text-8xl font-bold text-white mb-4 animate-pulse">
                                  ���
                                </div>
                                <div className="text-2xl text-gray-400 animate-pulse">
                                  Waiting for reveal...
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );

                  case 'fastestTeam':
                    // Fastest Team mode - shows the team that answered correctly the fastest
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">
                            🏃 FASTEST TEAM 🏃
                          </h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="text-center">
                            {displayData.fastestTeamData && displayData.fastestTeamData.fastestTeam && displayData.fastestTeamData.fastestTeam.name ? (
                              <>
                                <div className="text-4xl text-gray-400 mb-8">⚡ Lightning Fast ⚡</div>
                                <div className="text-[8rem] font-bold text-white mb-4 leading-none">
                                  {displayData.fastestTeamData.fastestTeam.name}
                                </div>
                                <div className="text-3xl text-gray-400 mb-4">
                                  🏆 Fastest Correct Answer! 🏆
                                </div>
                                {displayData.fastestTeamData.responseTime && (
                                  <div className="text-2xl text-gray-400 mb-4">
                                    Response time: {(displayData.fastestTeamData.responseTime / 1000).toFixed(2)}s
                                  </div>
                                )}
                                <div className="text-2xl text-gray-400">
                                  Got the correct answer first!
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-4xl text-gray-400 mb-8">⚡ Calculating... ⚡</div>
                                <div className="text-[8rem] font-bold text-white mb-4 animate-pulse leading-none">
                                  🏃
                                </div>
                                <div className="text-2xl text-gray-400 animate-pulse">
                                  Finding the fastest team...
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  case 'fastTrack':
                    // FAST TRACK mode - The most amazing display ever!
                    // Rainbow cycling background with extreme animations
                    const rainbowColors = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#FF00FF'];
                    const fastTrackBgColor = rainbowColors[Math.floor(Date.now() / 500) % rainbowColors.length];
                    
                    return (
                      <div 
                        className=\"h-full w-full flex flex-col p-8 relative overflow-hidden\"
                        style={{ 
                          backgroundColor: fastTrackBgColor,
                          transition: 'background-color 0.5s ease-in-out'
                        }}
                      >
                        {/* Animated sparkles */}
                        <div className=\"absolute inset-0 pointer-events-none\">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div
                              key={i}
                              className=\"absolute text-4xl animate-ping\"
                              style={{
                                left: Math.random() * 100 + '%',
                                top: Math.random() * 100 + '%',
                                animationDelay: Math.random() * 2 + 's',
                                animationDuration: (1 + Math.random() * 2) + 's',
                              }}
                            >
                              ✨
                            </div>
                          ))}
                        </div>
                        
                        {/* Rotating lightning bolts */}
                        <div className=\"absolute inset-0 pointer-events-none\">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              className=\"absolute text-6xl animate-spin\"
                              style={{
                                left: (10 + i * 12) + '%',
                                top: (20 + (i % 3) * 25) + '%',
                                animationDuration: (2 + Math.random() * 2) + 's',
                                opacity: 0.6
                              }}
                            >
                              ⚡
                            </div>
                          ))}
                        </div>
                        
                        {/* Header with FAST TRACK title */}
                        <div className=\"relative text-center mb-8 animate-bounce z-10\">
                          <h1 
                            className=\"text-8xl font-bold text-white drop-shadow-2xl\"
                            style={{
                              textShadow: '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.4)',
                              WebkitTextStroke: '3px black',
                            }}
                          >
                            ⚡ FAST TRACK ⚡
                          </h1>
                          <div className=\"text-3xl text-white font-bold mt-4\" style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
                            Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
                          </div>
                        </div>

                        {/* Main content area with team name */}
                        <div className=\"flex-1 flex flex-col justify-center items-center relative z-10\">
                          {/* Floating crowns */}
                          <div className=\"absolute inset-0 flex items-center justify-center pointer-events-none\">
                            <div className=\"absolute text-8xl animate-bounce\" style={{ left: '10%', animationDelay: '0s' }}>👑</div>
                            <div className=\"absolute text-8xl animate-bounce\" style={{ right: '10%', animationDelay: '0.3s' }}>👑</div>
                          </div>
                          
                          <div className=\"text-center relative z-10\">
                            <div 
                              className=\"text-5xl text-white mb-8 font-bold animate-pulse\"
                              style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
                            >
                              🏆 FAST TRACKED TO FIRST PLACE! 🏆
                            </div>
                            
                            {/* Ultra-large team name display with extreme effects */}
                            {displayData.fastestTeamData && displayData.fastestTeamData.fastestTeam && displayData.fastestTeamData.fastestTeam.name ? (
                              <div 
                                className=\"font-bold text-white animate-pulse\"
                                style={{
                                  fontSize: '10rem',
                                  textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)',
                                  WebkitTextStroke: '4px black',
                                  lineHeight: '1.2',
                                }}
                              >
                                {displayData.fastestTeamData.fastestTeam.name}
                              </div>
                            ) : (
                              <div 
                                className=\"font-bold text-white animate-pulse\"
                                style={{
                                  fontSize: '10rem',
                                  textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)',
                                  WebkitTextStroke: '4px black',
                                  lineHeight: '1.2',
                                }}
                              >
                                Unknown Team
                              </div>
                            )}
                            
                            {/* Trophy explosion */}
                            <div className=\"mt-12 flex justify-center gap-8\">
                              <div className=\"text-8xl animate-bounce\" style={{ animationDelay: '0s' }}>🏆</div>
                              <div className=\"text-9xl animate-bounce\" style={{ animationDelay: '0.2s' }}>🏆</div>
                              <div className=\"text-8xl animate-bounce\" style={{ animationDelay: '0.4s' }}>🏆</div>
                            </div>
                            
                            <div 
                              className=\"text-6xl text-white font-bold mt-12 animate-pulse\"
                              style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
                            >
                              ⭐ 1ST PLACE WITH +1 POINT LEAD! ⭐
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  case 'wheel-spinner':
                    // Wheel Spinner mode - shows the spinning wheel
                    return (
                      <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
                        {/* Header */}
                        <div className="text-center mb-8">
                          <h1 className="text-6xl font-bold text-gray-800">
                            🎡 WHEEL SPINNER 🎡
                          </h1>
                        </div>

                        {/* Main content area with dark rounded rectangle */}
                        <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
                          <div className="flex flex-col items-center justify-center">
                            {displayData.wheelSpinnerData && displayData.wheelSpinnerData.wheelItems && displayData.wheelSpinnerData.wheelItems.length > 0 ? (
                              <>
                                {/* Wheel display */}
                                <div className="relative mb-8">
                                  <svg 
                                    width="400" 
                                    height="400" 
                                    style={{ 
                                      transform: "rotate(" + (displayData.wheelSpinnerData.rotation || 0) + "deg)", 
                                      transition: displayData.wheelSpinnerData.isSpinning ? "transform " + ((displayData.wheelSpinnerData.spinDuration || 3500) * 1.8) + "ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none" 
                                    }}
                                  >
                                    {displayData.wheelSpinnerData.wheelItems.map((item, index) => {
                                      const itemAngle = 360 / displayData.wheelSpinnerData.wheelItems.length;
                                      const startAngle = index * itemAngle;
                                      const endAngle = (index + 1) * itemAngle;
                                      
                                      const radius = 180;
                                      const centerX = 200;
                                      const centerY = 200;
                                      
                                      const x1 = centerX + Math.cos((startAngle - 90) * Math.PI / 180) * radius;
                                      const y1 = centerY + Math.sin((startAngle - 90) * Math.PI / 180) * radius;
                                      const x2 = centerX + Math.cos((endAngle - 90) * Math.PI / 180) * radius;
                                      const y2 = centerY + Math.sin((endAngle - 90) * Math.PI / 180) * radius;
                                      
                                      const largeArcFlag = itemAngle > 180 ? 1 : 0;
                                      
                                      const pathData = [
                                        "M " + centerX + " " + centerY,
                                        "L " + x1 + " " + y1,
                                        "A " + radius + " " + radius + " 0 " + largeArcFlag + " 1 " + x2 + " " + y2,
                                        "Z"
                                      ].join(" ");

                                      const midAngle = (startAngle + endAngle) / 2;
                                      const textRadius = radius * 0.85;
                                      const textX = centerX + Math.cos((midAngle - 90) * Math.PI / 180) * textRadius;
                                      const textY = centerY + Math.sin((midAngle - 90) * Math.PI / 180) * textRadius;

                                      return (
                                        <g key={item.id}>
                                          <path d={pathData} fill={item.color} stroke="#333" strokeWidth="2" />
                                          <text
                                            x={textX}
                                            y={textY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill="white"
                                            fontSize="14"
                                            fontWeight="bold"
                                            className="pointer-events-none"
                                            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                            transform={"rotate(" + (midAngle - 90) + ", " + textX + ", " + textY + ")"}
                                          >
                                            {item.label}
                                          </text>
                                        </g>
                                      );
                                    })}
                                  </svg>
                                  
                                  {/* Pointer - moved to right side */}
                                  <div className="absolute top-1/2 right-0 transform translate-x-3 -translate-y-1/2">
                                    <div className="w-0 h-0 border-t-6 border-b-6 border-l-10 border-t-transparent border-b-transparent border-l-yellow-400 drop-shadow-lg"></div>
                                  </div>
                                </div>

                                {/* Status and winner display */}
                                <div className="text-center">
                                  {displayData.wheelSpinnerData.isSpinning ? (
                                    <div className="text-4xl text-white font-bold animate-pulse">
                                      🎲 SPINNING... 🎲
                                    </div>
                                  ) : displayData.wheelSpinnerData.winner ? (
                                    <>
                                      <div className="text-3xl text-gray-400 mb-4">🎉 WINNER! 🎉</div>
                                      <div className="text-6xl font-bold text-white mb-4">
                                        {displayData.wheelSpinnerData.winner}
                                      </div>
                                      <div className="text-2xl text-gray-400">
                                        Congratulations! ���
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-3xl text-white font-bold">
                                      🎯 Ready to spin! 🎯
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-center">
                                <div className="text-6xl mb-8">🎡</div>
                                <div className="text-4xl text-white font-bold mb-4">
                                  Setting up wheel...
                                </div>
                                <div className="text-2xl text-gray-400">
                                  Please wait while the wheel is configured
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  case 'team-welcome':
                    return (
                      <div 
                        className="w-full h-full relative overflow-hidden flex items-center justify-center"
                        style={{ 
                          backgroundColor: welcomeColors[welcomeColorIndex],
                          transition: 'background-color 3s ease-in-out'
                        }}
                      >
                        {/* Background animated circles */}
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-400 rounded-full animate-pulse"></div>
                          <div className="absolute top-60 right-32 w-24 h-24 bg-red-400 rounded-full animate-pulse"></div>
                          <div className="absolute bottom-60 left-40 w-40 h-40 bg-green-400 rounded-full animate-pulse"></div>
                          <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse"></div>
                          <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse"></div>
                          <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse"></div>
                        </div>
                        
                        {/* Main content */}
                        <div className="relative z-10 text-center">
                          <div className="text-4xl text-white mb-8 font-bold">
                            🎉 Welcome! ���
                          </div>
                          <div className="text-8xl font-bold text-white mb-8 drop-shadow-lg" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>
                            {displayData.teamName || "Team Name"}
                          </div>
                          <div className="text-3xl text-white font-semibold">
                            Let's hear your buzzer sound!
                          </div>
                        </div>
                      </div>
                    );
                  default:
                    return (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center">
                          <h1 className="text-6xl font-bold text-white">External Display</h1>
                        </div>
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
                      <div className="text-xs text-gray-400">1920x1080 • 16:9</div>
                    </div>
                  </div>
                  <div className="flex-1 bg-black relative overflow-hidden">
                    {renderContent()}
                    <div className="absolute bottom-4 right-4 text-xs text-white opacity-30 font-mono">
                      EXT-1
                    </div>
                  </div>
                </div>
              );
            }

            // Render the component
            ReactDOM.render(<ExternalDisplay />, document.getElementById('root'));
          </script>
        </body>
        </html>
      `;

      newWindow.document.write(htmlContent);
      newWindow.document.close();

      // Listen for window close
      const checkClosed = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(checkClosed);
          setExternalWindow(null);
          setIsExternalDisplayOpen(false);
        }
      }, 1000);

      // Send initial display data
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

    // If window exists but is closed, clear the state
    if (externalWindow && externalWindow.closed) {
      setExternalWindow(null);
      setIsExternalDisplayOpen(false);
    }

    // Build a URL that toggles the external route while preserving existing query/hash
    try {
      const href = window.location.href;
      const hasQuery = href.indexOf('?') !== -1;
      const fullUrl = href + (hasQuery ? '&' : '?') + 'external=1';

      let newWindow = null;

      try {
        newWindow = window.open(fullUrl, 'externalDisplay', 'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no');
      } catch (e) {
        newWindow = null;
      }

      // If window.open returned null (popup blocked) or failed, open about:blank and redirect it to the fullUrl
      if (!newWindow) {
        const blank = window.open('about:blank', 'externalDisplay', 'width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no');
        if (blank) {
          try {
            blank.document.location.href = fullUrl;
            newWindow = blank;
          } catch (e) {
            // Fallback: write a minimal HTML that redirects
            try {
              blank.document.write(`<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.location.replace(${JSON.stringify(fullUrl)});</script></body></html>`);
              blank.document.close();
              newWindow = blank;
            } catch (err) {
              console.warn('Failed to redirect external window to SPA route', err);
            }
          }
        }
      }

      if (newWindow) {
        setExternalWindow(newWindow);
        setIsExternalDisplayOpen(true);

        // Poll for window close and cleanup state
        const checkClosed = setInterval(() => {
          if (newWindow.closed) {
            clearInterval(checkClosed);
            setExternalWindow(null);
            setIsExternalDisplayOpen(false);
          }
        }, 1000);

        // Give the external window a moment to initialize before sending first update
        setTimeout(() => {
          updateExternalDisplay(newWindow, displayMode);
        }, 800);
      } else {
        console.warn('Unable to open external display window (popup blocked or unavailable).');
      }
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
      openExternalDisplaySimple();
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
    console.log(`🔀 handleScrambleKeypad called for team ${teamId}`);
    
    setQuizzes(prevQuizzes => {
      console.log('🔀 Previous quizzes state:', prevQuizzes.map(q => ({ id: q.id, name: q.name, scrambled: q.scrambled })));
      
      const targetTeam = prevQuizzes.find(q => q.id === teamId);
      if (!targetTeam) {
        console.error(`🔀 Team ${teamId} not found in quizzes array`);
        return prevQuizzes;
      }
      
      console.log(`🔀 Target team ${teamId} current scrambled state:`, targetTeam.scrambled);
      
      const updatedQuizzes = prevQuizzes.map(quiz => {
        if (quiz.id === teamId) {
          // Create a completely new object to ensure React detects the change
          const newScrambledState = !quiz.scrambled;
          console.log(`🔀 Updating team ${teamId} (${quiz.name}) scrambled from ${quiz.scrambled} to ${newScrambledState}`);
          return { ...quiz, scrambled: newScrambledState };
        }
        return quiz;
      });
      
      // Debug logging
      const updatedTeam = updatedQuizzes.find(q => q.id === teamId);
      console.log(`🔀 After update - team ${teamId} scrambled state:`, updatedTeam?.scrambled);
      console.log('🔀 All teams scrambled states after update:', updatedQuizzes.map(q => ({ id: q.id, name: q.name, scrambled: q.scrambled })));
      
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
            isVisible={flowState.flow === 'sent-question' || flowState.flow === 'running' || flowState.flow === 'timeup'}
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
              isActive={isQuizActive}
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
              isActive={isQuizActive}
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
              isActive={isQuizActive}
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
            displayMode={displayMode}
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
            <div className="flex-1 bg-background min-w-0">
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
        displayMode={displayMode}
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
