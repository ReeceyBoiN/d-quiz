import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import type { Question } from '../types/network';

interface QuestionDisplayProps {
  question: Question;
  timeRemaining: number;
  showTimer: boolean;
  onAnswerSubmit: (answer: any) => void;
}

export function QuestionDisplay({
  question,
  timeRemaining,
  showTimer,
  onAnswerSubmit,
}: QuestionDisplayProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
    setSubmitted(false);
  }, [question]);

  const handleSubmitAnswer = (answerIndex: number) => {
    if (submitted) return;
    
    setSelectedAnswer(answerIndex);
    setSubmitted(true);
    onAnswerSubmit({
      questionType: question.type,
      answer: question.options?.[answerIndex] || answerIndex,
      answerIndex,
    });
  };

  // Display question text - handle both q and text properties
  const questionText = question.q || question.text || '';
  const options = question.options || [];
  const isMultipleChoice = options.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Timer bar at top */}
      {showTimer && (
        <div className="bg-slate-700 h-1 w-full">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000"
            style={{
              width: `${Math.max(0, (timeRemaining / 30) * 100)}%`,
            }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Question Text */}
        <div className="mb-8 w-full max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight">
            {questionText}
          </h1>
        </div>

        {/* Image if present */}
        {question.imageUrl && (
          <div className="mb-8 max-w-md">
            <img
              src={question.imageUrl}
              alt="Question"
              className="w-full rounded-lg shadow-lg"
            />
          </div>
        )}

        {/* Multiple Choice Options */}
        {isMultipleChoice && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSubmitAnswer(index)}
                disabled={submitted}
                className={`p-4 rounded-lg font-semibold text-lg transition-all transform ${
                  submitted && selectedAnswer === index
                    ? 'bg-green-500 text-white scale-105 shadow-lg shadow-green-500/50'
                    : submitted
                    ? 'bg-slate-600 text-slate-300 opacity-50'
                    : 'bg-slate-700 text-white hover:bg-blue-600 active:scale-95'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Buzz In Button for other types */}
        {!isMultipleChoice && (
          <Button
            onClick={() => handleSubmitAnswer(0)}
            disabled={submitted}
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

        {/* Revealed answer display */}
        {question.revealed && (
          <div className="mt-8 text-center p-4 bg-slate-700 rounded-lg">
            <p className="text-slate-300 text-sm mb-2">Correct Answer:</p>
            <p className="text-2xl font-bold text-green-400">{question.revealedAnswer}</p>
          </div>
        )}
      </div>

      {/* Footer with status */}
      <div className="p-4 text-center text-slate-400 text-sm">
        {submitted && !question.revealed && 'Answer submitted! Waiting for reveal...'}
      </div>
    </div>
  );
}
