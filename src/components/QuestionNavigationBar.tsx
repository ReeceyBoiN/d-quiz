import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Timer, Eye, Volume2, Send, Zap, ChevronRight, ChevronLeft } from "lucide-react";
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
  onReveal?: () => void; // Reveal answer button callback
  onNextAction?: () => void; // Next action button callback (for Next Question)
  onRevealFastestTeam?: () => void; // Reveal fastest team button callback
  onPreviousQuestion?: () => void; // Left arrow navigation callback
  onNextQuestion?: () => void; // Right arrow navigation callback
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
  showNavigationArrows?: boolean; // Whether to show navigation arrows (true during active gameplay)
  canGoToPreviousQuestion?: boolean; // Whether left arrow should be enabled
}

export function QuestionNavigationBar({
  isVisible,
  isQuizPackMode,
  flowState,
  onStartTimer,
  onSilentTimer,
  onHideQuestion,
  onReveal,
  onNextAction,
  onRevealFastestTeam,
  onPreviousQuestion,
  onNextQuestion,
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
  showNavigationArrows = false,
  canGoToPreviousQuestion = false,
}: QuestionNavigationBarProps) {
  const [shouldShowProgressBar, setShouldShowProgressBar] = useState(false);

  // Track when timer is running and delay hiding the progress bar for animation completion
  useEffect(() => {
    const actualTimerIsRunning = isQuizPackMode ? isTimerRunning : isOnTheSpotTimerRunning;

    if (actualTimerIsRunning) {
      setShouldShowProgressBar(true);
    } else if (shouldShowProgressBar) {
      // When timer stops, hide progress bar quickly so buttons become clickable
      // Use shorter delay for on-the-spot mode (100ms) vs quiz pack mode (1500ms) for animation
      const delayMs = isOnTheSpotsMode ? 100 : 1500;
      const timer = setTimeout(() => {
        setShouldShowProgressBar(false);
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [isTimerRunning, isOnTheSpotTimerRunning, isQuizPackMode, isOnTheSpotsMode, shouldShowProgressBar]);

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

        // Determine and call the appropriate handler based on current flow state
        const spacebarHandler = getSpacebarHandler();
        if (spacebarHandler) {
          spacebarHandler();
        }
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [isVisible, isOnTheSpotTimerRunning, isTimerRunning, isOnTheSpotsMode, flowState, onStartTimer, onReveal, onRevealFastestTeam, onNextAction]);

  // Add arrow key shortcuts for question navigation
  useEffect(() => {
    const handleArrowKeyPress = (e: KeyboardEvent) => {
      // Only trigger for arrow keys and not in an input field
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Don't trigger if any timer is running (quiz pack or on-the-spot)
      if (isTimerRunning || isOnTheSpotTimerRunning) {
        return;
      }

      // Only navigate if navigation arrows are visible
      if (!showNavigationArrows) {
        return;
      }

      e.preventDefault();

      // Handle left arrow - go to previous question
      if (e.key === 'ArrowLeft') {
        // Only trigger if we can go to previous question
        if (canGoToPreviousQuestion && onPreviousQuestion) {
          onPreviousQuestion();
        }
      }
      // Handle right arrow - go to next question
      else if (e.key === 'ArrowRight') {
        if (onNextQuestion) {
          onNextQuestion();
        }
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleArrowKeyPress);
      return () => window.removeEventListener('keydown', handleArrowKeyPress);
    }
  }, [isVisible, onPreviousQuestion, onNextQuestion, isTimerRunning, isOnTheSpotTimerRunning, showNavigationArrows, canGoToPreviousQuestion]);

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

  // Determine which handler should be called for spacebar based on current flow state
  const getSpacebarHandler = (): (() => void) | null => {
    // Special case: quiz pack mode with 'sent-question' state should trigger Start Timer
    if (isQuizPackMode && flowState.flow === 'sent-question') {
      return onStartTimer;
    }

    // Special case: on-the-spot mode with timer buttons should trigger Start Timer
    if (isOnTheSpotsMode && !isOnTheSpotTimerRunning && !onTheSpotTimerFinished) {
      return onStartTimer;
    }

    const currentButton = isOnTheSpotsMode ? getOnTheSpotFlowButton() : getFlowButton();

    if (!currentButton) {
      return null;
    }

    switch (currentButton.label) {
      case 'Reveal Answer':
        return onReveal || null;
      case 'Fastest Team':
      case 'Fastest Answer':
        return onRevealFastestTeam || null;
      case 'Next Question':
      case 'End Round':
        return onNextAction || null;
      case 'Send Picture':
      case 'Send Question':
        return onStartTimer;
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
          <div className="flex items-center justify-between w-full h-full gap-2">
            <div className="flex items-center gap-2">
              {/* Navigation arrows - LEFT SIDE */}
              {showNavigationArrows && (
                <>
                  {/* Left arrow button */}
                  <Button
                    onClick={onPreviousQuestion}
                    disabled={actualTimerIsRunning || !canGoToPreviousQuestion}
                    className="px-2 bg-slate-600 hover:bg-slate-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm rounded flex items-center justify-center"
                    title="Go to previous question"
                    style={{
                      opacity: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 0.5 : 1,
                      pointerEvents: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 'none' : 'auto',
                      cursor: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 'not-allowed' : 'pointer',
                      height: '32px',
                      width: '32px'
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  {/* Right arrow button */}
                  <Button
                    onClick={onNextQuestion}
                    disabled={actualTimerIsRunning}
                    className="px-2 bg-slate-600 hover:bg-slate-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm rounded flex items-center justify-center"
                    title="Go to next question"
                    style={{
                      opacity: actualTimerIsRunning ? 0.5 : 1,
                      pointerEvents: actualTimerIsRunning ? 'none' : 'auto',
                      cursor: actualTimerIsRunning ? 'not-allowed' : 'pointer',
                      height: '32px',
                      width: '32px'
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 h-full">
              {/* Start Silent Timer button */}
              <Button
                onClick={onSilentTimer}
                disabled={isTimerRunning}
                className="px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 whitespace-nowrap"
                title="Start timer without sound (silent countdown)"
                style={{
                  opacity: isTimerRunning ? 0.5 : 1,
                  pointerEvents: isTimerRunning ? 'none' : 'auto',
                  cursor: isTimerRunning ? 'not-allowed' : 'pointer'
                }}
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
                style={{
                  opacity: isTimerRunning ? 0.5 : 1,
                  pointerEvents: isTimerRunning ? 'none' : 'auto',
                  cursor: isTimerRunning ? 'not-allowed' : 'pointer'
                }}
              >
                <Timer className="h-4 w-4" />
                Start Timer
              </Button>
            </div>
          </div>
        ) : (
          // Flow button and Hide Question button for non-timer states
          <div className="flex items-center justify-between w-full h-full gap-2">
            <div className="flex items-center gap-2">
              {/* Navigation arrows - LEFT SIDE */}
              {showNavigationArrows && (
                <>
                  {/* Left arrow button */}
                  <Button
                    onClick={onPreviousQuestion}
                    disabled={actualTimerIsRunning || !canGoToPreviousQuestion}
                    className="px-2 bg-slate-600 hover:bg-slate-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm rounded flex items-center justify-center"
                    title="Go to previous question"
                    style={{
                      opacity: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 0.5 : 1,
                      pointerEvents: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 'none' : 'auto',
                      cursor: (actualTimerIsRunning || !canGoToPreviousQuestion) ? 'not-allowed' : 'pointer',
                      height: '32px',
                      width: '32px'
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  {/* Right arrow button */}
                  <Button
                    onClick={onNextQuestion}
                    disabled={actualTimerIsRunning}
                    className="px-2 bg-slate-600 hover:bg-slate-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white border-0 shadow-sm rounded flex items-center justify-center"
                    title="Go to next question"
                    style={{
                      opacity: actualTimerIsRunning ? 0.5 : 1,
                      pointerEvents: actualTimerIsRunning ? 'none' : 'auto',
                      cursor: actualTimerIsRunning ? 'not-allowed' : 'pointer',
                      height: '32px',
                      width: '32px'
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 h-full">
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
                  style={{
                    opacity: isTimerRunning ? 0.5 : 1,
                    pointerEvents: isTimerRunning ? 'none' : 'auto',
                    cursor: isTimerRunning ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Eye className="h-4 w-4" />
                  {hideQuestionMode ? 'Hidden' : 'Hide Question'}
                </Button>
              )}

              {/* Flow button */}
              {flowButton && (
                <Button
                  onClick={() => {
                    // Determine which handler to call based on button content
                    if (flowButton.label === 'Reveal Answer') {
                      onReveal?.();
                    } else if (flowButton.label === 'Fastest Team' || flowButton.label === 'Fastest Answer') {
                      onRevealFastestTeam?.();
                    } else if (flowButton.label === 'Next Question' || flowButton.label === 'End Round') {
                      onNextAction?.();
                    } else {
                      // For Send Picture/Send Question buttons, use onStartTimer
                      onStartTimer();
                    }
                  }}
                  disabled={
                    // For Send Question/Picture buttons: disable when timer is running
                    ((isQuizPackMode && flowState.flow === 'ready') || (isQuizPackMode && flowState.flow === 'sent-picture'))
                      ? (isTimerRunning || isSendQuestionDisabled)
                      // For Reveal Answer/Fastest Team/Next Question buttons: only disable if specifically blocked
                      : false
                  }
                  className={`px-3 text-white border-0 shadow-sm text-sm font-semibold rounded flex items-center gap-1.5 disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap ${
                    flowButton.color
                  }`}
                  style={{
                    opacity: (isTimerRunning || (isQuizPackMode && isTimerRunning)) ? 0.5 : 1,
                    pointerEvents: (isTimerRunning || (isQuizPackMode && isTimerRunning)) ? 'none' : 'auto',
                    cursor: (isTimerRunning || (isQuizPackMode && isTimerRunning)) ? 'not-allowed' : 'pointer'
                  }}
                  title={`Press Spacebar to ${flowButton.label}`}
                >
                  {flowButton.icon}
                  {flowButton.label}
                </Button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
