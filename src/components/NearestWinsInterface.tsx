import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Star, Zap, Grid3X3, ArrowLeft, BarChart3, Timer, Eye, RotateCcw, CheckCircle, Target } from "lucide-react";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { useSettings } from "../utils/SettingsContext";
import { TimerProgressBar } from "./TimerProgressBar";
interface NearestWinsInterfaceProps {
  onBack: () => void;
  onExternalDisplayUpdate?: (data: any) => void;
  teams?: Array<{id: string, name: string, score?: number}>; // Teams data from main app
  onTeamAnswerUpdate?: (answers: {[teamId: string]: string}) => void; // Team answer update callback
  onAwardPoints?: (correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string) => void; // Award points callback
  currentRoundWinnerPoints?: number | null; // Winner points from bottom navigation
  onCurrentRoundWinnerPointsChange?: (winnerPoints: number) => void; // Handler for winner points changes
  onTimerLockChange?: (isLocked: boolean) => void; // Timer lock state callback
  externalWindow?: Window | null; // External display window
  onGetActionHandlers?: (handlers: { reveal: () => void; nextQuestion: () => void; startTimer: () => void }) => void; // Pass action handlers to parent for nav bar
  onGameTimerStateChange?: (isTimerRunning: boolean) => void; // Notify parent of timer state changes
  onCurrentScreenChange?: (screen: string) => void; // Notify parent of current screen changes
  onGameTimerUpdate?: (timeRemaining: number, totalTime: number) => void; // Notify parent of timer values for nav bar
}

export function NearestWinsInterface({ onBack, onExternalDisplayUpdate, teams = [], onTeamAnswerUpdate, onAwardPoints, currentRoundWinnerPoints, onCurrentRoundWinnerPointsChange, onTimerLockChange, externalWindow, onGetActionHandlers, onGameTimerStateChange, onCurrentScreenChange, onGameTimerUpdate }: NearestWinsInterfaceProps) {
  const { nearestWinsTimer, gameModePoints, voiceCountdown, keypadDesign } = useSettings();

  // Wrapper function to clear team answers when going back
  const handleBackWithCleanup = () => {
    console.log('NearestWins: handleBackWithCleanup called');
    
    // Reset all local state
    setCurrentScreen('config');
    setGameActive(false);
    setAnswerRevealed(false);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerHasBeenStarted(false);
    setTimerLocked(false); // Reset timer lock
    
    // Notify parent component about timer lock state reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }
    
    setAnswer('');
    setAnswerConfirmed(false);
    setCorrectAnswer(null);
    setTeamAnswers({});
    setSubmissions([]);
    
    // Clear team answers in the parent component (teams column)
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    
    // Return external display to basic mode with a slight delay to ensure cleanup
    setTimeout(() => {
      console.log('NearestWins: Setting display to basic mode');
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('basic');
      }
    }, 100);
    
    // Call the original onBack function with a delay
    setTimeout(() => {
      onBack();
    }, 150);
  };

  // Wrapper function to clear team answers when going back to config
  const handleBackToConfig = () => {
    console.log('NearestWins: handleBackToConfig called');
    
    // Reset game state
    setGameActive(false);
    setAnswerRevealed(false);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerHasBeenStarted(false);
    setTimerLocked(false); // Reset timer lock
    
    // Notify parent component about timer lock state reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }
    
    setAnswer('');
    setAnswerConfirmed(false);
    setCorrectAnswer(null);
    setTeamAnswers({});
    setSubmissions([]);
    
    // Clear team answers in the parent component (teams column)
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    
    // Return external display to basic mode when returning to config
    setTimeout(() => {
      console.log('NearestWins: Setting display to basic mode from config');
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('basic');
      }
    }, 50);
    
    setTimeout(() => {
      setCurrentScreen('config');
    }, 100);
  };
  
  // Game configuration state - separate from keypad mode
  const [targetNumber, setTargetNumber] = useState([50]); // The number participants aim for
  const [tolerance, setTolerance] = useState([5]); // How close counts as "nearest"
  
  // Use winner points from props (bottom navigation) or fallback to settings default
  const effectiveWinnerPoints = currentRoundWinnerPoints !== null ? currentRoundWinnerPoints : gameModePoints.nearestwins;
  const winnerPoints = [effectiveWinnerPoints]; // Keep array format for slider compatibility
  const setWinnerPoints = (newValue: number[]) => {
    if (onCurrentRoundWinnerPointsChange) {
      // Use queueMicrotask for better performance than setTimeout
      queueMicrotask(() => {
        onCurrentRoundWinnerPointsChange(newValue[0]);
      });
    }
  };
  
  const [runnerUpPoints, setRunnerUpPoints] = useState([5]); // Points for runner-up
  const [multipleWinnersEnabled, setMultipleWinnersEnabled] = useState(false);
  const [showAnswersEnabled, setShowAnswersEnabled] = useState(true);
  
  // Game state
  const [currentScreen, setCurrentScreen] = useState<'config' | 'playing' | 'results'>('config');
  const [gameActive, setGameActive] = useState(false);
  const [submissions, setSubmissions] = useState<Array<{id: string, name: string, guess: number, submitted: boolean, difference?: number}>>([]);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalTimerLength, setTotalTimerLength] = useState<number>(10); // Track total timer length for progress bar
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerHasBeenStarted, setTimerHasBeenStarted] = useState(false); // Track if timer was ever started
  const [answer, setAnswer] = useState('');
  const [answerConfirmed, setAnswerConfirmed] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [teamAnswers, setTeamAnswers] = useState<{[teamId: string]: number}>({});
  const [questionNumber, setQuestionNumber] = useState(1);
  const [timerLocked, setTimerLocked] = useState(false); // Lock state to prevent submissions after timer ends
  
  // Keypad Design Configurations (matching KeypadInterface)
  const keypadDesigns = {
    "neon-glow": {
      name: "Neon Glow",
      containerClass: "bg-gray-900 p-4 rounded-2xl border-2 border-cyan-400 shadow-2xl shadow-cyan-400/30",
      gridClass: "grid grid-cols-3 gap-3",
      buttonSize: "h-16",
      buttonText: "text-2xl",
      numberStyle: "bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-2 border-cyan-300 shadow-lg shadow-cyan-400/30",
      clearStyle: "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-2 border-red-400 shadow-lg shadow-red-500/30",
      backspaceStyle: "bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white border-2 border-orange-300 shadow-lg shadow-orange-400/30"
    },
    "gaming-beast": {
      name: "Gaming Beast",
      containerClass: "bg-gradient-to-br from-gray-800 to-black p-4 rounded-xl border-2 border-red-500 shadow-2xl shadow-red-500/30",
      gridClass: "grid grid-cols-3 gap-2.5",
      buttonSize: "h-16",
      buttonText: "text-2xl",
      numberStyle: "bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-red-400 border border-red-500/50 shadow-md",
      clearStyle: "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border border-red-400/70 shadow-md",
      backspaceStyle: "bg-gradient-to-br from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600 text-white border border-orange-400/70 shadow-md"
    },
    "matrix-green": {
      name: "Matrix Green",
      containerClass: "bg-black p-3 rounded-lg border-2 border-green-400 shadow-2xl shadow-green-400/20",
      gridClass: "grid grid-cols-3 gap-2",
      buttonSize: "h-16",
      buttonText: "text-xl font-mono",
      numberStyle: "bg-gray-900 hover:bg-gray-800 text-green-400 border border-green-400/50 shadow-md shadow-green-400/20",
      clearStyle: "bg-red-900 hover:bg-red-800 text-green-400 border border-red-400/50 shadow-md shadow-red-400/20",
      backspaceStyle: "bg-gray-800 hover:bg-gray-700 text-green-400 border border-green-400/50 shadow-md shadow-green-400/20"
    },
    "bubble-pop": {
      name: "Bubble Pop",
      containerClass: "bg-gradient-to-br from-pink-200 to-purple-200 p-4 rounded-3xl border-4 border-white shadow-xl",
      gridClass: "grid grid-cols-3 gap-3",
      buttonSize: "h-16",
      buttonText: "text-2xl",
      numberStyle: "bg-gradient-to-br from-white to-gray-100 hover:from-gray-50 hover:to-gray-200 text-purple-600 border-2 border-purple-300 shadow-lg",
      clearStyle: "bg-gradient-to-br from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white border-2 border-red-300 shadow-lg",
      backspaceStyle: "bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white border-2 border-orange-300 shadow-lg"
    },
    "ocean-wave": {
      name: "Ocean Wave",
      containerClass: "bg-gradient-to-br from-blue-400 to-teal-500 p-4 rounded-2xl border-3 border-white shadow-xl",
      gridClass: "grid grid-cols-3 gap-3",
      buttonSize: "h-16",
      buttonText: "text-xl",
      numberStyle: "bg-gradient-to-br from-white to-blue-100 hover:from-blue-50 hover:to-blue-200 text-blue-800 border-2 border-blue-300 shadow-md",
      clearStyle: "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white border-2 border-red-300 shadow-md",
      backspaceStyle: "bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white border-2 border-orange-300 shadow-md"
    },
    "cyber-chrome": {
      name: "Cyber Chrome",
      containerClass: "bg-gradient-to-br from-gray-300 to-gray-500 p-3 rounded-xl border-2 border-gray-600 shadow-2xl",
      gridClass: "grid grid-cols-3 gap-2",
      buttonSize: "h-16",
      buttonText: "text-xl",
      numberStyle: "bg-gradient-to-br from-gray-100 to-gray-200 hover:from-white hover:to-gray-100 text-gray-800 border border-gray-400 shadow-md",
      clearStyle: "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white border border-red-400 shadow-md",
      backspaceStyle: "bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white border border-orange-400 shadow-md"
    },
    "fire-storm": {
      name: "Fire Storm",
      containerClass: "bg-gradient-to-br from-red-800 to-orange-900 p-4 rounded-2xl border-3 border-yellow-400 shadow-2xl shadow-orange-500/40",
      gridClass: "grid grid-cols-3 gap-3",
      buttonSize: "h-16",
      buttonText: "text-2xl",
      numberStyle: "bg-gradient-to-br from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 text-yellow-200 border-2 border-yellow-400/50 shadow-md",
      clearStyle: "bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-yellow-200 border-2 border-red-400/70 shadow-md",
      backspaceStyle: "bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-600 text-yellow-200 border-2 border-orange-400/70 shadow-md"
    },
    "cosmic-space": {
      name: "Cosmic Space",
      containerClass: "bg-gradient-to-br from-purple-900 to-indigo-900 p-4 rounded-3xl border-2 border-purple-400 shadow-2xl shadow-purple-500/30",
      gridClass: "grid grid-cols-3 gap-3",
      buttonSize: "h-16",
      buttonText: "text-2xl",
      numberStyle: "bg-gradient-to-br from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-cyan-200 border border-purple-400/50 shadow-md shadow-purple-400/20",
      clearStyle: "bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-cyan-200 border border-red-400/50 shadow-md shadow-red-400/20",
      backspaceStyle: "bg-gradient-to-br from-orange-600 to-orange-800 hover:from-orange-500 hover:to-orange-700 text-cyan-200 border border-orange-400/50 shadow-md shadow-orange-400/20"
    }
  };
  
  // Get current design configuration from settings
  const currentDesign = keypadDesigns[keypadDesign] || keypadDesigns["neon-glow"];
  
  // Mock team data for demonstration
  const mockTeams = [
    { id: "1", name: "Ahmad" },
    { id: "2", name: "Fatima" },
    { id: "3", name: "Omar" },
    { id: "4", name: "Aisha" },
    { id: "5", name: "Hassan" }
  ];

  // Mock results for demonstration
  const mockResults = {
    winner: { name: "Ahmad", guess: 52, difference: 2 },
    runnerUp: { name: "Fatima", guess: 47, difference: 3 },
    submissions: [
      { name: "Ahmad", guess: 52, difference: 2, rank: 1 },
      { name: "Fatima", guess: 47, difference: 3, rank: 2 },
      { name: "Omar", guess: 58, difference: 8, rank: 3 },
      { name: "Aisha", guess: 42, difference: 8, rank: 4 },
      { name: "Hassan", guess: 65, difference: 15, rank: 5 }
    ]
  };

  // Start the round
  const handleStartRound = () => {
    setCurrentScreen('playing');
    setGameActive(true);
    setAnswerRevealed(false);
    setQuestionNumber(1); // Reset to question 1 when starting fresh
    setAnswer(''); // Clear number pad
    setAnswerConfirmed(false);
    setCorrectAnswer(null);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerLocked(false); // Reset timer lock when starting fresh
    
    // Notify parent component about timer lock state reset
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }
    
    // Use real teams if available, otherwise fall back to mock teams
    const teamData = teams.length > 0 ? teams : mockTeams;
    setSubmissions(teamData.map(team => ({ 
      ...team, 
      guess: 0, 
      submitted: false 
    })));
    
    // Clear team answers
    setTeamAnswers({});
    
    // Clear team answers in the parent component (teams column)
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }
    
    // Update external display
    setTimeout(() => {
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('nearest-wins-question', {
          targetNumber: targetNumber[0],
          questionNumber: 1,
          gameInfo: {
            targetNumber: targetNumber[0],
            tolerance: tolerance[0]
          }
        });
      }
    }, 0);

    // Broadcast QUESTION message to player portal devices to ensure they show the question screen
    // instead of display modes (BASIC/SCORES/SLIDESHOW)
    try {
      (window as any).api?.ipc?.invoke('network/broadcast-question', {
        question: {
          type: 'nearestwins',
          text: `Target: ${targetNumber[0]}`,
          tolerance: tolerance[0],
          timestamp: Date.now()
        }
      }).catch((error: any) => {
        console.warn('[NearestWins] Failed to broadcast question to players:', error);
        // This is non-critical - if players aren't connected, it's fine
      });
    } catch (err) {
      console.warn('[NearestWins] Error calling broadcast-question IPC:', err);
    }
  };

  // Handle keypad input
  const handleKeypadInput = (digit: string) => {
    setAnswer(prev => prev + digit);
  };

  // Start timer for submissions
  const handleStartTimer = () => {
    setTotalTimerLength(nearestWinsTimer); // Set total timer length for progress bar
    setIsTimerRunning(true);
    setTimerHasBeenStarted(true); // Mark timer as started
    setTimerLocked(false); // Unlock timer when starting
    
    // Notify parent component about timer lock state
    if (onTimerLockChange) {
      onTimerLockChange(false);
    }
    
    setCountdown(nearestWinsTimer); // Use setting from context
    
    const initialDisplayData = {
      timerValue: nearestWinsTimer,
      targetNumber: targetNumber[0],
      gameInfo: {
        targetNumber: targetNumber[0],
        tolerance: tolerance[0],
        totalTime: nearestWinsTimer
      },
      gameMode: 'nearestwins'
    };
    
    console.log('NearestWins: Starting timer and sending initial display update', {
      nearestWinsTimer,
      initialTimerValue: nearestWinsTimer,
      displayData: initialDisplayData,
      externalWindow: !!externalWindow,
      windowClosed: externalWindow ? externalWindow.closed : 'no window'
    });
    
    // Announce the starting time immediately if voice countdown is enabled
    if (voiceCountdown && nearestWinsTimer % 5 === 0) {
      const utterance = new SpeechSynthesisUtterance(nearestWinsTimer.toString());
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      speechSynthesis.speak(utterance);
    }
    

    
    // Update external display to show timer immediately with full timer value
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      console.log('NearestWins: Actually sending INITIAL timer update to external display');
      onExternalDisplayUpdate('nearest-wins-timer', initialDisplayData);
    } else {
      console.log('NearestWins: NOT sending INITIAL timer update - external window not available or closed');
    }
  };



  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && countdown !== null && countdown >= 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return 0;
          
          const newValue = prev - 1;
          
          // Use text-to-speech for countdown - only at 5-second intervals
          // Check newValue instead of prev to stay in sync after initial announcement
          if (voiceCountdown && newValue > 0 && newValue < nearestWinsTimer) {
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
            setIsTimerRunning(false);
            
            // Lock the timer to prevent any further submissions
            setTimerLocked(true);
            
            // Notify parent component about timer lock state
            if (onTimerLockChange) {
              onTimerLockChange(true);
            }
            

            
            // Say "Time's up!" at the end - only if voice countdown is enabled
            if (voiceCountdown) {
              const finalUtterance = new SpeechSynthesisUtterance("Time's up!");
              finalUtterance.rate = 1;
              finalUtterance.pitch = 1;
              finalUtterance.volume = 1;
              speechSynthesis.speak(finalUtterance);
            }
            
            // Only move to results screen if answer has been confirmed
            if (answerConfirmed) {
              setCurrentScreen('results');
            }
            return 0; // Keep at 0 instead of going negative
          }
          
          return newValue;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, countdown, answerConfirmed, voiceCountdown, nearestWinsTimer]);

  // Handle display updates separately to avoid circular dependencies
  useEffect(() => {
    if (isTimerRunning && countdown !== null) {
      const displayData = {
        timerValue: countdown,
        targetNumber: targetNumber[0],
        gameInfo: {
          targetNumber: targetNumber[0],
          tolerance: tolerance[0],
          totalTime: nearestWinsTimer
        },
        gameMode: 'nearestwins'
      };
      
      console.log('NearestWins: Sending timer update to external display', {
        countdown,
        totalTime: nearestWinsTimer,
        displayData,
        externalWindow: !!externalWindow,
        windowClosed: externalWindow ? externalWindow.closed : 'no window'
      });
      
      // Update display immediately for timer updates
      if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
        console.log('NearestWins: Actually sending timer update to external display');
        onExternalDisplayUpdate('nearest-wins-timer', displayData);
      } else {
        console.log('NearestWins: NOT sending timer update - external window not available or closed');
      }
    }
  }, [countdown, isTimerRunning, targetNumber[0], tolerance[0], nearestWinsTimer, onExternalDisplayUpdate, externalWindow]);

  // Memoize results calculation to prevent infinite loops
  const calculatedResults = useMemo(() => {
    if (!correctAnswer) {
      return mockResults;
    }
    
    const submittedTeams = submissions.filter(s => s.submitted);
    const resultsWithDifferences = submittedTeams.map(team => ({
      ...team,
      difference: Math.abs(team.guess - correctAnswer),
      rank: 0 // Will be calculated after sorting
    }));
    
    // Sort by difference (closest first)
    resultsWithDifferences.sort((a, b) => a.difference - b.difference);
    
    // Assign ranks
    resultsWithDifferences.forEach((team, index) => {
      team.rank = index + 1;
    });
    
    const results = {
      winner: resultsWithDifferences[0] || null,
      runnerUp: resultsWithDifferences[1] || null,
      submissions: resultsWithDifferences
    };
    
    return results;
  }, [correctAnswer, submissions]);

  useEffect(() => {
    if (currentScreen === 'results') {
      // Use calculatedResults if available, otherwise fallback to mockResults for demonstration
      const resultsToSend = calculatedResults.winner ? calculatedResults : mockResults;
      
      console.log('NearestWins: Results screen effect', {
        currentScreen,
        answerRevealed,
        resultsToSend
      });
      
      // Only update display if answer hasn't been revealed yet (to avoid overriding reveal state)
      if (!answerRevealed) {
        // Defer the display update to prevent setState-during-render warnings
        setTimeout(() => {
          if (onExternalDisplayUpdate) {
            onExternalDisplayUpdate('nearest-wins-results', {
              targetNumber: targetNumber[0],
              correctAnswer: correctAnswer,
              results: resultsToSend,
              answerRevealed: false
            });
          }
        }, 0);
      }
    }
  }, [currentScreen, correctAnswer, calculatedResults, targetNumber, answerRevealed]);



  // Spacebar shortcut for progression buttons
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        
        // Playing screen - Start Timer button
        if (currentScreen === 'playing' && !timerHasBeenStarted) {
          handleStartTimer();
        }
        // Results screen - Reveal Winner or Next Round button
        else if (currentScreen === 'results' && answerConfirmed) {
          if (!answerRevealed) {
            handleRevealResults();
          } else {
            handleNextRound();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentScreen, timerHasBeenStarted, answerConfirmed, answerRevealed]);

  // Reveal results
  const handleRevealResults = useCallback(() => {
    setAnswerRevealed(true);

    // Use calculatedResults if available, otherwise fallback to mockResults for demonstration
    const resultsToSend = calculatedResults.winner ? calculatedResults : mockResults;

    console.log('NearestWins: Revealing results', {
      answerRevealed: true,
      correctAnswer,
      resultsToSend,
      calculatedResults,
      mockResults
    });

    // Award points to the winner
    if (onAwardPoints && calculatedResults.winner && calculatedResults.winner.id) {
      const winnerTeamId = calculatedResults.winner.id;
      console.log('NearestWins: Awarding points to winner', {
        winnerTeamId,
        points: effectiveWinnerPoints
      });
      onAwardPoints([winnerTeamId], 'nearestwins');
    }

    setTimeout(() => {
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('nearest-wins-results', {
          targetNumber: targetNumber[0],
          correctAnswer: correctAnswer,
          results: resultsToSend,
          answerRevealed: true
        });
      }
    }, 0);
  }, [targetNumber, correctAnswer, calculatedResults, onAwardPoints, effectiveWinnerPoints, onExternalDisplayUpdate]);

  // Next round - reset for new question
  const handleNextRound = () => {
    // Reset all game state for new question
    setAnswerRevealed(false);
    setCountdown(null);
    setIsTimerRunning(false);
    setTimerHasBeenStarted(false);
    setAnswer(''); // Clear the number pad
    setAnswerConfirmed(false);
    setCorrectAnswer(null);
    setTeamAnswers({});
    setQuestionNumber(prev => prev + 1); // Increment question number

    // Reset submissions for all teams
    const teamData = teams.length > 0 ? teams : mockTeams;
    setSubmissions(teamData.map(team => ({
      ...team,
      guess: 0,
      submitted: false
    })));

    // Clear team answers in the parent component (teams column)
    if (onTeamAnswerUpdate) {
      onTeamAnswerUpdate({});
    }

    // Stay in playing mode and show new question
    setCurrentScreen('playing');

    // Update external display to show new question
    setTimeout(() => {
      if (onExternalDisplayUpdate) {
        onExternalDisplayUpdate('nearest-wins-question', {
          targetNumber: targetNumber[0],
          questionNumber: questionNumber + 1,
          gameInfo: {
            targetNumber: targetNumber[0],
            tolerance: tolerance[0]
          }
        });
      }
    }, 0);
  };

  // Expose action handlers to parent for nav bar integration
  useEffect(() => {
    if (onGetActionHandlers) {
      onGetActionHandlers({
        reveal: handleRevealResults,
        nextQuestion: handleNextRound,
        startTimer: handleStartTimer,
      });
    }
  }, [onGetActionHandlers, handleRevealResults, handleNextRound, handleStartTimer]);

  // Notify parent of timer state changes for navigation bar
  useEffect(() => {
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

  // Configuration Screen
  if (currentScreen === 'config') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6">
        {/* Single Winner Points Configuration Card */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-md">
            <Card className="bg-[#34495e] border-[#4a5568]">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-4 rounded-lg mb-4">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-3">{winnerPoints[0]}</div>
                  <h2 className="text-xl font-semibold mb-2">Winner Points</h2>
                  <p className="text-sm text-[#95a5a6] mb-6">
                    Points awarded to teams with the closest guess.
                  </p>
                  
                  {/* Text Input for exact entry */}
                  <div className="w-full mb-6">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={winnerPoints[0]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        const clampedValue = Math.max(0, Math.min(100, value));
                        setWinnerPoints([clampedValue]);
                      }}
                      className="w-full px-4 py-3 bg-[#2c3e50] border border-[#4a5568] rounded-lg text-white text-center text-lg focus:outline-none focus:border-[#3498db] transition-colors"
                      placeholder="0-100"
                    />
                  </div>
                  
                  {/* Slider */}
                  <div className="w-full">
                    <Slider
                      value={winnerPoints}
                      onValueChange={setWinnerPoints}
                      max={100}
                      min={0}
                      step={1}
                      className="w-full h-3"
                    />
                    <div className="flex justify-between text-xs text-[#95a5a6] mt-2">
                      <span>0</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleStartRound}
            className="flex-1 h-16 bg-[#27ae60] hover:bg-[#229954] text-white flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            START ROUND
          </Button>
          <Button
            onClick={handleBackWithCleanup}
            variant="outline"
            className="flex-1 h-16 border-[#4a5568] hover:bg-[#4a5568] text-[#ecf0f1] flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            CANCEL
          </Button>
        </div>
      </div>
    );
  }

  // Playing Screen
  if (currentScreen === 'playing') {
    return (
      <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-[#27ae60]">NEAREST WINS MODE</h2>
            <div className="text-lg text-[#95a5a6] mt-1">Question {questionNumber}</div>
          </div>
          <Button
            onClick={handleBackToConfig}
            className="bg-[#95a5a6] hover:bg-[#7f8c8d] text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Config
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            {/* Centered Answer Keypad */}
            <div className="text-center">
              <div className="mb-6">
                <h3 className="text-xl text-[#95a5a6] mb-4">Correct Answer</h3>
                <div className={`bg-[#34495e] border-2 ${answerConfirmed ? 'border-green-500' : 'border-[#4a5568]'} rounded-lg p-6 mb-6 max-w-md mx-auto`}>
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setAnswer(value);
                    }}
                    disabled={answerConfirmed}
                    className={`w-full bg-transparent text-center text-6xl font-bold outline-none ${answerConfirmed ? 'text-green-400 cursor-not-allowed' : 'text-white'}`}
                    placeholder="0"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Number Keypad */}
              <div className={`max-w-sm mx-auto mb-6 ${currentDesign.containerClass}`}>
                <div className={currentDesign.gridClass}>
                  {/* Numbers 1-9 */}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button
                      key={num}
                      onClick={() => handleKeypadInput(num.toString())}
                      disabled={answerConfirmed}
                      className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold rounded-lg transition-all ${answerConfirmed ? 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border border-[#95a5a6] opacity-50' : currentDesign.numberStyle}`}
                    >
                      {num}
                    </Button>
                  ))}
                  
                  {/* Bottom Row: Clear, 0, Backspace */}
                  <Button
                    onClick={() => setAnswer('')}
                    disabled={answerConfirmed}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold rounded-lg transition-all ${answerConfirmed ? 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border border-[#95a5a6] opacity-50' : currentDesign.clearStyle}`}
                  >
                    Clear
                  </Button>
                  
                  <Button
                    onClick={() => handleKeypadInput('0')}
                    disabled={answerConfirmed}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold rounded-lg transition-all ${answerConfirmed ? 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border border-[#95a5a6] opacity-50' : currentDesign.numberStyle}`}
                  >
                    0
                  </Button>
                  
                  <Button
                    onClick={() => setAnswer(prev => prev.slice(0, -1))}
                    disabled={answerConfirmed}
                    className={`${currentDesign.buttonSize} ${currentDesign.buttonText} font-bold rounded-lg transition-all ${answerConfirmed ? 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border border-[#95a5a6] opacity-50' : currentDesign.backspaceStyle}`}
                  >
                    ⌫
                  </Button>
                </div>
              </div>

              {/* Confirm Answer Button */}
              <div className="flex justify-center mt-6">
                <Button
                  onClick={() => {
                    if (answer && !answerConfirmed) {
                      setAnswerConfirmed(true);
                      setCorrectAnswer(parseInt(answer));
                      console.log('Confirmed answer:', answer);
                      
                      // If timer has finished, move to results immediately
                      if (!isTimerRunning && countdown === 0) {
                        setCurrentScreen('results');
                      }
                    }
                  }}
                  disabled={!answer || answerConfirmed}
                  className={`px-8 py-4 text-lg font-bold flex items-center gap-3 rounded-lg shadow-lg transition-all duration-200 ${
                    answerConfirmed
                      ? 'bg-[#2ecc71] text-white border-2 border-[#27ae60] cursor-default'
                      : answer
                        ? 'bg-[#27ae60] hover:bg-[#229954] text-white border-2 border-[#229954] hover:scale-105'
                        : 'bg-[#7f8c8d] text-[#95a5a6] cursor-not-allowed border-2 border-[#7f8c8d]'
                  }`}
                >
                  <CheckCircle className="h-5 w-5" />
                  {answerConfirmed ? 'ANSWER CONFIRMED' : 'CONFIRM ANSWER'}
                </Button>
              </div>
            </div>
          </div>
        </div>


      </div>
    );
  }

  // Results Screen
  return (
    <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-[#27ae60]">NEAREST WINS RESULTS</h2>
          <div className="text-lg text-[#95a5a6] mt-1">Question {questionNumber}</div>
        </div>
        <Button
          onClick={handleBackToConfig}
          className="bg-[#95a5a6] hover:bg-[#7f8c8d] text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Config
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <div className="bg-[#34495e] border-2 border-[#3498db] p-6 rounded-lg mb-6 max-w-md mx-auto">
              <h3 className="text-lg text-[#95a5a6] mb-2">Correct Answer</h3>
              <div className="text-5xl font-bold text-[#3498db]">{correctAnswer || 'Not Set'}</div>
            </div>
            
            <div className="flex justify-center">
              <div className="bg-[#27ae60] p-6 rounded-lg">
                <div className="text-3xl font-bold text-white text-center">{calculatedResults.winner?.difference || 0}</div>
                <div className="text-sm text-white opacity-80 text-center">Best Difference</div>
              </div>
            </div>
          </div>

          {/* Results display box - shows winner name immediately, transforms when revealed to external display */}
          <div className={`mb-6 p-6 rounded-lg border-2 max-w-7xl mx-auto ${
            answerRevealed 
              ? 'bg-[#2c3e50] border-[#27ae60]' 
              : 'bg-[#34495e] border-[#f39c12]'
          }`}>
            <div className="text-lg text-[#95a5a6] mb-3">
              {answerRevealed ? 'Winner Revealed on Display:' : 'Winner:'}
            </div>
            <div className={`text-4xl font-bold mt-2 ${
              answerRevealed ? 'text-[#27ae60]' : 'text-[#f39c12]'
            }`}>
              {calculatedResults.winner
                ? calculatedResults.winner.name
                : 'No submissions!'
              }
            </div>
            {calculatedResults.winner && (
              <>
                <div className={`text-2xl font-semibold mt-2 ${
                  answerRevealed ? 'text-[#27ae60]' : 'text-[#f39c12]'
                }`}>
                  Guess: {calculatedResults.winner.guess}
                </div>
                <div className="text-lg text-[#bdc3c7] mt-2">
                  Difference: {calculatedResults.winner.difference}
                </div>
              </>
            )}
          </div>

          {/* Finish Round button - only show if answer is confirmed */}
          {answerConfirmed && (
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleBackToConfig}
                variant="outline"
                className="px-8 py-4 text-lg font-semibold flex items-center gap-2 border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
              >
                <CheckCircle className="h-5 w-5" />
                Finish Round
              </Button>
            </div>
          )}

          {/* Show message if answer not confirmed yet */}
          {!answerConfirmed && (
            <div className="text-center">
              <div className="text-xl text-[#95a5a6] mb-4">Please confirm the correct answer first</div>
              <Button
                onClick={() => setCurrentScreen('playing')}
                variant="outline"
                className="px-8 py-4 text-lg font-semibold flex items-center gap-2 border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Game
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons moved to QuestionNavigationBar */}
    </div>
  );
}
