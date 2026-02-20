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
}

interface ActionButtonConfig {
  label: string;
  commandType: string;
  disabled: boolean;
  emoji: string;
}

interface ButtonLayoutConfig {
  layout: 'single' | 'timer-dual' | 'disabled';
  buttons: ActionButtonConfig[];
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
    case 'ready':
    case 'sent-picture':
      return {
        layout: 'single',
        buttons: [{
          label: 'Send Question',
          commandType: 'send-question',
          disabled: false,
          emoji: '📝'
        }]
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

export function GameControlsPanel({ deviceId, playerId, teamName, wsRef, flowState }: GameControlsPanelProps) {
  const [timerDuration, setTimerDuration] = useState<number>(30);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const { sendAdminCommand, previousQuestionNav, nextQuestionNav, nextQuestion, startSilentTimer, startNormalTimer, stopTimer } = useHostTerminalAPI({
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

  // Determine if navigation arrows should be visible and enabled
  const showNavigation = isQuizPackMode && totalQuestions > 0;
  const canGoPrevious = currentQuestionIndex > 0;
  const canGoNext = currentQuestionIndex < totalQuestions - 1;

  const handlePreviousQuestion = () => {
    console.log('[HostTerminal] Navigate to previous question');
    previousQuestionNav();
  };

  const handleNextQuestion = () => {
    console.log('[HostTerminal] Navigate to next question');
    nextQuestionNav();
  };

  const executeCommand = (commandType: string) => {
    if (!commandType) {
      console.log('[HostTerminal] No command to execute');
      return;
    }

    console.log('[HostTerminal] Executing command:', commandType);

    // Map commands to their respective handlers
    switch (commandType) {
      case 'send-question':
        sendAdminCommand('send-question');
        break;
      case 'start-normal-timer':
        sendAdminCommand('start-normal-timer', { seconds: timerDuration });
        break;
      case 'start-silent-timer':
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

  const handleStartNormalTimer = () => {
    console.log('[HostTerminal] Start Normal Timer with duration:', timerDuration);
    startNormalTimer(timerDuration);
  };

  const handleStartSilentTimer = () => {
    console.log('[HostTerminal] Start Silent Timer with duration:', timerDuration);
    startSilentTimer(timerDuration);
  };

  const handleStopTimer = () => {
    console.log('[HostTerminal] Stop Timer');
    stopTimer();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-800 overflow-auto">
      <h2 className="text-xl font-bold text-white mb-6">Game Controls</h2>

      {/* Navigation Arrows - Quiz Pack Mode Only */}
      {showNavigation && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={handlePreviousQuestion}
            disabled={!canGoPrevious}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              canGoPrevious
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          <div className="flex-1 text-center">
            <p className="text-slate-300 text-sm font-medium">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
          </div>

          <button
            onClick={handleNextQuestion}
            disabled={!canGoNext}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              canGoNext
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Question Preview Panel */}
      <QuestionPreviewPanel
        currentQuestion={flowState?.currentQuestion}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={totalQuestions}
        isQuizPackMode={isQuizPackMode}
      />

      {/* Dynamic Action Buttons */}
      <div className="mb-6">
        {buttonLayout.layout === 'single' && (
          <>
            <button
              onClick={() => handleButtonClick(buttonLayout.buttons[0])}
              disabled={buttonLayout.buttons[0].disabled}
              className={`w-full px-6 py-4 text-white font-bold text-lg rounded-lg transition-all ${
                buttonLayout.buttons[0].disabled
                  ? 'bg-slate-600 cursor-not-allowed opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }`}
            >
              <span className="text-2xl mr-2">{buttonLayout.buttons[0].emoji}</span>
              {buttonLayout.buttons[0].label}
            </button>
            <p className="text-slate-400 text-sm mt-2 text-center">
              {buttonLayout.buttons[0].disabled ? 'No active question' : 'Press spacebar or click to continue'}
            </p>
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
                    ? 'bg-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
              >
                <span className="text-xl">{buttonLayout.buttons[0].emoji}</span>
                {buttonLayout.buttons[0].label}
              </button>
              <button
                onClick={() => handleButtonClick(buttonLayout.buttons[1])}
                disabled={buttonLayout.buttons[1].disabled}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  buttonLayout.buttons[1].disabled
                    ? 'bg-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-green-600 hover:bg-green-700 active:scale-95'
                }`}
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
              className="w-full px-6 py-4 text-white font-bold text-lg rounded-lg bg-slate-600 cursor-not-allowed opacity-50 transition-all"
            >
              <span className="text-2xl mr-2">{buttonLayout.buttons[0].emoji}</span>
              {buttonLayout.buttons[0].label}
            </button>
            <p className="text-slate-400 text-sm mt-2 text-center">Waiting to start quiz</p>
          </>
        )}
      </div>

      {/* Timer Controls Section */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('timer')}
          className="w-full flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
        >
          <span className="font-bold text-white">⏱️ Timer Controls</span>
          <span className="text-slate-400">{expandedSection === 'timer' ? '▼' : '▶'}</span>
        </button>

        {expandedSection === 'timer' && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Timer Duration (seconds):</label>
              <input
                type="number"
                value={timerDuration}
                onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value) || 30))}
                className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-slate-400"
                min="1"
                max="300"
              />
            </div>
            <button
              onClick={handleStartSilentTimer}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded transition-colors"
            >
              🔇 Start Silent Timer
            </button>
            <button
              onClick={handleStartNormalTimer}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded transition-colors"
            >
              🔊 Start Normal Timer
            </button>
            <button
              onClick={handleStopTimer}
              className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded transition-colors"
            >
              ⏹️ Stop Timer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
