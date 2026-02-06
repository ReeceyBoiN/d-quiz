import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Star, Zap, Grid3X3, Skull, ArrowLeft, Type, BarChart3, Hash, Timer, Eye, RotateCcw, CheckCircle } from "lucide-react";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { useSettings } from "../utils/SettingsContext";
import { TimerProgressBar } from "./TimerProgressBar";
import { playCountdownAudio, stopCountdownAudio } from "../utils/countdownAudio";
import { playApplauseSound, playFailSound } from "../utils/audioUtils";
import { sendTimeUpToPlayers } from "../network/wsHost";

interface LoadedQuestion {
  type: string;
  q: string;
  options?: string[];
  correctIndex?: number;
  imageDataUrl?: string;
  answerText?: string;
}

interface KeypadInterfaceProps {
  onBack: () => void;
  onHome?: () => void; // Add home navigation prop
  externalWindow?: Window | null; // External display window
  onExternalDisplayUpdate?: (mode: string, data?: any) => void; // External display update function
  teams?: Array<{id: string, name: string, score?: number}>; // Teams data for simulation
  teamAnswers?: {[teamId: string]: string}; // Team answers from parent (for results display)
  onTeamAnswerUpdate?: (answers: {[teamId: string]: string}) => void; // Team answer update callback
  onTeamResponseTimeUpdate?: (responseTimes: {[teamId: string]: number}) => void; // Team response time update callback
  onAwardPoints?: (correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string) => void; // Award points callback
  onEvilModePenalty?: (wrongTeamIds: string[], noAnswerTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner") => void; // Evil Mode penalty callback
  currentRoundPoints?: number; // Current round points (shared with bottom navigation)
  currentRoundSpeedBonus?: number; // Current round speed bonus (shared with bottom navigation)
  onCurrentRoundPointsChange?: (points: number) => void; // Callback to update current round points
  onCurrentRoundSpeedBonusChange?: (speedBonus: number) => void; // Callback to update current round speed bonus
  onTimerStateChange?: (isRunning: boolean, timeRemaining: number, totalTime: number) => void; // Timer state callback
  onTimerLockChange?: (isLocked: boolean) => void; // Timer lock state callback
  onFastestTeamReveal?: (fastestTeam: { team: any; responseTime: number }) => void; // Callback for fastest team reveal
  triggerNextQuestion?: number; // Trigger to advance to next question (increment to trigger)
  onAnswerStatusUpdate?: (correctAnswer: string | null, questionType: string | null) => void; // Callback for answer status updates
  loadedQuestions?: LoadedQuestion[]; // Loaded questions from .sqq file
  currentQuestionIndex?: number; // Current question index from loaded quiz
  onQuestionComplete?: () => void; // Callback when a question is completed
  isQuizPackMode?: boolean; // Is this in quiz pack mode with pre-loaded answers
  onGetActionHandlers?: (handlers: { reveal: () => void; nextQuestion: () => void; startTimer: () => void; silentTimer: () => void; revealFastestTeam: () => void }) => void; // Pass action handlers to parent for nav bar
  onGameTimerStateChange?: (isTimerRunning: boolean) => void; // Notify parent of timer state changes
  onCurrentScreenChange?: (screen: string) => void; // Notify parent of current screen changes
  onGameTimerUpdate?: (timeRemaining: number, totalTime: number) => void; // Notify parent of timer values for nav bar
  onGameTimerFinished?: (finished: boolean) => void; // Notify parent when on-the-spot timer finishes
  onGameAnswerRevealed?: (revealed: boolean) => void; // Notify parent when answer is revealed
  onGameFastestRevealed?: (revealed: boolean) => void; // Notify parent when fastest team is revealed
  onTeamsAnsweredCorrectly?: (hasCorrectAnswers: boolean) => void; // Notify parent if any teams answered correctly
  onGameAnswerSelected?: (selected: boolean) => void; // Notify parent when user has selected an answer
  onTimerStart?: (startTime: number) => void; // Notify parent when timer starts for response time calculation
}

export function KeypadInterface({
  onBack,
  onHome,
  externalWindow,
  onExternalDisplayUpdate,
  teams = [],
  teamAnswers: parentTeamAnswers = {},
  onTeamAnswerUpdate,
  onTeamResponseTimeUpdate,
  onAwardPoints,
  onEvilModePenalty,
  currentRoundPoints,
  currentRoundSpeedBonus,
  onCurrentRoundPointsChange,
  onCurrentRoundSpeedBonusChange,
  onTimerStateChange,
  onTimerLockChange,
  onFastestTeamReveal,
  triggerNextQuestion = 0,
  onAnswerStatusUpdate,
  onFastTrack,
  loadedQuestions = [],
  currentQuestionIndex = 0,
  onQuestionComplete,
  isQuizPackMode = false,
  onGetActionHandlers,
  onGameTimerStateChange,
  onCurrentScreenChange,
  onGameTimerUpdate,
  onGameTimerFinished,
  onGameAnswerRevealed,
  onGameFastestRevealed,
  onTeamsAnsweredCorrectly,
  onGameAnswerSelected,
  onTimerStart
}: KeypadInterfaceProps) {
  const {
    defaultPoints,
    defaultSpeedBonus,
    goWideEnabled,
    evilModeEnabled,
    updateGoWideEnabled,
    updateEvilModeEnabled,
    staggeredEnabled,
    updateStaggeredEnabled,
    punishmentEnabled,
    updatePunishmentEnabled,
    gameModeTimers,
    voiceCountdown,
    hideQuizPackAnswers
  } = useSettings();
  
  // Use current round scores from props (convert to arrays for slider compatibility)
  // Once current round scores are set, they stay independent of default changes
  const points = useMemo(() => [currentRoundPoints !== null ? currentRoundPoints : defaultPoints], [currentRoundPoints, defaultPoints]);
  const speedBonus = useMemo(() => [currentRoundSpeedBonus !== null ? currentRoundSpeedBonus : defaultSpeedBonus], [currentRoundSpeedBonus, defaultSpeedBonus]);
  const [bonusType, setBonusType] = useState<"fixed" | "sliding">("fixed");
  // goWideEnabled and evilModeEnabled now come from settings context
  const [noAnswerPenalty, setNoAnswerPenalty] = useState(false);
  const [autoDisableTwoOptions, setAutoDisableTwoOptions] = useState(false);
  const [showQuestionTypes, setShowQuestionTypes] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'config' | 'question-types' | 'letters-game' | 'multiple-choice-game' | 'numbers-game' | 'sequence-game' | 'quiz-pack-question' | 'results'>('config');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalTimerLength, setTotalTimerLength] = useState<number>(30); // Track total timer length for progress bar
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [questionType, setQuestionType] = useState<'letters' | 'multiple-choice' | 'numbers' | 'sequence' | null>(null);
  
  // Add state for correct answer revelation
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Track if user has selected an answer
  const [answerSelected, setAnswerSelected] = useState(false);

  // Team simulation state
  const [teamAnswers, setTeamAnswers] = useState<{[teamId: string]: string}>({});
  const [teamAnswerTimes, setTeamAnswerTimes] = useState<{[teamId: string]: number}>({});

  const [timerLocked, setTimerLocked] = useState(false); // Lock state to prevent submissions after timer ends
  
  // Fastest team state
  const [fastestTeamRevealed, setFastestTeamRevealed] = useState(false);
  
  // SHIFT key state for Fast Track feature
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  // No need for local reset function - scores are managed by parent component
  
  // Numbers game state
  const [numbersAnswer, setNumbersAnswer] = useState('');
  const [numbersAnswerConfirmed, setNumbersAnswerConfirmed] = useState(false);

  // Sequence game state
  const [sequenceItems, setSequenceItems] = useState<string[]>([]);
  const [shuffledSequence, setShuffledSequence] = useState<Array<{id: string, item: string}>>([]);
  const [selectedSequence, setSelectedSequence] = useState<string[]>([]);
  const [sequenceCompleted, setSequenceCompleted] = useState(false);

  // Current loaded question state for displaying picture and info
  const [currentLoadedQuestion, setCurrentLoadedQuestion] = useState<LoadedQuestion | null>(null);

  // Timer start tracking for accurate response time calculation
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);

  // Debug mode state for keypad designs
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(0);

  // Track if we've already broadcast the current question to prevent re-broadcasts
  const broadcastedQuestionTypeRef = useRef<string | null>(null);

  // Track the last processed triggerNextQuestion value to prevent duplicate calls
  const lastProcessedTriggerRef = useRef<number>(0);

  // Guard against duplicate reveal calls from simultaneous event handlers
  const answerRevealInProgressRef = useRef<boolean>(false);
  
  // Get keypad design from settings context
  const { keypadDesign } = useSettings();
  
  // Keypad Design Configurations mapped to settings values
  const keypadDesigns = {
    "neon-glow": {
      name: "Neon Glow",
      containerClass: "bg-gray-900 p-4 rounded-2xl border-2 border-cyan-400 shadow-2xl shadow-cyan-400/30",
      gridClass: "grid grid-cols-4 gap-3",
      buttonSize: "h-16 w-16",
      buttonText: "text-xl",
      selectedStyle: "bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg ring-2 ring-pink-400/50 shadow-pink-500/50",
      unselectedStyle: "bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-2 border-cyan-300 shadow-lg shadow-cyan-400/30"
    },
    "gaming-beast": {
      name: "Gaming Beast",
      containerClass: "bg-gradient-to-br from-gray-800 to-black p-4 rounded-xl border-2 border-red-500 shadow-2xl shadow-red-500/30",
      gridClass: "grid grid-cols-4 gap-2.5",
      buttonSize: "h-16 w-16",
      buttonText: "text-xl",
      selectedStyle: "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white shadow-lg ring-2 ring-red-400/70 shadow-red-500/50",
      unselectedStyle: "bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-red-400 border border-red-500/50 shadow-md"
    },
    "matrix-green": {
      name: "Matrix Green",
      containerClass: "bg-black p-3 rounded-lg border-2 border-green-400 shadow-2xl shadow-green-400/20",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-16 w-16",
      buttonText: "text-lg font-mono",
      selectedStyle: "bg-green-400 hover:bg-green-300 text-black shadow-lg ring-2 ring-green-400/70 shadow-green-400/50",
      unselectedStyle: "bg-gray-900 hover:bg-gray-800 text-green-400 border border-green-400/50 shadow-md shadow-green-400/20"
    },
    "bubble-pop": {
      name: "Bubble Pop",
      containerClass: "bg-gradient-to-br from-pink-200 to-purple-200 p-4 rounded-3xl border-4 border-white shadow-xl",
      gridClass: "grid grid-cols-4 gap-3",
      buttonSize: "h-16 w-16",
      buttonText: "text-xl",
      selectedStyle: "bg-gradient-to-br from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white shadow-lg ring-4 ring-orange-300/60 scale-110",
      unselectedStyle: "bg-gradient-to-br from-white to-gray-100 hover:from-gray-50 hover:to-gray-200 text-purple-600 border-2 border-purple-300 shadow-lg"
    },
    "ocean-wave": {
      name: "Ocean Wave",
      containerClass: "bg-gradient-to-br from-blue-400 to-teal-500 p-4 rounded-2xl border-3 border-white shadow-xl",
      gridClass: "grid grid-cols-4 gap-3",
      buttonSize: "h-16 w-16",
      buttonText: "text-lg",
      selectedStyle: "bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg ring-3 ring-yellow-300/70",
      unselectedStyle: "bg-gradient-to-br from-white to-blue-100 hover:from-blue-50 hover:to-blue-200 text-blue-800 border-2 border-blue-300 shadow-md"
    },
    "cyber-chrome": {
      name: "Cyber Chrome",
      containerClass: "bg-gradient-to-br from-gray-300 to-gray-500 p-3 rounded-xl border-2 border-gray-600 shadow-2xl",
      gridClass: "grid grid-cols-4 gap-2",
      buttonSize: "h-16 w-16",
      buttonText: "text-lg",
      selectedStyle: "bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white shadow-lg ring-2 ring-blue-300/70",
      unselectedStyle: "bg-gradient-to-br from-gray-100 to-gray-200 hover:from-white hover:to-gray-100 text-gray-800 border border-gray-400 shadow-md"
    },
    "fire-storm": {
      name: "Fire Storm",
      containerClass: "bg-gradient-to-br from-red-800 to-orange-900 p-4 rounded-2xl border-3 border-yellow-400 shadow-2xl shadow-orange-500/40",
      gridClass: "grid grid-cols-4 gap-3",
      buttonSize: "h-16 w-16",
      buttonText: "text-xl",
      selectedStyle: "bg-gradient-to-br from-yellow-300 to-orange-400 hover:from-yellow-400 hover:to-orange-500 text-red-800 shadow-lg ring-3 ring-yellow-400/80",
      unselectedStyle: "bg-gradient-to-br from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 text-yellow-200 border-2 border-yellow-400/50 shadow-md"
    },
    "cosmic-space": {
      name: "Cosmic Space",
      containerClass: "bg-gradient-to-br from-purple-900 to-indigo-900 p-4 rounded-3xl border-2 border-purple-400 shadow-2xl shadow-purple-500/30",
      gridClass: "grid grid-cols-4 gap-3",
      buttonSize: "h-16 w-16",
      buttonText: "text-xl",
      selectedStyle: "bg-gradient-to-br from-cyan-300 to-blue-400 hover:from-cyan-400 hover:to-blue-500 text-purple-900 shadow-lg ring-3 ring-cyan-300/70 shadow-cyan-400/50",
      unselectedStyle: "bg-gradient-to-br from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-cyan-200 border border-purple-400/50 shadow-md shadow-purple-400/20"
    }
  };
  
  // Get current design configuration from settings
  const currentDesign = keypadDesigns[keypadDesign] || keypadDesigns["neon-glow"];

  // Helper function to get the correct answer (either from user input or pre-loaded data)
  // MUST be defined before useEffect hooks that use it
  // Uses same normalization logic as QuizHost.getAnswerText() to ensure consistent format
  const getCorrectAnswer = useCallback(() => {
    if (isQuizPackMode && currentLoadedQuestion) {
      // For multiple-choice and letters: convert correctIndex to letter (A, B, C, etc.)
      if ((currentLoadedQuestion.type?.toLowerCase() === 'multi' ||
           currentLoadedQuestion.type?.toLowerCase() === 'letters') &&
          currentLoadedQuestion.correctIndex !== undefined) {
        return String.fromCharCode(65 + currentLoadedQuestion.correctIndex);
      }
      // For sequence: return the sequence item at correctIndex
      if (currentLoadedQuestion.type?.toLowerCase() === 'sequence' &&
          currentLoadedQuestion.options &&
          currentLoadedQuestion.correctIndex !== undefined) {
        return currentLoadedQuestion.options[currentLoadedQuestion.correctIndex] || '';
      }
      // For other types: use answerText if available
      if (currentLoadedQuestion.answerText) {
        return currentLoadedQuestion.answerText;
      }
    }
    // Fallback to host's selected answers for on-the-spot mode
    return questionType === 'letters' ? selectedLetter :
           questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
           questionType === 'numbers' ? numbersAnswer : null;
  }, [isQuizPackMode, currentLoadedQuestion, questionType, selectedLetter, selectedAnswers, numbersAnswer]);

  // Handle timer completion and update team answer statuses
  useEffect(() => {
    if (timerFinished && onAnswerStatusUpdate && currentScreen !== 'results') {
      // Use getCorrectAnswer() which handles both quiz pack (uses loaded question's correct answer)
      // and on-the-spot mode (uses host's selected answer from UI)
      const correctAnswer = getCorrectAnswer();
      onAnswerStatusUpdate(correctAnswer, questionType);
    }
  }, [timerFinished, onAnswerStatusUpdate, currentScreen, questionType, getCorrectAnswer]);
  
  // Reset component to initial state when component mounts
  useEffect(() => {
    // Reset all states to initial values to ensure we start on config screen
    setCurrentScreen('config');
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setCurrentQuestion(1);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerFinished(false);
    setTimerLocked(false);
    setQuestionType(null);
    setAnswerRevealed(false);
    setFastestTeamRevealed(false);
    setTeamAnswers({});
    setTeamAnswerTimes({});
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setSequenceItems([]);
    setShuffledSequence([]);
    setSelectedSequence([]);
    setSequenceCompleted(false);
    setShowDebugPanel(false);
    setSelectedDesign(0);

    // Clear parent component state as well
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    if (onTeamResponseTimeUpdate) {
      onTeamResponseTimeUpdate({});
    }
    if (onAnswerStatusUpdate) {
      onAnswerStatusUpdate(null, null);
    }
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    // Cleanup: stop countdown audio when component unmounts
    return () => {
      stopCountdownAudio();
    };
  }, []); // Empty dependency array means this runs once on mount

  // Update currentLoadedQuestion when loaded questions or index changes
  useEffect(() => {
    if (loadedQuestions && loadedQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < loadedQuestions.length) {
      setCurrentLoadedQuestion(loadedQuestions[currentQuestionIndex]);
    }
  }, [loadedQuestions, currentQuestionIndex]);

  // Track previous isQuizPackMode value to detect mode transitions
  const prevIsQuizPackModeRef = useRef(isQuizPackMode);

  // Calculate actual results based on team answers and correct answer
  // Use parent's teamAnswers (includes network player answers) instead of local state
  const calculateAnswerStats = useCallback(() => {
    const answersToUse = parentTeamAnswers && Object.keys(parentTeamAnswers).length > 0 ? parentTeamAnswers : teamAnswers;

    if (!answersToUse || Object.keys(answersToUse).length === 0) {
      return { correct: 0, wrong: 0, noAnswer: teams.length };
    }

    const correctAnswer = getCorrectAnswer();

    if (!correctAnswer) {
      return { correct: 0, wrong: 0, noAnswer: teams.length };
    }

    let correct = 0;
    let wrong = 0;
    let noAnswer = 0;

    teams.forEach(team => {
      const teamAnswer = answersToUse[team.id];

      if (!teamAnswer || teamAnswer.trim() === '') {
        noAnswer++;
      } else if (questionType === 'letters' && teamAnswer === correctAnswer) {
        correct++;
      } else if (questionType === 'multiple-choice' && teamAnswer === correctAnswer) {
        correct++;
      } else if (questionType === 'numbers' && teamAnswer === correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    return { correct, wrong, noAnswer };
  }, [parentTeamAnswers, teamAnswers, teams, questionType, getCorrectAnswer]);

  // Find the fastest team that answered correctly
  const getFastestCorrectTeam = useCallback(() => {
    const answersToUse = parentTeamAnswers && Object.keys(parentTeamAnswers).length > 0 ? parentTeamAnswers : teamAnswers;

    if (!answersToUse || Object.keys(answersToUse).length === 0) {
      return null;
    }

    const correctAnswer = getCorrectAnswer();

    if (!correctAnswer) {
      return null;
    }

    const correctTeams = teams.filter(team => {
      const teamAnswer = answersToUse[team.id];
      return teamAnswer && (
        (questionType === 'letters' && teamAnswer === correctAnswer) ||
        (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
        (questionType === 'numbers' && teamAnswer === correctAnswer)
      );
    });

    if (correctTeams.length === 0) {
      return null;
    }

    // Find the team with the shortest answer time
    let fastestTeam = correctTeams[0];
    let fastestTime = teamAnswerTimes[fastestTeam.id] || Infinity;

    correctTeams.forEach(team => {
      const teamTime = teamAnswerTimes[team.id] || Infinity;
      if (teamTime < fastestTime) {
        fastestTime = teamTime;
        fastestTeam = team;
      }
    });

    return {
      team: fastestTeam,
      responseTime: fastestTime
    };
  }, [teamAnswers, teamAnswerTimes, teams, questionType, getCorrectAnswer, parentTeamAnswers]);

  // Helper function to get the question type label
  const getQuestionTypeLabel = (type: string | null): string => {
    if (!type) return 'Question';
    const t = type.toLowerCase();
    switch (t) {
      case 'letters':
        return 'Letters Question';
      case 'multiple-choice':
      case 'multi':
        return 'Multiple Choice Question';
      case 'numbers':
      case 'nearest':
        return 'Numbers Question';
      case 'sequence':
        return 'Sequence Question';
      case 'buzzin':
        return 'Buzz In Question';
      default:
        return type;
    }
  };

  const handleQuestionTypeSelect = useCallback((type: 'letters' | 'multiple-choice' | 'numbers' | 'sequence') => {
    setQuestionType(type);

    // Setup sequence game items if it's a sequence question with loaded data
    if (type === 'sequence' && currentLoadedQuestion?.options && currentLoadedQuestion.options.length > 0) {
      const items = [...currentLoadedQuestion.options];
      setSequenceItems(items);

      // Shuffle items for display
      const shuffled = items
        .map((item, idx) => ({ id: `seq-${idx}`, item }))
        .sort(() => Math.random() - 0.5);
      setShuffledSequence(shuffled);
    }

    if (isQuizPackMode) {
      // In quiz pack mode, skip the game input screen and go straight to question display
      setCurrentScreen('quiz-pack-question');
    } else if (type === 'letters') {
      setCurrentScreen('letters-game');
    } else if (type === 'multiple-choice') {
      setCurrentScreen('multiple-choice-game');
    } else if (type === 'numbers') {
      setCurrentScreen('numbers-game');
    } else if (type === 'sequence') {
      setCurrentScreen('sequence-game');
    }

    // Guard against re-broadcasting the same question type multiple times
    // Only broadcast if this is a NEW question type (not previously broadcast)
    if (broadcastedQuestionTypeRef.current !== type) {
      broadcastedQuestionTypeRef.current = type;

      // Now that a valid question type is selected, broadcast the question to player devices
      try {
        // Generate placeholder options based on question type
        let placeholderOptions: string[] = [];
        if (type === 'letters') {
          // For letters, generate 26 placeholder options (one for each letter)
          placeholderOptions = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
        } else if (type === 'numbers') {
          // For numbers, generate 10 placeholder options (digits 0-9)
          placeholderOptions = Array.from({ length: 10 }, (_, i) => String(i));
        } else if (type === 'multiple-choice') {
          // For multiple choice, generate 6 placeholder options
          placeholderOptions = Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i));
        } else if (type === 'sequence') {
          // For sequence, generate 6 placeholder options
          placeholderOptions = Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i));
        }

        console.log('[Keypad] Broadcasting question type:', type, 'with', placeholderOptions.length, 'options:', placeholderOptions);

        (window as any).api?.ipc?.invoke('network/broadcast-question', {
          question: {
            type: type,
            text: 'Question is ready...',
            options: placeholderOptions,
            timestamp: Date.now()
          }
        }).catch((error: any) => {
          console.warn('[Keypad] Failed to broadcast question to players:', error);
        });
      } catch (err) {
        console.warn('[Keypad] Error calling broadcast-question IPC:', err);
      }
    } else {
      console.log('[Keypad] Question type:', type, 'already broadcast, skipping re-broadcast');
    }

    const pointValue = points[0];
    const bonusValue = speedBonus[0];
    console.log("Starting keypad round with:", {
      points: pointValue,
      speedBonus: bonusValue,
      bonusType,
      goWideEnabled,
      evilModeEnabled,
      questionType: type
    });
  }, [currentLoadedQuestion, isQuizPackMode, points, speedBonus, bonusType, goWideEnabled, evilModeEnabled]);

  const handleStartRound = useCallback(() => {
    // Only auto-detect question type in QUIZ PACK MODE
    // In on-the-spot mode, we ALWAYS show the question-types screen for manual selection
    if (isQuizPackMode && loadedQuestions && loadedQuestions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < loadedQuestions.length) {
      const question = loadedQuestions[currentQuestionIndex];

      // Auto-detect question type
      if (question.type === 'letters') {
        handleQuestionTypeSelect('letters');
      } else if (question.type === 'multi') {
        handleQuestionTypeSelect('multiple-choice');
      } else if (question.type === 'numbers' || question.type === 'nearest') {
        handleQuestionTypeSelect('numbers');
      } else if (question.type === 'sequence') {
        handleQuestionTypeSelect('sequence');
      } else {
        // Fallback to question-types screen if type is not recognized
        setCurrentScreen('question-types');
      }
    } else {
      // Show question-types screen for manual selection in on-the-spot mode OR if no loaded questions
      // Reset question type to ensure fresh selection in on-the-spot mode
      setQuestionType(null);
      setCurrentScreen('question-types');
    }

    // Send questionWaiting to external display when starting round
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('questionWaiting', {
        questionInfo: {
          number: currentQuestion,
          type: 'Question',
          total: 0
        }
      });
    }
  }, [isQuizPackMode, loadedQuestions, currentQuestionIndex, externalWindow, onExternalDisplayUpdate, currentQuestion, handleQuestionTypeSelect]);

  // Auto-start quiz pack mode (moved here to be after handleStartRound is defined)
  useEffect(() => {
    // Only auto-start when:
    // 1. Currently in quiz pack mode
    // 2. On the config screen (NOT question-types or game screens)
    // 3. Have loaded questions
    // Avoid running the effect when transitioning FROM quiz pack mode to on-the-spot
    // Also prevent auto-start if on question-types screen - that's for manual selection
    if (isQuizPackMode && currentScreen === 'config' && loadedQuestions && loadedQuestions.length > 0) {
      console.log('[KeypadInterface] Auto-starting quiz pack round from config screen');
      handleStartRound();
    }

    // Update the ref to track current mode for next effect run
    prevIsQuizPackModeRef.current = isQuizPackMode;
  }, [isQuizPackMode, currentScreen, loadedQuestions, handleStartRound]);

  const handleBackFromQuestionTypes = () => {
    setCurrentScreen('config');
  };

  const handleBackFromGame = () => {
    // Stop countdown audio if timer is running
    stopCountdownAudio();

    // Reset broadcast guard for next question selection
    broadcastedQuestionTypeRef.current = null;
    console.log('[KeypadInterface] Reset broadcast guard when going back from game');

    setCurrentScreen('question-types');
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setSequenceItems([]);
    setShuffledSequence([]);
    setSelectedSequence([]);
    setSequenceCompleted(false);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerFinished(false);
    setTimerLocked(false); // Reset timer lock when going back

    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    setAnswerRevealed(false);
    setFastestTeamRevealed(false);
    setTeamAnswers({});
    setTeamAnswerTimes({});

    // Broadcast NEXT message to tell player portal to clear the question and display selection screen instead
    try {
      (window as any).api?.ipc?.invoke('network/broadcast-next', {
        timestamp: Date.now()
      }).catch((error: any) => {
        console.warn('[Keypad] Failed to broadcast next to players:', error);
      });
    } catch (err) {
      console.warn('[Keypad] Error calling broadcast-next IPC:', err);
    }
  };

  const handleLetterSelect = (letter: string) => {
    setSelectedLetter(letter);
  };

  const handleKeypadInput = (digit: string) => {
    if (!numbersAnswerConfirmed) {
      setNumbersAnswer(prev => prev + digit);
    }
  };

  const handleSequenceItemClick = (itemId: string) => {
    if (sequenceCompleted) return;

    const item = shuffledSequence.find(s => s.id === itemId);
    if (!item) return;

    const newSelected = [...selectedSequence, itemId];
    setSelectedSequence(newSelected);

    if (newSelected.length === shuffledSequence.length) {
      setSequenceCompleted(true);
    }
  };

  const handleSequenceUndo = () => {
    if (!sequenceCompleted) {
      setSelectedSequence(prev => prev.slice(0, -1));
    }
  };

  const handleSequenceReset = () => {
    setSelectedSequence([]);
    setSequenceCompleted(false);
  };



  const handleStartTimer = useCallback(() => {
    // Can now start timer without requiring an answer first
    const timerLength = gameModeTimers.keypad;
    setTotalTimerLength(timerLength); // Set total timer length for progress bar
    setIsTimerRunning(true);
    setTimerFinished(false);
    const now = Date.now();
    setTimerStartTime(now); // Capture timer start time for accurate response time calculation

    // Notify parent about timer start time for response time calculation
    if (onTimerStart) {
      onTimerStart(now);
    }

    setTimerLocked(false); // Unlock timer when starting

    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    setCountdown(timerLength);

    // Notify parent about timer state
    if (onTimerStateChange) {
      onTimerStateChange(true, timerLength, timerLength);
    }



    // Send timer to external display if available
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('timer', {
        timerValue: timerLength,
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' :
                questionType === 'multiple-choice' ? 'Multiple Choice' :
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        },
        gameMode: 'keypad'
      });
    }

    // Play countdown audio - normal timer with sound (voice countdown if enabled)
    playCountdownAudio(timerLength, false).catch(error => {
      console.error('[Keypad] Error playing countdown audio:', error);
    });

    // Start the countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;

        const newValue = prev - 1;

        // Notify parent about timer state change
        if (onTimerStateChange) {
          onTimerStateChange(true, newValue, gameModeTimers.keypad);
        }

        // Update external display with new timer value
        if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
          onExternalDisplayUpdate('timer', {
            timerValue: newValue < 0 ? 0 : newValue,
            questionInfo: {
              number: currentQuestion,
              type: questionType === 'letters' ? 'Letters Question' :
                    questionType === 'multiple-choice' ? 'Multiple Choice' :
                    questionType === 'numbers' ? 'Numbers Question' : 'Question',
              total: 0
            },
            gameMode: 'keypad'
          });
        }

        if (newValue < 0) {
          clearInterval(timer);

          // Delay stopping audio to let the final part of the countdown audio play ("Time's up" message)
          // Audio plays for timerLength + 1 seconds, but countdown finishes at timerLength seconds
          // So we need to wait ~1 second for the audio to finish
          setTimeout(() => {
            stopCountdownAudio();
          }, 1100);

          setIsTimerRunning(false);
          setCountdown(null);

          // Lock the timer to prevent any further submissions
          setTimerLocked(true);

          // Notify parent component about timer lock
          if (onTimerLockChange) {
            onTimerLockChange(true);
          }

          // Notify players that time is up
          sendTimeUpToPlayers();

          // Log the appropriate answer based on current screen
          const answer = currentScreen === 'letters-game'
            ? selectedLetter
            : currentScreen === 'multiple-choice-game'
              ? selectedAnswers.join(', ')
              : 'unknown';
          console.log("Timer finished for question", currentQuestion, "with answer:", answer);
          setTimerFinished(true);

          // Reset external display to basic mode when timer finishes
          if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
            onExternalDisplayUpdate('basic');
          }

          return null;
        }

        return newValue;
      });
    }, 1000);
  }, [gameModeTimers, voiceCountdown, onTimerLockChange, onTimerStateChange, externalWindow, onExternalDisplayUpdate, currentQuestion, questionType, currentScreen, selectedLetter, selectedAnswers]);

  const handleShowResults = useCallback(() => {
    setCurrentScreen('results');

    // Send placeholder to external display (don't reveal answer yet)
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      const stats = calculateAnswerStats();
      onExternalDisplayUpdate('correctAnswer', {
        correctAnswer: 'The correct answer is...',
        question: `Question ${currentQuestion}`,
        questionType: questionType,
        revealed: false,
        stats: stats,
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' :
                questionType === 'multiple-choice' ? 'Multiple Choice' :
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        }
      });
    }
  }, [externalWindow, onExternalDisplayUpdate, calculateAnswerStats, currentQuestion, questionType]);

  // Add function to handle silent timer (no countdown audio)
  const handleSilentTimer = useCallback(() => {
    // Can now start timer without requiring an answer first
    const timerLength = gameModeTimers.keypad;
    setTotalTimerLength(timerLength); // Set total timer length for progress bar
    setIsTimerRunning(true);
    setTimerFinished(false);
    const now = Date.now();
    setTimerStartTime(now); // Capture timer start time for accurate response time calculation

    // Notify parent about timer start time for response time calculation
    if (onTimerStart) {
      onTimerStart(now);
    }

    setTimerLocked(false); // Unlock timer when starting

    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    setCountdown(timerLength);

    // Notify parent about timer state
    if (onTimerStateChange) {
      onTimerStateChange(true, timerLength, timerLength);
    }

    // Send timer to external display if available
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('timer', {
        timerValue: timerLength,
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' :
                questionType === 'multiple-choice' ? 'Multiple Choice' :
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        },
        gameMode: 'keypad'
      });
    }

    // Play countdown audio - SILENT version (no countdown beeps/voice)
    playCountdownAudio(timerLength, true).catch(error => {
      console.error('[Keypad] Error playing silent countdown audio:', error);
    });

    // Start the countdown (identical to handleStartTimer)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;

        const newValue = prev - 1;

        // Notify parent about timer state change
        if (onTimerStateChange) {
          onTimerStateChange(true, newValue, gameModeTimers.keypad);
        }

        // Update external display with new timer value
        if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
          onExternalDisplayUpdate('timer', {
            timerValue: newValue < 0 ? 0 : newValue,
            questionInfo: {
              number: currentQuestion,
              type: questionType === 'letters' ? 'Letters Question' :
                    questionType === 'multiple-choice' ? 'Multiple Choice' :
                    questionType === 'numbers' ? 'Numbers Question' : 'Question',
              total: 0
            },
            gameMode: 'keypad'
          });
        }

        if (newValue < 0) {
          clearInterval(timer);

          // Delay stopping audio to let the final part of the countdown audio play
          setTimeout(() => {
            stopCountdownAudio();
          }, 1100);

          setIsTimerRunning(false);
          setCountdown(null);

          // Lock the timer to prevent any further submissions
          setTimerLocked(true);

          // Notify parent component about timer lock
          if (onTimerLockChange) {
            onTimerLockChange(true);
          }

          // Notify players that time is up
          sendTimeUpToPlayers();

          // Log the appropriate answer based on current screen
          const answer = currentScreen === 'letters-game'
            ? selectedLetter
            : currentScreen === 'multiple-choice-game'
            ? selectedAnswers[0]
            : currentScreen === 'numbers-game'
            ? numbersAnswer
            : null;

          if (answer) {
            setTeamAnswers(prev => ({
              ...prev,
              'host': answer
            }));

            // Capture answer time
            // Calculate response time from timer start
            // If timerStartTime is null, this means the answer was submitted before timer started (pre-timer)
            // In that case, responseTime = Date.now() - Date.now() = 0, which is correct
            const responseTime = Date.now() - (timerStartTime || Date.now());
            setTeamAnswerTimes(prev => ({
              ...prev,
              'host': responseTime
            }));
            console.log('[KeypadInterface] Host answer time calculated: timerStartTime =', timerStartTime, ', responseTime =', responseTime, 'ms (', (responseTime / 1000).toFixed(2), 's)');
          }

          setTimerFinished(true);

          // Notify parent component about timer finished
          if (onGameTimerFinished) {
            onGameTimerFinished(true);
          }

          // Send placeholder to external display (don't reveal answer yet)
          if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
            const stats = calculateAnswerStats();
            onExternalDisplayUpdate('correctAnswer', {
              correctAnswer: 'The correct answer is...',
              question: `Question ${currentQuestion}`,
              questionType: questionType,
              revealed: false,
              stats: stats,
              questionInfo: {
                number: currentQuestion,
                type: questionType === 'letters' ? 'Letters Question' :
                      questionType === 'multiple-choice' ? 'Multiple Choice' :
                      questionType === 'numbers' ? 'Numbers Question' : 'Question',
                total: 0
              }
            });
          }
        }

        return newValue;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameModeTimers, onTimerStart, onTimerLockChange, onTimerStateChange, externalWindow, onExternalDisplayUpdate, currentQuestion, questionType, currentScreen, selectedLetter, selectedAnswers, numbersAnswer, timerStartTime, onGameTimerFinished, calculateAnswerStats]);

  // Add function to handle revealing the correct answer
  const handleRevealAnswer = useCallback(() => {
    console.log('[KeypadInterface] handleRevealAnswer called');

    // Guard against duplicate calls from simultaneous event handlers (spacebar + nav button)
    if (answerRevealInProgressRef.current) {
      console.log('[KeypadInterface] handleRevealAnswer already in progress, skipping duplicate call');
      return;
    }

    answerRevealInProgressRef.current = true;
    console.log('[KeypadInterface] onAwardPoints callback exists:', !!onAwardPoints);
    console.log('[KeypadInterface] onEvilModePenalty callback exists:', !!onEvilModePenalty);

    setAnswerRevealed(true);

    // Award points to teams that answered correctly
    if (onAwardPoints) {
      const correctAnswer = getCorrectAnswer();
      console.log('[KeypadInterface] Correct answer:', correctAnswer);
      console.log('[KeypadInterface] Question type:', questionType);
      console.log('[KeypadInterface] Total teams:', teams.length);

      // Use parentTeamAnswers (includes network players) instead of local teamAnswers
      const answersToCheck = parentTeamAnswers && Object.keys(parentTeamAnswers).length > 0 ? parentTeamAnswers : teamAnswers;
      console.log('[KeypadInterface] Team answers being used:', answersToCheck);
      console.log('[KeypadInterface] ParentTeamAnswers available:', parentTeamAnswers);

      if (correctAnswer) {
        const correctTeamIds = teams.filter(team => {
          const teamAnswer = answersToCheck[team.id];
          const isCorrect = teamAnswer && (
            (questionType === 'letters' && teamAnswer === correctAnswer) ||
            (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
            (questionType === 'numbers' && teamAnswer === correctAnswer)
          );
          console.log(`[KeypadInterface] Team ${team.id} (${team.name}): answer="${teamAnswer}", correct=${isCorrect}`);
          return isCorrect;
        }).map(team => team.id);

        console.log('[KeypadInterface] Correct team IDs:', correctTeamIds);
        const fastestTeam = getFastestCorrectTeam();
        const fastestTeamId = fastestTeam ? fastestTeam.team.id : undefined;
        console.log('[KeypadInterface] Fastest team:', fastestTeamId);

        console.log('[KeypadInterface] Calling onAwardPoints with:', { correctTeamIds, fastestTeamId });
        onAwardPoints(correctTeamIds, 'keypad', fastestTeamId, teamAnswerTimes, true);
        console.log('[KeypadInterface] onAwardPoints called successfully');

        // Apply Evil Mode penalties if enabled
        if (onEvilModePenalty && (evilModeEnabled || punishmentEnabled)) {
          console.log('[KeypadInterface] Applying Evil Mode penalties');
          const wrongTeamIds = teams.filter(team => {
            const teamAnswer = answersToCheck[team.id];
            // Team answered but got it wrong
            return teamAnswer && teamAnswer.trim() !== '' && !(
              (questionType === 'letters' && teamAnswer === correctAnswer) ||
              (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
              (questionType === 'numbers' && teamAnswer === correctAnswer)
            );
          }).map(team => team.id);

          const noAnswerTeamIds = teams.filter(team => {
            const teamAnswer = answersToCheck[team.id];
            // Team didn't answer or gave empty answer
            return !teamAnswer || teamAnswer.trim() === '';
          }).map(team => team.id);

          console.log('[KeypadInterface] Wrong team IDs:', wrongTeamIds);
          console.log('[KeypadInterface] No-answer team IDs:', noAnswerTeamIds);
          onEvilModePenalty(wrongTeamIds, noAnswerTeamIds, 'keypad');
        } else {
          console.log('[KeypadInterface] Evil Mode penalty skipped - onEvilModePenalty exists:', !!onEvilModePenalty, 'evilModeEnabled:', evilModeEnabled, 'punishmentEnabled:', punishmentEnabled);
        }
      } else {
        console.log('[KeypadInterface] No correct answer found, skipping point awards');
      }
    } else {
      console.log('[KeypadInterface] onAwardPoints callback not available, skipping point awards');
    }

    // Send correct answer to external display with stats
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      const answer = getCorrectAnswer() || 'Unknown';
      const stats = calculateAnswerStats();
      const fastestTeam = getFastestCorrectTeam();

      onExternalDisplayUpdate('correctAnswer', {
        correctAnswer: answer,
        question: `Question ${currentQuestion}`,
        questionType: questionType,
        revealed: true,
        stats: stats,
        fastestTeam: fastestTeam,
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' :
                questionType === 'multiple-choice' ? 'Multiple Choice' :
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        }
      });
    }

    // Broadcast reveal to player devices
    if ((window as any).api?.network?.broadcastReveal) {
      try {
        const answer = getCorrectAnswer() || '';
        const revealData = {
          answer: answer,
          correctIndex: isQuizPackMode ? currentLoadedQuestion?.correctIndex : undefined,
          type: questionType,
          selectedAnswers: []
        };
        console.log('[KeypadInterface] Broadcasting reveal to players:', revealData);
        (window as any).api.network.broadcastReveal(revealData);
      } catch (err) {
        console.error('[KeypadInterface] Error broadcasting reveal:', err);
      }
    }

    // Sound playback is now handled by QuizHost to centralize all audio logic

    // Reset guard after reveal is complete to allow future reveals
    // 500ms timeout allows state updates to settle before allowing another reveal
    setTimeout(() => {
      answerRevealInProgressRef.current = false;
      console.log('[KeypadInterface] Reset answerRevealInProgressRef after reveal completion');
    }, 500);
  }, [externalWindow, onExternalDisplayUpdate, calculateAnswerStats, getFastestCorrectTeam, currentQuestion, onAwardPoints, onEvilModePenalty, evilModeEnabled, punishmentEnabled, teams, teamAnswers, teamAnswerTimes, getCorrectAnswer, questionType, isQuizPackMode, currentLoadedQuestion?.correctIndex, parentTeamAnswers]);

  // Add function to handle revealing the fastest team
  const handleRevealFastestTeam = useCallback(() => {
    setFastestTeamRevealed(true);

    const fastestTeamData = getFastestCorrectTeam();

    // Send fastest team data to parent for main display
    if (onFastestTeamReveal && fastestTeamData) {
      onFastestTeamReveal(fastestTeamData);
    }

    // Broadcast fastest team to player devices
    if ((window as any).api?.network?.broadcastFastest && fastestTeamData) {
      try {
        const fastestData = {
          teamName: fastestTeamData.team.name,
          questionNumber: currentQuestion,
          teamPhoto: fastestTeamData.team.photoUrl || null
        };
        console.log('[KeypadInterface] Broadcasting fastest team to players:', fastestData);
        (window as any).api.network.broadcastFastest(fastestData);
      } catch (err) {
        console.error('[KeypadInterface] Error broadcasting fastest team:', err);
      }
    }

    // Send fastest team reveal to external display
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('fastestTeam', {
        fastestTeam: fastestTeamData ? fastestTeamData.team : null,
        responseTime: fastestTeamData ? fastestTeamData.responseTime : null,
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' :
                questionType === 'multiple-choice' ? 'Multiple Choice' :
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        }
      });
    }
  }, [externalWindow, onExternalDisplayUpdate, getFastestCorrectTeam, currentQuestion, questionType, onFastestTeamReveal]);

  // Add function to handle Fast Track - puts team in first place with 1 point lead
  const handleFastTrack = useCallback(() => {
    setFastestTeamRevealed(true);
    
    const fastestTeamData = getFastestCorrectTeam();
    
    if (fastestTeamData && onFastTrack) {
      // Call Fast Track function to put team in first place
      onFastTrack(fastestTeamData.team.id);
    }
    
    // Send fastest team data to parent for main display
    if (onFastestTeamReveal && fastestTeamData) {
      onFastestTeamReveal(fastestTeamData);
    }
    
    // Send FAST TRACK reveal to external display with special flag
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('fastTrack', {
        fastestTeam: fastestTeamData ? fastestTeamData.team : null,
        responseTime: fastestTeamData ? fastestTeamData.responseTime : null,
        fastTracked: true, // Special flag for Fast Track mode
        questionInfo: {
          number: currentQuestion,
          type: questionType === 'letters' ? 'Letters Question' : 
                questionType === 'multiple-choice' ? 'Multiple Choice' : 
                questionType === 'numbers' ? 'Numbers Question' : 'Question',
          total: 0
        }
      });
    }
  }, [externalWindow, onExternalDisplayUpdate, getFastestCorrectTeam, currentQuestion, questionType, onFastestTeamReveal, onFastTrack]);

  const handleNextQuestion = useCallback(() => {
    // Reset all states for next question
    const nextQuestionNumber = currentQuestion + 1;
    setCurrentQuestion(nextQuestionNumber);
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setTimerFinished(false);
    setTimerLocked(false); // Reset timer lock for next question
    setTimerStartTime(null); // Reset timer start time for next question

    // Reset broadcast guard to allow broadcasting the next question type
    broadcastedQuestionTypeRef.current = null;
    console.log('[KeypadInterface] Reset broadcast guard for next question');

    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    setAnswerRevealed(false); // Reset answer revelation state
    setFastestTeamRevealed(false); // Reset fastest team revelation state
    setTeamAnswers({}); // Reset team answers
    setTeamAnswerTimes({}); // Reset team answer times
    setCurrentScreen('question-types');
    setQuestionType(null);

    // Clear parent component state as well
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    if (onTeamResponseTimeUpdate) {
      onTeamResponseTimeUpdate({});
    }

    // Clear team answer statuses for next question
    if (onAnswerStatusUpdate) {
      onAnswerStatusUpdate(null, null);
    }

    // No need to reset points - they remain available for the current round

    // Send questionWaiting to external display for next question
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('questionWaiting', {
        questionInfo: {
          number: nextQuestionNumber,
          type: 'Question',
          total: 0
        }
      });
    }
  }, [currentQuestion, onTimerLockChange, onTeamAnswerUpdate, onTeamResponseTimeUpdate, onAnswerStatusUpdate, externalWindow, onExternalDisplayUpdate]);

  // Handle navigation to previous question
  const handlePreviousQuestion = useCallback(() => {
    // Reset all states for previous question
    const previousQuestionNumber = currentQuestion - 1;
    setCurrentQuestion(previousQuestionNumber);
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setTimerFinished(false);
    setTimerLocked(false); // Reset timer lock for previous question
    setTimerStartTime(null); // Reset timer start time for previous question

    // Reset broadcast guard to allow broadcasting the previous question type
    broadcastedQuestionTypeRef.current = null;
    console.log('[KeypadInterface] Reset broadcast guard for previous question');

    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }

    setAnswerRevealed(false); // Reset answer revelation state
    setFastestTeamRevealed(false); // Reset fastest team revelation state
    setTeamAnswers({}); // Reset team answers
    setTeamAnswerTimes({}); // Reset team answer times
    setCurrentScreen('question-types');
    setQuestionType(null);

    // Clear parent component state as well
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    if (onTeamResponseTimeUpdate) {
      onTeamResponseTimeUpdate({});
    }

    // Clear team answer statuses for previous question
    if (onAnswerStatusUpdate) {
      onAnswerStatusUpdate(null, null);
    }

    // Send questionWaiting to external display for previous question
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('questionWaiting', {
        questionInfo: {
          number: previousQuestionNumber,
          type: 'Question',
          total: 0
        }
      });
    }
  }, [currentQuestion, onTimerLockChange, onTeamAnswerUpdate, onTeamResponseTimeUpdate, onAnswerStatusUpdate, externalWindow, onExternalDisplayUpdate]);

  // Watch for external trigger to advance to next question
  useEffect(() => {
    // Only process if trigger has changed to a new value (increment)
    // This prevents the effect from calling handleNextQuestion multiple times
    if (triggerNextQuestion > lastProcessedTriggerRef.current) {
      console.log('[KeypadInterface] Processing triggerNextQuestion:', triggerNextQuestion);
      lastProcessedTriggerRef.current = triggerNextQuestion;
      handleNextQuestion();
    }
  }, [triggerNextQuestion, handleNextQuestion]);

  // Create smart reveal handler that knows whether to reveal answer or fastest team
  const handleReveal = useCallback(() => {
    console.log('[KeypadInterface] handleReveal called, answerRevealed:', answerRevealed);
    if (!answerRevealed) {
      // Answer not revealed yet - reveal the answer
      console.log('[KeypadInterface] Calling handleRevealAnswer from handleReveal');
      handleRevealAnswer();
    } else if (!fastestTeamRevealed && getFastestCorrectTeam()) {
      // Answer already revealed, fastest team not revealed yet - reveal fastest team
      console.log('[KeypadInterface] Calling handleRevealFastestTeam from handleReveal');
      handleRevealFastestTeam();
    } else {
      console.log('[KeypadInterface] No action taken in handleReveal - answerRevealed:', answerRevealed, 'fastestTeamRevealed:', fastestTeamRevealed);
    }
  }, [answerRevealed, fastestTeamRevealed, handleRevealAnswer, handleRevealFastestTeam, getFastestCorrectTeam]);

  // Expose action handlers to parent for nav bar integration
  useEffect(() => {
    if (onGetActionHandlers) {
      onGetActionHandlers({
        reveal: handleReveal,
        nextQuestion: handleNextQuestion,
        startTimer: handleStartTimer,
        silentTimer: handleSilentTimer,
        revealFastestTeam: handleRevealFastestTeam,
        previousQuestion: handlePreviousQuestion,
      });
    }
  }, [onGetActionHandlers, handleReveal, handleNextQuestion, handleStartTimer, handleSilentTimer, handleRevealFastestTeam, handlePreviousQuestion]);

  // Add home navigation to any nested screen
  const handleHomeNavigation = () => {
    // Reset question number when going back to home
    setCurrentQuestion(1);
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setTimerFinished(false);
    setTimerLocked(false); // Reset timer lock when going home
    setAnswerRevealed(false);
    setFastestTeamRevealed(false);
    setTeamAnswers({});
    setTeamAnswerTimes({});
    setCurrentScreen('config');
    setQuestionType(null);

    // Reset broadcast guard when going home
    broadcastedQuestionTypeRef.current = null;
    console.log('[KeypadInterface] Reset broadcast guard when going home');

    // No need to reset points - parent component handles score management

    // Clear parent component state as well
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    if (onTeamResponseTimeUpdate) {
      onTeamResponseTimeUpdate({});
    }

    // Clear team answer statuses when going home
    if (onAnswerStatusUpdate) {
      onAnswerStatusUpdate(null, null);
    }

    if (onHome) {
      onHome();
    }
  };

  // Auto-advance to results screen when timer finishes and answer is selected
  // Only auto-advance when user is in a game screen (not question selection)
  useEffect(() => {
    // Guard against auto-advancing when in question-types or config screens
    if (timerFinished && currentScreen !== 'results' && currentScreen !== 'question-types' && currentScreen !== 'config') {
      const hasAnswer = currentScreen === 'letters-game'
        ? selectedLetter
        : currentScreen === 'multiple-choice-game'
          ? selectedAnswers.length > 0
          : currentScreen === 'numbers-game'
            ? numbersAnswer && numbersAnswerConfirmed
            : currentScreen === 'sequence-game'
              ? selectedSequence.length > 0
              : currentScreen === 'quiz-pack-question'
                ? true
                : false;

      if (hasAnswer) {
        // Immediately transition to results screen
        handleShowResults();
      }
    }
  }, [timerFinished, currentScreen, handleShowResults]);

  // Remove auto-reveal functionality - answers should only be revealed when manually clicked

  // Update parent component when team answers change
  useEffect(() => {
    if (onTeamAnswerUpdate && Object.keys(teamAnswers).length > 0) {
      onTeamAnswerUpdate(teamAnswers);
    }
  }, [teamAnswers, onTeamAnswerUpdate]);

  // Update parent component when team response times change
  useEffect(() => {
    if (onTeamResponseTimeUpdate && Object.keys(teamAnswerTimes).length > 0) {
      console.log('[KeypadInterface] Sending response times to parent:', teamAnswerTimes);
      // Log each team's response time for debugging
      Object.entries(teamAnswerTimes).forEach(([teamId, time]) => {
        console.log('[KeypadInterface] Team', teamId, 'response time:', time, 'ms (', (time / 1000).toFixed(2), 's)');
      });
      onTeamResponseTimeUpdate(teamAnswerTimes);
    }
  }, [teamAnswerTimes, onTeamResponseTimeUpdate]);



  // SHIFT key detection for Fast Track feature
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Spacebar shortcut for progression buttons
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        // Don't handle spacebar on config or question-types screens, or when timer is running
        if (currentScreen === 'config' || currentScreen === 'question-types' || isTimerRunning) {
          return;
        }

        e.preventDefault();

        // Results screen - multi-state button (only if timer has finished)
        if (currentScreen === 'results') {
          // Only allow progression if timer has finished
          if (!timerFinished) {
            return;
          }
          console.log('[KeypadInterface] Keyboard handler - results screen, answerRevealed:', answerRevealed, 'fastestTeamRevealed:', fastestTeamRevealed);
          if (!answerRevealed) {
            console.log('[KeypadInterface] Keyboard handler - calling handleRevealAnswer');
            handleRevealAnswer();
          } else if (answerRevealed && !fastestTeamRevealed && getFastestCorrectTeam()) {
            console.log('[KeypadInterface] Keyboard handler - calling handleRevealFastestTeam');
            handleRevealFastestTeam();
          } else {
            console.log('[KeypadInterface] Keyboard handler - calling handleNextQuestion');
            handleNextQuestion();
          }
        }
        // Game screens - Start Timer button (only if answer has been selected)
        else if ((currentScreen === 'letters-game' || currentScreen === 'multiple-choice-game' || currentScreen === 'numbers-game' || currentScreen === 'sequence-game') && !timerFinished) {
          // Check if an answer has been selected based on the current screen
          let answerSelected = false;
          if (currentScreen === 'letters-game' && selectedLetter !== null) {
            answerSelected = true;
          } else if (currentScreen === 'multiple-choice-game' && selectedAnswers.length > 0) {
            answerSelected = true;
          } else if (currentScreen === 'numbers-game' && numbersAnswerConfirmed) {
            answerSelected = true;
          } else if (currentScreen === 'sequence-game' && sequenceCompleted) {
            answerSelected = true;
          }

          // Only start timer if an answer has been selected
          if (answerSelected) {
            handleStartTimer();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentScreen, isTimerRunning, timerFinished, answerRevealed, fastestTeamRevealed, selectedLetter, selectedAnswers, numbersAnswerConfirmed, sequenceCompleted, handleRevealAnswer, handleRevealFastestTeam, handleNextQuestion, handleStartTimer, getFastestCorrectTeam]);

  // Update parent component when response times change
  useEffect(() => {
    if (onTeamResponseTimeUpdate && Object.keys(teamAnswerTimes).length > 0) {
      onTeamResponseTimeUpdate(teamAnswerTimes);
    }
  }, [teamAnswerTimes, onTeamResponseTimeUpdate]);

  // Auto-show results when timer finishes in quiz pack question mode
  useEffect(() => {
    if (timerFinished && currentScreen === 'quiz-pack-question') {
      handleShowResults();
    }
  }, [timerFinished, currentScreen, handleShowResults]);

  // Notify parent of timer state changes for navigation bar
  useEffect(() => {
    console.log('[KeypadInterface] Timer state changed, isTimerRunning:', isTimerRunning);
    if (onGameTimerStateChange) {
      onGameTimerStateChange(isTimerRunning);
    }
  }, [isTimerRunning, onGameTimerStateChange]);

  // Notify parent of current screen changes for navigation bar visibility
  useEffect(() => {
    if (onCurrentScreenChange) {
      onCurrentScreenChange(currentScreen);
    }
  }, [currentScreen, onCurrentScreenChange]);

  // Notify parent of timer values for navigation bar display
  useEffect(() => {
    if (onGameTimerUpdate && isTimerRunning) {
      onGameTimerUpdate(countdown || 0, totalTimerLength);
    }
  }, [countdown, totalTimerLength, isTimerRunning, onGameTimerUpdate]);

  // Notify parent when timer finishes
  useEffect(() => {
    if (onGameTimerFinished) {
      onGameTimerFinished(timerFinished);
    }
  }, [timerFinished, onGameTimerFinished]);

  // Notify parent when answer is revealed
  useEffect(() => {
    if (onGameAnswerRevealed) {
      onGameAnswerRevealed(answerRevealed);
    }
  }, [answerRevealed, onGameAnswerRevealed]);

  // Notify parent when fastest team is revealed
  useEffect(() => {
    if (onGameFastestRevealed) {
      onGameFastestRevealed(fastestTeamRevealed);
    }
  }, [fastestTeamRevealed, onGameFastestRevealed]);

  // Notify parent if any teams answered correctly
  useEffect(() => {
    if (onTeamsAnsweredCorrectly) {
      const correctAnswer = getCorrectAnswer();
      // Use same logic as getFastestCorrectTeam - prioritize parentTeamAnswers if available
      const answersToUse = parentTeamAnswers && Object.keys(parentTeamAnswers).length > 0 ? parentTeamAnswers : teamAnswers;
      const hasCorrectAnswers = correctAnswer && Object.keys(answersToUse).some(teamId => {
        const teamAnswer = answersToUse[teamId];
        return teamAnswer && (
          (questionType === 'letters' && teamAnswer === correctAnswer) ||
          (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
          (questionType === 'numbers' && teamAnswer === correctAnswer)
        );
      });
      onTeamsAnsweredCorrectly(hasCorrectAnswers || false);
    }
  }, [teamAnswers, questionType, onTeamsAnsweredCorrectly, getCorrectAnswer, parentTeamAnswers]);

  // Notify parent when user has selected an answer
  useEffect(() => {
    if (onGameAnswerSelected && currentScreen !== 'config' && currentScreen !== 'question-types') {
      // Determine if an answer has been selected based on current game screen
      const hasSelected = (
        (currentScreen === 'letters-game' && selectedLetter !== null) ||
        (currentScreen === 'multiple-choice-game' && selectedAnswers.length > 0) ||
        (currentScreen === 'numbers-game' && numbersAnswerConfirmed) ||
        (currentScreen === 'sequence-game' && sequenceCompleted) ||
        (currentScreen === 'quiz-pack-question') ||
        (currentScreen === 'results')
      );
      onGameAnswerSelected(hasSelected);
    }
  }, [selectedLetter, selectedAnswers, numbersAnswerConfirmed, sequenceCompleted, currentScreen, onGameAnswerSelected]);

  // Letters Question Game Screen
  if (currentScreen === 'letters-game') {
    // Letter layout matching the image - 4 columns, 6 rows
    const letterRows = [
      ['A', 'B', 'C', 'D'],
      ['E', 'F', 'G', 'H'],
      ['I', 'J', 'K', 'L'],
      ['M', 'N', 'O', 'P'],
      ['R', 'S', 'T', 'U'],
      ['QV', 'W', 'Y', 'XZ']
    ];
    
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromGame}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion}: Ask an on the spot question!</h2>
          </div>
        </div>

        {/* Debug Panel */}
        {showDebugPanel && (
          <div className="mb-6 bg-gray-800 rounded-xl p-4 border-2 border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">�� Keypad Design Debug Panel</h3>
              <Button
                onClick={() => setShowDebugPanel(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {Object.values(keypadDesigns).map((design, index) => (
                <Button
                  key={index}
                  onClick={() => setSelectedDesign(index)}
                  className={`p-2 text-sm font-medium transition-all ${
                    selectedDesign === index
                      ? 'bg-blue-500 hover:bg-blue-600 text-white ring-2 ring-blue-300'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {design.name}
                </Button>
              ))}
            </div>
            <div className="text-sm text-gray-300">
              <p><strong>Current Design:</strong> {currentDesign.name}</p>
              <p><strong>Button Size:</strong> {currentDesign.buttonSize}</p>
            </div>
          </div>
        )}

        {/* Letters Grid - 4x6 layout with dynamic styling */}
        <div className="flex items-center justify-center mb-4">
          <div className={currentDesign.containerClass}>
            <div className={currentDesign.gridClass}>
              {letterRows.map((row, rowIndex) => 
                row.map((letters, colIndex) => (
                  <Button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleLetterSelect(letters)}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold transition-all duration-200 hover:scale-105 rounded-lg ${
                      selectedLetter === letters
                        ? currentDesign.selectedStyle
                        : currentDesign.unselectedStyle
                    }`}
                  >
                    {letters}
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Debug Toggle Button */}
        <div className="flex justify-center mb-4">
          <Button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            variant="outline"
            size="sm"
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500 hidden"
          >
            {showDebugPanel ? '🎨 Hide' : '��� Show'} Design Panel
          </Button>
        </div>

        {/* Selected Answer Display */}
        {selectedLetter && !isTimerRunning && (
          <div className="text-center mb-6">
            <div className="text-xl text-[#95a5a6]">Selected Answer:</div>
            <div className="text-4xl font-bold text-[#f39c12] mt-2">{selectedLetter}</div>
          </div>
        )}



        {/* Picture Display Box - Bottom Right Corner */}
        {isQuizPackMode && currentLoadedQuestion?.imageDataUrl && (
          <div className="fixed bottom-24 right-6 z-40 border-2 border-[#4a5568] rounded-lg bg-[#34495e] p-2 shadow-lg" style={{ width: '160px', height: '240px', aspectRatio: '2 / 3' }}>
            <img
              src={currentLoadedQuestion.imageDataUrl}
              alt="Question"
              className="w-full h-full object-contain rounded"
            />
          </div>
        )}

      </div>
    );
  }

  // Multiple Choice Game Screen
  if (currentScreen === 'multiple-choice-game') {
    
    const handleAnswerToggle = (letter: string) => {
      // For multiple choice, only allow one answer to be selected
      setSelectedAnswers([letter]);
    };

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromGame}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion}: Multiple Choice Question</h2>
          </div>
        </div>

        {/* Multiple Choice Interface */}
        <div className="flex items-center justify-center mb-8">
          <div className={currentDesign.containerClass}>
            {/* Title */}
            <div className="text-center mb-4">
              <h3 className="text-white font-bold text-lg tracking-wider">MULTIPLE CHOICE</h3>
            </div>
            
            {/* Letter Buttons - Vertical Layout */}
            <div className="space-y-2">
              {letters.map((letter) => (
                <Button
                  key={letter}
                  onClick={() => handleAnswerToggle(letter)}
                  className={`w-full h-12 ${currentDesign.buttonText} font-bold transition-all duration-200 hover:scale-105 rounded-lg ${
                    selectedAnswers.includes(letter)
                      ? currentDesign.selectedStyle
                      : currentDesign.unselectedStyle
                  }`}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Answers Display */}
        {selectedAnswers.length > 0 && !isTimerRunning && (
          <div className="text-center mb-6">
            <div className="text-xl text-[#95a5a6]">Selected Answer(s):</div>
            <div className="text-4xl font-bold text-[#f39c12] mt-2">{selectedAnswers.join(', ')}</div>
          </div>
        )}



        {/* Show Results Button - Hidden (irrelevant on this screen) */}
        {false && timerFinished && selectedAnswers.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              onClick={handleShowResults}
              className="px-12 py-6 text-xl font-bold flex items-center gap-3 rounded-lg shadow-lg border-4 bg-[#27ae60] hover:bg-[#229954] text-white border-[#229954] ring-2 ring-[#27ae60]/50 z-10"
            >
              <Eye className="h-6 w-6" />
              REVEAL ANSWER & SHOW RESULTS
            </Button>
          </div>
        )}

        {/* Picture Display Box - Bottom Right Corner */}
        {isQuizPackMode && currentLoadedQuestion?.imageDataUrl && (
          <div className="fixed bottom-24 right-6 z-40 border-2 border-[#4a5568] rounded-lg bg-[#34495e] p-2 shadow-lg" style={{ width: '160px', height: '240px', aspectRatio: '2 / 3' }}>
            <img
              src={currentLoadedQuestion.imageDataUrl}
              alt="Question"
              className="w-full h-full object-contain rounded"
            />
          </div>
        )}

      </div>
    );
  }

  // Numbers Game Screen
  if (currentScreen === 'numbers-game') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromGame}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion}: Numbers Question</h2>
          </div>

        </div>

        {/* Numbers Interface */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <h3 className="text-xl text-[#95a5a6] mb-4">Correct Answer</h3>
              <div
                className={`bg-[#34495e] border-2 ${numbersAnswerConfirmed ? 'border-green-500' : 'border-[#4a5568]'} rounded-lg p-6 mb-6`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={numbersAnswer}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setNumbersAnswer(value);
                  }}
                  disabled={numbersAnswerConfirmed}
                  className={`w-full bg-transparent text-center text-2xl font-bold outline-none ${numbersAnswerConfirmed ? 'text-green-400 cursor-not-allowed' : 'text-white'}`}
                  style={{
                    margin: '-25px 0',
                    lineHeight: '60px',
                  }}
                  placeholder="0"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Number Keypad */}
            <div className="flex justify-center">
              <div className={`${currentDesign.containerClass} max-w-xs`}>
                <div className={`${currentDesign.gridClass.replace('grid-cols-4', 'grid-cols-3')} gap-2`}>
                  {/* Numbers 1-9 */}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button
                      key={num}
                      onClick={() => handleKeypadInput(num.toString())}
                      disabled={numbersAnswerConfirmed}
                      className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold transition-all duration-200 hover:scale-105 ${
                        numbersAnswerConfirmed 
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed border border-gray-400 opacity-50' 
                          : currentDesign.unselectedStyle
                      }`}
                    >
                      {num}
                    </Button>
                  ))}
                  
                  {/* Bottom Row: Clear, 0, Backspace */}
                  <Button
                    onClick={() => setNumbersAnswer('')}
                    disabled={numbersAnswerConfirmed}
                    className={`${currentDesign.buttonSize} text-sm font-bold transition-all duration-200 hover:scale-105 ${
                      numbersAnswerConfirmed 
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed border border-gray-400 opacity-50' 
                        : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-2 border-red-400 shadow-lg shadow-red-500/30'
                    }`}
                  >
                    CLR
                  </Button>
                  
                  <Button
                    onClick={() => handleKeypadInput('0')}
                    disabled={numbersAnswerConfirmed}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold transition-all duration-200 hover:scale-105 ${
                      numbersAnswerConfirmed 
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed border border-gray-400 opacity-50' 
                        : currentDesign.unselectedStyle
                    }`}
                  >
                    0
                  </Button>
                  
                  <Button
                    onClick={() => setNumbersAnswer(prev => prev.slice(0, -1))}
                    disabled={numbersAnswerConfirmed}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold transition-all duration-200 hover:scale-105 ${
                      numbersAnswerConfirmed
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed border border-gray-400 opacity-50'
                        : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-2 border-orange-400 shadow-lg shadow-orange-500/30'
                    }`}
                  >
                    {'<'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Confirm Answer Button */}
            <div className="flex justify-center mb-4 mt-6">
              <Button
                onClick={() => {
                  if (numbersAnswer && !numbersAnswerConfirmed) {
                    setNumbersAnswerConfirmed(true);
                    console.log('Confirmed answer:', numbersAnswer);
                  }
                }}
                disabled={!numbersAnswer || numbersAnswerConfirmed}
                className={`px-8 py-4 text-lg font-bold flex items-center gap-3 rounded-lg shadow-lg transition-all duration-200 ${
                  numbersAnswerConfirmed
                    ? 'bg-[#2ecc71] text-white border-2 border-[#27ae60] cursor-default'
                    : numbersAnswer
                      ? 'bg-[#27ae60] hover:bg-[#229954] text-white border-2 border-[#229954] hover:scale-105'
                      : 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border-2 border-[#7f8c8d]'
                }`}
              >
                <CheckCircle className="h-5 w-5" />
                {numbersAnswerConfirmed ? 'ANSWER CONFIRMED' : 'CONFIRM ANSWER'}
              </Button>
            </div>
          </div>
        </div>



        {/* Show Results Button - Only visible after timer finishes and answer is confirmed */}

        {/* Picture Display Box - Bottom Right Corner */}
        {isQuizPackMode && currentLoadedQuestion?.imageDataUrl && (
          <div className="fixed bottom-24 right-6 z-40 border-2 border-[#4a5568] rounded-lg bg-[#34495e] p-2 shadow-lg" style={{ width: '160px', height: '240px', aspectRatio: '2 / 3' }}>
            <img
              src={currentLoadedQuestion.imageDataUrl}
              alt="Question"
              className="w-full h-full object-contain rounded"
            />
          </div>
        )}
      </div>
    );
  }

  // Sequence Game Screen
  if (currentScreen === 'sequence-game') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromGame}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion}: Sequence Question</h2>
          </div>
        </div>

        {/* Sequence Game Interface */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          {/* Instructions */}
          <div className="text-center mb-4">
            <h3 className="text-2xl font-semibold text-white mb-2">
              {sequenceCompleted ? '✓ Sequence Complete!' : 'Tap items in the correct order'}
            </h3>
            <p className="text-[#95a5a6]">
              {sequenceCompleted
                ? `You selected ${selectedSequence.length} items`
                : `Select ${shuffledSequence.length} items in order (${selectedSequence.length}/${shuffledSequence.length})`}
            </p>
          </div>

          {/* Sequence Items Grid */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
            {shuffledSequence.map((item, index) => {
              const isSelected = selectedSequence.includes(item.id);
              const position = selectedSequence.indexOf(item.id) + 1;

              return (
                <Button
                  key={item.id}
                  onClick={() => handleSequenceItemClick(item.id)}
                  disabled={sequenceCompleted || (isSelected && position !== selectedSequence.length)}
                  className={`h-32 text-lg font-bold rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isSelected
                      ? `bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg ring-2 ring-green-300`
                      : `bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg border-2 border-blue-300 hover:scale-105`
                  }`}
                >
                  <div>{item.item}</div>
                  {isSelected && <div className="text-sm font-bold">#{position}</div>}
                </Button>
              );
            })}
          </div>

          {/* Selected Sequence Preview */}
          {selectedSequence.length > 0 && (
            <div className="w-full max-w-2xl bg-[#34495e] rounded-lg p-4 border-2 border-[#4a5568]">
              <h4 className="text-white font-semibold mb-3">Your Sequence:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedSequence.map((itemId, index) => {
                  const item = shuffledSequence.find(s => s.id === itemId);
                  return (
                    <div
                      key={index}
                      className="bg-[#3498db] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                    >
                      <span className="text-sm">#{index + 1}</span>
                      <span>{item?.item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {selectedSequence.length > 0 && !sequenceCompleted && (
              <Button
                onClick={handleSequenceUndo}
                className="bg-[#e67e22] hover:bg-[#d35400] text-white px-6 py-3 font-semibold rounded-lg"
              >
                ← Undo
              </Button>
            )}
            {selectedSequence.length > 0 && (
              <Button
                onClick={handleSequenceReset}
                className="bg-[#c0392b] hover:bg-[#a93226] text-white px-6 py-3 font-semibold rounded-lg"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Picture Display Box - Bottom Right Corner */}
        {isQuizPackMode && currentLoadedQuestion?.imageDataUrl && (
          <div className="fixed bottom-24 right-6 z-40 border-2 border-[#4a5568] rounded-lg bg-[#34495e] p-2 shadow-lg" style={{ width: '160px', height: '240px', aspectRatio: '2 / 3' }}>
            <img
              src={currentLoadedQuestion.imageDataUrl}
              alt="Question"
              className="w-full h-full object-contain rounded"
            />
          </div>
        )}

      </div>
    );
  }

  // Question Type Selection Screen
  if (currentScreen === 'question-types') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromQuestionTypes}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-2xl font-semibold text-white">Select Question Type</h2>
          </div>
        </div>

        {/* Question Type Buttons */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-6 w-full max-w-4xl">
            {/* Letters Question */}
            <Button
              onClick={() => handleQuestionTypeSelect('letters')}
              className="flex-1 h-48 bg-[#3498db] hover:bg-[#2980b9] text-white flex flex-col items-center justify-center gap-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <Type className="h-16 w-16" />
              <div className="text-2xl font-bold">Letters Question</div>
              <div className="text-sm opacity-90">Answer with letters A-Z</div>
            </Button>

            {/* Multiple Choice Question */}
            <Button
              onClick={() => handleQuestionTypeSelect('multiple-choice')}
              className="flex-1 h-48 bg-[#27ae60] hover:bg-[#229954] text-white flex flex-col items-center justify-center gap-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <BarChart3 className="h-16 w-16" />
              <div className="text-2xl font-bold">Multiple Choice Question</div>
              <div className="text-sm opacity-90">Choose from multiple options</div>
            </Button>

            {/* Numbers Question */}
            <Button
              onClick={() => handleQuestionTypeSelect('numbers')}
              className="flex-1 h-48 bg-[#f39c12] hover:bg-[#e67e22] text-white flex flex-col items-center justify-center gap-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <Hash className="h-16 w-16" />
              <div className="text-2xl font-bold">Numbers Question</div>
              <div className="text-sm opacity-90">Answer with numbers 0-9</div>
            </Button>

            {/* Sequence Question */}
            <Button
              onClick={() => handleQuestionTypeSelect('sequence')}
              className="flex-1 h-48 bg-[#8e44ad] hover:bg-[#7d3c98] text-white flex flex-col items-center justify-center gap-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <RotateCcw className="h-16 w-16" />
              <div className="text-2xl font-bold">Sequence Question</div>
              <div className="text-sm opacity-90">Order items in sequence</div>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main Keypad Configuration Screen
  if (currentScreen === 'config') {
    return (
    <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Scoring Section */}
        <div>
          {/* Points */}
          <Card className="bg-[#34495e] border-[#4a5568] mb-2">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="bg-[#e74c3c] p-2 rounded-lg mb-2">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{points[0]}</div>
                <h4 className="font-semibold mb-1 text-sm">Points</h4>
                <p className="text-xs text-[rgba(255,255,255,1)] mb-2">
                  Points awarded for each correct answer.
                </p>
                <Slider
                  value={points}
                  onValueChange={(value) => {
                    if (value[0] !== points[0] && onCurrentRoundPointsChange && !isTimerRunning) {
                      onCurrentRoundPointsChange(value[0]);
                    }
                  }}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                  disabled={isTimerRunning}
                  style={{
                    opacity: isTimerRunning ? 0.5 : 1,
                    pointerEvents: isTimerRunning ? 'none' : 'auto'
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Speed Bonus */}
        <div>
          <Card className="bg-[#34495e] border-[#4a5568] mb-2">
            <CardContent className="p-4 bg-[rgba(102,102,255,0)]">
              <div className="flex flex-col items-center text-center">
                <div className="bg-[#e74c3c] p-2 rounded-lg mb-2">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{speedBonus[0]}</div>
                <h4 className="font-semibold mb-1 text-sm">Speed Bonus</h4>
                <p className="text-xs text-[rgba(255,255,255,1)] mb-2">
                  Bonus points for the fastest correct answering team.
                </p>
                <Slider
                  value={speedBonus}
                  onValueChange={(value) => {
                    if (value[0] !== speedBonus[0] && onCurrentRoundSpeedBonusChange && !isTimerRunning) {
                      onCurrentRoundSpeedBonusChange(value[0]);
                    }
                  }}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                  disabled={isTimerRunning}
                  style={{
                    opacity: isTimerRunning ? 0.5 : 1,
                    pointerEvents: isTimerRunning ? 'none' : 'auto'
                  }}
                />
                
                <div
                  className={`w-full border-t border-[#4a5568] pt-[20px] mt-[8px] cursor-pointer pr-[0px] pb-[0px] pl-[0px] ${isTimerRunning ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={(e) => {
                    if (isTimerRunning) return;
                    e.stopPropagation();
                    updateStaggeredEnabled(!staggeredEnabled);
                  }}
                >
                  <div className="flex items-center gap-1 justify-center mb-1">
                    <Checkbox
                      checked={staggeredEnabled}
                      onCheckedChange={updateStaggeredEnabled}
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isTimerRunning}
                    />
                    <h5 className="font-semibold text-xs">Staggered</h5>
                  </div>
                  <p className="text-xs text-[rgba(255,255,255,1)]">
                    Speed bonus points will scale down for slower answering teams.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Go Wide */}
        <div>
          <Card
            className={`border-[#4a5568] mb-2 transition-all cursor-pointer ${
              goWideEnabled ? 'bg-[#27ae60] border-[#27ae60]' : 'bg-[#7f8c8d]'
            } ${isTimerRunning ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => {
              if (isTimerRunning) return;
              updateGoWideEnabled(!goWideEnabled);
            }}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="bg-[#95a5a6] p-2 rounded-lg mb-2">
                  <Grid3X3 className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <Checkbox
                    checked={goWideEnabled}
                    onCheckedChange={updateGoWideEnabled}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isTimerRunning}
                  />
                  <h4 className="font-semibold text-sm">Go Wide</h4>
                </div>
                <p className="text-xs text-[#2c3e50] mb-3">
                  Multiple answers for half points.
                </p>
                
                {/* Auto Disable Two Options Toggle */}
                <div 
                  className="w-full border-t border-[#4a5568] pt-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAutoDisableTwoOptions(!autoDisableTwoOptions);
                  }}
                >
                  <div className="flex items-center gap-1 justify-center mb-1">
                    <Checkbox
                      checked={autoDisableTwoOptions}
                      onCheckedChange={setAutoDisableTwoOptions}
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <h5 className="font-semibold text-xs">Auto Disable</h5>
                  </div>
                  <p className="text-xs text-[#2c3e50]">
                    Auto disable for questions with only 2 options like A or B questions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Evil Mode */}
        <div>
          <Card
            className={`border-[#4a5568] mb-2 transition-all cursor-pointer ${
              evilModeEnabled ? 'bg-[#8b0000] border-[#8b0000]' : 'bg-[#7f8c8d]'
            } ${isTimerRunning ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => {
              if (isTimerRunning) return;
              updateEvilModeEnabled(!evilModeEnabled);
            }}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <div className="bg-[#95a5a6] p-2 rounded-lg mb-2">
                  <Skull className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <Checkbox
                    checked={evilModeEnabled}
                    onCheckedChange={updateEvilModeEnabled}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isTimerRunning}
                  />
                  <h4 className="font-semibold text-sm">Evil Mode</h4>
                </div>
                <p className="text-xs text-[#2c3e50] mb-2">
                  Evil mode takes the available points to win, away from the teams score if they answer incorectly.
                </p>
                
                <div
                  className={`w-full border-t border-[#4a5568] pt-[20px] mt-[8px] cursor-pointer pr-[0px] pb-[0px] pl-[0px] ${isTimerRunning ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={(e) => {
                    if (isTimerRunning) return;
                    e.stopPropagation();
                    updatePunishmentEnabled(!punishmentEnabled);
                  }}
                >
                  <div className="flex items-center gap-1 justify-center mb-1">
                    <Checkbox
                      checked={punishmentEnabled}
                      onCheckedChange={updatePunishmentEnabled}
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isTimerRunning}
                    />
                    <h5 className="font-semibold text-xs">Punishment</h5>
                  </div>
                  <p className="text-xs text-[#2c3e50]">
                    If a team answers wrong or doesnt answer in time they lose points too.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons - Updated to match BuzzInInterface */}
      <div className="flex gap-4">
        <Button
          onClick={handleStartRound}
          className="flex-1 h-16 bg-[#3498db] hover:bg-[#2980b9] text-white flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
        >
          START ROUND
        </Button>
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 h-16 border-[#4a5568] hover:bg-[#4a5568] text-[#ecf0f1] flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
        >
          CANCEL
        </Button>
      </div>
    </div>
    );
  }

  // Quiz Pack Question Screen
  if (currentScreen === 'quiz-pack-question') {

    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleBackFromGame}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion}: {getQuestionTypeLabel(questionType || '')}</h2>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center flex-col gap-8">
          {/* Question Text */}
          <div className="text-center max-w-2xl">
            <h3 className="text-2xl text-[#95a5a6] mb-4">Question:</h3>
            <div className="text-4xl font-bold text-white mb-6 break-words">{currentLoadedQuestion?.q || 'No question text'}</div>
          </div>

          {/* Answer Display - Always visible in quiz pack mode */}
          <div className={`p-6 rounded-lg ${
            hideQuizPackAnswers && !isTimerRunning
              ? 'bg-[#34495e]'
              : 'bg-[#2c3e50] border-2 border-[#f39c12]'
          }`}>
            <div className="text-lg text-[#95a5a6] mb-2">Answer:</div>
            <div className={`text-3xl font-bold ${
              hideQuizPackAnswers && !isTimerRunning
                ? 'text-[#95a5a6]'
                : 'text-[#f39c12]'
            }`}>
              {hideQuizPackAnswers && !isTimerRunning ? '••••••' : currentLoadedQuestion?.answerText || 'No answer'}
            </div>
          </div>

          {/* Picture Display Box */}
          {isQuizPackMode && currentLoadedQuestion?.imageDataUrl && (
            <div className="border-2 border-[#4a5568] rounded-lg bg-[#34495e] p-4 shadow-lg" style={{ width: '300px', height: '450px', aspectRatio: '2 / 3' }}>
              <img
                src={currentLoadedQuestion.imageDataUrl}
                alt="Question"
                className="w-full h-full object-contain rounded"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results Screen
  if (currentScreen === 'results') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setCurrentScreen('config')}
              className="p-2 text-[#ecf0f1] hover:bg-[#4a5568]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-3xl font-semibold text-white">Question {currentQuestion} Results</h2>
          </div>

        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-8">
              <h3 className="text-2xl text-[#95a5a6] mb-4">Results Summary</h3>
              <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
                <div className="bg-[#27ae60] p-4 rounded-lg">
                  <div className="text-3xl font-bold text-white">{calculateAnswerStats().correct}</div>
                  <div className="text-sm text-white opacity-80">Correct</div>
                </div>
                <div className="bg-[#e74c3c] p-4 rounded-lg">
                  <div className="text-3xl font-bold text-white">{calculateAnswerStats().wrong}</div>
                  <div className="text-sm text-white opacity-80">Wrong</div>
                </div>
                <div className="bg-[#95a5a6] p-4 rounded-lg">
                  <div className="text-3xl font-bold text-white">{calculateAnswerStats().noAnswer}</div>
                  <div className="text-sm text-white opacity-80">No Answer</div>
                </div>
              </div>
            </div>



            {/* Answer display box - transforms from selected to correct when revealed */}
            <div className={`mb-6 p-4 rounded-lg ${
              answerRevealed
                ? 'bg-[#2c3e50] border-2 border-[#f39c12]'
                : 'bg-[#34495e]'
            }`}>
              <div className="text-lg text-[#95a5a6]">
                {answerRevealed ? 'Correct Answer:' : isQuizPackMode ? 'Answer:' : 'Your Selected Answer:'}
              </div>
              <div className={`text-3xl font-bold mt-2 ${
                answerRevealed ? 'text-[#f39c12]' : 'text-[#3498db]'
              }`}>
                {isQuizPackMode && hideQuizPackAnswers && !answerRevealed ? (
                  '••••••'
                ) : isQuizPackMode ? (
                  currentLoadedQuestion?.answerText || 'No answer'
                ) : (
                  questionType === 'letters' ? selectedLetter :
                  questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
                  questionType === 'numbers' ? numbersAnswer : 'Unknown'
                )}
              </div>
            </div>

            {/* Fastest Team display - shown after answer is revealed and there are correct answers */}
            {/* For quiz pack mode, use the rich FastestTeamDisplay component (handled by parent) */}
            {/* For on-the-spot mode, show inline display */}
            {!isQuizPackMode && answerRevealed && !fastestTeamRevealed && (
              (() => {
                const fastestTeam = getFastestCorrectTeam();
                if (fastestTeam) {
                  return (
                    <div className="mb-6 p-4 rounded-lg bg-[#2c3e50] border-2 border-[#f39c12]">
                      <div className="text-lg text-[#95a5a6] mb-2">Fastest Team:</div>
                      <div className="text-3xl font-bold text-[#f39c12]">{fastestTeam.team.name}</div>
                      <div className="text-sm text-[#95a5a6] mt-1">{fastestTeam.responseTime.toFixed(2)}s</div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Finish Round Button - Only show in quiz pack mode; on-the-spot uses QuestionNavigationBar */}
            {isQuizPackMode && (
              <div className="flex justify-center">
                <Button
                  onClick={() => setCurrentScreen('config')}
                  variant="outline"
                  className="px-8 py-4 text-lg font-semibold flex items-center gap-2 border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
                >
                  <CheckCircle className="h-5 w-5" />
                  Finish Round
                </Button>
              </div>
            )}
        
        {/* Action buttons moved to QuestionNavigationBar */}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
