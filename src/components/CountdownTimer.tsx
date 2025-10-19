import React, { useEffect, useState } from 'react';
import { useSettings } from '../utils/SettingsContext';

interface CountdownTimerProps {
  currentTime: number;
  totalTime: number;
  size?: number; // Size in Tailwind units (e.g., 80 for w-80 h-80)
  className?: string;
  showLabel?: boolean;
  label?: string;
  overrideStyle?: "circular" | "digital" | "pulsing" | "progress-bar" | "matrix" | "liquid" | "gradient";
}

export function CountdownTimer({
  currentTime,
  totalTime,
  size = 80,
  className = "",
  showLabel = true,
  label = "seconds",
  overrideStyle
}: CountdownTimerProps) {
  const { countdownStyle } = useSettings();
  const [forceRender, setForceRender] = useState(0);
  const activeStyle = overrideStyle || countdownStyle;
  
  // Listen for countdown style changes
  useEffect(() => {
    const handleStyleChange = (event: CustomEvent) => {
      console.log('CountdownTimer: Style change event received', event.detail);
      setForceRender(prev => prev + 1);
    };
    
    window.addEventListener('countdownStyleChanged', handleStyleChange as EventListener);
    return () => window.removeEventListener('countdownStyleChanged', handleStyleChange as EventListener);
  }, []);
  
  console.log('CountdownTimer: Rendering with style', {
    activeStyle,
    countdownStyle,
    overrideStyle,
    currentTime,
    forceRender
  });
  
  // Calculate progress (0 to 1) where 1 is full time remaining, 0 is no time remaining
  const progress = totalTime > 0 ? currentTime / totalTime : 0;
  
  // Convert size to rem units for consistent sizing
  const sizeInRem = size * 0.25; // 80 -> 20rem (w-80 = 20rem)

  const renderCircular = () => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference * (1 - progress);

    return (
      <div key={`circular-${forceRender}`} className={`relative inline-block ${className}`}>
        <svg 
          style={{ width: `${sizeInRem}rem`, height: `${sizeInRem}rem` }}
          className="transform -rotate-90" 
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#e74c3c"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[8rem] font-bold text-[#e74c3c]">
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
  };

  const renderDigital = () => (
    <div key={`digital-${forceRender}`} className={`digital-clock-container ${className}`}>
      <div 
        className="digital-clock"
        style={{ fontSize: `${sizeInRem * 0.4}rem` }}
      >
        <div className="digital-display">
          <span className="digital-number">
            {currentTime.toString().padStart(2, '0')}
          </span>
        </div>
        {showLabel && label && (
          <div className="digital-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );

  const renderPulsing = () => (
    <div key={`pulsing-${forceRender}`} className={`pulsing-container ${className}`}>
      <div 
        className={`pulsing-timer ${currentTime <= 10 ? 'pulsing-urgent' : 'pulsing-normal'}`}
        style={{ 
          width: `${sizeInRem}rem`, 
          height: `${sizeInRem}rem`,
          fontSize: `${sizeInRem * 0.3}rem`
        }}
      >
        <div className="pulsing-number">
          {currentTime}
        </div>
        {showLabel && label && (
          <div className="pulsing-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );

  const renderProgressBar = () => (
    <div key={`progress-bar-${forceRender}`} className={`progress-bar-container ${className}`}>
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

  const renderMatrix = () => (
    <div key={`matrix-${forceRender}`} className={`matrix-container ${className}`}>
      <div 
        className="matrix-display"
        style={{ 
          width: `${sizeInRem}rem`, 
          height: `${sizeInRem}rem`,
          fontSize: `${sizeInRem * 0.3}rem`
        }}
      >
        <div className="matrix-grid">
          {/* Background digital rain effect */}
          {[...Array(20)].map((_, i) => (
            <div 
              key={`${forceRender}-${i}`}
              className="matrix-rain"
              style={{
                left: `${(i * 5) % 100}%`,
                animationDelay: `${i * 0.1}s`
              }}
            >
              {Math.random() > 0.5 ? '1' : '0'}
            </div>
          ))}
        </div>
        <div className="matrix-timer">
          {currentTime.toString().padStart(2, '0')}
        </div>
        {showLabel && label && (
          <div className="matrix-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );

  const renderLiquid = () => (
    <div key={`liquid-${forceRender}`} className={`liquid-container ${className}`}>
      <div 
        className="liquid-timer"
        style={{ 
          width: `${sizeInRem}rem`, 
          height: `${sizeInRem}rem`
        }}
      >
        <div className="liquid-background">
          <div 
            className="liquid-fill"
            style={{ height: `${progress * 100}%` }}
          >
            <div className="liquid-wave" />
          </div>
        </div>
        <div 
          className="liquid-number"
          style={{ fontSize: `${sizeInRem * 0.3}rem` }}
        >
          {currentTime}
        </div>
        {showLabel && label && (
          <div className="liquid-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );

  const renderGradient = () => (
    <div key={`gradient-${forceRender}`} className={`gradient-container ${className}`}>
      <div 
        className="gradient-timer"
        style={{ 
          width: `${sizeInRem}rem`, 
          height: `${sizeInRem}rem`,
          fontSize: `${sizeInRem * 0.3}rem`
        }}
      >
        <div 
          className="gradient-background"
          style={{
            background: `conic-gradient(from 0deg, 
              hsl(${120 * progress}, 70%, 50%) 0%, 
              hsl(${60 * progress}, 70%, 50%) 25%, 
              hsl(${30 * progress}, 70%, 50%) 50%, 
              hsl(${0}, 70%, 50%) 75%, 
              hsl(${120 * progress}, 70%, 50%) 100%)`
          }}
        />
        <div className="gradient-number">
          {currentTime}
        </div>
        {showLabel && label && (
          <div className="gradient-label">
            {label}
          </div>
        )}
      </div>
    </div>
  );

  switch (activeStyle) {
    case "digital":
      return renderDigital();
    case "pulsing":
      return renderPulsing();
    case "progress-bar":
      return renderProgressBar();
    case "matrix":
      return renderMatrix();
    case "liquid":
      return renderLiquid();
    case "gradient":
      return renderGradient();
    case "circular":
    default:
      return renderCircular();
  }
}