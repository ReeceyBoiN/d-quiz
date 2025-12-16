import { useState, useEffect, useContext } from 'react';
import { NetworkContext } from '../context/NetworkContext';
import { usePlayerSettings, type KeypadColor } from '../hooks/usePlayerSettings';
import { Button } from '../ui/button';
import type { Question } from '../types/network';
import { getQuestionTypeLabel, isPlaceholderQuestion } from '../types/network';

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

// Helper function to convert index to letter (0 -> A, 1 -> B, etc.)
const indexToLetter = (index: number | string): string => {
  const idx = typeof index === 'string' ? parseInt(index, 10) : index;
  if (isNaN(idx) || idx < 0) return String(index);
  return String.fromCharCode(65 + idx); // 65 is ASCII for 'A'
};

// Letter grid with combined buttons for less common letters
const LETTERS_GRID = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P'],
  ['R', 'S', 'T', 'U'],
  ['QV', 'W', 'Y', 'XZ']
];

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
  const networkSelectedAnswers = networkContext?.selectedAnswers ?? [];

  const [selectedAnswers, setSelectedAnswers] = useState<(string | number)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [timerEnded, setTimerEnded] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [numberInput, setNumberInput] = useState<string>('0');
  const [numberSubmitted, setNumberSubmitted] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswers([]);
    setSubmitted(false);
    setTimerEnded(false);
    setSubmittedAnswer(null);
    setNumberInput('0');
    setNumberSubmitted(false);
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

    // Determine question type for answer conversion
    const questionType = question?.type?.toLowerCase().trim() || 'buzzin';
    const isMultipleChoiceQuestion = questionType === 'multiple-choice';

    // Convert numeric index to letter for multiple-choice questions
    const isMultipleChoiceAnswer = typeof answerValue === 'number' && isMultipleChoiceQuestion;
    const answerToSubmit = isMultipleChoiceAnswer ? indexToLetter(answerValue) : answerValue;

    // Auto-disable: if 2 or fewer options available, max 1 answer regardless of go-wide
    const optionCount = options.length;
    const autoDisableGoWide = goWideEnabled && optionCount <= 2;
    const maxAnswers = autoDisableGoWide ? 1 : (goWideEnabled ? 2 : 1);

    // Handle single answer mode (not go wide)
    if (!goWideEnabled || autoDisableGoWide) {
      setSelectedAnswers([answerValue]);
      setSubmittedAnswer(String(answerToSubmit));
      onAnswerSubmit({
        questionType: question?.type,
        answer: answerToSubmit,
        answerIndex: 0,
        answerCount: 1
      });
      setSubmitted(true);
      return;
    }

    // Handle go wide mode (multiple answers, max 2)
    if (selectedAnswers.includes(answerValue)) {
      // Deselect if already selected
      setSelectedAnswers(selectedAnswers.filter((a) => a !== answerValue));
      if (selectedAnswers.length === 1) {
        setSubmittedAnswer(null);
      }
    } else if (selectedAnswers.length < maxAnswers) {
      // Add to selection if under limit
      const newAnswers = [...selectedAnswers, answerValue];
      setSelectedAnswers(newAnswers);
      const submitAnswers = newAnswers.map(a => {
        const isMultiChoice = typeof a === 'number' && isMultipleChoiceQuestion;
        return isMultiChoice ? indexToLetter(a) : String(a);
      });
      setSubmittedAnswer(submitAnswers.join(', '));
      // Send answer immediately
      onAnswerSubmit({
        questionType: question?.type,
        answer: submitAnswers[submitAnswers.length - 1],
        answerIndex: newAnswers.length - 1,
        goWideMode: true,
        allAnswers: submitAnswers,
        answerCount: newAnswers.length
      });
    }
  };

  // Handle number pad digit entry (1-9)
  const handleNumberDigit = (digit: string) => {
    if (timerEnded || numberSubmitted) return;

    // Prevent leading zeros (0 -> stay as 0, but can't prepend)
    if (numberInput === '0') {
      setNumberInput(digit);
    } else {
      // Prevent excessively long numbers (max 10 digits)
      if (numberInput.length < 10) {
        setNumberInput(numberInput + digit);
      }
    }
  };

  // Handle zero button
  const handleNumberZero = () => {
    if (timerEnded || numberSubmitted) return;

    // Prevent leading zeros
    if (numberInput === '0') {
      return; // Stay at 0
    }

    // Add zero if not already at max length
    if (numberInput.length < 10) {
      setNumberInput(numberInput + '0');
    }
  };

  // Handle clear button
  const handleClearNumber = () => {
    if (timerEnded || numberSubmitted) return;
    setNumberInput('0');
  };

  // Handle submit button
  const handleSubmitNumber = () => {
    if (timerEnded || numberSubmitted) return;

    // Convert to number
    const numericValue = parseInt(numberInput, 10);

    // Set submitted answer for display feedback (mirrors letters behavior)
    setSubmittedAnswer(String(numericValue));

    // Send the answer
    onAnswerSubmit({
      questionType: question?.type,
      answer: numericValue,
      answerIndex: 0,
      answerCount: 1
    });

    // Lock the keypad
    setNumberSubmitted(true);
  };

  // Display question text - handle both q and text properties
  const questionText = question?.q || question?.text || '';
  const options = question?.options || [];

  // Normalize and cache the question type
  const rawType = question?.type;
  const questionType: QuestionType = rawType?.toLowerCase().trim() || 'buzzin';

  // Debug logging for question type
  if (rawType && rawType !== questionType) {
    console.log('[QuestionDisplay] Question type received:', rawType, '-> normalized:', questionType);
  }

  // Determine if we're showing a placeholder (waiting for real question)
  const isShowingPlaceholder = isPlaceholderQuestion(questionText) || question?.isPlaceholder;

  // Determine which input interface to show based on question type
  // Note: No longer requiring options.length > 0 because host now provides placeholder options for all types
  // Perform case-insensitive type checking for defensive programming
  const isMultipleChoice = questionType === 'multiple-choice';
  const isLetters = questionType === 'letters';
  const isNumbers = questionType === 'numbers';
  const isSequence = questionType === 'sequence';
  const isBuzzIn = questionType === 'buzzin' || (!isMultipleChoice && !isLetters && !isNumbers && !isSequence);

  // Log which interface will be rendered
  useEffect(() => {
    if (question) {
      console.log('[QuestionDisplay] Rendering interface for type:', questionType, {
        isLetters,
        isMultipleChoice,
        isNumbers,
        isSequence,
        isBuzzIn,
        optionsCount: options.length,
        isPlaceholder: isShowingPlaceholder
      });
    }
  }, [questionType, question, options.length, isShowingPlaceholder, isLetters, isMultipleChoice, isNumbers, isSequence, isBuzzIn]);

  // Get letter grid structure (6 rows with combined buttons for less common letters)
  const getLetterGrid = () => {
    console.log('[QuestionDisplay] Using letter grid with combined QV and XZ buttons');
    return LETTERS_GRID;
  };

  // Generate number options (1, 2, 3, ... 9)
  const generateNumberOptions = () => {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  };

  // Determine button state classes
  const getButtonStateClasses = (answerValue: string | number, index?: number) => {
    const isSelected = selectedAnswers.includes(answerValue);
    const baseColor = KEYPAD_COLOR_CLASSES[settings.keypadColor];

    // Normalize comparison: convert index to letter for multiple choice questions
    const normalizeForComparison = (value: string | number): string => {
      if (typeof value === 'number' && isMultipleChoice) {
        return String.fromCharCode(65 + value); // Convert 0->A, 1->B, etc.
      }
      return String(value);
    };

    const normalizedAnswerValue = normalizeForComparison(answerValue);
    const normalizedCorrectAnswer = typeof correctAnswer === 'string'
      ? correctAnswer.toUpperCase()
      : correctAnswer !== undefined ? normalizeForComparison(correctAnswer) : undefined;
    // Use networkSelectedAnswers for reveal comparisons (from host broadcast), fallback to local selectedAnswers
    const answersToCompare = answerRevealed && networkSelectedAnswers.length > 0 ? networkSelectedAnswers : selectedAnswers;
    const normalizedSelectedAnswers = answersToCompare.map(a => normalizeForComparison(a));

    const isCorrect = Array.isArray(normalizedCorrectAnswer)
      ? normalizedCorrectAnswer.some(ans => ans === normalizedAnswerValue)
      : normalizedCorrectAnswer === normalizedAnswerValue;

    const isUserSelected = normalizedSelectedAnswers.includes(normalizedAnswerValue);

    // After reveal: show correct answers in green (flashing), selected wrong answers in red (flashing), rest greyed
    if (answerRevealed) {
      if (isCorrect) {
        // Start with green, animation will take over
        return 'bg-green-500 text-white animate-flash-green cursor-default';
      }
      if (isUserSelected) {
        // Start with red, animation will take over
        return 'bg-red-500 text-white animate-flash-red cursor-default';
      }
      return 'bg-slate-600 text-slate-300 opacity-50 cursor-default';
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

    // Normalize comparison: convert index to letter for multiple choice questions
    const normalizeForComparison = (value: string | number): string => {
      if (typeof value === 'number' && isMultipleChoice) {
        return String.fromCharCode(65 + value); // Convert 0->A, 1->B, etc.
      }
      return String(value);
    };

    const normalizedAnswerValue = normalizeForComparison(answerValue);
    const normalizedCorrectAnswer = typeof correctAnswer === 'string'
      ? correctAnswer.toUpperCase()
      : correctAnswer !== undefined ? normalizeForComparison(correctAnswer) : undefined;
    // Use networkSelectedAnswers for reveal comparisons (from host broadcast), fallback to local selectedAnswers
    const answersToCompare = answerRevealed && networkSelectedAnswers.length > 0 ? networkSelectedAnswers : selectedAnswers;
    const normalizedSelectedAnswers = answersToCompare.map(a => normalizeForComparison(a));

    const isCorrect = Array.isArray(normalizedCorrectAnswer)
      ? normalizedCorrectAnswer.some(ans => ans === normalizedAnswerValue)
      : normalizedCorrectAnswer === normalizedAnswerValue;

    const isUserSelected = normalizedSelectedAnswers.includes(normalizedAnswerValue);

    // Show checkmark for all correct answers, X only for selected wrong answers
    if (isCorrect) return ' ✓';
    if (isUserSelected && !isCorrect) return ' ✗';
    return null;
  };

  // Get animation class for answer reveal (returns empty string - animations are in getButtonStateClasses)
  const getAnimationClass = (answerValue: string | number, index?: number): string => {
    // Animation classes are handled in getButtonStateClasses when answerRevealed is true
    // This function is kept for backward compatibility but returns empty string
    return '';
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Go Wide Indicator */}
      {goWideEnabled && (
        <div className={`text-white text-center py-2 text-sm font-semibold ${options.length <= 2 ? 'bg-orange-600' : 'bg-blue-600'}`}>
          {options.length <= 2
            ? `Auto-Disable: Limited options (${options.length} available) - Select 1 answer`
            : `Go Wide - Select up to 2 answers ${selectedAnswers.length > 0 ? `(${selectedAnswers.length}/2 selected)` : ''}`
          }
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

      <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 md:px-6 lg:px-8 pb-16 sm:pb-20">
        {/* Question Text or Type Label Area */}
        <div className="mb-4 sm:mb-6 md:mb-8 lg:mb-10 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
          {questionText && !isPlaceholderQuestion(questionText) ? (
            // Show actual question text
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white text-center leading-tight">
              {questionText}
            </h1>
          ) : (
            // Show question type label when waiting for question or placeholder is shown
            <div className="min-h-[80px] sm:min-h-[100px] md:min-h-[120px] flex items-center justify-center">
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-slate-300 text-center uppercase tracking-wide">
                {getQuestionTypeLabel(questionType)}
              </p>
            </div>
          )}
        </div>

        {/* Image if present */}
        {question?.imageUrl && (
          <div className="mb-4 sm:mb-6 md:mb-8 lg:mb-10">
            <div
              className="rounded-md sm:rounded-lg md:rounded-xl shadow-lg bg-slate-700 flex items-center justify-center"
              style={{
                width: 'min(100%, 200px)',
                height: 'auto',
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
          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
            {options.map((option, index) => {
              // Show letter placeholder (A, B, C, D) if waiting for real question
              const displayText = isShowingPlaceholder ? String.fromCharCode(65 + index) : option;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={
                    timerEnded ||
                    (!goWideEnabled && submitted && !selectedAnswers.includes(index))
                  }
                  className={`w-full p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg sm:rounded-xl md:rounded-xl lg:rounded-xl font-bold text-sm sm:text-base md:text-lg lg:text-2xl transition-all transform active:scale-95 ${getButtonStateClasses(
                    index,
                    index
                  )} ${getAnimationClass(index, index)}`}
                >
                  {displayText}
                  {getRevealIcon(index, index)}
                </button>
              );
            })}
          </div>
        )}

        {/* Letter Options */}
        {isLetters && (
          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
            {/* Submission Feedback */}
            {submittedAnswer && (
              <div className="mb-2 sm:mb-3 md:mb-4 p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg sm:rounded-xl md:rounded-2xl text-center shadow-lg">
                <p className="text-white font-bold text-base sm:text-lg md:text-xl lg:text-2xl">
                  ✓ Answer Submitted
                </p>
                <p className="text-cyan-100 font-semibold text-sm sm:text-base md:text-lg lg:text-xl mt-1 sm:mt-2">
                  {submittedAnswer}
                </p>
              </div>
            )}

            {/* Letter Grid - Rows */}
            {getLetterGrid().map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4">
                {row.map((letter, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleAnswerSelect(letter)}
                    disabled={
                      timerEnded ||
                      (!goWideEnabled && submitted && !selectedAnswers.includes(letter))
                    }
                    className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-2xl font-bold text-base sm:text-lg md:text-2xl lg:text-4xl transition-all transform active:scale-95 ${getButtonStateClasses(
                      letter
                    )} ${getAnimationClass(letter)}`}
                  >
                    {letter}
                    {getRevealIcon(letter)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Number Options */}
        {isNumbers && (
          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
            {/* Submission Feedback */}
            {submittedAnswer && (
              <div className="mb-2 sm:mb-3 md:mb-4 p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg sm:rounded-xl md:rounded-2xl text-center shadow-lg">
                <p className="text-white font-bold text-base sm:text-lg md:text-xl lg:text-2xl">
                  ✓ Answer Submitted
                </p>
                <p className="text-cyan-100 font-semibold text-sm sm:text-base md:text-lg lg:text-xl mt-1 sm:mt-2">
                  {submittedAnswer}
                </p>
              </div>
            )}

            {/* Display area for entered number */}
            <div className="mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl border-2 border-cyan-400 bg-slate-800 text-center">
              <p className="text-white font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl">{numberInput}</p>
            </div>
            {/* Number grid - 3 columns */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 mb-2 sm:mb-3 md:mb-4 lg:mb-5">
              {generateNumberOptions().map((number, index) => (
                <button
                  key={index}
                  onClick={() => handleNumberDigit(number)}
                  disabled={timerEnded || numberSubmitted}
                  className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl font-bold text-base sm:text-lg md:text-2xl lg:text-3xl transition-all transform ${
                    !numberSubmitted && !timerEnded ? 'active:scale-95' : ''
                  } ${
                    numberSubmitted || timerEnded
                      ? 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  }`}
                >
                  {number}
                </button>
              ))}
            </div>
            {/* Control buttons row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4">
              <button
                onClick={handleClearNumber}
                disabled={timerEnded || numberSubmitted}
                className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl font-bold text-sm sm:text-base md:text-lg lg:text-xl transition-all ${
                  !numberSubmitted && !timerEnded ? 'active:scale-95' : ''
                } ${
                  numberSubmitted || timerEnded
                    ? 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                }`}
              >
                CLR
              </button>
              <button
                onClick={handleNumberZero}
                disabled={timerEnded || numberSubmitted}
                className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl font-bold text-sm sm:text-base md:text-lg lg:text-xl transition-all ${
                  !numberSubmitted && !timerEnded ? 'active:scale-95' : ''
                } ${
                  numberSubmitted || timerEnded
                    ? 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer'
                }`}
              >
                0
              </button>
              <button
                onClick={handleSubmitNumber}
                disabled={timerEnded || numberSubmitted}
                className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl font-bold text-sm sm:text-base md:text-lg lg:text-xl transition-all ${
                  !numberSubmitted && !timerEnded ? 'active:scale-95' : ''
                } ${
                  numberSubmitted || timerEnded
                    ? 'bg-slate-600 text-slate-300 opacity-50 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                }`}
              >
                ✓
              </button>
            </div>
          </div>
        )}

        {/* Sequence Options - Ordered selection */}
        {isSequence && (
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
            {options.map((option, index) => {
              // Show letter placeholder (A, B, C, D) if waiting for real question
              const displayText = isShowingPlaceholder ? String.fromCharCode(65 + index) : option;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={
                    timerEnded ||
                    (!goWideEnabled && submitted && !selectedAnswers.includes(index))
                  }
                  className={`aspect-square p-2 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl md:rounded-xl font-bold text-base sm:text-lg md:text-2xl lg:text-3xl transition-all transform active:scale-95 ${getButtonStateClasses(
                    index,
                    index
                  )} ${getAnimationClass(index, index)}`}
                >
                  {displayText}
                  {getRevealIcon(index, index)}
                </button>
              );
            })}
          </div>
        )}

        {/* Buzz In Button for question types without options or explicit buzzin type */}
        {isBuzzIn && (
          <Button
            onClick={() => handleAnswerSelect('buzzed')}
            disabled={timerEnded || submitted}
            className={`px-4 sm:px-8 md:px-12 lg:px-16 py-3 sm:py-4 md:py-6 lg:py-8 text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold rounded-lg sm:rounded-xl md:rounded-xl transition-all transform active:scale-95 ${
              submitted
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {submitted ? '✓ Answer Submitted' : 'BUZZ IN'}
          </Button>
        )}

        {/* Time remaining display */}
        {showTimer && (
          <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 text-center">
            <p className="text-slate-400 text-xs sm:text-sm md:text-base lg:text-lg">
              Time Remaining: <span className="text-cyan-400 font-bold">{timeRemaining}s</span>
            </p>
          </div>
        )}

        {/* Timer ended notification */}
        {timerEnded && !answerRevealed && (
          <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 text-center">
            <p className="text-orange-400 font-semibold text-sm sm:text-base md:text-lg lg:text-xl">Time's up! Waiting for reveal...</p>
          </div>
        )}

      </div>

      {/* Footer with status */}
      <div className="p-2 sm:p-3 md:p-4 lg:p-5 text-center text-slate-400 text-xs sm:text-sm md:text-base lg:text-lg">
        {goWideEnabled && options.length > 2 && selectedAnswers.length > 0 && !timerEnded && (
          <span>
            Selected: {selectedAnswers.length}/2 answers {selectedAnswers.length < 2 && '(Select another or wait for timer)'}
          </span>
        )}
        {goWideEnabled && options.length <= 2 && selectedAnswers.length > 0 && !timerEnded && 'Answer submitted! Waiting for timer to end...'}
        {!goWideEnabled && selectedAnswers.length > 0 && !timerEnded && 'Answer submitted! Waiting for timer to end...'}
        {timerEnded && !answerRevealed && 'Waiting for reveal...'}
      </div>

      {/* Answer Feedback Overlay */}
      {answerRevealed && networkContext?.showAnswerFeedback && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="flex flex-col items-center justify-center gap-6">
            {networkContext?.isAnswerCorrect ? (
              <div
                className="text-9xl text-green-500 font-bold"
                style={{
                  textShadow: '0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.6), 0 0 90px rgba(34, 197, 94, 0.4)',
                  filter: 'drop-shadow(0 0 25px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 50px rgba(34, 197, 94, 0.5))',
                  textRendering: 'optimizeLegibility',
                  WebkitTextStroke: '1px rgba(34, 197, 94, 0.3)'
                }}
              >
                ✓
              </div>
            ) : (
              <div
                className="text-9xl text-red-500 font-bold"
                style={{
                  textShadow: '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.6), 0 0 90px rgba(239, 68, 68, 0.4)',
                  filter: 'drop-shadow(0 0 25px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 50px rgba(239, 68, 68, 0.5))',
                  textRendering: 'optimizeLegibility',
                  WebkitTextStroke: '1px rgba(239, 68, 68, 0.3)'
                }}
              >
                ✗
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
