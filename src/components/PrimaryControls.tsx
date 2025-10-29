import React from 'react';

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
 * PrimaryControls: Empty placeholder component
 * 
 * The Send Question button has been moved to QuestionPanel.
 * This component is kept for backwards compatibility but renders nothing.
 */
export function PrimaryControls(props: PrimaryControlsProps) {
  return <div className="fixed bottom-8 right-8 flex items-center gap-4 z-50" />;
}
