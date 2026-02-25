import React, { useState } from 'react';
import { HostTerminalNav } from './HostTerminalNav';
import { LeaderboardPanel } from './LeaderboardPanel';
import { TeamManagementPanel } from './TeamManagementPanel';
import { GameControlsPanel } from './GameControlsPanel';
import { SettingsPanel } from './SettingsPanel';
import { QuestionTypeSelector } from './QuestionTypeSelector';
import { HostRemoteKeypad } from './HostRemoteKeypad';
import { AnswerInputKeypad } from './AnswerInputKeypad';

interface HostTerminalProps {
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
    selectedQuestionType?: 'letters' | 'numbers' | 'multiple-choice' | 'sequence';
    keypadCurrentScreen?: string;
  } | null;
}

/**
 * ============================================================================
 * HOST TERMINAL (HOST REMOTE) - PRIMARY CONTROL INTERFACE
 * ============================================================================
 *
 * The HostTerminal is the PRIMARY CONTROL INTERFACE for the Quiz Host
 * application. It is a remote control terminal that must ALWAYS STAY IN SYNC
 * with the host app's state. The host remote DRIVES the host app's behavior
 * through admin commands sent via WebSocket.
 *
 * CRITICAL PRINCIPLE: Host Remote State Always Reflects Host App State
 * - When the host app is on the home screen → remote shows nothing/blank
 * - When host app is on settings screen → remote shows relevant controls
 * - When host app is on question type selection → remote shows question selector
 * - When host app is on a question screen → remote shows answer input + timer controls
 * - State synchronization happens through the flowState prop (FLOW_STATE messages)
 *
 * PRIMARY CONTROL FUNCTIONS (what the remote controls):
 * 1. QUESTION TYPE SELECTION (On-The-Spot Mode)
 *    - Command: 'select-question-type'
 *    - Selects: Letters, Numbers, Multiple Choice, or Sequence
 *    - Effect: Host app's KeypadInterface transitions to that question type's screen
 *    - Expected: Host app becomes ready to receive answers for that question type
 *
 * 2. TIMER CONTROL (On-The-Spot Mode)
 *    - Command: 'start-timer' (with optional silent mode)
 *    - Controls: Question countdown timer on host app
 *    - Effect: Host app displays timer ticking down in real-time
 *    - Silent Timer: No audio countdown beep (quiet mode for presentations)
 *
 * 3. ANSWER MANAGEMENT (On-The-Spot Mode)
 *    - Set Correct Answer: Records the expected answer for grading
 *    - Reveal Answer: Displays correct answer to all teams
 *    - Hide Answer: Hides answer (back to question-only view)
 *
 * 4. QUIZ PACK NAVIGATION (Quiz Pack Mode)
 *    - Next/Previous Question: Navigate through loaded quiz
 *    - Command: 'next-question' or 'previous-question'
 *    - Effect: Host app loads and displays next/previous question
 *
 * 5. LEADERBOARD & TEAM MANAGEMENT
 *    - View real-time team scores
 *    - Manage team data (names, colors, photos)
 *    - Monitor connected teams
 *
 * STATE SYNCHRONIZATION MODEL:
 * - Host app sends FLOW_STATE via WebSocket when screen/state changes
 * - Host remote receives flowState prop with current host app state
 * - Remote renders UI based on flowState (question type, current screen, etc.)
 * - Remote sends admin commands back to host app
 * - Host app executes command, updates state, broadcasts new FLOW_STATE
 *
 * KEY FIELDS FROM flowState:
 * - flow: Current flow state (idle, sent-question, running, timeup, revealed, etc.)
 * - isQuestionMode: Whether in active question mode
 * - isQuizPackMode: true = quiz pack loaded, false = on-the-spot mode
 * - keypadCurrentScreen: What screen the KeypadInterface is showing
 *   (e.g., 'config', 'question-types', 'letters-game', 'numbers-game', etc.)
 * - selectedQuestionType: Which question type is selected (for on-the-spot)
 * - currentQuestion: The question data being displayed
 *
 * VISIBILITY RULES:
 * - Question Type Selector: Show ONLY when keypadCurrentScreen === 'question-types'
 * - Timer & Answer Controls: Show ONLY in game flow states (sent-question, running, etc.)
 * - Waiting State: Show ONLY when flow === 'idle' AND keypadCurrentScreen === 'config'
 * - Answer Keypad: Show ONLY when in game flow AND selected question type exists
 *
 * RULE OF THUMB FOR DEVELOPERS:
 * If the host app isn't showing it, the remote shouldn't show controls for it.
 * The remote is a SLAVE to the host app's state - it reflects what's happening
 * on the main app, and sends commands to drive state changes.
 */

export function HostTerminal({ deviceId, playerId, teamName, wsRef, flowState }: HostTerminalProps) {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'teams' | 'controls' | 'settings'>('leaderboard');
  const [showPurposeInfo, setShowPurposeInfo] = useState(false);

  // Determine if we're in on-the-spot mode
  const isOnTheSpotMode = flowState?.isQuizPackMode === false;
  const isInIdleState = flowState?.flow === 'idle';
  // Keypad should be visible throughout entire game flow (after question type selected)
  const isInGameFlow = ['sent-question', 'running', 'timeup', 'revealed', 'fastest'].includes(flowState?.flow || '');

  // For on-the-spot mode, show different UI based on game state
  // Only show question type selector when KeypadInterface is on the question-types screen
  const showQuestionTypeSelector = isOnTheSpotMode && flowState?.keypadCurrentScreen === 'question-types';
  const showAnswerKeypad = isOnTheSpotMode && isInGameFlow && flowState?.isQuestionMode;

  // Show waiting state when on home screen (no game mode selected yet)
  const showWaitingState = isOnTheSpotMode && flowState?.flow === 'idle' && flowState?.keypadCurrentScreen === 'config';


  // Check if we have both a selected question type AND a loaded question
  const hasSelectedQuestionType = !!flowState?.selectedQuestionType;
  const hasLoadedQuestion = !!flowState?.currentQuestion;

  // Compute whether keypad will actually render (has both question type AND question data)
  const shouldRenderAnswerKeypad = showAnswerKeypad && hasSelectedQuestionType && hasLoadedQuestion;

  // Check if we're in game flow but missing data (should show "No quizpack or question loaded")
  const showMissingQuestionMessage = showAnswerKeypad && (!hasSelectedQuestionType || !hasLoadedQuestion);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              Host Controller
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isOnTheSpotMode ? 'On-The-Spot Mode' : 'Quiz Pack Mode'} • Remote Control Terminal
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPurposeInfo(!showPurposeInfo)}
              className="text-slate-400 hover:text-slate-200 text-lg transition-colors"
              title="Show Host Remote Purpose & Goals"
            >
              ℹ️
            </button>
            <div className="bg-green-500/20 border border-green-500 rounded-lg px-3 py-2">
              <span className="text-green-400 text-sm font-semibold">✓ Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose & Goals Reference Section */}
      {showPurposeInfo && (
        <div className="bg-slate-800/90 border-b border-slate-700 p-4 text-sm text-slate-300">
          <div className="max-h-48 overflow-y-auto space-y-3">
            <div>
              <h3 className="text-white font-semibold mb-1">🎯 Host Remote Purpose</h3>
              <p>Remote control terminal for the Quiz Host application. Manages quiz game from any device connected over local network (WiFi).</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">📊 Leaderboard Tab</h3>
              <p>Real-time team rankings & scores. Shows: Position • Team Name • Score. Updates via periodic fetch (3s) + real-time WebSocket.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">👥 Teams Tab</h3>
              <p>Manage connected players/teams. View team info, status, photo approval, player connections.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">🎮 Controls Tab</h3>
              <p>Game flow commands: Start/Stop timer, Advance question, Show/Hide answers, Reset scores, Navigate quiz.</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-1">⚙️ Settings Tab</h3>
              <p>Configure quiz behavior: Timer duration, Scoring rules, Team management, Visual preferences.</p>
            </div>

            <div className="pt-2 border-t border-slate-600">
              <h3 className="text-white font-semibold mb-1">🔌 Data Source</h3>
              <p className="text-xs">Backend WebSocket: GET_CONNECTED_TEAMS command • Real-time updates via LEADERBOARD_UPDATE messages</p>
            </div>

            <div className="text-xs text-slate-500">
              <p>📍 Expected behavior: On load shows "Loading..." → Then shows real team data OR "No teams connected yet" if empty</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* On-The-Spot Mode: Question Type Selector (Idle State) */}
        {showQuestionTypeSelector && (
          <QuestionTypeSelector
            deviceId={deviceId}
            playerId={playerId}
            teamName={teamName}
            wsRef={wsRef}
            isOnTheSpotMode={isOnTheSpotMode}
            flowState={flowState}
          />
        )}

        {/* On-The-Spot Mode: Waiting State (Home Screen) */}
        {showWaitingState && (
          <div className="flex flex-col h-full items-center justify-center p-4 bg-slate-900 overflow-auto">
            <div className="w-full max-w-md p-8 rounded-lg bg-gradient-to-b from-slate-800 to-slate-700 border-2 border-slate-600 shadow-lg">
              <div className="text-center">
                <div className="text-5xl mb-4">⏳</div>
                <h3 className="text-2xl font-bold text-white mb-2">Waiting for Game</h3>
                <p className="text-slate-300 text-base mb-6">
                  Select a game mode on the host app to begin.
                </p>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-500">
                    <p className="text-slate-300 text-sm">
                      ⏸️ Remote is idle and ready...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* On-The-Spot Mode: Answer Input (centered) + Timer Controls (Timer State) */}
        {shouldRenderAnswerKeypad ? (
          <div className="flex flex-col h-full p-4 bg-slate-900 overflow-auto">
            {/* Answer Input - centered at top */}
            <div className="mb-6 flex justify-center max-w-2xl mx-auto w-full">
              {flowState?.selectedQuestionType &&
              ['letters', 'numbers', 'multiple-choice'].includes(flowState.selectedQuestionType) ? (
                <div className="w-full">
                  <HostRemoteKeypad
                    deviceId={deviceId}
                    playerId={playerId}
                    teamName={teamName}
                    wsRef={wsRef}
                    isOnTheSpotMode={isOnTheSpotMode}
                    flowState={flowState}
                  />
                </div>
              ) : (
                <div className="w-full">
                  <AnswerInputKeypad
                    deviceId={deviceId}
                    playerId={playerId}
                    teamName={teamName}
                    wsRef={wsRef}
                    isOnTheSpotMode={isOnTheSpotMode}
                    flowState={flowState}
                  />
                </div>
              )}
            </div>

            {/* Game Controls - below Answer Input */}
            <div className="flex-1 overflow-auto">
              <GameControlsPanel
                deviceId={deviceId}
                playerId={playerId}
                teamName={teamName}
                wsRef={wsRef}
                flowState={flowState}
                showQuestionPreview={false}
              />
            </div>
          </div>
        ) : showMissingQuestionMessage ? (
          <div className="flex flex-col h-full items-center justify-center p-4 bg-slate-900 overflow-auto">
            {/* Info Card - No quizpack or question loaded */}
            <div className="w-full max-w-md p-8 rounded-lg bg-gradient-to-b from-amber-900/20 to-amber-800/10 border-2 border-amber-600 shadow-lg">
              <div className="text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-white mb-2">No Question Loaded</h3>
                <p className="text-amber-100 text-base mb-6">
                  Please load a quizpack or select a question type to continue.
                </p>
                <div className="space-y-3">
                  <div className="p-3 bg-amber-600/20 rounded-lg border border-amber-500">
                    <p className="text-amber-100 text-sm">
                      ⚠️ Waiting for question data...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Regular Tab Navigation (Quiz Pack Mode or Non-Timer States) */}
            {activeTab === 'leaderboard' && (
              <LeaderboardPanel deviceId={deviceId} playerId={playerId} teamName={teamName} wsRef={wsRef} />
            )}
            {activeTab === 'teams' && (
              <TeamManagementPanel deviceId={deviceId} playerId={playerId} teamName={teamName} wsRef={wsRef} />
            )}
            {activeTab === 'controls' && (
              <GameControlsPanel
                deviceId={deviceId}
                playerId={playerId}
                teamName={teamName}
                wsRef={wsRef}
                flowState={flowState}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsPanel
                deviceId={deviceId}
                playerId={playerId}
                teamName={teamName}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation - Only show when not in question type selector or answer input */}
      {!showQuestionTypeSelector && !showAnswerKeypad && (
        <HostTerminalNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}
