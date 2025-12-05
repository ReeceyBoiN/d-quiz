import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Timer, Eye, Volume2, Send, Zap, ChevronRight } from "lucide-react";
import type { HostFlow } from "../state/flowState";
import { hasQuestionImage } from "../state/flowState";
import { TimerProgressBar } from "./TimerProgressBar";

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
  isOnTheSpotsMode?: boolean; // Whether we're in on-the-spot game mode
  isOnTheSpotTimerRunning?: boolean; // Whether on-the-spot timer is running
  timeRemaining?: number; // Current time remaining in seconds (for timer progress bar)
  totalTime?: number; // Total time in seconds (for timer progress bar)
  onTheSpotTimerFinished?: boolean; // Whether on-the-spot timer has finished
  onTheSpotAnswerRevealed?: boolean; // Whether on-the-spot answer has been revealed
  onTheSpotFastestRevealed?: boolean; // Whether on-the-spot fastest team has been revealed
  hasTeamsAnsweredCorrectly?: boolean; // Whether any teams answered correctly (for on-the-spot)
  onTheSpotAnswerSelected?: boolean; // Whether user has selected an answer (for on-the-spot)
  isSendQuestionDisabled?: boolean; // Whether Send Question button should be disabled after fastest team
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
  isOnTheSpotsMode = false,
  isOnTheSpotTimerRunning = false,
  timeRemaining = 0,
  totalTime = 0,
  onTheSpotTimerFinished = false,
  isSendQuestionDisabled = false,
  onTheSpotAnswerRevealed = false,
  onTheSpotFastestRevealed = false,
  hasTeamsAnsweredCorrectly = false,
  onTheSpotAnswerSelected = false,
}: QuestionNavigationBarProps) {
  const [shouldShowProgressBar, setShouldShowProgressBar] = useState(false);

  // Track when timer is running and delay hiding the progress bar for animation completion
  useEffect(() => {
    const actualTimerIsRunning = isQuizPackMode ? isTimerRunning : isOnTheSpotTimerRunning;

    if (actualTimerIsRunning) {
      setShouldShowProgressBar(true);
    } else if (shouldShowProgressBar) {
      // When timer stops, wait 1.5 seconds for animation to complete before hiding
      const timer = setTimeout(() => {
        setShouldShowProgressBar(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isTimerRunning, isOnTheSpotTimerRunning, isQuizPackMode, shouldShowProgressBar]);

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
        // Don't trigger spacebar if any timer is running (quiz pack or on-the-spot)
        if (isTimerRunning || isOnTheSpotTimerRunning) {
          return;
        }

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
  }, [isVisible, onStartTimer, isOnTheSpotTimerRunning, isTimerRunning]);

  // Determine button content based on on-the-spot game state
  const getOnTheSpotFlowButton = () => {
    // If timer running, no button shown (timer progress bar takes precedence)
    if (isOnTheSpotTimerRunning) {
      return null;
    }

    // After timer finishes and answer selected, but answer not revealed
    if (onTheSpotTimerFinished && onTheSpotAnswerSelected && !onTheSpotAnswerRevealed) {
      return {
        label: 'Reveal Answer',
        icon: <Eye className="h-4 w-4" />,
        color: 'bg-blue-600 hover:bg-blue-700',
      };
    }

    // After answer revealed
    if (onTheSpotAnswerRevealed && !onTheSpotFastestRevealed) {
      // If teams answered correctly, show "Fastest Team" button
      if (hasTeamsAnsweredCorrectly) {
        return {
          label: 'Fastest Team',
          icon: <Zap className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      }
      // If no teams answered correctly, skip to "Next Question"
      return {
        label: 'Next Question',
        icon: <ChevronRight className="h-4 w-4" />,
        color: 'bg-blue-600 hover:bg-blue-700',
      };
    }

    // After fastest team revealed
    if (onTheSpotFastestRevealed) {
      return {
        label: 'Next Question',
        icon: <ChevronRight className="h-4 w-4" />,
        color: 'bg-blue-600 hover:bg-blue-700',
      };
    }

    return null;
  };

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
          label: isOnTheSpotsMode ? 'Fastest Answer' : 'Fastest Team',
          icon: <Zap className="h-4 w-4" />,
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'fastest':
        // For on-the-spot mode: always show 'Next Question' (returns to question selection)
        // For quiz pack mode: show 'End Round' only on last question
        if (isOnTheSpotsMode) {
          return {
            label: 'Next Question',
            icon: <ChevronRight className="h-4 w-4" />,
            color: 'bg-blue-600 hover:bg-blue-700',
          };
        } else {
          const isLastQuestion = questionNumber >= totalQuestions;
          return {
            label: isLastQuestion ? 'End Round' : 'Next Question',
            icon: <ChevronRight className="h-4 w-4" />,
            color: 'bg-blue-600 hover:bg-blue-700',
          };
        }
      default:
        return null;
    }
  };

  // Get the appropriate flow button based on mode
  const getFlowButtonForMode = () => {
    if (isOnTheSpotsMode) {
      return getOnTheSpotFlowButton();
    } else {
      return getFlowButton();
    }
  };

  const flowButton = getFlowButtonForMode();

  // Determine if we should show timer buttons
  const shouldShowTimerButtons = isQuizPackMode
    ? flowState.flow === 'sent-question'
    : isOnTheSpotsMode && !isOnTheSpotTimerRunning && !onTheSpotTimerFinished;

  // Determine whether timer is running for this navigation bar (quiz pack vs on-the-spot)
  const actualTimerIsRunning = isQuizPackMode ? isTimerRunning : isOnTheSpotTimerRunning;

  // Show timer progress bar when timer is running, otherwise show buttons
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="w-full bg-sidebar-accent border-t border-sidebar-border px-3 py-0 flex items-center justify-center gap-2 z-40"
      style={{ marginBottom: '12px', minHeight: '35px' }}
    >
      {shouldShowProgressBar && totalTime > 0 ? (
        // Render TimerProgressBar in the bottom navigation when timer is active
        <TimerProgressBar
          isVisible={shouldShowProgressBar}
          timeRemaining={timeRemaining}
          totalTime={totalTime}
          position="bottom"
        />
      ) : (
        // Right side: Flow-state dependent buttons or Hide Question button
        shouldShowTimerButtons ? (
          // Timer button group for sent-question state (quiz pack) or on-the-spot mode
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
                disabled={isTimerRunning || (isSendQuestionDisabled && (flowState.flow === 'ready' || flowState.flow === 'sent-picture'))}
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
        )
      )}
    </div>
  );
}
