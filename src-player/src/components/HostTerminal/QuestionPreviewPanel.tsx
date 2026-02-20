import React from 'react';

interface QuestionPreviewPanelProps {
  currentQuestion: any;
  currentQuestionIndex: number;
  totalQuestions: number;
  isQuizPackMode: boolean;
}

const getAnswerOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // A, B, C, D, etc.
};

export function QuestionPreviewPanel({
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  isQuizPackMode,
}: QuestionPreviewPanelProps) {
  // Don't show preview if no question or not in quiz pack mode
  if (!currentQuestion || !isQuizPackMode) {
    return null;
  }

  const options = currentQuestion.options || [];
  const hasImage = !!currentQuestion.imageDataUrl;

  return (
    <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
      {/* Question Header */}
      <div className="mb-4">
        <p className="text-slate-400 text-xs font-semibold uppercase mb-2">
          Question Preview - {currentQuestionIndex + 1} of {totalQuestions}
        </p>
        <h3 className="text-white font-semibold text-sm leading-relaxed">
          {currentQuestion.q || currentQuestion.question || 'No question text'}
        </h3>
      </div>

      {/* Image Thumbnail (if present) */}
      {hasImage && (
        <div className="mb-4">
          <img
            src={currentQuestion.imageDataUrl}
            alt="Question image"
            className="w-full h-24 object-cover rounded bg-slate-800"
          />
        </div>
      )}

      {/* Options Display */}
      {options.length > 0 && (
        <div className="mb-4">
          <p className="text-slate-400 text-xs font-semibold uppercase mb-2">Options</p>
          <div className="space-y-2">
            {options.map((option: string, index: number) => {
              // Handle both correctAnswer (numeric/string) and correctIndex
              const correctIndex = currentQuestion.correctIndex ?? currentQuestion.correctAnswer;
              const isCorrect =
                index === correctIndex ||
                option === currentQuestion.correctAnswer;

              return (
                <div
                  key={index}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isCorrect
                      ? 'bg-green-600/30 text-green-300 border border-green-500'
                      : 'bg-slate-600 text-slate-200'
                  }`}
                >
                  <span className="font-bold">{getAnswerOptionLabel(index)}.</span>{' '}
                  {option}
                  {isCorrect && (
                    <span className="ml-2 text-xs">✓ Correct</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Question Type Info */}
      <div className="pt-3 border-t border-slate-600">
        <p className="text-slate-400 text-xs">
          Type: <span className="text-slate-300 font-medium">{currentQuestion.type || 'Unknown'}</span>
        </p>
      </div>
    </div>
  );
}
