import React, { useState, useEffect } from 'react';
import { useHostTerminalAPI } from './useHostTerminalAPI';

interface HostRemoteKeypadProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  isOnTheSpotMode: boolean;
  flowState?: {
    flow: string;
    isQuestionMode: boolean;
    currentQuestion?: any;
    answerSubmitted?: string;
    selectedQuestionType?: 'letters' | 'numbers' | 'multiple-choice' | 'sequence';
  } | null;
}

type QuestionType = 'letters' | 'numbers' | 'multiple-choice' | 'sequence';

// Letter grid with combined buttons for less common letters
const LETTERS_GRID = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P'],
  ['R', 'S', 'T', 'U'],
  ['QV', 'W', 'Y', 'XZ']
];

export function HostRemoteKeypad({
  deviceId,
  playerId,
  teamName,
  wsRef,
  isOnTheSpotMode,
  flowState,
}: HostRemoteKeypadProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confirmedAnswer, setConfirmedAnswer] = useState<string | null>(null);

  const { sendAdminCommand } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  // Sync confirmed answer with flowState when host submits the answer
  useEffect(() => {
    if (flowState?.answerSubmitted && !confirmedAnswer) {
      setConfirmedAnswer(flowState.answerSubmitted);
    }
  }, [flowState?.answerSubmitted, confirmedAnswer]);

  // Only show during appropriate states in on-the-spot mode
  const questionType = flowState?.selectedQuestionType;
  const shouldShow = isOnTheSpotMode &&
    flowState?.flow !== 'idle' &&
    flowState?.isQuestionMode &&
    questionType &&
    ['sent-question', 'running', 'timeup', 'revealed', 'fastest'].includes(flowState?.flow || '');

  if (!shouldShow || !questionType) {
    return null;
  }

  // Disable keypad if timer is still running or answer already confirmed
  const isTimerRunning = flowState?.flow === 'running';
  const isDisabled = confirmedAnswer !== null;

  const handleAnswerSelect = (answer: string) => {
    if (isDisabled) return;

    // For numbers questions: append digit instead of replacing
    // For other question types: replace the answer
    if (questionType === 'numbers') {
      // Append the digit, with a max of 10 digits
      setSelectedAnswer(prev => {
        const newAnswer = (prev ?? '') + answer;
        return newAnswer.length <= 10 ? newAnswer : prev;
      });
    } else {
      // For letters/multiple-choice: single selection (replace)
      setSelectedAnswer(answer);
    }
  };

  const handleBackspace = () => {
    if (isDisabled || !selectedAnswer) return;

    // Remove the last character
    const newAnswer = selectedAnswer.slice(0, -1);
    setSelectedAnswer(newAnswer || null);
  };

  const handleClear = () => {
    if (isDisabled) return;
    setSelectedAnswer(null);
  };

  const handleSubmit = () => {
    if (!selectedAnswer || isDisabled) {
      return;
    }

    // Send the answer to the host
    // Don't lock locally; let flowState.answerSubmitted sync it via the existing useEffect
    sendAdminCommand('set-expected-answer', { answer: selectedAnswer });
  };

  const renderLetterKeypad = () => {
    return (
      <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3">
        {LETTERS_GRID.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3">
            {row.map((letter, colIndex) => {
              const isSelected = selectedAnswer === letter;
              const isConfirmed = confirmedAnswer === letter;

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleAnswerSelect(letter)}
                  disabled={isDisabled}
                  className={`aspect-square p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl font-bold text-base sm:text-lg md:text-2xl transition-all transform ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'active:scale-95 cursor-pointer'
                  } ${
                    isConfirmed
                      ? 'bg-green-600 border-2 border-green-400 text-white shadow-lg'
                      : isSelected
                      ? 'bg-blue-600 border-2 border-blue-400 text-white shadow-lg'
                      : 'bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent'
                  }`}
                >
                  {letter}
                  {isConfirmed && ' ✓'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderNumberKeypad = () => {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    return (
      <div className="flex flex-col gap-3">
        {/* Display area for entered number */}
        <div className="p-4 rounded-lg border-2 border-cyan-400 bg-slate-800 text-center mb-3">
          <p className="text-white font-bold text-2xl sm:text-3xl md:text-4xl">
            {selectedAnswer || '—'}
          </p>
        </div>

        {/* Number grid */}
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5 md:gap-3">
          {numbers.map((num) => {
            const isSelected = selectedAnswer === num;
            const isConfirmed = confirmedAnswer === num;

            return (
              <button
                key={num}
                onClick={() => handleAnswerSelect(num)}
                disabled={isDisabled}
                className={`aspect-square p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl font-bold text-base sm:text-lg md:text-xl transition-all transform ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'active:scale-95 cursor-pointer'
                } ${
                  isConfirmed
                    ? 'bg-green-600 border-2 border-green-400 text-white shadow-lg'
                    : isSelected
                    ? 'bg-blue-600 border-2 border-blue-400 text-white shadow-lg'
                    : 'bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent'
                }`}
              >
                {num}
                {isConfirmed && ' ✓'}
              </button>
            );
          })}
        </div>

        {/* Control buttons */}
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 mt-2">
          <button
            onClick={handleBackspace}
            disabled={isDisabled || !selectedAnswer}
            className={`p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all ${
              isDisabled || !selectedAnswer
                ? 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            ← Back
          </button>
          <button
            onClick={handleClear}
            disabled={isDisabled || !selectedAnswer}
            className={`p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all ${
              isDisabled || !selectedAnswer
                ? 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            🗑️ Clear
          </button>
          <div />
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer || isDisabled}
            className={`p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all ${
              !selectedAnswer || isDisabled
                ? 'bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            ✓ Submit
          </button>
        </div>
      </div>
    );
  };

  const renderMultipleChoiceKeypad = () => {
    // Dynamically determine number of options from current question
    // If currentQuestion has options array, use its length; otherwise default to 4
    const optionCount = flowState?.currentQuestion?.options?.length || 4;
    // Generate choices based on option count (A, B, C, D, E, F, etc.)
    const choices = Array.from({ length: optionCount }, (_, i) => String.fromCharCode(65 + i));

    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
        {choices.map((choice) => {
          const isSelected = selectedAnswer === choice;
          const isConfirmed = confirmedAnswer === choice;

          return (
            <button
              key={choice}
              onClick={() => handleAnswerSelect(choice)}
              disabled={isDisabled}
              className={`aspect-square p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl md:rounded-2xl font-bold text-2xl sm:text-3xl md:text-4xl transition-all transform ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'active:scale-95 cursor-pointer'
              } ${
                isConfirmed
                  ? 'bg-green-600 border-2 border-green-400 text-white shadow-lg'
                  : isSelected
                  ? 'bg-blue-600 border-2 border-blue-400 text-white shadow-lg'
                  : 'bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent'
              }`}
            >
              {choice}
              {isConfirmed && ' ✓'}
            </button>
          );
        })}
      </div>
    );
  };

  const getKeypadRenderer = () => {
    switch (questionType) {
      case 'letters':
        return renderLetterKeypad;
      case 'numbers':
        return renderNumberKeypad;
      case 'multiple-choice':
        return renderMultipleChoiceKeypad;
      default:
        return () => null;
    }
  };

  const keypadRenderer = getKeypadRenderer();
  const typeLabel = questionType === 'multiple-choice' ? 'Multiple Choice' : questionType.charAt(0).toUpperCase() + questionType.slice(1);

  return (
    <div className="flex flex-col bg-slate-700 rounded-lg p-4 sm:p-5 md:p-6 border border-slate-600">
      {/* Header */}
      <div className="mb-4 sm:mb-5 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-white">
            📱 Answer Input
          </h3>
          {confirmedAnswer && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded-full">
              <span className="text-green-100 text-xs sm:text-sm font-semibold">✓ Confirmed</span>
            </div>
          )}
        </div>
        <p className="text-slate-300 text-xs sm:text-sm">
          Type: <span className="font-semibold text-white">{typeLabel}</span>
        </p>
      </div>

      {/* Status message */}
      {confirmedAnswer && (
        <div className="mb-4 p-3 bg-green-600/20 border border-green-500 rounded-lg">
          <p className="text-green-100 text-sm font-semibold text-center">
            ✓ Answer locked: <span className="text-lg font-bold">{confirmedAnswer}</span>
          </p>
        </div>
      )}

      {isTimerRunning && !confirmedAnswer && (
        <div className="mb-4 p-3 bg-amber-600/20 border border-amber-500 rounded-lg">
          <p className="text-amber-100 text-sm font-semibold text-center">
            ⏱️ Timer running
          </p>
        </div>
      )}

      {/* Keypad */}
      <div className="flex-1">
        {keypadRenderer()}
      </div>

      {/* Submit button (only for letter and multiple-choice modes) */}
      {questionType !== 'numbers' && (
        <div className="mt-4 sm:mt-5 md:mt-6">
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer || isDisabled}
            className={`w-full p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all ${
              !selectedAnswer || isDisabled
                ? 'bg-slate-600 text-slate-400 opacity-50 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            ✓ Confirm Answer
          </button>
        </div>
      )}
    </div>
  );
}
