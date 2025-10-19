import React from 'react';

interface SimpleTimerProps {
  currentTime: number;
  textColor?: string;
  textSize?: string; // Tailwind text size class
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function SimpleTimer({
  currentTime,
  textColor = "#e74c3c",
  textSize = "text-[8rem]",
  showLabel = true,
  label = "seconds",
  className = ""
}: SimpleTimerProps) {
  return (
    <div className={`text-center ${className}`}>
      <div 
        className={`${textSize} font-bold`}
        style={{ color: textColor }}
      >
        {currentTime}
      </div>
      {showLabel && label && (
        <div className="text-2xl text-white mt-2">
          {label}
        </div>
      )}
    </div>
  );
}