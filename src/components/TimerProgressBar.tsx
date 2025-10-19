import { useEffect, useState } from 'react';

interface TimerProgressBarProps {
  isVisible: boolean;
  timeRemaining: number;
  totalTime: number;
  position?: 'top' | 'bottom';
}

export function TimerProgressBar({ 
  isVisible, 
  timeRemaining, 
  totalTime, 
  position = 'top' 
}: TimerProgressBarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isVisible && totalTime > 0) {
      const newProgress = (timeRemaining / totalTime) * 100;
      setProgress(newProgress);
    } else if (!isVisible) {
      setProgress(100);
    }
  }, [isVisible, timeRemaining, totalTime]);

  if (!isVisible) return null;

  // Determine color based on progress
  const getProgressColor = () => {
    if (progress > 50) return 'bg-green-500';
    if (progress > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Use relative positioning instead of fixed to stay within the parent container
  const positionClasses = position === 'top' 
    ? 'relative w-full z-40' 
    : 'relative w-full z-50';

  return (
    <div className={`${positionClasses} h-2 bg-gray-200 dark:bg-gray-700 mb-4`}>
      <div 
        className={`h-full transition-all duration-1000 ease-linear ${getProgressColor()}`}
        style={{ 
          width: `${progress}%`,
          transformOrigin: 'left center'
        }}
      />
      {/* Optional glow effect for the progress bar */}
      <div 
        className={`h-full absolute top-0 left-0 ${getProgressColor()} opacity-30 blur-sm transition-all duration-1000 ease-linear`}
        style={{ 
          width: `${progress}%`,
          transformOrigin: 'left center'
        }}
      />
    </div>
  );
}