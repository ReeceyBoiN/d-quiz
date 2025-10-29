import React from 'react';
import { Button } from './ui/button';
import { Eye, Zap, ChevronRight, Send, Timer } from 'lucide-react';

interface PrimaryControlsProps {
  flow?: string;
  isQuestionMode?: boolean;
  currentQuestionIndex?: number;
  totalQuestions?: number;
  onPrimaryAction?: () => void;
  onSilentTimer?: () => void;
  primaryLabel?: string;
}

/**
 * PrimaryControls: Dynamic primary action button for quiz pack mode
 * 
 * Shows different actions based on the flow state:
 * - ready: Send Picture/Question
 * - sent-picture: Send Question
 * - sent-question: Start Timer
 * - running/timeup: Reveal Answer
 * - revealed: Fastest Team
 * - fastest: Next Question/End Round
 */
export function PrimaryControls({
  flow = 'idle',
  isQuestionMode = false,
  currentQuestionIndex = 0,
  totalQuestions = 0,
  onPrimaryAction,
  onSilentTimer,
  primaryLabel = 'Send Question'
}: PrimaryControlsProps) {
  if (!isQuestionMode) {
    return null;
  }

  // Determine button text and icon based on flow state
  const getButtonContent = () => {
    switch (flow) {
      case 'ready':
        return {
          text: primaryLabel || 'Send Question',
          icon: <Send className="h-6 w-6" />
        };
      case 'sent-picture':
        return {
          text: 'Send Question',
          icon: <Send className="h-6 w-6" />
        };
      case 'sent-question':
        return {
          text: 'Start Timer',
          icon: <Timer className="h-6 w-6" />
        };
      case 'running':
      case 'timeup':
        return {
          text: 'Reveal Answer',
          icon: <Eye className="h-6 w-6" />
        };
      case 'revealed':
        return {
          text: 'Fastest Team',
          icon: <Zap className="h-6 w-6" />
        };
      case 'fastest':
        const isLastQuestion = currentQuestionIndex >= (totalQuestions - 1);
        return {
          text: isLastQuestion ? 'End Round' : 'Next Question',
          icon: <ChevronRight className="h-6 w-6" />
        };
      default:
        return {
          text: 'Send Question',
          icon: <Send className="h-6 w-6" />
        };
    }
  };

  const { text, icon } = getButtonContent();

  return (
    <div className="fixed bottom-8 right-8 flex items-center gap-4 z-50">
      <Button
        onClick={onPrimaryAction}
        title="Press Spacebar to trigger this action"
        className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg flex items-center gap-3 px-8 py-6 text-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {icon}
        <span>{text}</span>
      </Button>
    </div>
  );
}
