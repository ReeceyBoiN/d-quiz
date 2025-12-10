import { useState, useEffect, useContext } from 'react';
import { NetworkContext } from '../context/NetworkContext';
import { usePlayerSettings, type KeypadColor } from '../hooks/usePlayerSettings';
import { Button } from '../ui/button';
import type { Question } from '../types/network';

interface QuestionDisplayProps {
  question?: Question;
  timeRemaining: number;
  showTimer: boolean;
  totalTimerLength?: number;
  onAnswerSubmit: (answer: any) => void;
}

type QuestionType = 'letters' | 'numbers' | 'multiple-choice' | string;

// Keypad color mapping
const KEYPAD_COLOR_CLASSES: Record<KeypadColor, string> = {
  cyan: 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700',
  blue: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
  purple: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
  green: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
  orange: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
  pink: 'bg-pink-500 hover:bg-pink-600 active:bg-pink-700',
};

export function QuestionDisplay({
  question,
  timeRemaining,
  showTimer,
  totalTimerLength = 30,
  onAnswerSubmit,
}: QuestionDisplayProps) {
  const { settings } = usePlayerSettings();
  const networkContext = useContext(NetworkContext);
  const goWideEnabled = networkContext?.goWideEnabled ?? false;
  const answerRevealed = networkContext?.answerRevealed ?? false;
  const correctAnswer = networkContext?.correctAnswer;

  const [selectedAnswers, setSelectedAnswers] = useState<(string | number)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswers([]);
    setSubmitted(false);
    setTimerEnded(false);
  }, [question]);

  // Track when timer ends
  useEffect(() => {
    if (timeRemaining <= 0 && showTimer) {
      setTimerEnded(true);
    }
  }, [timeRemaining, showTimer]);

  const handleAnswerSelect = (answerValue: string | number) => {
    // Can't select if timer ended
    if (timerEnded) return;

    // Handle single answer mode (not go wide)
    if (!goWideEnabled) {
      setSelectedAnswers([answerValue]);
      onAnswerSubmit({
        questionType: question?.type,
        answer: answerValue,
        answerIndex: 0,
      });
      setSubmitted(true);
      return;
    }

    // Handle go wide mode (multiple answers)
    if (selectedAnswers.includes(answerValue)) {
      // Deselect if already selected
      setSelectedAnswers(selectedAnswers.filter((a) => a !== answerValue));
    } else if (selectedAnswers.length < 2) {
      // Add to selection if under limit
      const newAnswers = [...selectedAnswers, answerValue];
      setSelectedAnswers(newAnswers);
      // Send answer immediately
      onAnswerSubmit({
        questionType: question?.type,
        answer: answerValue,
        answerIndex: newAnswers.length - 1,
        goWideMode: true,
        allAnswers: newAnswers,
      });
    }
  };

  // Display question text - handle both q and text properties
  const questionText = question?.q || question?.text || '';
  const options = question?.options || [];
  const questionType: QuestionType = question?.type?.toLowerCase() || 'multiple-choice';

  const isMultipleChoice = questionType === 'multiple-choice' && options.length > 0;
  const isLetters = questionType === 'letters';
  const isNumbers = questionType === 'numbers';

  // Generate letter options (A, B, C, D, ...)
  const generateLetterOptions = () => {
    if (options.length === 0) return [];
    return options.map((_, index) => String.fromCharCode(65 + index)); // A, B, C, D, ...
  };

  // Generate number options (1, 2, 3, ...)
  const generateNumberOptions = () => {
    if (options.length === 0) return [];
    return Array.from({ length: options.length }, (_, i) => String(i + 1)); // 1, 2, 3, ...
  };

  // Determine button state classes
  const getButtonStateClasses = (answerValue: string | number, index?: number) => {
    const isSelected = selectedAnswers.includes(answerValue);
    const baseColor = KEYPAD_COLOR_CLASSES[settings.keypadColor];
    const isCorrect = Array.isArray(correctAnswer)
      ? correctAnswer.includes(answerValue)
      : correctAnswer === answerValue || correctAnswer === index;

    // After reveal: show correct answers in green, selected wrong answers in red, rest greyed
    if (answerRevealed) {
      if (isCorrect) {
        return 'bg-green-500 text-white shadow-lg shadow-green-500/50';
      }
      if (isSelected) {
        return 'bg-red-500 text-white shadow-lg shadow-red-500/50';
      }
      return 'bg-slate-600 text-slate-300 opacity-50';
    }

    // Timer ended: grey out except selected
    if (timerEnded) {
      return isSelected
        ? `${baseColor} text-white shadow-lg`
        : 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed';
    }

    // After submission in non-go-wide mode: grey out unselected answers
    if (submitted && !goWideEnabled) {
      return isSelected
        ? `${baseColor} text-white shadow-lg`
        : 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed';
    }

    // Normal state: selected or not
    return isSelected ? `${baseColor} text-white shadow-lg` : `${baseColor} text-white`;
  };

  // Get reveal icon for answer
  const getRevealIcon = (answerValue: string | number, index?: number) => {
    if (!answerRevealed) return null;

    const isCorrect = Array.isArray(correctAnswer)
      ? correctAnswer.includes(answerValue)
      : correctAnswer === answerValue || correctAnswer === index;
    const isSelected = selectedAnswers.includes(answerValue);

    // Show checkmark for all correct answers, X only for selected wrong answers
    if (isCorrect) return ' ✓';
    if (isSelected && !isCorrect) return ' ✗';
    return null;
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Go Wide Indicator */}
      {goWideEnabled && (
        <div className="bg-blue-600 text-white text-center py-2 text-sm font-semibold">
          Go Wide - Select up to 2 answers
        </div>
      )}

      {/* Timer bar at top */}
      {showTimer && (
        <div className="bg-slate-700 h-1 w-full">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000"
            style={{
              width: `${Math.max(0, (timeRemaining / totalTimerLength) * 100)}%`,
            }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Question Text or Waiting Area */}
        <div className="mb-8 w-full max-w-2xl">
          {questionText ? (
            <h1 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight">
              {questionText}
            </h1>
          ) : (
            <div className="min-h-[120px] flex items-center justify-center text-slate-500 text-lg">
              Waiting for question...
            </div>
          )}
        </div>

        {/* Image if present */}
        {question?.imageUrl && (
          <div className="mb-8">
            <div
              className="rounded-lg shadow-lg bg-slate-700 flex items-center justify-center"
              style={{
                width: '300px',
                height: '450px',
                aspectRatio: '2 / 3',
              }}
            >
              <img
                src={question.imageUrl}
                alt="Question"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Multiple Choice Options */}
        {isMultipleChoice && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={
                  timerEnded ||
                  (!goWideEnabled && submitted && !selectedAnswers.includes(index))
                }
                className={`p-4 rounded-lg font-semibold text-lg transition-all transform ${getButtonStateClasses(
                  index,
                  index
                )}`}
              >
                {option}
                {getRevealIcon(index, index)}
              </button>
            ))}
          </div>
        )}

        {/* Letter Options */}
        {isLetters && options.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
            {generateLetterOptions().map((letter, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(letter)}
                disabled={
                  timerEnded ||
                  (!goWideEnabled && submitted && !selectedAnswers.includes(letter))
                }
                className={`p-6 rounded-lg font-bold text-2xl transition-all transform ${getButtonStateClasses(
                  letter
                )}`}
              >
                {letter}
                {getRevealIcon(letter)}
              </button>
            ))}
          </div>
        )}

        {/* Number Options */}
        {isNumbers && options.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
            {generateNumberOptions().map((number, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(number)}
                disabled={
                  timerEnded ||
                  (!goWideEnabled && submitted && !selectedAnswers.includes(number))
                }
                className={`p-6 rounded-lg font-bold text-2xl transition-all transform ${getButtonStateClasses(
                  number
                )}`}
              >
                {number}
                {getRevealIcon(number)}
              </button>
            ))}
          </div>
        )}

        {/* Buzz In Button for question types without options */}
        {!isMultipleChoice && !isLetters && !isNumbers && (
          <Button
            onClick={() => handleAnswerSelect('buzzed')}
            disabled={timerEnded || submitted}
            className={`px-12 py-8 text-3xl font-bold rounded-lg transition-all transform ${
              submitted
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            {submitted ? '✓ Answer Submitted' : 'BUZZ IN'}
          </Button>
        )}

        {/* Time remaining display */}
        {showTimer && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Time Remaining: <span className="text-cyan-400 font-bold">{timeRemaining}s</span>
            </p>
          </div>
        )}

        {/* Timer ended notification */}
        {timerEnded && !answerRevealed && (
          <div className="mt-8 text-center">
            <p className="text-orange-400 font-semibold">Time's up! Waiting for reveal...</p>
          </div>
        )}

        {/* Revealed answer display */}
        {answerRevealed && (
          <div className="mt-8 text-center p-4 bg-slate-700 rounded-lg">
            <p className="text-slate-300 text-sm mb-2">Correct Answer:</p>
            <p className="text-2xl font-bold text-green-400">
              {Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer}
            </p>
            {selectedAnswers.length > 0 && (
              <p className="text-slate-400 text-sm mt-3">
                Your answer: {selectedAnswers.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer with status */}
      <div className="p-4 text-center text-slate-400 text-sm">
        {goWideEnabled && selectedAnswers.length > 0 && !timerEnded && (
          <span>
            Selected: {selectedAnswers.length}/2 answers {selectedAnswers.length < 2 && '(Select another or wait for timer)'}
          </span>
        )}
        {!goWideEnabled && selectedAnswers.length > 0 && !timerEnded && 'Answer submitted! Waiting for timer to end...'}
        {timerEnded && !answerRevealed && 'Waiting for reveal...'}
      </div>
    </div>
  );
}
