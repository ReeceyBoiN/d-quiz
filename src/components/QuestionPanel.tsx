import React, { useEffect } from 'react';
import { Send, Timer, Eye, Zap, ChevronRight } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';

interface QuestionPanelProps {
  question: any;
  questionNumber: number;
  totalQuestions: number;
  showAnswer?: boolean;
  answerText?: string;
  correctIndex?: number;
  answerSubmitted?: string;
  onPrimaryAction?: () => void;
  flow?: string;
  primaryLabel?: string;
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
  onPrimaryAction,
  flow = 'ready',
  primaryLabel = 'Send Question',
}: QuestionPanelProps) {
  const { gameModeTimers } = useSettings();
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

  // Determine button content based on flow state
  const getButtonContent = () => {
    switch (flow) {
      case 'ready':
        return {
          text: primaryLabel || 'Send Question',
          icon: <Send className="w-4 h-4" />
        };
      case 'sent-picture':
        return {
          text: 'Send Question',
          icon: <Send className="w-4 h-4" />
        };
      case 'sent-question':
        return {
          text: 'Start Timer',
          icon: <Timer className="w-4 h-4" />
        };
      case 'running':
      case 'timeup':
        return {
          text: 'Reveal Answer',
          icon: <Eye className="w-4 h-4" />
        };
      case 'revealed':
        return {
          text: 'Fastest Team',
          icon: <Zap className="w-4 h-4" />
        };
      case 'fastest':
        const isLastQuestion = questionNumber >= totalQuestions;
        return {
          text: isLastQuestion ? 'End Round' : 'Next Question',
          icon: <ChevronRight className="w-4 h-4" />
        };
      default:
        return {
          text: 'Send Question',
          icon: <Send className="w-4 h-4" />
        };
    }
  };

  const { text, icon } = getButtonContent();

  // Add spacebar shortcut for primary action
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        onPrimaryAction?.();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onPrimaryAction]);

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

      {/* Dynamic Primary Action Button - Styled to match Keypad interface */}
      <button
        onClick={onPrimaryAction}
        title="Press Spacebar to trigger this action"
        className="border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-xl font-semibold bg-[#3498db] hover:bg-[#2980b9] text-white transition-all hover:scale-105 active:scale-95"
        style={{
          margin: '0 24.6px 75px auto',
          whiteSpace: 'nowrap',
        }}
      >
        {icon}
        <span>{text}</span>
      </button>
    </div>
  );
}
