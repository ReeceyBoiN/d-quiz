import React from 'react';

interface CircularTimerProps {
  currentTime: number;
  totalTime: number;
  size?: number; // Size in Tailwind units (e.g., 80 for w-80 h-80)
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor?: string;
  textColor?: string;
  textSize?: string; // Tailwind text size class
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function CircularTimer({
  currentTime,
  totalTime,
  size = 80,
  strokeWidth = 8,
  strokeColor = "#e74c3c",
  backgroundColor = "rgba(255,255,255,0.1)",
  textColor = "#e74c3c",
  textSize = "text-[8rem]",
  showLabel = true,
  label = "seconds",
  className = ""
}: CircularTimerProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate progress (0 to 1) where 1 is full time remaining, 0 is no time remaining
  const progress = totalTime > 0 ? currentTime / totalTime : 0;
  
  // For a countdown timer, we want to start full and drain to empty
  const strokeOffset = circumference * (1 - progress);
  
  // Convert size to rem units for consistent sizing
  const sizeInRem = size * 0.25; // 80 -> 20rem (w-80 = 20rem)
  
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Circular progress ring */}
      <svg 
        style={{ width: `${sizeInRem}rem`, height: `${sizeInRem}rem` }}
        className="transform -rotate-90" 
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      
      {/* Timer number in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
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
      </div>
    </div>
  );
}