import React, { useEffect } from "react";
import { Button } from "./ui/button";
import { Timer, Eye, Volume2, Send, Zap, ChevronRight } from "lucide-react";
import type { HostFlow } from "../state/flowState";
import { hasQuestionImage } from "../state/flowState";

interface QuestionNavigationBarProps {
  isVisible: boolean;
  isQuizPackMode: boolean;
  flowState: HostFlow;
  onStartTimer: () => void;
  onSilentTimer: () => void;
  onHideQuestion: () => void;
  leftSidebarWidth: number;
  isTimerRunning: boolean;
  timerProgress: number; // 0-100
  hideQuestionMode?: boolean; // Whether question is currently hidden
  currentQuestion?: any; // Question object to check for image
  questionNumber?: number; // Current question number
  totalQuestions?: number; // Total questions
}

export function QuestionNavigationBar({
  isVisible,
  isQuizPackMode,
  flowState,
  onStartTimer,
  onSilentTimer,
  onHideQuestion,
  leftSidebarWidth,
  isTimerRunning,
  timerProgress,
  hideQuestionMode = false,
  currentQuestion,
  questionNumber = 1,
  totalQuestions = 1,
}: QuestionNavigationBarProps) {
  if (!isVisible) return null;

  // Determine progress bar color based on time remaining
  const getProgressColor = () => {
    if (timerProgress > 50) return "bg-green-500";
    if (timerProgress > 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Add spacebar shortcut for primary actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();

        // Spacebar triggers the appropriate action for the current flow state
        // The handler (onStartTimer) is context-aware and knows how to interpret each state
        onStartTimer();
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isVisible, onStartTimer]);

  // Show timer progress bar when timer is running
  if (isTimerRunning) {
    return (
      <div
        className="w-full bg-sidebar-accent border-t border-sidebar-border h-[60px] flex items-center z-40"
      >
        {/* Timer progress bar */}
        <div className="flex-1 h-full flex items-center px-4">
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${getProgressColor()}`}
              style={{
                width: `${timerProgress}%`,
              }}
            />
            {/* Glow effect */}
            <div
              className={`h-full absolute top-0 left-0 ${getProgressColor()} opacity-30 blur-sm transition-all duration-1000 ease-linear`}
              style={{
                width: `${timerProgress}%`,
              }}
            />
          </div>

          {/* Time display */}
          <div className="ml-4 text-white font-semibold text-sm whitespace-nowrap">
            {Math.ceil(flowState.timeRemaining)}s
          </div>
        </div>
      </div>
    );
  }

  // Determine button content based on flow state
  const getFlowButton = () => {
    const hasPicture = hasQuestionImage(currentQuestion);

    switch (flowState.flow) {
      case 'ready':
        return {
          label: hasPicture ? 'Send Picture' : 'Send Question',
          icon: <Send className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'sent-picture':
        return {
          label: 'Send Question',
          icon: <Send className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'sent-question':
        return null; // Timer buttons shown instead
      case 'running':
      case 'timeup':
        return {
          label: 'Reveal Answer',
          icon: <Eye className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'revealed':
        return {
          label: 'Fastest Team',
          icon: <Zap className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'fastest':
        const isLastQuestion = questionNumber >= totalQuestions;
        return {
          label: isLastQuestion ? 'End Round' : 'Next Question',
          icon: <ChevronRight className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      default:
        return null;
    }
  };

  const flowButton = getFlowButton();

  // Show buttons when timer is not running
  return (
    <div
      className="w-full bg-sidebar-accent border-t border-sidebar-border px-3 py-0 h-[35px] flex items-center justify-center gap-2 z-40"
      style={{ marginBottom: '12px' }}
    >
      {/* Right side: Flow-state dependent buttons or Hide Question button */}
      {flowState.flow === 'sent-question' ? (
        // Timer button group for sent-question state
        <div className="flex items-center gap-2 ml-auto h-full">
          {/* Start Silent Timer button */}
          <Button
            onClick={onSilentTimer}
            disabled={isTimerRunning}
            className="px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 whitespace-nowrap"
            title="Start timer without sound (silent countdown)"
          >
            <Volume2 className="h-4 w-4" />
            Silent Timer
          </Button>

          {/* Start Timer button */}
          <Button
            onClick={onStartTimer}
            disabled={isTimerRunning}
            className="px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 whitespace-nowrap"
            title="Start timer with sound countdown"
          >
            <Timer className="h-4 w-4" />
            Start Timer
          </Button>
        </div>
      ) : (
        // Flow button and Hide Question button for non-timer states
        <div className="flex items-center gap-2 ml-auto h-full">
          {/* Hide Question button - only for quiz pack mode, only when NOT in sent-question state */}
          {isQuizPackMode && (
            <Button
              onClick={onHideQuestion}
              className={`px-3 text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 transition-all whitespace-nowrap ${
                hideQuestionMode
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={
                hideQuestionMode
                  ? 'Question is hidden - click to send normally'
                  : 'Hide question from external display and players'
              }
            >
              <Eye className="h-4 w-4" />
              {hideQuestionMode ? 'Hidden' : 'Hide Question'}
            </Button>
          )}

          {/* Flow button */}
          {flowButton && (
            <Button
              onClick={onStartTimer}
              disabled={isTimerRunning}
              className={`px-3 text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap ${
                flowButton.color
              }`}
              title={`Press Spacebar to ${flowButton.label}`}
            >
              {flowButton.icon}
              {flowButton.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
