import React from 'react';

interface QuestionPanelProps {
  question: any;
  questionNumber: number;
  totalQuestions: number;
  showAnswer?: boolean;
  answerText?: string;
  correctIndex?: number;
  answerSubmitted?: string;
}

/**
 * QuestionPanel: Displays question, options, and optional image.
 * 
 * Layout:
 * - Right side: Fixed-size image area (if question.imageDataUrl present)
 * - Center: Large, readable question text
 * - Below: Dynamic options for Multi/Letters/Sequence, or nothing for Buzzin/Numbers
 * - Bottom: Optional answer display (when showAnswer is true)
 * 
 * The image is always visible to the host immediately; broadcasting to
 * players/external is controlled by the primary blue button (Send Picture action).
 */
export function QuestionPanel({
  question,
  questionNumber,
  totalQuestions,
  showAnswer = false,
  answerText = '',
  correctIndex = -1,
  answerSubmitted = '',
}: QuestionPanelProps) {
  if (!question) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 text-slate-400">
        <p className="text-lg">No question loaded</p>
      </div>
    );
  }

  const qType = (question.type || '').toLowerCase();
  const hasImage = !!question.imageDataUrl;
  const hasOptions = question.options && question.options.length > 0;

  // Render options as letters (A, B, C, ...)
  const renderOptions = () => {
    if (!hasOptions) return null;

    return (
      <div className="space-y-3 mb-6">
        {question.options.map((option: string, index: number) => {
          const letter = String.fromCharCode(65 + index);
          const isCorrectOption = correctIndex === index;
          const isSelectedOption = answerSubmitted === letter;

          return (
            <div
              key={`${letter}-${index}`}
              className={`p-4 rounded-lg border-2 flex items-start gap-4 transition-all ${
                showAnswer && isCorrectOption
                  ? 'bg-green-900 border-green-500 shadow-lg'
                  : isSelectedOption && !showAnswer
                  ? 'bg-blue-900 border-blue-500'
                  : 'bg-slate-700 border-slate-600 hover:border-slate-500'
              }`}
            >
              <span className="font-bold text-2xl min-w-10 text-slate-200">
                {letter}.
              </span>
              <span className="text-lg flex-1 text-slate-100">
                {option}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-slate-800 text-white flex flex-col">
      {/* Header with question number and type */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-300">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="text-sm font-semibold text-slate-300">
            {qType.charAt(0).toUpperCase() + qType.slice(1)}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto flex p-6 gap-6">
        {/* Left side: Question text and options */}
        <div className="flex-1 flex flex-col">
          {/* Question text */}
          <div className="mb-8">
            <p className="text-3xl font-semibold leading-relaxed text-slate-100">
              {question.q}
            </p>
          </div>

          {/* Options (for Multi, Letters, Sequence) */}
          {renderOptions()}

          {/* For Buzzin/Numbers: show placeholder */}
          {!hasOptions && (
            <div className="text-slate-400 text-lg mb-6">
              {qType === 'buzzin'
                ? 'Teams will submit free-text answers'
                : qType === 'numbers' || qType === 'nearest'
                ? 'Teams will submit numeric answers'
                : 'Teams will submit their answers'}
            </div>
          )}

          {/* Answer display (shown only after reveal) */}
          {showAnswer && (
            <div className="mt-auto pt-4 border-t border-slate-600">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">
                Answer
              </p>
              <div className="bg-slate-900 border-l-4 border-yellow-500 rounded px-4 py-3">
                <p className="text-2xl font-bold text-yellow-400">
                  {answerText || 'Answer not provided'}
                </p>
                {answerSubmitted && (
                  <p className="text-sm text-slate-400 mt-2">
                    Your answer: {answerSubmitted}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right side: Question image (fixed size) */}
        {hasImage && (
          <div className="flex-shrink-0 flex items-center">
            <div
              className="bg-slate-700 border-2 border-slate-600 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                width: '300px',
                height: '300px',
              }}
            >
              <img
                src={question.imageDataUrl}
                alt="Question"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
