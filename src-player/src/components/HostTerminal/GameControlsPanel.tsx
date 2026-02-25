import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHostTerminalAPI } from './useHostTerminalAPI';
import { QuestionPreviewPanel } from './QuestionPreviewPanel';

interface GameControlsPanelProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  flowState?: {
    flow: string;
    isQuestionMode: boolean;
    currentQuestion?: any;
    currentLoadedQuestionIndex?: number;
    loadedQuizQuestions?: any[];
    isQuizPackMode?: boolean;
  } | null;
  showQuestionPreview?: boolean;
}

interface ActionButtonConfig {
  label: string;
  commandType: string;
  disabled: boolean;
  emoji: string;
}

interface ButtonLayoutConfig {
  layout: 'single' | 'timer-dual' | 'question-choice' | 'disabled';
  buttons: ActionButtonConfig[];
}

/**
 * Determine if the current question has an image
 */
function hasQuestionImage(question: any): boolean {
  return !!(question?.imageDataUrl);
}

/**
 * Map the current flow state to the button layout configuration
 * This determines what button(s) to show and what commands to send
 */
function getButtonLayout(flowState: any): ButtonLayoutConfig {
  if (!flowState || !flowState.isQuestionMode) {
    return {
      layout: 'disabled',
      buttons: [{
        label: 'Ready to Start',
        commandType: '',
        disabled: true,
        emoji: '⏸️'
      }]
    };
  }

  switch (flowState.flow) {
    case 'ready': {
      // In ready state, offer options to send picture (if available) or hide question
      const hasPicture = hasQuestionImage(flowState.currentQuestion);
      return {
        layout: 'question-choice',
        buttons: [
          {
            label: hasPicture ? 'Send Picture' : 'Send Question',
            commandType: 'send-question',
            disabled: false,
            emoji: hasPicture ? '🖼️' : '📝'
          },
          {
            label: 'Hide Question',
            commandType: 'hide-question',
            disabled: false,
            emoji: '🙈'
          }
        ]
      };
    }

    case 'sent-picture':
      return {
        layout: 'question-choice',
        buttons: [
          {
            label: 'Send Question',
            commandType: 'send-question',
            disabled: false,
            emoji: '📝'
          },
          {
            label: 'Hide Question',
            commandType: 'hide-question',
            disabled: false,
            emoji: '🙈'
          }
        ]
      };

    case 'sent-question':
      // Show two timer buttons side-by-side
      return {
        layout: 'timer-dual',
        buttons: [
          {
            label: 'Normal Timer',
            commandType: 'start-normal-timer',
            disabled: false,
            emoji: '🔊'
          },
          {
            label: 'Silent Timer',
            commandType: 'start-silent-timer',
            disabled: false,
            emoji: '🔇'
          }
        ]
      };

    case 'running':
    case 'timeup':
      return {
        layout: 'single',
        buttons: [{
          label: 'Reveal Answer',
          commandType: 'reveal-answer',
          disabled: false,
          emoji: '🔍'
        }]
      };

    case 'revealed':
      return {
        layout: 'single',
        buttons: [{
          label: 'Show Fastest Team',
          commandType: 'show-fastest',
          disabled: false,
          emoji: '⚡'
        }]
      };

    case 'fastest':
      return {
        layout: 'single',
        buttons: [{
          label: 'Next Question',
          commandType: 'next-question',
          disabled: false,
          emoji: '➡️'
        }]
      };

    case 'idle':
    default:
      return {
        layout: 'disabled',
        buttons: [{
          label: 'Waiting for Question',
          commandType: '',
          disabled: true,
          emoji: '⏸️'
        }]
      };
  }
}

export function GameControlsPanel({ deviceId, playerId, teamName, wsRef, flowState, showQuestionPreview = true }: GameControlsPanelProps) {
  // Timer duration is now pulled from flowState.totalTime (Settings-based) sent by host
  // Falls back to 30 only if flowState not available (shouldn't happen in normal flow)
  const timerDuration = flowState?.totalTime ?? 30;

  const { sendAdminCommand, previousQuestionNav, nextQuestionNav } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  // Get the button layout configuration based on flow state
  const buttonLayout = useMemo(() => getButtonLayout(flowState), [flowState]);

  // Get current question index and total questions for navigation
  const currentQuestionIndex = flowState?.currentLoadedQuestionIndex ?? -1;
  const totalQuestions = flowState?.loadedQuizQuestions?.length ?? 0;
  const isQuizPackMode = flowState?.isQuizPackMode ?? false;

  // Show navigation arrows when we have loaded questions (in any mode, not just quiz pack)
  // This allows jumping between questions in non-quiz-pack modes too
  const showNavigation = totalQuestions > 0;
  const canGoPrevious = currentQuestionIndex > 0;
  const canGoNext = currentQuestionIndex < totalQuestions - 1;

  const handlePreviousQuestion = () => {
    console.log('[HostTerminal] Navigate to previous question');
    previousQuestionNav();
  };

  const handleNextQuestion = () => {
    nextQuestionNav();
  };

  const executeCommand = (commandType: string) => {
    if (!commandType) {
      return;
    }

    // Map commands to their respective handlers
    switch (commandType) {
      case 'send-question':
        sendAdminCommand('send-question');
        break;
      case 'hide-question':
        sendAdminCommand('hide-question');
        break;
      case 'start-normal-timer':
        // Pass explicit seconds to ensure consistent timer duration between remote and host
        // This prevents the host from falling back to defaults if flowState is out of sync
        sendAdminCommand('start-normal-timer', { seconds: timerDuration });
        break;
      case 'start-silent-timer':
        // Pass explicit seconds to ensure consistent timer duration between remote and host
        // This prevents the host from falling back to defaults if flowState is out of sync
        sendAdminCommand('start-silent-timer', { seconds: timerDuration });
        break;
      case 'reveal-answer':
        sendAdminCommand('reveal-answer');
        break;
      case 'show-fastest':
        sendAdminCommand('show-fastest');
        break;
      case 'next-question':
        sendAdminCommand('next-question');
        break;
      default:
        console.warn('[HostTerminal] Unknown command type:', commandType);
    }
  };

  const handleButtonClick = (button: ActionButtonConfig) => {
    if (button.disabled) {
      console.log('[HostTerminal] Button is disabled:', button.label);
      return;
    }
    executeCommand(button.commandType);
  };


  return (
    <div className="flex flex-col h-full p-6 bg-slate-800 overflow-auto items-center">
      <div className="w-full max-w-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Game Controls</h2>

        {/* Navigation Arrows - Quiz Pack Mode Only */}
        {showNavigation && (
          <div className="mb-6 flex items-center justify-between gap-3">
          {/* Check if timer is running to disable navigation */}
          {(() => {
            const isTimerRunning = flowState?.flow === 'running';
            const previousDisabled = !canGoPrevious || isTimerRunning;
            const nextDisabled = !canGoNext || isTimerRunning;

            return (
              <>
                <button
                  onClick={handlePreviousQuestion}
                  disabled={previousDisabled}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    previousDisabled
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50 pointer-events-none'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  style={{
                    pointerEvents: previousDisabled ? 'none' : 'auto',
                    opacity: previousDisabled ? 0.5 : 1,
                    cursor: previousDisabled ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={20} />
                  Previous
                </button>

                <div className="flex-1 text-center">
                  <p className="text-slate-300 text-sm font-medium">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </p>
                  {isTimerRunning && (
                    <p className="text-amber-400 text-xs mt-1 font-semibold">⏱️ Timer running - navigation disabled</p>
                  )}
                </div>

                <button
                  onClick={handleNextQuestion}
                  disabled={nextDisabled}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    nextDisabled
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50 pointer-events-none'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  style={{
                    pointerEvents: nextDisabled ? 'none' : 'auto',
                    opacity: nextDisabled ? 0.5 : 1,
                    cursor: nextDisabled ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              </>
            );
          })()}
          </div>
        )}

        {/* Question Preview Panel - hidden when Answer Input is displayed */}
        {showQuestionPreview && (
          <QuestionPreviewPanel
            currentQuestion={flowState?.currentQuestion}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            isQuizPackMode={isQuizPackMode}
          />
        )}

        {/* Dynamic Action Buttons */}
        <div className="mb-6">
          {buttonLayout.layout === 'single' && (
            <>
              {(() => {
              // For 'Reveal Answer' button: disable if timer is still running
              // Allow clicking when timer is 'running' but protect against accidental clicks during timer
              const isRevealAnswerButton = buttonLayout.buttons[0].commandType === 'reveal-answer';
              const isTimerRunning = flowState?.flow === 'running';
              const buttonDisabled = buttonLayout.buttons[0].disabled || (isRevealAnswerButton && isTimerRunning);

              return (
                <>
                  <button
                    onClick={() => handleButtonClick(buttonLayout.buttons[0])}
                    disabled={buttonDisabled}
                    className={`w-full px-6 py-4 text-white font-bold text-lg rounded-lg transition-all ${
                      buttonDisabled
                        ? 'bg-slate-600 cursor-not-allowed opacity-50 pointer-events-none'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                    }`}
                    style={{
                      pointerEvents: buttonDisabled ? 'none' : 'auto',
                      opacity: buttonDisabled ? 0.5 : 1,
                      cursor: buttonDisabled ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <span className="text-2xl mr-2">{buttonLayout.buttons[0].emoji}</span>
                    {buttonLayout.buttons[0].label}
                  </button>
                  <p className="text-slate-400 text-sm mt-2 text-center">
                    {buttonDisabled && isRevealAnswerButton && isTimerRunning
                      ? '⏱️ Timer running - button disabled to prevent accidents'
                      : (buttonLayout.buttons[0].disabled ? 'No active question' : 'Press spacebar or click to continue')}
                  </p>
                </>
              );
              })()}
            </>
          )}

          {buttonLayout.layout === 'question-choice' && (
            <>
              <div className="flex gap-3">
              <button
                onClick={() => handleButtonClick(buttonLayout.buttons[0])}
                disabled={buttonLayout.buttons[0].disabled}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  buttonLayout.buttons[0].disabled
                    ? 'bg-slate-600 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
                style={{
                  pointerEvents: buttonLayout.buttons[0].disabled ? 'none' : 'auto',
                  opacity: buttonLayout.buttons[0].disabled ? 0.5 : 1,
                  cursor: buttonLayout.buttons[0].disabled ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="text-xl">{buttonLayout.buttons[0].emoji}</span>
                {buttonLayout.buttons[0].label}
              </button>
              <button
                onClick={() => handleButtonClick(buttonLayout.buttons[1])}
                disabled={buttonLayout.buttons[1].disabled}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  buttonLayout.buttons[1].disabled
                    ? 'bg-slate-600 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-amber-600 hover:bg-amber-700 active:scale-95'
                }`}
                style={{
                  pointerEvents: buttonLayout.buttons[1].disabled ? 'none' : 'auto',
                  opacity: buttonLayout.buttons[1].disabled ? 0.5 : 1,
                  cursor: buttonLayout.buttons[1].disabled ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="text-xl">{buttonLayout.buttons[1].emoji}</span>
                {buttonLayout.buttons[1].label}
              </button>
              </div>
              <p className="text-slate-400 text-sm mt-2 text-center">Choose action to proceed</p>
            </>
          )}

          {buttonLayout.layout === 'timer-dual' && (
            <>
              <div className="flex gap-3">
              <button
                onClick={() => handleButtonClick(buttonLayout.buttons[0])}
                disabled={buttonLayout.buttons[0].disabled}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  buttonLayout.buttons[0].disabled
                    ? 'bg-slate-600 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
                style={{
                  pointerEvents: buttonLayout.buttons[0].disabled ? 'none' : 'auto',
                  opacity: buttonLayout.buttons[0].disabled ? 0.5 : 1,
                  cursor: buttonLayout.buttons[0].disabled ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="text-xl">{buttonLayout.buttons[0].emoji}</span>
                {buttonLayout.buttons[0].label}
              </button>
              <button
                onClick={() => handleButtonClick(buttonLayout.buttons[1])}
                disabled={buttonLayout.buttons[1].disabled}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  buttonLayout.buttons[1].disabled
                    ? 'bg-slate-600 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-green-600 hover:bg-green-700 active:scale-95'
                }`}
                style={{
                  pointerEvents: buttonLayout.buttons[1].disabled ? 'none' : 'auto',
                  opacity: buttonLayout.buttons[1].disabled ? 0.5 : 1,
                  cursor: buttonLayout.buttons[1].disabled ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="text-xl">{buttonLayout.buttons[1].emoji}</span>
                {buttonLayout.buttons[1].label}
              </button>
            </div>
              <p className="text-slate-400 text-sm mt-2 text-center">Choose timer mode to begin</p>
            </>
          )}

          {buttonLayout.layout === 'disabled' && (
            <>
              <button
              disabled={true}
              className="w-full px-6 py-4 text-white font-bold text-lg rounded-lg bg-slate-600 cursor-not-allowed opacity-50 transition-all pointer-events-none"
              style={{
                pointerEvents: 'none',
                opacity: 0.5,
                cursor: 'not-allowed'
              }}
            >
                <span className="text-2xl mr-2">{buttonLayout.buttons[0].emoji}</span>
                {buttonLayout.buttons[0].label}
              </button>
              <p className="text-slate-400 text-sm mt-2 text-center">Waiting to start quiz</p>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
