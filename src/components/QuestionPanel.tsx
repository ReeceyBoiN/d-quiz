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
      <div
        style={{
          borderBottomWidth: '1px',
          borderColor: 'rgb(74, 85, 104)',
          fontSize: '37px',
          fontWeight: '400',
          lineHeight: '55.5px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: '400',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              display: 'flex',
              fontWeight: '600',
              gap: '4px',
            }}
          >
            <div style={{ fontSize: '35px', fontWeight: '600', lineHeight: '52.5px', marginBottom: '5px' }}>Question</div>
            <div style={{ fontSize: '35px', fontWeight: '600', lineHeight: '52.5px' }}>{questionNumber}</div>
            <div style={{ fontSize: '35px', fontWeight: '600', lineHeight: '52.5px', margin: '0 3px 0 1px' }}>of</div>
            <div style={{ fontSize: '35px', fontWeight: '600', lineHeight: '52.5px' }}>{totalQuestions}</div>
          </span>
          <div
            style={{
              display: 'block',
              fontSize: '35px',
              fontWeight: '600',
              lineHeight: '52.5px',
              margin: '0 0 5px 50px',
            }}
          >
            {qType.charAt(0).toUpperCase() + qType.slice(1)}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto flex p-6 gap-6">
        {/* Left side: Question text and options */}
        <div
          className="flex-1 flex flex-col"
          style={{
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
        >
          {/* Question text */}
          <div className="mb-8">
            <p className="text-3xl leading-relaxed text-slate-100">
              {question.q}
            </p>
          </div>

          {/* Options (for Multi, Letters, Sequence) */}
          {renderOptions()}

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
        height: '450px',
        aspectRatio: '2 / 3',
      }}
            >
              <img
        src={question.imageDataUrl}
        alt="Question"
        className="w-full h-full object-contain"
      />
            </div>
          </div>
        )}
      </div>

      {/* Primary action button moved to QuestionNavigationBar */}
    </div>
  );
}
