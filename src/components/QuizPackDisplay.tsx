import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ChevronLeft, ChevronRight, Flag, Star, Zap, Grid3X3, Skull, ArrowLeft, Timer as TimerIcon } from "lucide-react";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { useSettings } from "../utils/SettingsContext";
import { TimerProgressBar } from "./TimerProgressBar";

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
  onPointsChange?: (points: number) => void; // Callback when points slider changes
  onSpeedBonusChange?: (speedBonus: number) => void; // Callback when speed bonus slider changes
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
  onPointsChange,
  onSpeedBonusChange
}: QuizPackDisplayProps) {
  const [currentScreen, setCurrentScreen] = useState<'config' | 'question'>('config');
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerFinished, setTimerFinished] = useState(false);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [localSpeedBonus, setLocalSpeedBonus] = useState<number | null>(null);

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

  // Use local state if set, otherwise use defaults
  const currentPoints = localPoints !== null ? localPoints : defaultPoints;
  const currentSpeedBonus = localSpeedBonus !== null ? localSpeedBonus : defaultSpeedBonus;
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
    // Store the configured points in local state before triggering parent
    // The parent will access these values from the QuizHost state
    onStartQuiz?.();
  }, [onStartQuiz, currentPoints, currentSpeedBonus]);

  // Timer effect - handles countdown when timer is running
  useEffect(() => {
    if (!isTimerRunning || countdown === null) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        const newCountdown = prev - 1;

        if (newCountdown <= 0) {
          clearInterval(interval);
          setIsTimerRunning(false);
          setTimerFinished(true);
          return 0;
        }

        return newCountdown;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, countdown]);

  const handleStartTimer = useCallback(() => {
    if (isTimerRunning) return;

    const timerLength = gameModeTimers.keypad || 30;
    setCountdown(timerLength);
    setIsTimerRunning(true);
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

  // Configuration Screen
  if (currentScreen === 'config') {
    return (
      <div className="h-full bg-slate-700 text-slate-100 p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Points */}
          <div>
            <Card className="bg-slate-600 border-slate-500 mb-2">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-red-600 p-2 rounded-lg mb-2">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{points[0]}</div>
                  <h4 className="font-semibold mb-1 text-sm">Points</h4>
                  <p className="text-xs text-slate-200 mb-2">
                    Points awarded for each correct answer.
                  </p>
                  <Slider
                    value={points}
                    onValueChange={(value) => {
                      setLocalPoints(value[0]);
                      onPointsChange?.(value[0]);
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
            <Card className="bg-slate-600 border-slate-500 mb-2">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-red-600 p-2 rounded-lg mb-2">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{speedBonus[0]}</div>
                  <h4 className="font-semibold mb-1 text-sm">Speed Bonus</h4>
                  <p className="text-xs text-slate-200 mb-2">
                    Bonus points for fastest correct answering team.
                  </p>
                  <Slider
                    value={speedBonus}
                    onValueChange={(value) => {
                      setLocalSpeedBonus(value[0]);
                      onSpeedBonusChange?.(value[0]);
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

          {/* Go Wide */}
          <div>
            <Card 
              className={`border-slate-500 mb-2 transition-all cursor-pointer ${
                goWideEnabled ? 'bg-green-700 border-green-600' : 'bg-slate-500'
              }`}
              onClick={() => updateGoWideEnabled(!goWideEnabled)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-slate-600 p-2 rounded-lg mb-2">
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
                  <p className="text-xs text-slate-300 mb-3">
                    Multiple answers for half points.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evil Mode */}
          <div>
            <Card 
              className={`border-slate-500 mb-2 transition-all cursor-pointer ${
                evilModeEnabled ? 'bg-red-900 border-red-800' : 'bg-slate-500'
              }`}
              onClick={() => updateEvilModeEnabled(!evilModeEnabled)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-slate-600 p-2 rounded-lg mb-2">
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
                  <p className="text-xs text-slate-300 mb-2">
                    Take points from wrong answers.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleStartRound}
            className="flex-1 h-16 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            START QUIZ
          </Button>
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 h-16 border-slate-500 hover:bg-slate-600 text-slate-100 flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
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
            <img
              src={currentQuestion.imageDataUrl}
              alt="Question"
              className="max-h-64 max-w-full object-contain rounded-lg"
            />
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
            {isTimerRunning && (
              <div className="w-32">
                <TimerProgressBar
                  timeRemaining={countdown || 0}
                  totalTime={gameModeTimers.keypad || 30}
                  isFinished={timerFinished}
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
