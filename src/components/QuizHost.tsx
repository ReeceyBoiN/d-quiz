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
      { id: "5", name: "Hassan", type: "test" as const, icon: "⭐", score: Math.floor(Math.random() * 200) + 50 },
      { id: "6", name: "Khadija", type: "test" as const, icon: "💫", score: Math.floor(Math.random() * 200) + 50 },
      { id: "7", name: "Ali", type: "test" as const, icon: "🎊", score: Math.floor(Math.random() * 200) + 50 },
      { id: "8", name: "Zainab", type: "test" as const, icon: "🎊", score: Math.floor(Math.random() * 200) + 50 },
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

  // Handle external display update via IPC
  const handleExternalDisplayUpdate = async (
    mode: "basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" |
          "timer" | "correctAnswer" | "fastestTeam" | "question" | "picture" | "endRound",
    extraData: any = {}
  ) => {
    if (!isExternalDisplayOpen || !window.api?.externalDisplay?.update) return;

    const currentQuestion = loadedQuizQuestions[currentLoadedQuestionIndex] || null;

    const payload = {
      mode,
      quizzes,
      leaderboardData,
      revealedTeams,
      questionInfo: currentQuestion
        ? {
            id: currentQuestion.id,
            number: currentLoadedQuestionIndex + 1,
            text: currentQuestion.question,
            options: currentQuestion.options,
            correctIndex: currentQuestion.correctAnswer,
            total: loadedQuizQuestions.length,
          }
        : null,
      timerValue: flowState.timeRemaining,
      correctAnswer: currentQuestion
        ? currentQuestion.options[currentQuestion.correctAnswer]
        : null,
      answerRevealed: showAnswer,
      countdownStyle,
      gameModeTimers,
      fastestTeamData,
      slideshowSpeed,
      ...extraData,
    };

    try {
      console.log("[ExternalDisplay] →", mode, payload);
      await window.api.externalDisplay.update(payload);
    } catch (err) {
      console.error("[ExternalDisplay] Failed to update:", err);
    }
  };


  // Handle team score changes
  const handleScoreChange = useCallback((teamId: string, amount: number) => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId
          ? { ...quiz, score: (quiz.score || 0) + amount }
          : quiz
      )
    );
  }, []);

  // Handle team score set
  const handleScoreSet = useCallback((teamId: string, newScore: number) => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId
          ? { ...quiz, score: newScore }
          : quiz
      )
    );
  }, []);

  // Handle team name change
  const handleNameChange = useCallback((teamId: string, newName: string) => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz =>
        quiz.id === teamId
          ? { ...quiz, name: newName }
          : quiz
      )
    );
  }, []);

  // Handle team delete
  const handleDeleteTeam = useCallback((teamId: string, teamName: string, score: number) => {
    setTeamToDelete({ id: teamId, name: teamName, score });
    setShowDeleteConfirm(true);
  }, []);

  // Handle team selection
  const handleQuizSelect = useCallback((teamId: string) => {
    setSelectedQuiz(quizzes.find(q => q.id === teamId) || null);
  }, [quizzes]);

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
      // Check if this is a quiz pack SYNCHRONOUSLY before any state updates
      const isQuizPack = currentQuiz.isQuizPack || false;

      // Now schedule all state updates together in next tick
      queueMicrotask(() => {
        setLoadedQuizQuestions(currentQuiz.questions);
        setCurrentLoadedQuestionIndex(0);
        closeAllGameModes();
        setIsQuizPackMode(isQuizPack);

        if (isQuizPack) {
          // For quiz packs, show the quiz pack display (config or question screen)
          setShowQuizPackDisplay(true);
        } else {
          // For regular games, show the keypad interface
          setShowKeypadInterface(true);
        }
        setActiveTab("teams");
      });
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
    // Note: Do NOT clear loaded quiz questions here - they are cleared explicitly in handleQuizPackClose and handleTabChange
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
    if (showQuizPackDisplay && flowState.isQuestionMode) {
      setFlowState(prev => ({ ...prev, isQuestionMode: false, flow: 'idle' }));
      timer.stop();
      if (isExternalDisplayOpen) handleExternalDisplayUpdate("basic");
      return;
    }

    playExplosionSound();
    closeAllGameModes();
    setActiveTab("home");

    if (isExternalDisplayOpen) {
      handleExternalDisplayUpdate("endRound", {
        message: "Round Complete! 🎉",
      });
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
    // Clear loaded quiz pack questions when closing
    setLoadedQuizQuestions([]);
    setCurrentLoadedQuestionIndex(0);
    setIsQuizPackMode(false);
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
        if (hasQuestionImage(currentQuestion)) {
          sendPictureToPlayers(currentQuestion.imageDataUrl);
          handleExternalDisplayUpdate('picture', { image: currentQuestion.imageDataUrl });
          setFlowState(prev => ({ ...prev, flow: 'sent-picture', pictureSent: true }));
        } else {
          sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, currentQuestion.type);
          handleExternalDisplayUpdate('question', {
            text: currentQuestion.q,
            options: currentQuestion.options,
            type: currentQuestion.type,
          });
          setFlowState(prev => ({ ...prev, flow: 'sent-question', questionSent: true }));
        }
        break;
      }

      case 'sent-picture': {
        sendQuestionToPlayers(currentQuestion.q, currentQuestion.options, currentQuestion.type);
        handleExternalDisplayUpdate('question', {
          text: currentQuestion.q,
          options: currentQuestion.options,
          type: currentQuestion.type,
        });
        setFlowState(prev => ({ ...prev, flow: 'sent-question', questionSent: true }));
        break;
      }

      case 'sent-question': {
        sendTimerToPlayers(flowState.totalTime, false);
        handleExternalDisplayUpdate('timer', {
          timerValue: flowState.totalTime,
          questionInfo: {
            number: currentLoadedQuestionIndex + 1,
            total: loadedQuizQuestions.length,
          },
        });
        setFlowState(prev => ({ ...prev, flow: 'running' }));
        break;
      }

      case 'running':
      case 'timeup': {
        timer.stop();
        sendRevealToPlayers(currentQuestion.answerText, currentQuestion.correctIndex, currentQuestion.type);
        handleExternalDisplayUpdate('correctAnswer', {
          correctAnswer: currentQuestion.answerText,
          correctIndex: currentQuestion.correctIndex,
        });
        setFlowState(prev => ({ ...prev, flow: 'revealed' }));
        break;
      }

      case 'revealed': {
        sendFastestToDisplay('TBD', currentLoadedQuestionIndex + 1);
        handleExternalDisplayUpdate('fastestTeam', {
          question: currentLoadedQuestionIndex + 1,
        });
        setFlowState(prev => ({ ...prev, flow: 'fastest' }));
        break;
      }

      case 'fastest': {
        if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
          setCurrentLoadedQuestionIndex(currentLoadedQuestionIndex + 1);
          sendNextQuestion();
        } else {
          sendEndRound();
          handleExternalDisplayUpdate('endRound', {
            message: "End of Round!",
          });
          setFlowState(prev => ({ ...prev, flow: 'complete' }));
        }
        break;
      }

      case 'complete': {
        setShowQuizPackDisplay(false);
        setFlowState(prev => ({ ...prev, isQuestionMode: false, flow: 'idle' }));
        setActiveTab("home");
        handleExternalDisplayUpdate("basic");
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
    isExternalDisplayOpen,
    timer,
  ]);


  /**
   * Silent timer handler - starts timer without audio.
   */
  const handleSilentTimer = useCallback(() => {
    sendTimerToPlayers(flowState.totalTime, true);
    if (isExternalDisplayOpen) {
      handleExternalDisplayUpdate('timer', { seconds: flowState.totalTime });
    }
    setFlowState(prev => ({
      ...prev,
      flow: 'running',
      answerSubmitted: 'silent',
    }));
  }, [flowState.totalTime, isExternalDisplayOpen, handleExternalDisplayUpdate]);

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

  // Handle nearest wins interface close
  const handleNearestWinsClose = () => {
    setShowNearestWinsInterface(false);
    setActiveTab("home"); // Return to home when nearest wins is closed
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
      setIsQuizPackMode(false);
      setLoadedQuizQuestions([]);
      setCurrentLoadedQuestionIndex(0);
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
          console.log('🔀 Next Question (SPACEBAR) - advancing to question type selection');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showFastestTeamDisplay]);

  const handleRevealAnswer = () => {
    setShowAnswer(true);
    setIsQuizActive(false);
    setLastResponseTimes(prev => ({ ...prev, ...teamResponseTimes }));

    updateExternalDisplayMode("correctAnswer", {
      correctAnswer:
        loadedQuizQuestions[currentLoadedQuestionIndex]?.options?.[
          loadedQuizQuestions[currentLoadedQuestionIndex]?.correctAnswer
        ],
      answerRevealed: true,
    });
  };

  const handleStartTimer = () => {
    setIsQuizActive(true);
    setTimeRemaining(flowState.totalTime);
    setShowAnswer(false);
    setShowTeamAnswers(true);
    setTeamResponseTimes({});
    setLastResponseTimes({});

    // Send to external display
    updateExternalDisplayMode("timer", {
      timerValue: flowState.totalTime,
    });
  };

  const handleNextQuestion = () => {
    if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
      const nextIndex = currentLoadedQuestionIndex + 1;
      setCurrentLoadedQuestionIndex(nextIndex);
      setTimeRemaining(loadedQuizQuestions[nextIndex].timeLimit);
      setShowAnswer(false);
      setIsQuizActive(false);
      setTeamResponseTimes({});
      setLastResponseTimes({});

      updateExternalDisplayMode(userSelectedDisplayMode || "basic", {
        questionInfo: loadedQuizQuestions[nextIndex],
      });
    }
  };

  const handleLeaderboardIntro = () => {
    setDisplayMode("leaderboard-intro");
    updateExternalDisplayMode("leaderboard-intro", { leaderboardData });
  };

  const handleLeaderboardReveal = () => {
    setDisplayMode("leaderboard-reveal");
    updateExternalDisplayMode("leaderboard-reveal", {
      leaderboardData,
      revealedTeams,
    });
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
    console.log('DISPLAY MODE IS:', displayMode);
    console.log('Changing display mode to:', mode);
    setDisplayMode(mode);
    
    // Remember user's preference for non-leaderboard modes
    if (mode === "basic" || mode === "slideshow" || mode === "scores") {
      setUserSelectedDisplayMode(mode);
    }

    updateExternalDisplayMode();
  };

  const handleDisplayModeChangeClickButton = () => {
    const modes: ("basic" | "slideshow" | "scores")[] = ["basic", "slideshow", "scores"];
    const currentIndex = modes.indexOf(displayMode as any);
    const nextMode = currentIndex === -1
      ? modes[0]
      : modes[(currentIndex + 1) % modes.length];

    handleDisplayModeChange(nextMode);
  };


  const updateExternalDisplayMode = async (
    modeOverride?: "basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "timer" | "correctAnswer",
    extraData: any = {}
  ) => {
    const modeToSend = modeOverride || displayMode;

    console.log("[ExternalDisplay] Updating to:", modeToSend);

    if (isExternalDisplayOpen && window.api?.externalDisplay?.update) {
      try {
        await window.api.externalDisplay.update({
          mode: modeToSend,
          quizzes, // live team data
          leaderboardData,
          revealedTeams,
          questionInfo: loadedQuizQuestions[currentLoadedQuestionIndex] || null,
          timerValue: flowState.timeRemaining,
          correctAnswer:
            loadedQuizQuestions[currentLoadedQuestionIndex]?.options?.[
              loadedQuizQuestions[currentLoadedQuestionIndex]?.correctAnswer
            ] || null,
          answerRevealed: showAnswer,
          gameMode: "keypad",
          countdownStyle,
          slideshowSpeed,
          gameModeTimers,
          fastestTeamData,
          ...extraData,
        });
      } catch (error) {
        console.error("[ExternalDisplay] Failed to update:", error);
      }
    }
  };

  useEffect(() => {
    if (isExternalDisplayOpen && flowState.flow === "running") {
      handleExternalDisplayUpdate("timer", {
        timerValue: flowState.timeRemaining,
      });
    }
  }, [flowState.timeRemaining]);


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

  // Handle global scramble keypad - scrambles all team keypads
  const handleGlobalScrambleKeypad = () => {
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(quiz => ({
        ...quiz,
        scrambled: !quiz.scrambled
      }))
    );
  };

  // Handle toggle hide scores
  const handleToggleHideScores = () => {
    setScoresHidden(!scoresHidden);
  };

  // Handle change team layout - cycles through: default -> alphabetical -> random -> default
  const handleChangeTeamLayout = () => {
    setTeamLayoutMode(prevMode => {
      switch (prevMode) {
        case 'default':
          return 'alphabetical';
        case 'alphabetical':
          return 'random';
        case 'random':
          return 'default';
        default:
          return 'default';
      }
    });
  };

  const handleSettingsOpen = () => {
    setShowSettings(true);
  };

  const openExternalDisplay = async () => {
    if (isExternalDisplayOpen) {
      return; // Already open
    }

    try {
      if (window.api?.externalDisplay?.open) {
        await window.api.externalDisplay.open();
        setIsExternalDisplayOpen(true);
      }
    } catch (error) {
      console.error('Failed to open external display:', error);
    }
  };

  const closeExternalDisplay = async () => {
    try {
      if (window.api?.externalDisplay?.close) {
        await window.api.externalDisplay.close();
        setIsExternalDisplayOpen(false);
      }
    } catch (error) {
      console.error('Failed to close external display:', error);
    }
  };

  // Rest of the component implementation...
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <Resizable
        defaultSize={{ width: 345, height: '100%' }}
        minWidth={250}
        maxWidth={800}
        enable={{ right: true }}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
      >
        <LeftSidebar
          quizzes={quizzes}
          selectedQuiz={selectedQuiz?.id || null}
          onQuizSelect={handleQuizSelect}
          onScoreChange={handleScoreChange}
          onScoreSet={handleScoreSet}
          onNameChange={handleNameChange}
          onDeleteTeam={handleDeleteTeam}
          onTeamDoubleClick={setSelectedTeamForWindow}
          teamAnswers={teamAnswers}
          teamResponseTimes={teamResponseTimes}
          showAnswers={showTeamAnswers}
          scoresPaused={scoresPaused}
          scoresHidden={scoresHidden}
          teamAnswerStatuses={teamAnswerStatuses}
          teamCorrectRankings={teamCorrectRankings}
          teamLayoutMode={teamLayoutMode}
        />
      </Resizable>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSettingsOpen={handleSettingsOpen}
          onExternalDisplayToggle={openExternalDisplay}
          onDisplayModeChange={handleDisplayModeChangeClickButton}
          externalDisplayOpen={isExternalDisplayOpen}
        />

        {/* Content Area with Game Interfaces */}
        <div className="flex-1 relative flex">
          {/* Main content display area */}
          <div className="flex-1 relative flex flex-col">
            {/* Keypad Interface */}
            {showKeypadInterface && !showQuizPackDisplay && !(currentQuiz?.isQuizPack) && (
              <KeypadInterface
                key={keypadInstanceKey}
                onBack={handleKeypadClose}
                triggerNextQuestion={keypadNextQuestionTrigger}
                teams={quizzes}
                currentRoundPoints={currentRoundPoints}
                currentRoundSpeedBonus={currentRoundSpeedBonus}
                onCurrentRoundPointsChange={handleCurrentRoundPointsChange}
                onCurrentRoundSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
                onTimerStateChange={handleTimerStateChange}
                onExternalDisplayUpdate={handleExternalDisplayUpdate}
                loadedQuestions={loadedQuizQuestions}
                currentQuestionIndex={currentLoadedQuestionIndex}
                isQuizPackMode={false}
              />
            )}

            {/* Buzz-in Interface */}
            {showBuzzInInterface && (
              <BuzzInInterface
                quizzes={quizzes}
                onClose={handleBuzzInClose}
              />
            )}

            {/* Nearest Wins Interface */}
            {showNearestWinsInterface && (
              <NearestWinsInterface
                onBack={handleNearestWinsClose}
                onDisplayUpdate={handleExternalDisplayUpdate}
                teams={quizzes}
                currentRoundWinnerPoints={currentRoundWinnerPoints}
                onCurrentRoundWinnerPointsChange={handleCurrentRoundWinnerPointsChange}
              />
            )}

            {/* Wheel Spinner Interface */}
            {showWheelSpinnerInterface && (
              <WheelSpinnerInterface
                quizzes={quizzes}
                onBack={handleWheelSpinnerClose}
                onHome={() => setActiveTab("home")}
                onExternalDisplayUpdate={handleExternalDisplayUpdate}
              />
            )}

            {/* Quiz Pack Display */}
            {showQuizPackDisplay && (
              <QuizPackDisplay
                questions={loadedQuizQuestions}
                currentQuestionIndex={currentLoadedQuestionIndex}
                onPreviousQuestion={handleQuizPackPrevious}
                onNextQuestion={handleQuizPackNext}
                onBack={() => {
                  handleQuizPackClose();
                  setFlowState(prev => ({ ...prev, isQuestionMode: false }));
                }}
                onStartQuiz={handleStartQuiz}
                currentRoundPoints={currentRoundPoints}
                currentRoundSpeedBonus={currentRoundSpeedBonus}
                onPointsChange={handleCurrentRoundPointsChange}
                onSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
              />
            )}

            {/* Buzzers Management */}
            {showBuzzersManagement && (
              <BuzzersManagement
                teams={quizzes.map(quiz => ({
                  id: quiz.id,
                  name: quiz.name,
                  type: quiz.type || "test",
                  icon: quiz.icon,
                  score: quiz.score,
                  buzzerSound: quiz.buzzerSound,
                  photoUrl: quiz.photoUrl,
                  backgroundColor: quiz.backgroundColor
                }))}
                onBuzzerChange={(teamId, buzzerSound) => {
                  setQuizzes(prevQuizzes =>
                    prevQuizzes.map(quiz =>
                      quiz.id === teamId ? { ...quiz, buzzerSound } : quiz
                    )
                  );
                }}
                onClose={handleCloseBuzzersManagement}
                onShowTeamOnDisplay={(teamName) => {
                  // Send team name to external display
                  if (externalWindow && !externalWindow.closed) {
                    handleExternalDisplayUpdate('team', { teamName });
                  }
                }}
              />
            )}

            {/* Fastest Team Display */}
            {showFastestTeamDisplay && fastestTeamData && (
              <FastestTeamDisplay
                fastestTeam={fastestTeamData}
                teams={quizzes}
                hostLocation={hostLocation}
                onClose={() => {
                  setShowFastestTeamDisplay(false);
                  if (currentLoadedQuestionIndex < loadedQuizQuestions.length - 1) {
                    setCurrentLoadedQuestionIndex(prev => prev + 1);
                    setFlowState(prev => ({ ...prev, flow: 'ready', pictureSent: false, questionSent: false }));
                  } else {
                    handleEndRound();
                  }
                }}
                onFastestTeamLocationChange={(teamId, location) => {
                  if (fastestTeamData && fastestTeamData.team.id === teamId) {
                    setFastestTeamData(prev =>
                      prev ? { ...prev, team: { ...prev.team, location } } : null
                    );
                  }
                }}
                onHostLocationChange={setHostLocation}
                onScrambleKeypad={(teamId) => {
                  const updatedQuizzes = quizzes.map(quiz =>
                    quiz.id === teamId ? { ...quiz, scrambled: !(quiz.scrambled || false) } : quiz
                  );
                  setQuizzes(updatedQuizzes);
                }}
                onBlockTeam={(teamId, blocked) => {
                  const updatedQuizzes = quizzes.map(quiz =>
                    quiz.id === teamId ? { ...quiz, blocked } : quiz
                  );
                  setQuizzes(updatedQuizzes);
                }}
              />
            )}

            {/* Default display when no game is active */}
            {!showKeypadInterface && !showBuzzInInterface && !showNearestWinsInterface && !showWheelSpinnerInterface && !showQuizPackDisplay && !showFastestTeamDisplay && (
              <>
                {activeTab === "livescreen" && <DisplayPreview displayMode={displayMode} images={images} />}
                {activeTab === "home" && <QuestionDisplay question={currentQuestion} currentQuestionNumber={currentQuestionIndex + 1} totalQuestions={mockQuestions.length} timeRemaining={timeRemaining} onRevealAnswer={handleRevealAnswer} onNextQuestion={handleNextQuestion} showAnswer={showAnswer} />}
                {activeTab === "teams" && <div className="w-full h-full flex items-center justify-center text-muted-foreground">Teams view</div>}
              </>
            )}
          </div>

          {/* Right Panel - Game Mode Buttons */}
          {!showKeypadInterface && !showBuzzInInterface && !showNearestWinsInterface && !showWheelSpinnerInterface && !showQuizPackDisplay && !showFastestTeamDisplay && (
            <div className="w-80 border-l border-border overflow-y-auto">
              <RightPanel
                quizzes={quizzes}
                onKeypadClick={handleKeypadClick}
                onBuzzInClick={handleBuzzInClick}
                onWheelSpinnerClick={handleWheelSpinnerClick}
                onNearestWinsClick={handleNearestWinsClick}
              />
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <StatusBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          teamCount={quizzes.length}
          currentGameMode={getCurrentGameMode()}
          currentRoundPoints={currentRoundPoints}
          currentRoundSpeedBonus={currentRoundSpeedBonus}
          onCurrentRoundPointsChange={handleCurrentRoundPointsChange}
          onCurrentRoundSpeedBonusChange={handleCurrentRoundSpeedBonusChange}
          showKeypadInterface={showKeypadInterface}
          showBuzzInInterface={showBuzzInInterface}
          showNearestWinsInterface={showNearestWinsInterface}
          showWheelSpinnerInterface={showWheelSpinnerInterface}
          showBuzzInMode={showBuzzInMode}
          showQuizPackDisplay={showQuizPackDisplay}
          onEndRound={handleEndRound}
          leftSidebarWidth={sidebarWidth}
          onGlobalScrambleKeypad={handleGlobalScrambleKeypad}
          scoresHidden={scoresHidden}
          onToggleHideScores={handleToggleHideScores}
          teamLayoutMode={teamLayoutMode}
          onChangeTeamLayout={handleChangeTeamLayout}
          hostControllerEnabled={hostControllerEnabled}
          onToggleHostController={handleToggleHostController}
          teams={quizzes}
          onOpenBuzzersManagement={handleOpenBuzzersManagement}
        />
      </div>

      {/* Delete Team Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{teamToDelete?.name}</strong> (Score: {teamToDelete?.score})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (teamToDelete) {
                  setQuizzes(prevQuizzes =>
                    prevQuizzes.filter(quiz => quiz.id !== teamToDelete.id)
                  );
                  setShowDeleteConfirm(false);
                  setTeamToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
