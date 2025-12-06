import { useState, useEffect } from 'react';
import { LettersInterface } from './LettersInterface';
import { NumbersInterface } from './NumbersInterface';
import { MultipleChoiceInterface } from './MultipleChoiceInterface';
import { ImageLoader } from './ImageLoader';
import { SubmissionFeedback, type SubmissionState } from './SubmissionFeedback';
import { StateIndicator, type QuestionState } from './StateIndicator';
import type { Question } from '../types/network';

interface QuestionDisplayProps {
  question: Question;
  timeRemaining: number;
  totalTimeRemaining?: number;
  showTimer: boolean;
  submissionState?: SubmissionState;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  onAnswerSubmit: (answer: any) => void;
}

export function QuestionDisplay({
  question,
  timeRemaining,
  totalTimeRemaining = 30,
  showTimer,
  submissionState = 'idle',
  connectionStatus = 'connected',
  onAnswerSubmit,
}: QuestionDisplayProps) {
  const [submitted, setSubmitted] = useState(false);
  const [questionShown, setQuestionShown] = useState(false);
  const [questionState, setQuestionState] = useState<QuestionState>('waiting');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);

  useEffect(() => {
    setSubmitted(false);
    setQuestionShown(false);
    setImageLoadError(false);
    setQuestionState('ready');
    setSelectedAnswerIndex(null);
  }, [question]);

  // When question text should be revealed (questionShown flag from host)
  useEffect(() => {
    if (question.shown) {
      // Add 500ms delay for smoother transition
      const timer = setTimeout(() => {
        setQuestionShown(true);
        setQuestionState('shown');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [question.shown]);

  // Track submission state
  useEffect(() => {
    if (submissionState === 'confirmed') {
      setSubmitted(true);
      setQuestionState('answered');
    } else if (submissionState === 'submitting') {
      setQuestionState('waiting');
    }
  }, [submissionState]);

  const handleAnswerSubmit = (answer: any) => {
    setSubmitted(true);
    // Capture the selected answer index for multiple choice questions
    if (answer.answerIndex !== undefined) {
      setSelectedAnswerIndex(answer.answerIndex);
    }
    onAnswerSubmit({
      questionType: question.type,
      answer: answer,
      selectedAnswerIndex: answer.answerIndex,
      timestamp: Date.now(),
    });
  };

  // Display question text - handle both q and text properties
  const questionText = question.q || question.text || '';
  const options = question.options || [];

  // Determine which input interface to show based on question type
  const getInputInterface = () => {
    const maxAnswers = question.maxAnswers || 1;

    switch (question.type) {
      case 'letters':
        return (
          <LettersInterface
            onSubmit={(answer) =>
              handleAnswerSubmit({ input: 'letter', answer })
            }
            disabled={submitted}
            questionShown={questionShown}
            maxAnswers={maxAnswers}
          />
        );

      case 'numbers':
      case 'nearest':
        return (
          <NumbersInterface
            onSubmit={(answer) =>
              handleAnswerSubmit({ input: 'number', answer })
            }
            disabled={submitted}
            questionShown={questionShown}
            maxAnswers={maxAnswers}
          />
        );

      case 'multi':
      case 'multiple-choice':
        return (
          <MultipleChoiceInterface
            options={options}
            onSubmit={(answerIndex, answer) =>
              handleAnswerSubmit({ input: 'choice', answer, answerIndex })
            }
            disabled={submitted}
            questionShown={questionShown}
            maxAnswers={maxAnswers}
            revealed={question.revealed || false}
            correctIndex={question.correctIndex}
            playerSelectedIndex={question.playerSelectedIndex}
          />
        );

      case 'buzzin':
        return (
          <div className="flex flex-col items-center justify-center gap-6">
            <p className="text-slate-400 text-sm">
              {!questionShown && 'Waiting for question...'}
              {questionShown && submitted && 'Buzzed in!'}
              {questionShown && !submitted && 'Click to buzz in'}
            </p>
            <button
              onClick={() => handleAnswerSubmit({ input: 'buzzin' })}
              disabled={submitted || !questionShown}
              className={`px-12 py-8 text-3xl font-bold rounded-lg transition-all transform ${
                !questionShown
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : submitted
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              }`}
            >
              {submitted ? '✓ BUZZED IN' : 'BUZZ IN'}
            </button>
          </div>
        );

      case 'sequence':
        return (
          <div className="flex flex-col items-center justify-center gap-6">
            <p className="text-slate-400 text-sm">
              {!questionShown && 'Waiting for question...'}
              {questionShown && submitted && 'Answer submitted!'}
              {questionShown && !submitted && 'Select in order'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() =>
                    handleAnswerSubmit({ input: 'sequence', answer: option })
                  }
                  disabled={submitted || !questionShown}
                  className={`p-4 rounded-lg font-semibold text-lg transition-all transform ${
                    !questionShown
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                      : submitted
                      ? 'bg-slate-600 text-slate-300 opacity-50'
                      : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center text-slate-400">
            Unknown question type: {question.type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timer progress bar at top */}
      {showTimer && (
        <div className="w-full h-2 bg-slate-700">
          <div
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: `${Math.max(0, (timeRemaining / totalTimeRemaining) * 100)}%`,
              backgroundColor:
                timeRemaining > totalTimeRemaining * 0.5
                  ? '#06b6d4' // cyan-400 when time is good
                  : timeRemaining > totalTimeRemaining * 0.2
                  ? '#eab308' // yellow-400 when time is medium
                  : '#ef4444', // red-500 when time is running out
            }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* State indicator */}
        <div className="mb-4 w-full max-w-2xl">
          <StateIndicator state={questionState} connectionStatus={connectionStatus} />
        </div>

        {/* Question Text - Only visible when questionShown is true */}
        {questionShown && (
          <div className="mb-8 w-full max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight">
              {questionText}
            </h1>
          </div>
        )}

        {/* Image with preloading and error handling */}
        {question.imageUrl && (
          <ImageLoader
            src={question.imageUrl}
            alt="Question image"
            onLoadStart={() => setQuestionState('waiting')}
            onLoadSuccess={() => {
              if (questionShown) {
                setQuestionState('shown');
              }
            }}
            onLoadError={(error) => {
              console.error('Image load error:', error);
              setImageLoadError(true);
            }}
            timeout={5000}
          />
        )}

        {/* Input Interface - Always visible to show input type */}
        <div className="w-full">
          {getInputInterface()}
        </div>

        {/* Time remaining display */}
        {showTimer && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Time Remaining:{' '}
              <span
                className="font-bold"
                style={{
                  color:
                    timeRemaining > 15
                      ? '#06b6d4' // cyan-400
                      : timeRemaining > 5
                      ? '#eab308' // yellow-400
                      : '#ef4444', // red-500
                }}
              >
                {timeRemaining}s
              </span>
            </p>
          </div>
        )}

        {/* Revealed answer display */}
        {question.revealed && (
          <div className="mt-8 text-center p-4 bg-slate-700 rounded-lg">
            <p className="text-slate-300 text-sm mb-2">Correct Answer:</p>
            <p className="text-2xl font-bold text-green-400">
              {question.revealedAnswer}
            </p>
          </div>
        )}
      </div>

      {/* Footer with status */}
      <div className="p-4 text-center text-slate-400 text-sm">
        {submitted && !question.revealed && 'Answer submitted! Waiting for reveal...'}
      </div>

      {/* Submission feedback toast */}
      <SubmissionFeedback
        state={submissionState}
        message={
          submissionState === 'submitting'
            ? 'Submitting answer...'
            : submissionState === 'confirmed'
            ? 'Answer received ✓'
            : 'Failed to submit answer'
        }
      />
    </div>
  );
}
