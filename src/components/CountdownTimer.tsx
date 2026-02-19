import React, { useState } from 'react';

interface CountdownTimerProps {
  currentTime: number;
  totalTime: number;
  size?: number; // Size in Tailwind units (e.g., 80 for w-80 h-80)
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export function CountdownTimer({
  currentTime,
  totalTime,
  size = 80,
  className = "",
  showLabel = true,
  label = "seconds"
}: CountdownTimerProps) {
  // Calculate progress (0 to 1) where 1 is full time remaining, 0 is no time remaining
  const progress = totalTime > 0 ? currentTime / totalTime : 0;

  // Convert size to rem units for consistent sizing
  const sizeInRem = size * 0.25; // 80 -> 20rem (w-80 = 20rem)

  const renderProgressBar = () => (
    <div className={`progress-bar-container ${className}`}>
      <div 
        className="progress-bar-wrapper"
        style={{ width: `${sizeInRem}rem` }}
      >
        <div className="progress-bar-track">
          <div 
            className="progress-bar-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div 
          className="progress-bar-timer"
          style={{ fontSize: `${sizeInRem * 0.3}rem` }}
        >
          {currentTime}
        </div>
        {showLabel && label && (
          <div className="progress-bar-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );



  return renderProgressBar();
}
