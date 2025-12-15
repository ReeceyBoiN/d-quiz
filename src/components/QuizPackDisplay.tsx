import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ChevronLeft, ChevronRight, Flag, Star, Zap, Grid3X3, Skull, ArrowLeft, Timer as TimerIcon } from "lucide-react";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { useSettings } from "../utils/SettingsContext";
import { TimerProgressBar } from "./TimerProgressBar";
import { playCountdownAudio, stopCountdownAudio } from "../utils/countdownAudio";

interface LoadedQuestion {
  type: string;
  q: string;
  options?: string[];
  correctIndex?: number;
  imageDataUrl?: string;
  answerText?: string;
  meta?: { short_answer?: string; user_view?: string };
}

interface QuizPackDisplayProps {
  questions: LoadedQuestion[];
  currentQuestionIndex: number;
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
  onBack: () => void;
  totalTeams?: number;
  onAwardPoints?: (correctTeamIds: string[], gameMode: string, fastestTeamId?: string) => void;
  onStartQuiz?: () => void; // Called when "START QUIZ" button is clicked
  onStartRoundWithQuestion?: (questionData: { type: string; options?: string[]; q: string; questionIndex: number }) => void; // Called with question data when round starts
  onPointsChange?: (points: number) => void; // Callback when points slider changes
  onSpeedBonusChange?: (speedBonus: number) => void; // Callback when speed bonus slider changes
  currentRoundPoints?: number | null; // Current round points from parent
  currentRoundSpeedBonus?: number | null; // Current round speed bonus from parent
  onGameTimerStateChange?: (isRunning: boolean) => void; // Notify parent when timer state changes
}

export function QuizPackDisplay({
  questions,
  currentQuestionIndex,
  onPreviousQuestion,
  onNextQuestion,
  onBack,
  totalTeams = 0,
  onAwardPoints,
  onStartQuiz,
  onStartRoundWithQuestion,
  onPointsChange,
  onSpeedBonusChange,
  currentRoundPoints,
  currentRoundSpeedBonus,
  onGameTimerStateChange
}: QuizPackDisplayProps) {
  const [currentScreen, setCurrentScreen] = useState<'config' | 'question'>('config');
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerFinished, setTimerFinished] = useState(false);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [localSpeedBonus, setLocalSpeedBonus] = useState<number | null>(null);
  const [autoDisableEnabled, setAutoDisableEnabled] = useState(false);
  const [timerStartValue, setTimerStartValue] = useState<number | null>(null);
  const isMountedRef = useRef(true);
  const countdownRef = useRef<number | null>(null);
  const isFirstTickRef = useRef(true);
  const audioPlayedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    gameModeTimers
  } = useSettings();

  // Use parent's round values if set, otherwise use local state, otherwise use defaults
  const currentPoints = currentRoundPoints !== null ? currentRoundPoints : (localPoints !== null ? localPoints : defaultPoints);
  const currentSpeedBonus = currentRoundSpeedBonus !== null ? currentRoundSpeedBonus : (localSpeedBonus !== null ? localSpeedBonus : defaultSpeedBonus);
  const points = [currentPoints];
  const speedBonus = [currentSpeedBonus];

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleStartRound = useCallback(() => {
    setCurrentScreen('question');
    setIsTimerRunning(false);
    setCountdown(null);
    setTimerFinished(false);
    setTimerStartValue(null);

    // Reset timer refs for new round
    countdownRef.current = null;
    isFirstTickRef.current = true;
    audioPlayedRef.current = false;

    onStartQuiz?.();

    // Signal round start with question data to broadcast to players immediately
    // This allows players to see the correct input pads (letters/numbers/multiple-choice)
    // before the actual question text is sent
    if (currentQuestion && onStartRoundWithQuestion) {
      onStartRoundWithQuestion({
        type: currentQuestion.type,
        options: currentQuestion.options,
        q: currentQuestion.q,
        questionIndex: currentQuestionIndex
      });
    }
  }, [onStartQuiz, onStartRoundWithQuestion, currentQuestion, currentQuestionIndex]);

  // Timer effect - handles countdown
  useEffect(() => {
    console.log('[QuizPackDisplay Timer Effect] Setup:', { isTimerRunning, countdown });
    if (!isTimerRunning || countdown === null) {
      console.log('[QuizPackDisplay Timer Effect] Not running');
      return;
    }

    console.log('[QuizPackDisplay Timer Effect] Starting interval, initial countdown:', countdown);
    isFirstTickRef.current = true;

    const interval = setInterval(() => {
      // Check if component is still mounted before doing anything
      if (!isMountedRef.current) {
        console.log('[QuizPackDisplay Timer] Component unmounted, clearing interval');
        clearInterval(interval);
        return;
      }

      setCountdown(prev => {
        if (prev === null || !isMountedRef.current) return null;

        // On the first tick, don't decrement (show the full second for the starting number)
        if (isFirstTickRef.current) {
          isFirstTickRef.current = false;
          return prev;
        }

        const newCountdown = Math.max(0, prev - 1);

        if (newCountdown === 0) {
          setTimerFinished(true);
          // Delay hiding the timer to show the final 0% progress bar state
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsTimerRunning(false);
            }
          }, 1100);
        }

        return newCountdown;
      });
    }, 1000);

    // Store interval ref so we can clear it on unmount
    intervalRef.current = interval;

    return () => {
      clearInterval(interval);
      intervalRef.current = null;
    };
  }, [isTimerRunning]);

  // Cleanup effect - cleanup on unmount to prevent background sounds
  useEffect(() => {
    return () => {
      console.log('[QuizPackDisplay] Component unmounting, cleaning up');

      // Mark component as unmounted to prevent any sounds from playing
      isMountedRef.current = false;

      // Stop countdown audio
      stopCountdownAudio();
      console.log('[QuizPackDisplay] Countdown audio stopped');

      // Clear the interval if it's still running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[QuizPackDisplay] Interval cleared');
      }

      // Clear refs
      countdownRef.current = null;
      isFirstTickRef.current = true;
      audioPlayedRef.current = false;
      console.log('[QuizPackDisplay] Refs cleared');
    };
  }, []);

  // Notify parent when timer state changes
  useEffect(() => {
    if (onGameTimerStateChange) {
      onGameTimerStateChange(isTimerRunning);
    }
  }, [isTimerRunning, onGameTimerStateChange]);

  const handleStartTimer = useCallback(() => {
    console.log('[QuizPackDisplay] handleStartTimer called', { isTimerRunning, isMounted: isMountedRef.current });

    if (isTimerRunning) {
      console.log('[QuizPackDisplay] Timer already running, returning');
      return;
    }

    const timerLength = gameModeTimers.keypad || 30;
    console.log('[QuizPackDisplay] Starting timer with length:', timerLength);

    // Reset timer refs for this session
    countdownRef.current = timerLength;
    isFirstTickRef.current = true;
    audioPlayedRef.current = false;

    // Play countdown audio with normal mode (not silent)
    if (isMountedRef.current) {
      console.log('[QuizPackDisplay] Playing countdown audio:', timerLength);
      playCountdownAudio(timerLength, false).catch(error => {
        console.error('[QuizPackDisplay] Error playing countdown audio:', error);
      });
      audioPlayedRef.current = true;
    }

    // Set state to start timer display
    setCountdown(timerLength);
    setTimerFinished(false);
    setIsTimerRunning(true);
    setTimerStartValue(timerLength);
  }, [isTimerRunning, gameModeTimers.keypad]);

  const getQuestionTypeLabel = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'letters':
        return 'Letters';
      case 'multi':
        return 'Multiple Choice';
      case 'numbers':
      case 'nearest':
        return 'Numbers';
      case 'sequence':
        return 'Sequence';
      case 'buzzin':
        return 'Buzz In';
      default:
        return type;
    }
  };

  const getAnswerDisplay = (): string => {
    if (currentQuestion.answerText) {
      return currentQuestion.answerText;
    }
    
    if (currentQuestion.meta?.short_answer) {
      return currentQuestion.meta.short_answer;
    }

    if (currentQuestion.type.toLowerCase() === 'multi' && currentQuestion.options && currentQuestion.correctIndex !== undefined) {
      return currentQuestion.options[currentQuestion.correctIndex];
    }

    if (currentQuestion.type.toLowerCase() === 'letters' && currentQuestion.correctIndex !== undefined) {
      return String.fromCharCode(65 + currentQuestion.correctIndex);
    }

    return "Answer not available";
  };

  const getMultipleChoiceOptions = (): Array<{ letter: string; text: string; isCorrect: boolean }> => {
    if (!currentQuestion.options) return [];
    
    return currentQuestion.options.map((option, index) => ({
      letter: String.fromCharCode(65 + index),
      text: option,
      isCorrect: index === currentQuestion.correctIndex
    }));
  };

  const isFlagged = flaggedQuestions.has(currentQuestionIndex);

  const toggleFlag = () => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestionIndex)) {
        newSet.delete(currentQuestionIndex);
      } else {
        newSet.add(currentQuestionIndex);
      }
      return newSet;
    });
  };

  // Sync local state with parent's round values when they change (e.g., from bottom navigation controls)
  useEffect(() => {
    if (currentRoundPoints !== null && localPoints !== currentRoundPoints) {
      setLocalPoints(currentRoundPoints);
    }
  }, [currentRoundPoints]);

  useEffect(() => {
    if (currentRoundSpeedBonus !== null && localSpeedBonus !== currentRoundSpeedBonus) {
      setLocalSpeedBonus(currentRoundSpeedBonus);
    }
  }, [currentRoundSpeedBonus]);

  // Configuration Screen - exact copy of KeypadInterface layout
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
                    if (value[0] !== points[0]) {
                      setLocalPoints(value[0]);
                      if (onPointsChange) {
                        onPointsChange(value[0]);
                      }
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
                    if (value[0] !== speedBonus[0]) {
                      setLocalSpeedBonus(value[0]);
                      if (onSpeedBonusChange) {
                        onSpeedBonusChange(value[0]);
                      }
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
                    setAutoDisableEnabled(!autoDisableEnabled);
                  }}
                >
                  <div className="flex items-center gap-1 justify-center mb-1">
                    <Checkbox
                      checked={autoDisableEnabled}
                      onCheckedChange={setAutoDisableEnabled}
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

  // Question Display Screen
  if (!currentQuestion) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
        <Button onClick={onBack}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-800 text-white flex flex-col">
      {/* Top Header */}
      <div className="bg-red-700 px-8 py-6 flex justify-between items-center border-b-4 border-red-900">
        <div className="text-3xl font-bold tracking-wide">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </div>
        <div className="text-3xl font-bold tracking-wide">
          {getQuestionTypeLabel(currentQuestion.type)}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-10 py-10 flex flex-col">
        {/* Question Image if available */}
        {currentQuestion.imageDataUrl && (
          <div className="mb-8 flex justify-center">
            <div
              className="rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center"
              style={{
                width: '300px',
                height: '450px',
                aspectRatio: '2 / 3',
              }}
            >
              <img
                src={currentQuestion.imageDataUrl}
                alt="Question"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Question Text */}
        <div className="mb-14">
          <p className="text-3xl font-semibold leading-relaxed text-slate-100">
            {currentQuestion.q}
          </p>
        </div>

        {/* Multiple Choice Options */}
        {currentQuestion.type.toLowerCase() === 'multi' && (
          <div className="space-y-5 mb-8">
            {getMultipleChoiceOptions().map((option) => (
              <div
                key={option.letter}
                className={`p-5 rounded-lg border-2 flex items-start gap-5 transition-colors ${
                  option.isCorrect
                    ? 'bg-green-900 border-green-400 shadow-md'
                    : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                }`}
              >
                <span className="font-bold text-2xl min-w-12 text-slate-200">
                  {option.letter}.
                </span>
                <span className="text-lg flex-1 text-slate-100">
                  {option.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Letters Type Options */}
        {currentQuestion.type.toLowerCase() === 'letters' && currentQuestion.options && currentQuestion.options.length > 0 && (
          <div className="space-y-5 mb-8">
            {currentQuestion.options.map((option, index) => (
              <div
                key={index}
                className={`p-5 rounded-lg border-2 flex items-start gap-5 transition-colors ${
                  index === currentQuestion.correctIndex
                    ? 'bg-green-900 border-green-400 shadow-md'
                    : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                }`}
              >
                <span className="font-bold text-2xl min-w-12 text-slate-200">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="text-lg flex-1 text-slate-100">
                  {option}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Answer Display Section - VERY SMALL at bottom */}
        <div className="mt-auto pt-4 border-t border-slate-600">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Answer</p>
              <div className="bg-slate-900 border-l-2 border-yellow-500 rounded px-3 py-2">
                <p className="text-sm font-bold text-yellow-400">
                  {getAnswerDisplay()}
                </p>
              </div>
            </div>
            
            {/* Timer Progress Bar */}
            {isTimerRunning && countdown !== null && (
              <div className="w-32">
                <TimerProgressBar
                  isVisible={true}
                  timeRemaining={countdown}
                  totalTime={timerStartValue || gameModeTimers.keypad || 30}
                  position="bottom"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-slate-700 border-t-2 border-slate-600 px-8 py-5 flex justify-between items-center gap-6">
        <div className="flex gap-3">
          <Button
            onClick={onPreviousQuestion}
            disabled={isFirstQuestion}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold transition-all ${
              isFirstQuestion
                ? 'bg-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-slate-600 hover:bg-slate-500 text-white'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </Button>
          
          <Button
            onClick={onNextQuestion}
            disabled={isLastQuestion}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold transition-all ${
              isLastQuestion
                ? 'bg-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-slate-600 hover:bg-slate-500 text-white'
            }`}
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={toggleFlag}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold transition-all ${
              isFlagged
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-slate-600 hover:bg-slate-500 text-white'
            }`}
          >
            <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
            Flag
          </Button>
          
          <Button
            onClick={handleStartTimer}
            disabled={isTimerRunning}
            className={`flex items-center gap-2 px-6 py-2 rounded-md font-semibold transition-all ${
              isTimerRunning
                ? 'bg-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
            Start Timer
          </Button>
          
          <Button
            onClick={onBack}
            className="px-6 py-2 rounded-md font-semibold bg-slate-600 hover:bg-slate-500 text-white transition-all"
          >
            Exit Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}
