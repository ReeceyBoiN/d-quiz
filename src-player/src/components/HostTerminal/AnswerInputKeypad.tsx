import React, { useState, useMemo } from 'react';
import { useHostTerminalAPI } from './useHostTerminalAPI';
import { normalizeQuestionType } from '../../types/network';

interface AnswerInputKeypadProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  isOnTheSpotMode: boolean;
  flowState?: {
    flow: string;
    isQuestionMode: boolean;
    isQuizPackMode?: boolean;
    selectedQuestionType?: 'letters' | 'numbers' | 'multiple-choice';
    currentQuestion?: any;
  } | null;
}

type QuestionType = 'letters' | 'numbers' | 'multiple-choice';

export function AnswerInputKeypad({
  deviceId,
  playerId,
  teamName,
  wsRef,
  isOnTheSpotMode,
  flowState,
}: AnswerInputKeypadProps) {
  const [expectedAnswer, setExpectedAnswer] = useState<string>('');
  const { sendAdminCommand } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  // Only show during timer states in on-the-spot mode
  const shouldShow = isOnTheSpotMode &&
    (flowState?.flow === 'sent-question' || flowState?.flow === 'running') &&
    flowState?.isQuestionMode;

  // Try to get question type from flowState.selectedQuestionType first,
  // fallback to normalized currentQuestion.type
  const questionType = flowState?.selectedQuestionType ||
    (flowState?.currentQuestion ? normalizeQuestionType(flowState.currentQuestion.type) : undefined) as QuestionType | undefined;

  if (!shouldShow || !questionType) {
    if (!questionType && shouldShow) {
      console.warn('[AnswerInputKeypad] Cannot render: missing selectedQuestionType and currentQuestion.type');
    }
    return null;
  }

  const handleKeyPress = (key: string) => {
    // Letters: A-F
    if (questionType === 'letters') {
      if (key.match(/^[A-F]$/i)) {
        setExpectedAnswer(key.toUpperCase());
      }
    }
    // Numbers: 0-9, allow multiple digits
    else if (questionType === 'numbers') {
      if (key === 'Clear') {
        setExpectedAnswer('');
      } else if (key.match(/^[0-9]$/)) {
        setExpectedAnswer((prev) => (prev + key).slice(0, 10)); // Max 10 digits
      }
    }
    // Multiple Choice: A-D
    else if (questionType === 'multiple-choice') {
      if (key.match(/^[A-D]$/i)) {
        setExpectedAnswer(key.toUpperCase());
      }
    }
  };

  const handleClear = () => {
    setExpectedAnswer('');
  };

  const handleSubmit = () => {
    if (!expectedAnswer) {
      console.warn('[AnswerInputKeypad] No answer selected');
      return;
    }

    console.log('[AnswerInputKeypad] Submitting answer:', expectedAnswer);
    sendAdminCommand('set-expected-answer', { answer: expectedAnswer });
    // Keep the answer visible after submission
  };

  const renderLetterKeypad = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    return (
      <div className="grid grid-cols-3 gap-2 mb-4">
        {letters.map((letter) => (
          <button
            key={letter}
            onClick={() => handleKeyPress(letter)}
            className={`py-3 rounded-lg font-bold text-lg transition-all ${
              expectedAnswer === letter
                ? 'bg-green-600 border-2 border-green-400 text-white'
                : 'bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
    );
  };

  const renderNumberKeypad = () => {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    return (
      <div className="grid grid-cols-5 gap-2 mb-4">
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => handleKeyPress(num)}
            className="py-3 rounded-lg font-bold text-lg bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent transition-all"
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  const renderMultipleChoiceKeypad = () => {
    const choices = ['A', 'B', 'C', 'D'];
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {choices.map((choice) => (
          <button
            key={choice}
            onClick={() => handleKeyPress(choice)}
            className={`py-4 rounded-lg font-bold text-lg transition-all ${
              expectedAnswer === choice
                ? 'bg-green-600 border-2 border-green-400 text-white'
                : 'bg-slate-600 hover:bg-slate-500 text-white border-2 border-transparent'
            }`}
          >
            {choice}
          </button>
        ))}
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

  return (
    <div className="flex flex-col h-full p-6 bg-gradient-to-b from-slate-800 to-slate-900 overflow-auto">
      <h2 className="text-xl font-bold text-white mb-6">Expected Answer Input</h2>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Question Type Indicator */}
        <div className="w-full max-w-sm mb-8 p-4 bg-slate-700 rounded-lg border border-slate-600">
          <p className="text-slate-300 text-sm text-center">
            Question Type:{' '}
            <span className="font-bold text-white capitalize">
              {questionType === 'multiple-choice' ? 'Multiple Choice' : questionType}
            </span>
          </p>
        </div>

        {/* Answer Display */}
        <div className="w-full max-w-sm mb-8">
          <label className="block text-slate-300 text-sm mb-2 font-semibold">Expected Answer:</label>
          <div className="bg-slate-900 border-2 border-slate-600 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white h-12 flex items-center justify-center">
              {expectedAnswer || <span className="text-slate-400 text-lg">—</span>}
            </p>
          </div>
        </div>

        {/* Dynamic Keypad */}
        <div className="w-full max-w-sm mb-8">
          {keypadRenderer()}

          {/* Number Keypad Clear Button */}
          {questionType === 'numbers' && (
            <button
              onClick={handleClear}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg mb-2 transition-all"
            >
              🗑️ Clear
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!expectedAnswer}
          className={`w-full max-w-sm px-6 py-4 font-bold text-lg rounded-lg transition-all ${
            expectedAnswer
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
          }`}
        >
          <span className="text-2xl mr-2">✓</span>
          Set Answer
        </button>
      </div>

      <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
        <p className="text-slate-300 text-sm">
          <span className="font-semibold">ℹ️ How to use:</span> Select or type the expected answer. This helps track which team answers fastest and correctly.
        </p>
      </div>
    </div>
  );
}
