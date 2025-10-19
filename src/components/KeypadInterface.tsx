import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Star, Zap, Grid3X3, Skull, ArrowLeft, Type, BarChart3, Hash, Timer, Eye, RotateCcw, CheckCircle } from "lucide-react";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { useSettings } from "../utils/SettingsContext";
import { TimerProgressBar } from "./TimerProgressBar";

interface KeypadInterfaceProps {
  onBack: () => void;
  onHome?: () => void; // Add home navigation prop
  externalWindow?: Window | null; // External display window
  onExternalDisplayUpdate?: (mode: string, data?: any) => void; // External display update function
  teams?: Array<{id: string, name: string, score?: number}>; // Teams data for simulation
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
}

export function KeypadInterface({ 
  onBack, 
  onHome, 
  externalWindow, 
  onExternalDisplayUpdate, 
  teams = [], 
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
  onFastTrack
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
    voiceCountdown
  } = useSettings();
  
  // Use current round scores from props (convert to arrays for slider compatibility)
  // Once current round scores are set, they stay independent of default changes
  const points = [currentRoundPoints !== null ? currentRoundPoints : defaultPoints];
  const speedBonus = [currentRoundSpeedBonus !== null ? currentRoundSpeedBonus : defaultSpeedBonus];
  const [bonusType, setBonusType] = useState<"fixed" | "sliding">("fixed");
  // goWideEnabled and evilModeEnabled now come from settings context
  const [noAnswerPenalty, setNoAnswerPenalty] = useState(false);
  const [autoDisableTwoOptions, setAutoDisableTwoOptions] = useState(false);
  const [showQuestionTypes, setShowQuestionTypes] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'config' | 'question-types' | 'letters-game' | 'multiple-choice-game' | 'numbers-game' | 'results'>('config');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalTimerLength, setTotalTimerLength] = useState<number>(30); // Track total timer length for progress bar
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [questionType, setQuestionType] = useState<'letters' | 'multiple-choice' | 'numbers' | null>(null);
  
  // Add state for correct answer revelation
  const [answerRevealed, setAnswerRevealed] = useState(false);
  
  // Team simulation state
  const [teamAnswers, setTeamAnswers] = useState<{[teamId: string]: string}>({});
  const [teamAnswerTimes, setTeamAnswerTimes] = useState<{[teamId: string]: number}>({});
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulationTimeouts, setSimulationTimeouts] = useState<NodeJS.Timeout[]>([]);
  const [timerLocked, setTimerLocked] = useState(false); // Lock state to prevent submissions after timer ends
  
  // Fastest team state
  const [fastestTeamRevealed, setFastestTeamRevealed] = useState(false);
  
  // SHIFT key state for Fast Track feature
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  // No need for local reset function - scores are managed by parent component
  
  // Numbers game state
  const [numbersAnswer, setNumbersAnswer] = useState('');
  const [numbersAnswerConfirmed, setNumbersAnswerConfirmed] = useState(false);
  
  // Debug mode state for keypad designs
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(0);
  
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
  
  // Handle timer completion and update team answer statuses
  useEffect(() => {
    if (timerFinished && onAnswerStatusUpdate && currentScreen !== 'results') {
      const correctAnswer = currentScreen === 'letters-game' ? selectedLetter : 
                           currentScreen === 'multiple-choice-game' ? selectedAnswers.join(', ') :
                           currentScreen === 'numbers-game' ? numbersAnswer : null;
      onAnswerStatusUpdate(correctAnswer, questionType);
    }
  }, [timerFinished, onAnswerStatusUpdate, currentScreen, selectedLetter, selectedAnswers, numbersAnswer, questionType]);
  
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
    setIsSimulated(false);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setShowDebugPanel(false);
    setSelectedDesign(0);
    
    // Clear any pending simulation timeouts
    simulationTimeouts.forEach(timeout => clearTimeout(timeout));
    setSimulationTimeouts([]);
    
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
  }, []); // Empty dependency array means this runs once on mount
  
  // Calculate actual results based on team answers and correct answer
  const calculateAnswerStats = useCallback(() => {
    if (!teamAnswers || Object.keys(teamAnswers).length === 0) {
      return { correct: 0, wrong: 0, noAnswer: teams.length };
    }

    const correctAnswer = questionType === 'letters' ? selectedLetter : 
                         questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
                         questionType === 'numbers' ? numbersAnswer : null;

    if (!correctAnswer) {
      return { correct: 0, wrong: 0, noAnswer: teams.length };
    }

    let correct = 0;
    let wrong = 0;
    let noAnswer = 0;

    teams.forEach(team => {
      const teamAnswer = teamAnswers[team.id];
      
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
  }, [teamAnswers, teams, questionType, selectedLetter, selectedAnswers, numbersAnswer]);

  // Find the fastest team that answered correctly
  const getFastestCorrectTeam = useCallback(() => {
    if (!teamAnswers || Object.keys(teamAnswers).length === 0) {
      return null;
    }

    const correctAnswer = questionType === 'letters' ? selectedLetter : 
                         questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
                         questionType === 'numbers' ? numbersAnswer : null;

    if (!correctAnswer) {
      return null;
    }

    const correctTeams = teams.filter(team => {
      const teamAnswer = teamAnswers[team.id];
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
  }, [teamAnswers, teamAnswerTimes, teams, questionType, selectedLetter, selectedAnswers, numbersAnswer]);

  const handleStartRound = () => {
    setCurrentScreen('question-types');
    
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
  };

  const handleQuestionTypeSelect = (type: 'letters' | 'multiple-choice' | 'numbers') => {
    setQuestionType(type);
    if (type === 'letters') {
      setCurrentScreen('letters-game');
    } else if (type === 'multiple-choice') {
      setCurrentScreen('multiple-choice-game');
    } else if (type === 'numbers') {
      setCurrentScreen('numbers-game');
    }
    
    console.log("Starting keypad round with:", { 
      points, 
      speedBonus, 
      bonusType, 
      goWideEnabled, 
      evilModeEnabled,
      questionType: type
    });
  };

  const handleBackFromQuestionTypes = () => {
    setCurrentScreen('config');
  };

  const handleBackFromGame = () => {
    setCurrentScreen('question-types');
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
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
  };

  const handleLetterSelect = (letter: string) => {
    setSelectedLetter(letter);
  };

  const handleKeypadInput = (digit: string) => {
    if (!numbersAnswerConfirmed) {
      setNumbersAnswer(prev => prev + digit);
    }
  };

  const handleStartTimer = () => {
    // Can now start timer without requiring an answer first
    const timerLength = gameModeTimers.keypad;
    setTotalTimerLength(timerLength); // Set total timer length for progress bar
    setIsTimerRunning(true);
    setTimerFinished(false);
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
    
    // Simulate team answers when timer starts
    simulateTeamAnswers();
    
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
    
    // Announce the starting time immediately if voice countdown is enabled
    if (voiceCountdown && timerLength % 5 === 0) {
      const utterance = new SpeechSynthesisUtterance(timerLength.toString());
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      speechSynthesis.speak(utterance);
    }
    
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
        
        // Use text-to-speech for countdown - only at 5-second intervals
        // Check newValue instead of prev to stay in sync after initial announcement
        if (voiceCountdown && newValue > 0 && newValue < timerLength) {
          // Only speak at 5-second intervals (25, 20, 15, 10, 5) - starting value was already announced
          if (newValue % 5 === 0) {
            const utterance = new SpeechSynthesisUtterance(newValue.toString());
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;
            speechSynthesis.speak(utterance);
          }
        }
        
        if (newValue < 0) {
          clearInterval(timer);
          setIsTimerRunning(false);
          setCountdown(null);
          
          // Lock the timer to prevent any further submissions
          setTimerLocked(true);
          
          // Notify parent component about timer lock
          if (onTimerLockChange) {
            onTimerLockChange(true);
          }
          
          // Clear all pending simulation timeouts to prevent late submissions
          simulationTimeouts.forEach(timeout => clearTimeout(timeout));
          setSimulationTimeouts([]);
          
          // Say "Time's up!" at the end - only if voice countdown is enabled
          if (voiceCountdown) {
            const finalUtterance = new SpeechSynthesisUtterance("Time's up!");
            finalUtterance.rate = 1;
            finalUtterance.pitch = 1;
            finalUtterance.volume = 1;
            speechSynthesis.speak(finalUtterance);
          }
          
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
  };

  const handleShowResults = useCallback(() => {
    // Check if we have an answer selected before showing results
    const hasAnswer = currentScreen === 'letters-game' 
      ? selectedLetter 
      : currentScreen === 'multiple-choice-game'
        ? selectedAnswers.length > 0
        : currentScreen === 'numbers-game'
          ? numbersAnswer && numbersAnswerConfirmed
          : false;
    
    if (hasAnswer) {
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
    }
  }, [currentScreen, selectedLetter, selectedAnswers, numbersAnswer, numbersAnswerConfirmed, externalWindow, onExternalDisplayUpdate, calculateAnswerStats, currentQuestion, questionType]);

  // Add function to handle revealing the correct answer
  const handleRevealAnswer = useCallback(() => {
    setAnswerRevealed(true);
    
    // Award points to teams that answered correctly
    if (onAwardPoints) {
      const correctAnswer = questionType === 'letters' ? selectedLetter : 
                           questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
                           questionType === 'numbers' ? numbersAnswer : null;

      if (correctAnswer) {
        const correctTeamIds = teams.filter(team => {
          const teamAnswer = teamAnswers[team.id];
          return teamAnswer && (
            (questionType === 'letters' && teamAnswer === correctAnswer) ||
            (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
            (questionType === 'numbers' && teamAnswer === correctAnswer)
          );
        }).map(team => team.id);

        const fastestTeam = getFastestCorrectTeam();
        const fastestTeamId = fastestTeam ? fastestTeam.team.id : undefined;

        if (correctTeamIds.length > 0) {
          onAwardPoints(correctTeamIds, 'keypad', fastestTeamId, teamAnswerTimes);
        }

        // Apply Evil Mode penalties if enabled
        if (onEvilModePenalty && (evilModeEnabled || punishmentEnabled)) {
          const wrongTeamIds = teams.filter(team => {
            const teamAnswer = teamAnswers[team.id];
            // Team answered but got it wrong
            return teamAnswer && teamAnswer.trim() !== '' && !(
              (questionType === 'letters' && teamAnswer === correctAnswer) ||
              (questionType === 'multiple-choice' && teamAnswer === correctAnswer) ||
              (questionType === 'numbers' && teamAnswer === correctAnswer)
            );
          }).map(team => team.id);

          const noAnswerTeamIds = teams.filter(team => {
            const teamAnswer = teamAnswers[team.id];
            // Team didn't answer or gave empty answer
            return !teamAnswer || teamAnswer.trim() === '';
          }).map(team => team.id);

          onEvilModePenalty(wrongTeamIds, noAnswerTeamIds, 'keypad');
        }
      }
    }
    
    // Send correct answer to external display with stats
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      const answer = questionType === 'letters' ? selectedLetter : 
                     questionType === 'multiple-choice' ? selectedAnswers.join(', ') :
                     questionType === 'numbers' ? numbersAnswer : 'Unknown';
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
  }, [externalWindow, onExternalDisplayUpdate, questionType, selectedLetter, selectedAnswers, numbersAnswer, calculateAnswerStats, getFastestCorrectTeam, currentQuestion, onAwardPoints, onEvilModePenalty, evilModeEnabled, punishmentEnabled, teams, teamAnswers, teamAnswerTimes]);

  // Add function to handle revealing the fastest team
  const handleRevealFastestTeam = useCallback(() => {
    setFastestTeamRevealed(true);
    
    const fastestTeamData = getFastestCorrectTeam();
    
    // Send fastest team data to parent for main display
    if (onFastestTeamReveal && fastestTeamData) {
      onFastestTeamReveal(fastestTeamData);
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

  // Function to simulate team answers with staggered timing
  const simulateTeamAnswers = useCallback(() => {
    // Clear any existing team answers and timeouts
    setTeamAnswers({});
    setTeamAnswerTimes({});
    setIsSimulated(false);
    
    // Clear parent component state as well
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    if (onTeamResponseTimeUpdate) {
      onTeamResponseTimeUpdate({});
    }
    
    // Clear any existing timeouts
    simulationTimeouts.forEach(timeout => clearTimeout(timeout));
    setSimulationTimeouts([]);
    
    // Generate random delays for each team (between 0 and 9 seconds)
    const newTimeouts: NodeJS.Timeout[] = [];
    const startTime = Date.now();
    
    teams.forEach(team => {
      const randomDelay = Math.floor(Math.random() * 9000); // 0-9000ms delay
      
      const timeout = setTimeout(() => {
        // Check if timer is locked before allowing submission
        if (timerLocked) {
          console.log(`Team ${team.name} tried to submit after timer ended - submission blocked`);
          return;
        }
        
        let randomAnswer = '';
        
        if (questionType === 'letters') {
          // For letters questions, pick from available letter options
          const letterRows = [
            ['A', 'B', 'C', 'D'],
            ['E', 'F', 'G', 'H'],
            ['I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P'],
            ['R', 'S', 'T', 'U'],
            ['QV', 'W', 'Y', 'XZ']
          ];
          const allLetters = letterRows.flat();
          randomAnswer = allLetters[Math.floor(Math.random() * allLetters.length)];
        } else if (questionType === 'multiple-choice') {
          // For multiple choice, pick from A-F
          const choices = ['A', 'B', 'C', 'D', 'E', 'F'];
          randomAnswer = choices[Math.floor(Math.random() * choices.length)];
        } else if (questionType === 'numbers') {
          // For numbers questions, pick random number 0-100000
          randomAnswer = Math.floor(Math.random() * 100001).toString();
        }
        
        const answerTime = Date.now() - startTime;
        
        // Update team answers state by adding this team's answer
        setTeamAnswers(prevAnswers => {
          const updatedAnswers = {
            ...prevAnswers,
            [team.id]: randomAnswer
          };
          
          // Notify parent component of team answer updates immediately
          if (onTeamAnswerUpdate) {
            queueMicrotask(() => {
              onTeamAnswerUpdate(updatedAnswers);
            });
          }
          
          return updatedAnswers;
        });
        
        // Update team answer times (store in milliseconds for precise calculation)
        setTeamAnswerTimes(prevTimes => {
          const updatedTimes = {
            ...prevTimes,
            [team.id]: answerTime
          };
          
          // Notify parent component of response time updates
          if (onTeamResponseTimeUpdate) {
            queueMicrotask(() => {
              onTeamResponseTimeUpdate(updatedTimes);
            });
          }
          
          return updatedTimes;
        });
        
        // Mark as simulated when at least one team has answered
        setIsSimulated(true);
      }, randomDelay);
      
      newTimeouts.push(timeout);
    });
    
    setSimulationTimeouts(newTimeouts);
  }, [teams, questionType, onTeamAnswerUpdate, onTeamResponseTimeUpdate, simulationTimeouts]);

  const handleNextQuestion = () => {
    // Reset all states for next question
    const nextQuestionNumber = currentQuestion + 1;
    setCurrentQuestion(nextQuestionNumber);
    setSelectedLetter(null);
    setSelectedAnswers([]);
    setNumbersAnswer('');
    setNumbersAnswerConfirmed(false);
    setTimerFinished(false);
    setTimerLocked(false); // Reset timer lock for next question
    
    // Notify parent component about timer lock reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }
    
    setAnswerRevealed(false); // Reset answer revelation state
    setFastestTeamRevealed(false); // Reset fastest team revelation state
    setTeamAnswers({}); // Reset team answers
    setTeamAnswerTimes({}); // Reset team answer times
    setIsSimulated(false); // Reset simulation state
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
  };

  // Watch for external trigger to advance to next question
  useEffect(() => {
    if (triggerNextQuestion > 0) {
      handleNextQuestion();
    }
  }, [triggerNextQuestion]);

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
    setIsSimulated(false);
    setCurrentScreen('config');
    setQuestionType(null);
    
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
  useEffect(() => {
    if (timerFinished) {
      const hasAnswer = currentScreen === 'letters-game' 
        ? selectedLetter 
        : currentScreen === 'multiple-choice-game'
          ? selectedAnswers.length > 0
          : currentScreen === 'numbers-game'
            ? numbersAnswer && numbersAnswerConfirmed
            : false;
      
      if (hasAnswer) {
        // Auto-advance to results after a brief delay to let users see the timer finished
        const timer = setTimeout(() => {
          handleShowResults();
        }, 1500); // 1.5 second delay before auto-advancing

        return () => clearTimeout(timer);
      }
    }
  }, [timerFinished, selectedLetter, selectedAnswers, numbersAnswer, numbersAnswerConfirmed, currentScreen, handleShowResults]);

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
      onTeamResponseTimeUpdate(teamAnswerTimes);
    }
  }, [teamAnswerTimes, onTeamResponseTimeUpdate]);

  // Cleanup simulation timeouts when component unmounts or screen changes
  useEffect(() => {
    return () => {
      simulationTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [currentScreen]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      simulationTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

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
        e.preventDefault();
        
        // Results screen - multi-state button
        if (currentScreen === 'results') {
          if (!answerRevealed) {
            handleRevealAnswer();
          } else if (answerRevealed && !fastestTeamRevealed && getFastestCorrectTeam()) {
            handleRevealFastestTeam();
          } else {
            handleNextQuestion();
          }
        }
        // Game screens - Start Timer button
        else if ((currentScreen === 'letters-game' || currentScreen === 'multiple-choice-game' || currentScreen === 'numbers-game') && !isTimerRunning && !timerFinished) {
          handleStartTimer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentScreen, isTimerRunning, timerFinished, answerRevealed, fastestTeamRevealed]);

  // Update parent component when response times change
  useEffect(() => {
    if (onTeamResponseTimeUpdate && Object.keys(teamAnswerTimes).length > 0) {
      onTeamResponseTimeUpdate(teamAnswerTimes);
    }
  }, [teamAnswerTimes, onTeamResponseTimeUpdate]);

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

        {/* Timer Progress Bar */}
        <TimerProgressBar 
          isVisible={isTimerRunning}
          timeRemaining={countdown || 0}
          totalTime={totalTimerLength}
          position="top"
        />

        {/* Debug Panel */}
        {showDebugPanel && (
          <div className="mb-6 bg-gray-800 rounded-xl p-4 border-2 border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">🎨 Keypad Design Debug Panel</h3>
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
            {showDebugPanel ? '🎨 Hide' : '🎨 Show'} Design Panel
          </Button>
        </div>

        {/* Selected Answer Display */}
        {selectedLetter && !isTimerRunning && (
          <div className="text-center mb-6">
            <div className="text-xl text-[#95a5a6]">Selected Answer:</div>
            <div className="text-4xl font-bold text-[#f39c12] mt-2">{selectedLetter}</div>
          </div>
        )}



        {/* Start Timer Button - Fixed bottom right position */}
        {!isTimerRunning && !timerFinished && (
          <div className="fixed bottom-20 right-6 z-50">
            <Button
              onClick={handleStartTimer}
              className="bg-[#3498db] hover:bg-[#2980b9] text-white border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl"
            >
              <Timer className="h-6 w-6" />
              Start Timer
            </Button>
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

        {/* Timer Progress Bar */}
        <TimerProgressBar 
          isVisible={isTimerRunning}
          timeRemaining={countdown || 0}
          totalTime={totalTimerLength}
          position="top"
        />

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



        {/* Start Timer Button - Fixed bottom right position */}
        {!isTimerRunning && !timerFinished && (
          <div className="fixed bottom-20 right-6 z-50">
            <Button
              onClick={handleStartTimer}
              className="bg-[#3498db] hover:bg-[#2980b9] text-white border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl"
            >
              <Timer className="h-6 w-6" />
              Start Timer
            </Button>
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

        {/* Timer Progress Bar */}
        <TimerProgressBar 
          isVisible={isTimerRunning}
          timeRemaining={countdown || 0}
          totalTime={totalTimerLength}
          position="top"
        />

        {/* Numbers Interface */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <h3 className="text-xl text-[#95a5a6] mb-4">Correct Answer</h3>
              <div className={`bg-[#34495e] border-2 ${numbersAnswerConfirmed ? 'border-green-500' : 'border-[#4a5568]'} rounded-lg p-6 mb-6`}>
                <input
                  type="text"
                  value={numbersAnswer}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setNumbersAnswer(value);
                  }}
                  disabled={numbersAnswerConfirmed}
                  className={`w-full bg-transparent text-center text-6xl font-bold outline-none ${numbersAnswerConfirmed ? 'text-green-400 cursor-not-allowed' : 'text-white'}`}
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
                    ⌫
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



        {/* Start Timer Button - Fixed bottom right position */}
        {!isTimerRunning && !timerFinished && (
          <div className="fixed bottom-20 right-6 z-50">
            <Button
              onClick={handleStartTimer}
              className="bg-[#3498db] hover:bg-[#2980b9] text-white border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl"
            >
              <Timer className="h-6 w-6" />
              Start Timer
            </Button>
          </div>
        )}

        {/* Show Results Button - Only visible after timer finishes and answer is confirmed */}

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
                    if (value[0] !== points[0] && onCurrentRoundPointsChange) {
                      onCurrentRoundPointsChange(value[0]);
                    }
                  }}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
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
                    if (value[0] !== speedBonus[0] && onCurrentRoundSpeedBonusChange) {
                      onCurrentRoundSpeedBonusChange(value[0]);
                    }
                  }}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                />
                
                <div 
                  className="w-full border-t border-[#4a5568] pt-[20px] mt-[8px] cursor-pointer pr-[0px] pb-[0px] pl-[0px]"
                  onClick={(e) => {
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
            }`}
            onClick={() => updateGoWideEnabled(!goWideEnabled)}
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
            }`}
            onClick={() => updateEvilModeEnabled(!evilModeEnabled)}
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
                  />
                  <h4 className="font-semibold text-sm">Evil Mode</h4>
                </div>
                <p className="text-xs text-[#2c3e50] mb-2">
                  Evil mode takes the available points to win, away from the teams score if they answer incorectly.
                </p>
                
                <div 
                  className="w-full border-t border-[#4a5568] pt-[20px] mt-[8px] cursor-pointer pr-[0px] pb-[0px] pl-[0px]"
                  onClick={(e) => {
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
                {answerRevealed ? 'Correct Answer:' : 'Your Selected Answer:'}
              </div>
              <div className={`text-3xl font-bold mt-2 ${
                answerRevealed ? 'text-[#f39c12]' : 'text-[#3498db]'
              }`}>
                {questionType === 'letters' ? selectedLetter : 
                 questionType === 'multiple-choice' ? selectedAnswers.join(', ') : 
                 questionType === 'numbers' ? numbersAnswer : 'Unknown'}
              </div>
            </div>

            {/* Finish Round Button - Centered */}
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
        
        {/* Multi-state Action Button - Fixed bottom right position */}
        <div className="fixed bottom-20 right-6 z-50">
          <Button
            onClick={() => {
              if (!answerRevealed) {
                handleRevealAnswer();
              } else if (answerRevealed && !fastestTeamRevealed && getFastestCorrectTeam()) {
                // Check if SHIFT is pressed for Fast Track mode
                if (isShiftPressed) {
                  handleFastTrack();
                } else {
                  handleRevealFastestTeam();
                }
              } else {
                handleNextQuestion();
              }
            }}
            className={`border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl ${
              answerRevealed && !fastestTeamRevealed && getFastestCorrectTeam() && isShiftPressed
                ? 'bg-[#00FF00] hover:bg-[#00DD00] text-black'
                : 'bg-[#3498db] hover:bg-[#2980b9] text-white'
            }`}
          >
            {!answerRevealed ? (
              <>
                <Eye className="h-6 w-6" />
                Reveal Answer
              </>
            ) : answerRevealed && !fastestTeamRevealed && getFastestCorrectTeam() ? (
              <>
                <Zap className="h-6 w-6" />
                {isShiftPressed ? 'Fast Track' : 'Fastest Team'}
              </>
            ) : (
              <>
                <RotateCcw className="h-6 w-6" />
                Next Question
              </>
            )}
          </Button>
        </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}