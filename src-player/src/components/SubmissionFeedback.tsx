import { useEffect, useState } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

export type SubmissionState = 'idle' | 'submitting' | 'confirmed' | 'error';

interface SubmissionFeedbackProps {
  state: SubmissionState;
  message?: string;
  autoHideDuration?: number; // milliseconds, 0 = don't auto hide
}

export function SubmissionFeedback({
  state,
  message,
  autoHideDuration = 2000,
}: SubmissionFeedbackProps) {
  const [isVisible, setIsVisible] = useState(state !== 'idle');

  useEffect(() => {
    setIsVisible(state !== 'idle');

    if (state !== 'idle' && autoHideDuration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [state, autoHideDuration]);

  if (!isVisible) {
    return null;
  }

  const getContent = () => {
    switch (state) {
      case 'submitting':
        return {
          icon: <Clock className="w-5 h-5 animate-spin text-blue-400" />,
          text: message || 'Submitting answer...',
          bgColor: 'bg-blue-900/80',
          borderColor: 'border-blue-500',
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-400" />,
          text: message || 'Answer received ✓',
          bgColor: 'bg-green-900/80',
          borderColor: 'border-green-500',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-400" />,
          text: message || 'Failed to submit answer',
          bgColor: 'bg-red-900/80',
          borderColor: 'border-red-500',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 ${content.bgColor} border ${content.borderColor} rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg max-w-sm animate-in slide-in-from-bottom-4 duration-300`}
    >
      {content.icon}
      <span className="text-white text-sm font-medium">{content.text}</span>
    </div>
  );
}
