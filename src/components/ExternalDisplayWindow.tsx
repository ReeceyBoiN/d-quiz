import React, { useState, useEffect } from "react";
import { useSettings } from "../utils/SettingsContext";
import { FastestTeamOverlaySimplified } from "./FastestTeamOverlaySimplified";

declare global {
  interface Window {
    api?: {
      ipc: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, callback: (data: any) => void) => () => void;
      };
    };
  }
}

const isElectron = Boolean(window.api);

export function ExternalDisplayWindow() {
  const { countdownStyle } = useSettings();
  const [displayData, setDisplayData] = useState({
    mode: 'basic',
    previousMode: 'basic',
    images: [] as any[],
    quizzes: [] as any[],
    slideshowSpeed: 5,
    leaderboardData: null as any,
    revealedTeams: [] as any[],
    timerValue: null as number | null,
    correctAnswer: null as any,
    questionInfo: null as any,
    fastestTeamData: null as any,
    gameInfo: null as any,
    targetNumber: null as any,
    answerRevealed: false,
    results: null as any,
    nearestWinsData: null as any,
    wheelSpinnerData: null as any,
    countdownStyle: 'circular',
    gameMode: 'keypad',
    gameModeTimers: { keypad: 30, buzzin: 30, nearestwins: 10 } as any,
    teamName: null as string | null,
    data: null as any,
    totalTime: 30
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [dynamicBackgroundColor, setDynamicBackgroundColor] = useState('#f1c40f');
  const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);

  const welcomeColors = [
    '#f39c12', '#e74c3c', '#e91e63', '#9b59b6', '#3498db', '#27ae60', '#f1c40f',
  ];

  const dynamicColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
    '#00bcd4', '#4caf50', '#ff9800', '#673ab7', '#607d8b',
    '#8bc34a', '#ffc107', '#795548', '#ff5722', '#009688'
  ];

  const getRandomDynamicColor = () => {
    return dynamicColors[Math.floor(Math.random() * dynamicColors.length)];
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DISPLAY_UPDATE') {
        const newMode = event.data.mode || 'basic';
        console.log('[ExternalDisplayWindow] Received DISPLAY_UPDATE message with mode:', newMode);
        setDisplayData(prevData => {
          if ((newMode === 'timer' || newMode === 'correctAnswer' || newMode === 'questionWaiting') && prevData.mode !== newMode) {
            setDynamicBackgroundColor(getRandomDynamicColor());
          }
          return {
            mode: newMode,
            previousMode: (newMode === 'timer' || newMode === 'correctAnswer') ? prevData.mode : newMode,
            images: event.data.images || [],
            quizzes: event.data.quizzes || [],
            slideshowSpeed: event.data.slideshowSpeed || 5,
            leaderboardData: event.data.leaderboardData || null,
            revealedTeams: event.data.revealedTeams || [],
            timerValue: event.data.timerValue || null,
            correctAnswer: event.data.correctAnswer || null,
            questionInfo: event.data.questionInfo || null,
            fastestTeamData: event.data.fastestTeamData || null,
            gameInfo: event.data.gameInfo || null,
            targetNumber: event.data.targetNumber || null,
            answerRevealed: event.data.answerRevealed || false,
            results: event.data.results || null,
            nearestWinsData: event.data.nearestWinsData || null,
            wheelSpinnerData: event.data.wheelSpinnerData || null,
            countdownStyle: event.data.countdownStyle || prevData.countdownStyle || 'circular',
            gameMode: event.data.gameMode || prevData.gameMode || 'keypad',
            gameModeTimers: event.data.gameModeTimers || prevData.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 },
            teamName: (event.data.data && event.data.data.teamName) || event.data.teamName || null,
            data: event.data.data || null,
            totalTime: event.data.totalTime || (event.data.data && event.data.data.totalTime) || prevData.totalTime || 30
          };
        });
      }
    };

    window.addEventListener('message', handleMessage);

    let removeIpcListener: (() => void) | undefined;
    if (isElectron) {
      removeIpcListener = window.api?.ipc.on("external-display/update", (data) => {
        const newMode = data.mode || 'basic';
        console.log('[ExternalDisplayWindow] Received IPC external-display/update message with mode:', newMode);
        setDisplayData(prevData => {
          if ((newMode === 'timer' || newMode === 'correctAnswer' || newMode === 'questionWaiting') && prevData.mode !== newMode) {
            setDynamicBackgroundColor(getRandomDynamicColor());
          }
          return {
            mode: newMode,
            previousMode: (newMode === 'timer' || newMode === 'correctAnswer') ? prevData.mode : newMode,
            images: data.images || [],
            quizzes: data.quizzes || [],
            slideshowSpeed: data.slideshowSpeed || 5,
            leaderboardData: data.leaderboardData || null,
            revealedTeams: data.revealedTeams || [],
            timerValue: data.timerValue || null,
            correctAnswer: data.correctAnswer || null,
            questionInfo: data.questionInfo || null,
            fastestTeamData: data.fastestTeamData || null,
            gameInfo: data.gameInfo || null,
            targetNumber: data.targetNumber || null,
            answerRevealed: data.answerRevealed || false,
            results: data.results || null,
            nearestWinsData: data.nearestWinsData || null,
            wheelSpinnerData: data.wheelSpinnerData || null,
            countdownStyle: data.countdownStyle || prevData.countdownStyle || 'circular',
            gameMode: data.gameMode || prevData.gameMode || 'keypad',
            gameModeTimers: data.gameModeTimers || prevData.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 },
            teamName: (data.data && data.data.teamName) || data.teamName || null,
            data: data.data || null,
            totalTime: data.totalTime || (data.data && data.data.totalTime) || prevData.totalTime || 30
          };
        });
      });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (removeIpcListener) removeIpcListener();
    };
  }, []);

  useEffect(() => {
    if (displayData.mode === 'basic') {
      const startTime = Date.now();
      const duration = 5 * 60 * 1000;
      const updateColor = () => {
        const elapsed = Date.now() - startTime;
        const progress = (elapsed % duration) / duration;
        const hue = progress * 360;
        setCurrentColorIndex(hue);
      };
      const colorInterval = setInterval(updateColor, 500);
      updateColor();
      return () => clearInterval(colorInterval);
    }
  }, [displayData.mode]);

  useEffect(() => {
    if (displayData.mode === 'basic') {
      const emojis = [
        '🎯', '🎪', '🎉', '🏆', '⭐', '💫', '🎊', '🎈', '🎺', '🐼', '🎨', '🎭', '🎸', '🎲', '🎳', '🎮',
        '🎱', '🎰', '🎵', '🌮', '🍕', '🍦', '🍪', '🍰', '🧁', '🍓', '🍊', '🍌', '🍍', '🐶', '🐱', '🐭',
        '🐹', '🐰', '🦊', '🐻', '🐨', '🐯', '🌸', '🌺', '🌻', '🌷', '🌹', '🌵', '🌲', '🌳', '🍀', '🍃',
        '✨', '🌙', '☀️', '🌤️', '⛅', '🌦️', '❄️', '🚀', '🛸', '🎡', '🎢', '🎠', '🔥', '💖', '🌈', '⚡'
      ];
      const spawnEmoji = () => {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const randomLeft = Math.random() * 80 + 10;
        const emojiDiv = document.createElement('div');
        emojiDiv.textContent = randomEmoji;
        emojiDiv.style.position = 'fixed';
        emojiDiv.style.left = randomLeft + '%';
        emojiDiv.style.top = '-60px';
        emojiDiv.style.fontSize = '3rem';
        emojiDiv.style.opacity = '1';
        emojiDiv.style.pointerEvents = 'none';
        emojiDiv.style.animation = 'fall 8s linear forwards';
        emojiDiv.style.zIndex = '1000';
        document.body.appendChild(emojiDiv);
        setTimeout(() => {
          if (emojiDiv.parentNode) {
            emojiDiv.parentNode.removeChild(emojiDiv);
          }
        }, 8000);
      };
      spawnEmoji();
      const emojiInterval = setInterval(spawnEmoji, 2000);
      return () => {
        clearInterval(emojiInterval);
        const existingEmojis = document.querySelectorAll('[style*="position: fixed"][style*="animation"]');
        existingEmojis.forEach(emoji => emoji.remove());
      };
    }
  }, [displayData.mode]);

  useEffect(() => {
    if (displayData.mode === 'slideshow' && displayData.images.length > 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % displayData.images.length);
      }, displayData.slideshowSpeed * 1000);
      return () => clearInterval(interval);
    }
  }, [displayData.mode, displayData.images.length, displayData.slideshowSpeed]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [displayData.images]);

  useEffect(() => {
    if (displayData.mode === 'team-welcome') {
      const interval = setInterval(() => {
        setWelcomeColorIndex((prev) => (prev + 1) % 7);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [displayData.mode]);

  const getHSLColor = (hue: number) => {
    return 'hsl(' + hue + ', 85%, 60%)';
  };

  const renderCountdownTimer = (currentTime: number | null, style: string, totalTime = 30, size = 300) => {
    // Display full seconds when > 1, show 0 when timer reaches or passes 0
    const timerNum = currentTime !== null && currentTime !== undefined && currentTime > 0 ? Math.floor(currentTime) : 0;
    const actualTime = currentTime !== null && currentTime !== undefined ? Math.max(0, currentTime) : 0; // Keep actual time for progress calculations

    switch (style) {
      case 'digital':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'black', border: '4px solid #22c55e', borderRadius: '8px', padding: '32px', boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}>
              <div style={{ textAlign: 'center', fontFamily: 'monospace', color: '#22c55e', fontSize: '12rem', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
                {String(timerNum).padStart(2, '0')}
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '24px', color: '#dcfce7', marginTop: '16px' }}>seconds</div>
          </div>
        );

      case 'pulsing':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 'bold', width: '30rem', height: '30rem',
              animation: timerNum <= 10 ? 'pulse 0.5s ease-in-out infinite' : 'pulse 2s ease-in-out infinite'
            }}>
              <div style={{ fontSize: '12rem' }}>{timerNum}</div>
              <div style={{ fontSize: '24px', marginTop: '8px' }}>seconds</div>
            </div>
          </div>
        );

      case 'progress-bar':
        const progress = actualTime / totalTime;
        const progressTransitionMs = Math.max(800, totalTime * 950); // Dynamic transition in milliseconds
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%', maxWidth: '64rem', margin: '0 auto' }}>
            <div style={{ width: '100%', height: '48px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', transition: `all ${progressTransitionMs}ms linear`,
                width: (progress * 100) + '%',
                background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)'
              }} />
            </div>
            <div style={{ fontSize: '12rem', fontWeight: 'bold', color: '#3b82f6' }}>{timerNum}</div>
            <div style={{ fontSize: '24px', color: 'white' }}>seconds</div>
          </div>
        );

      case 'matrix':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'black', border: '1px solid #22c55e', borderRadius: '8px', position: 'relative', overflow: 'hidden', width: '30rem', height: '30rem' }}>
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontFamily: 'monospace', fontSize: '12rem', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
                {String(timerNum).padStart(2, '0')}
              </div>
            </div>
            <div style={{ color: '#22c55e', fontSize: '24px', marginTop: '16px' }}>seconds</div>
          </div>
        );

      case 'liquid':
        const liquidProgress = actualTime / totalTime;
        const liquidTransitionMs = Math.max(800, totalTime * 950); // Dynamic transition in milliseconds
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            <div style={{ position: 'relative', borderRadius: '50%', border: '4px solid #d1d5db', overflow: 'hidden', width: '30rem', height: '30rem' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#e5e7eb' }}></div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, transition: `all ${liquidTransitionMs}ms linear`,
                height: (liquidProgress * 100) + '%',
                background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
              }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12rem', fontWeight: 'bold', color: 'white', zIndex: 10, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                {timerNum}
              </div>
            </div>
            <div style={{ fontSize: '24px', color: 'white' }}>seconds</div>
          </div>
        );

      case 'gradient':
        const hue = (timerNum / totalTime) * 120;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            <div style={{ position: 'relative', borderRadius: '50%', overflow: 'hidden', width: '30rem', height: '30rem' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'conic-gradient(from 0deg, hsl(' + hue + ', 70%, 50%) 0%, hsl(60, 70%, 50%) 25%, hsl(30, 70%, 50%) 50%, hsl(0, 70%, 50%) 75%, hsl(' + hue + ', 70%, 50%) 100%)',
                animation: 'spin 3s linear infinite'
              }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12rem', fontWeight: 'bold', color: 'white', zIndex: 10, textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                {timerNum}
              </div>
            </div>
            <div style={{ fontSize: '24px', color: 'white' }}>seconds</div>
          </div>
        );

      case 'circular':
      default:
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        // Ensure progress reaches exactly 1.0 (100%) when timer is 0 or negative
        const circularProgress = totalTime > 0 ? Math.max(0, Math.min(1, actualTime / totalTime)) : 1;
        const strokeOffset = circularProgress >= 0.99 ? 0 : circumference * (1 - circularProgress);
        // Use the actual remaining time for transition duration, not the total time
        // This ensures the animation completes exactly when the timer reaches 0
        const transitionDuration = Math.max(0.1, actualTime);

        return (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <svg style={{ width: '30rem', height: '30rem', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
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
                style={{ transition: `stroke-dashoffset ${transitionDuration}s linear` }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12rem', fontWeight: 'bold', color: '#ef4444' }}>
                  {timerNum}
                </div>
                <div style={{ fontSize: '24px', color: 'white', marginTop: '8px' }}>
                  seconds
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderContent = () => {
    switch (displayData.mode) {
      case 'basic':
        return (
          <div style={{
            height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', backgroundColor: getHSLColor(currentColorIndex), transition: 'background-color 0.3s ease'
          }}>
            <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', transform: 'rotate(-6deg)' }}>
              <div style={{
                backgroundColor: '#f97316', color: 'black', padding: '64px 80px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                border: '6px solid white', transform: 'rotate(3deg)', transition: 'transform 0.3s ease'
              }}>
                <h1 style={{ fontSize: 'clamp(3rem, 12vw, 10rem)', fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'black', textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', lineHeight: 0.9 }}>
                  POP
                </h1>
                <h2 style={{ fontSize: 'clamp(3rem, 12vw, 10rem)', fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'black', textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', lineHeight: 0.9 }}>
                  QUIZ!
                </h2>
              </div>
              <div style={{ position: 'absolute', top: '-1rem', left: '-1rem', fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎯</div>
              <div style={{ position: 'absolute', top: '1.5rem', right: '-2rem', fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🌟</div>
              <div style={{ position: 'absolute', bottom: '3rem', right: '-3rem', fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🏆</div>
              <div style={{ position: 'absolute', bottom: '-2rem', left: '-2rem', fontSize: '2rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎵</div>
            </div>
          </div>
        );

      case 'question-with-timer':
      case 'timer-with-question': {
        // Timer with question, options, and image displayed
        const progressPercentage = displayData.data?.timerValue && displayData.data?.totalTime
          ? Math.max(0, Math.min(100, (displayData.data.timerValue / displayData.data.totalTime) * 100))
          : 0;
        const timeRemaining = displayData.data?.timerValue || 0;
        const showProgressBar = displayData.data?.showProgressBar !== false; // Default to true if not specified

        // Dynamic scaling based on available space
        const isMobileSize = window.innerWidth < 1024;
        const isSmallHeight = window.innerHeight < 800;

        // Calculate responsive padding and font sizes
        const containerPadding = isMobileSize ? '20px' : '40px';
        const gapSize = isMobileSize ? '20px' : '40px';
        const questionFontSize = isMobileSize ? '28px' : '40px';
        const headerFontSize = isMobileSize ? '24px' : '36px';
        const optionFontSize = isMobileSize ? '14px' : '20px';

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1f2937', position: 'relative', overflow: 'hidden' }}>
            {/* Progress bar at top - show only if timer is actively running */}
            {showProgressBar && (
              <div style={{
                height: '12px',
                backgroundColor: '#374151',
                width: '100%',
                position: 'relative',
                flexShrink: 0,
                opacity: timeRemaining > 0 ? 1 : 0,
                transition: 'opacity 0.2s ease'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#f97316',
                  width: `${progressPercentage}%`,
                  transition: 'width 0.1s linear'
                }}></div>
              </div>
            )}

            {/* Main content area with question on left, image on right (if present) */}
            <div style={{ flex: 1, display: 'flex', padding: containerPadding, gap: gapSize, alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'hidden' }}>
              {/* Question and Options on Left - takes up left portion, shrinks if image present */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: displayData.data?.imageDataUrl ? '0 1 50%' : '1',
                maxWidth: displayData.data?.imageDataUrl ? '50%' : '100%',
                overflow: 'auto',
                paddingRight: displayData.data?.imageDataUrl ? '0' : gapSize
              }}>
                {/* Question Header */}
                <div style={{ marginBottom: isMobileSize ? '20px' : '30px' }}>
                  <h1 style={{ fontSize: headerFontSize, fontWeight: 'bold', color: '#f97316', margin: '0 0 15px 0' }}>
                    Question {displayData.data?.questionNumber || 1} of {displayData.data?.totalQuestions || 1}
                  </h1>
                  {displayData.data?.hidden ? (
                    <div style={{ fontSize: isMobileSize ? '64px' : '96px', fontWeight: 'bold', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>?</div>
                  ) : (
                    <h2 style={{ fontSize: questionFontSize, fontWeight: '600', color: 'white', margin: '0', lineHeight: '1.3' }}>
                      {displayData.data?.text || 'Loading question...'}
                    </h2>
                  )}
                </div>

                {/* Options */}
                {displayData.data?.options && displayData.data.options.length > 0 && !displayData.data?.hidden && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileSize ? '120px' : '180px'}, 1fr))`, gap: isMobileSize ? '10px' : '16px', marginTop: isMobileSize ? '10px' : '20px' }}>
                    {displayData.data.options.map((option: string, index: number) => {
                      const letterMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                      return (
                        <div key={index} style={{
                          backgroundColor: '#374151',
                          border: '2px solid #f97316',
                          borderRadius: '8px',
                          padding: isMobileSize ? '10px' : '16px',
                          textAlign: 'center',
                          fontSize: optionFontSize,
                          fontWeight: '600',
                          color: 'white'
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: isMobileSize ? '18px' : '28px', color: '#f97316' }}>{letterMap[index]}</div>
                          <div>{option}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Image on Right (if present) - constrained to right half of screen */}
              {displayData.data?.imageDataUrl && (
                <div style={{
                  flex: '0 0 calc(50% - 20px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  overflow: 'hidden'
                }}>
                  <img
                    src={displayData.data.imageDataUrl}
                    alt="Question"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Timer at bottom-right - only show while timer is running */}
            {timeRemaining > 0 && (
              <div style={{
                position: 'absolute',
                bottom: isMobileSize ? '12px' : '24px',
                right: isMobileSize ? '12px' : '24px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '16px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transform: 'scale(0.425)',
                transformOrigin: 'bottom right'
              }}>
                {renderCountdownTimer(timeRemaining, displayData.countdownStyle || displayData.data?.countdownStyle || 'circular', displayData.data?.totalTime || displayData.totalTime || 30, 120)}
              </div>
            )}
          </div>
        );
      }

      case 'timer':
        const progressPercentage = displayData.timerValue !== null && displayData.timerValue !== undefined && displayData.totalTime
          ? Math.max(0, Math.min(100, (displayData.timerValue / displayData.totalTime) * 100))
          : 0;
        const timerValue = displayData.timerValue !== null && displayData.timerValue !== undefined ? displayData.timerValue : 0;
        const isTimerActive = timerValue > 0 || (displayData.timerValue !== null && displayData.timerValue === 0);
        const getProgressBarColor = () => {
          const percent = (timerValue / (displayData.totalTime || 30)) * 100;
          if (percent > 66) return '#10b981'; // Green
          if (percent > 33) return '#f59e0b'; // Amber
          return '#ef4444'; // Red
        };

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: dynamicBackgroundColor, position: 'relative' }}>
            {/* Progress bar at top - show while timer is active */}
            {isTimerActive && (
              <div style={{
                height: '12px',
                backgroundColor: '#e5e7eb',
                width: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: getProgressBarColor(),
                  width: `${progressPercentage}%`,
                  transition: 'width 0.05s linear, background-color 0.3s ease',
                  boxShadow: `0 0 10px ${getProgressBarColor()}`
                }}></div>
              </div>
            )}

            {/* Content area - centered */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#1f2937' }}>
                  Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
                </h1>
              </div>
            </div>

            {/* Timer at bottom-right - show while timer is active */}
            {isTimerActive && (
              <div style={{
                position: 'absolute',
                bottom: window.innerWidth < 1024 ? '12px' : '24px',
                right: window.innerWidth < 1024 ? '12px' : '24px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transform: 'scale(0.355)',
                transformOrigin: 'bottom right'
              }}>
                {renderCountdownTimer(timerValue, displayData.countdownStyle, displayData.totalTime || 30, 120)}
              </div>
            )}
          </div>
        );

      case 'question':
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '40px', backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
            {/* Question Header */}
            <div style={{ marginBottom: '40px', textAlign: 'center', width: '100%' }}>
              <h1 style={{ fontSize: '56px', fontWeight: 'bold', color: '#f97316', margin: '0 0 20px 0' }}>
                Question {displayData.data?.questionNumber || 1} of {displayData.data?.totalQuestions || 1}
              </h1>
              {displayData.data?.hidden ? (
                <div style={{ fontSize: '120px', fontWeight: 'bold', color: '#9ca3af' }}>?</div>
              ) : (
                <h2 style={{ fontSize: '48px', fontWeight: '600', color: 'white', margin: '0', lineHeight: '1.2', maxWidth: '90vw' }}>
                  {displayData.data?.text || 'Loading question...'}
                </h2>
              )}
            </div>

            {/* Options for Multiple Choice and Sequence */}
            {displayData.data?.options && displayData.data.options.length > 0 && !displayData.data?.hidden && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '1200px' }}>
                {displayData.data.options.map((option: string, index: number) => {
                  const letterMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                  return (
                    <div key={index} style={{
                      backgroundColor: '#374151',
                      border: '3px solid #f97316',
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      fontSize: '28px',
                      fontWeight: '600',
                      color: 'white'
                    }}>
                      <div style={{ marginBottom: '10px', fontSize: '36px', color: '#f97316' }}>{letterMap[index]}</div>
                      <div>{option}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'resultsSummary':
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '40px', backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
            {/* Question and Answer at top */}
            <div style={{ marginBottom: displayData.data?.correctCount !== undefined ? '40px' : '60px', textAlign: 'center', width: '100%' }}>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#f97316', margin: '0 0 20px 0' }}>
                Question {displayData.data?.questionNumber || 1}
              </h1>
              <h2 style={{ fontSize: '40px', fontWeight: '600', color: 'white', margin: '0 0 30px 0', lineHeight: '1.3' }}>
                {displayData.data?.text || ''}
              </h2>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#10b981', margin: '0 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <span style={{ fontSize: '48px' }}>✓</span>
                <span>{displayData.data?.answer || 'No answer available'}</span>
              </div>
            </div>

            {/* Results Summary Grid - only show if team answer counts exist */}
            {displayData.data?.correctCount !== undefined && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%', maxWidth: '800px' }}>
              {/* Correct */}
              <div style={{
                backgroundColor: '#10b981',
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                border: '4px solid white'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '10px' }}>Correct</div>
                <div style={{ fontSize: '56px', fontWeight: 'bold', color: 'white' }}>{displayData.data?.correctCount || 0}</div>
              </div>

              {/* Incorrect */}
              <div style={{
                backgroundColor: '#ef4444',
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                border: '4px solid white'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '10px' }}>Incorrect</div>
                <div style={{ fontSize: '56px', fontWeight: 'bold', color: 'white' }}>{displayData.data?.incorrectCount || 0}</div>
              </div>

              {/* No Answer */}
              <div style={{
                backgroundColor: '#6b7280',
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                border: '4px solid white'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'white', marginBottom: '10px' }}>No Answer</div>
                <div style={{ fontSize: '56px', fontWeight: 'bold', color: 'white' }}>{displayData.data?.noAnswerCount || 0}</div>
              </div>
            </div>
            )}
          </div>
        );

      case 'fastestTeam':
        return (
          <FastestTeamOverlaySimplified
            teamName={displayData.data?.teamName || 'No Team'}
            teamPhoto={displayData.data?.teamPhoto || undefined}
          />
        );

      case 'scores':
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '8px', padding: '32px', width: '100%', maxWidth: '56rem' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#f97316', textAlign: 'center', marginBottom: '32px' }}>★ LIVE SCORES ★</h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {displayData.quizzes.sort((a, b) => (b.score || 0) - (a.score || 0)).map((team, index) => (
                  <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#374151', padding: '16px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>#{index + 1}</span>
                      <span style={{ fontSize: '20px', color: 'white' }}>{team.name}</span>
                    </div>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ade80' }}>{team.score || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>External Display</h1>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#111827', display: 'flex', flexDirection: 'column', border: '8px solid #f97316' }}>
      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleInAnimation {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <div style={{ backgroundColor: '#374151', padding: '12px', flex: '0 0 auto', borderBottom: '3px solid #f97316', display: 'none' }} data-external-display-header="true">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f97316', animation: 'pulse 2s ease-in-out infinite' }}></div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>EXTERNAL DISPLAY</span>
            <span style={{ fontSize: '12px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 500, backgroundColor: '#f97316', color: 'white' }}>
              {displayData.mode}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>1920x1080 • 16:9</div>
        </div>
      </div>

      <div style={{ flex: 1, backgroundColor: 'black', position: 'relative', overflow: 'hidden', border: '8px solid #f97316', boxSizing: 'border-box' }}>
        {renderContent()}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', fontSize: '12px', color: 'white', opacity: 0.3, fontFamily: 'monospace' }}>
          EXT-1
        </div>
      </div>
    </div>
  );
}
