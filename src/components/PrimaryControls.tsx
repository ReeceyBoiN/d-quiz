import React, { useEffect } from 'react';
import { Button } from './ui/button';
import { ChevronRight, Play, FastForward, Eye, Trophy, SkipForward, Square } from 'lucide-react';
import type { QuestionFlowState } from '../state/flowState';

interface PrimaryControlsProps {
  flow: QuestionFlowState;
  isQuestionMode: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  onPrimaryAction: () => void;
  onSilentTimer?: () => void;
  primaryLabel?: string;
}

/**
 * PrimaryControls: Bottom-right fixed controls for question flow.
 * 
 * Layout (bottom-right, always fixed position):
 *   [Start Silent Timer] [Primary Blue Action Button]
 * 
 * The primary button's label changes based on flow state:
 *   ready → "Send Picture" or "Send Question"
 *   sent-picture → "Send Question"
 *   sent-question → "Start Timer"
 *   running / timeup → "Reveal Answer"
 *   revealed → "Fastest Team"
 *   fastest → "Next Question" or "End Round"
 *   complete → "End Round"
 * 
 * Keyboard: Spacebar triggers the primary action.
 * 
 * Visibility: Only shown when isQuestionMode is true.
 */
export function PrimaryControls({
  flow,
  isQuestionMode,
  currentQuestionIndex,
  totalQuestions,
  onPrimaryAction,
  onSilentTimer,
  primaryLabel = 'Continue',
}: PrimaryControlsProps) {
  // Listen for Spacebar to trigger primary action
  useEffect(() => {
    if (!isQuestionMode || flow === 'idle') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onPrimaryAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuestionMode, flow, onPrimaryAction]);

  if (!isQuestionMode) {
    return null; // Hide controls in non-question modes
  }

  // Determine if Start Silent Timer should be visible
  const showSilentTimer = flow === 'sent-question' || flow === 'running';
  const silentTimerDisabled = flow === 'timeup' || flow === 'revealed' || flow === 'fastest' || flow === 'complete';

  // Get icon for primary button based on flow
  const getPrimaryIcon = () => {
    switch (flow) {
      case 'ready':
        return <Eye className="w-5 h-5" />;
      case 'sent-picture':
        return <ChevronRight className="w-5 h-5" />;
      case 'sent-question':
        return <Play className="w-5 h-5" />;
      case 'running':
      case 'timeup':
        return <Eye className="w-5 h-5" />;
      case 'revealed':
        return <Trophy className="w-5 h-5" />;
      case 'fastest':
        return <SkipForward className="w-5 h-5" />;
      case 'complete':
        return <Square className="w-5 h-5" />;
      default:
        return <ChevronRight className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed bottom-8 right-8 flex items-center gap-4 z-50">
      {/* Start Silent Timer Button (secondary) */}
      {showSilentTimer && (
        <Button
          onClick={onSilentTimer}
          disabled={silentTimerDisabled}
          className={`flex items-center gap-2 px-6 py-4 rounded-lg font-bold text-base transition-all shadow-lg ${
            silentTimerDisabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-slate-600 hover:bg-slate-500 text-white hover:scale-105'
          }`}
          title="Start timer without audio"
        >
          <FastForward className="w-5 h-5" />
          Silent Timer
        </Button>
      )}

      {/* Primary Blue Action Button */}
      <Button
        onClick={onPrimaryAction}
        className={`flex items-center gap-3 px-8 py-5 rounded-lg font-bold text-xl transition-all shadow-lg whitespace-nowrap ${
          flow === 'idle'
            ? 'bg-slate-500 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
        }`}
        disabled={flow === 'idle'}
        title="Press Spacebar to trigger this action"
      >
        {getPrimaryIcon()}
        {primaryLabel}
      </Button>
    </div>
  );
}

/**
 * Helper to generate primary button label based on flow state.
 * (Defined in this component to avoid Fast Refresh issues with exported functions)
 */
function getPrimaryButtonLabel(
  flow: QuestionFlowState,
  hasPicture: boolean,
  currentQuestionIndex: number,
  totalQuestions: number
): string {
  switch (flow) {
    case 'ready':
      return hasPicture ? 'Send Picture' : 'Send Question';
    case 'sent-picture':
      return 'Send Question';
    case 'sent-question':
      return 'Start Timer';
    case 'running':
    case 'timeup':
      return 'Reveal Answer';
    case 'revealed':
      return 'Fastest Team';
    case 'fastest':
      return currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'End Round';
    case 'complete':
      return 'End Round';
    default:
      return 'Continue';
  }
}
