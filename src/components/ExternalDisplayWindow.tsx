import React, { useState, useEffect } from "react";
import { useSettings } from "../utils/SettingsContext";
import { FastestTeamOverlaySimplified } from "./FastestTeamOverlaySimplified";

declare global {
  interface Window {
    api?: {
      ipc: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, callback: (data: any) => void) => () => void;
        invoke: (channel: string, data?: any) => Promise<any>;
      };
      externalDisplay?: {
        toggleState: () => Promise<any>;
        setBounds: (x: number, y: number, width: number, height: number) => Promise<any>;
        closeWindow: () => Promise<any>;
      };
    };
  }
}

const isElectron = Boolean(window.api);

// Helper function to calculate optimal grid columns based on option count
const getOptimalGridColumns = (optionCount: number): string => {
  if (optionCount === 1 || optionCount === 2) return '2';
  if (optionCount === 3) return '3';
  if (optionCount === 4) return '4';
  if (optionCount === 5) return '3'; // 2-3 layout (2 in first row, 3 in second row)
  if (optionCount === 6) return '3'; // 3-3 layout (2 rows of 3)
  if (optionCount <= 9) return '3';
  return '4';
};

export function ExternalDisplayWindow() {
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
    gameMode: 'keypad',
    gameModeTimers: { keypad: 30, buzzin: 30, nearestwins: 10 } as any,
    teamName: null as string | null,
    data: null as any,
    totalTime: 30,
    textSize: 'medium' as 'small' | 'medium' | 'large',
    borderColor: '#f97316' as string,
    backgroundColor: '#e74c3c' as string
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [dynamicBackgroundColor, setDynamicBackgroundColor] = useState('#f1c40f');
  const [welcomeColorIndex, setWelcomeColorIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);
  const contentDivRef = React.useRef<HTMLDivElement>(null);

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

  const getRandomBorderColor = () => {
    return dynamicColors[Math.floor(Math.random() * dynamicColors.length)];
  };

  // Helper function to get text size multiplier
  const getTextSizeMultiplier = (textSize: 'small' | 'medium' | 'large'): number => {
    switch (textSize) {
      case 'small':
        return 0.85;
      case 'large':
        return 1.2;
      case 'medium':
      default:
        return 1.0;
    }
  };

  // Helper function to scale font size
  const scaleFontSize = (fontSize: string, multiplier: number): string => {
    // Handle px values
    const pxMatch = fontSize.match(/^(\d+(?:\.\d+)?)px$/);
    if (pxMatch) {
      const value = parseFloat(pxMatch[1]);
      return `${Math.round(value * multiplier)}px`;
    }

    // Handle rem values
    const remMatch = fontSize.match(/^(\d+(?:\.\d+)?)rem$/);
    if (remMatch) {
      const value = parseFloat(remMatch[1]);
      return `${(value * multiplier).toFixed(2)}rem`;
    }

    // Handle clamp() expressions - multiply all three values
    const clampMatch = fontSize.match(/clamp\((.*?),(.*?),(.*?)\)/);
    if (clampMatch) {
      const [, min, preferred, max] = clampMatch;

      const scaleValue = (val: string): string => {
        const trimmed = val.trim();
        const pxMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/);
        if (pxMatch) {
          const value = parseFloat(pxMatch[1]);
          return `${Math.round(value * multiplier)}px`;
        }
        const remMatch = trimmed.match(/^(\d+(?:\.\d+)?)rem$/);
        if (remMatch) {
          const value = parseFloat(remMatch[1]);
          return `${(value * multiplier).toFixed(2)}rem`;
        }
        const vwMatch = trimmed.match(/^(\d+(?:\.\d+)?)vw$/);
        if (vwMatch) {
          const value = parseFloat(vwMatch[1]);
          return `${(value * multiplier).toFixed(2)}vw`;
        }
        return trimmed;
      };

      return `clamp(${scaleValue(min)},${scaleValue(preferred)},${scaleValue(max)})`;
    }

    return fontSize;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DISPLAY_UPDATE') {
        const newMode = event.data.mode || 'basic';
        console.log('[ExternalDisplayWindow] Received DISPLAY_UPDATE message with mode:', newMode);
        setDisplayData(prevData => {
          let newBorderColor = prevData.borderColor;
          let newBackgroundColor = prevData.backgroundColor;
          const questionModes = ['question-with-timer', 'timer-with-question', 'timer', 'question', 'resultsSummary'];
          if (questionModes.includes(newMode) && prevData.mode !== newMode) {
            newBorderColor = getRandomBorderColor();
            newBackgroundColor = getRandomDynamicColor();
          }
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
            timerValue: event.data.timerValue ?? null,
            correctAnswer: event.data.correctAnswer || null,
            questionInfo: event.data.questionInfo || null,
            fastestTeamData: event.data.fastestTeamData || null,
            gameInfo: event.data.gameInfo || null,
            targetNumber: event.data.targetNumber || null,
            answerRevealed: event.data.answerRevealed || false,
            results: event.data.results || null,
            nearestWinsData: event.data.nearestWinsData || null,
            wheelSpinnerData: event.data.wheelSpinnerData || null,
            gameMode: event.data.gameMode || prevData.gameMode || 'keypad',
            gameModeTimers: event.data.gameModeTimers || prevData.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 },
            teamName: (event.data.data && event.data.data.teamName) || event.data.teamName || null,
            data: event.data.data || null,
            totalTime: event.data.totalTime || (event.data.data && event.data.data.totalTime) || prevData.totalTime || 30,
            textSize: event.data.textSize || prevData.textSize || 'medium',
            borderColor: newBorderColor,
            backgroundColor: newBackgroundColor
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
          let newBorderColor = prevData.borderColor;
          let newBackgroundColor = prevData.backgroundColor;
          const questionModes = ['question-with-timer', 'timer-with-question', 'timer', 'question', 'resultsSummary'];
          if (questionModes.includes(newMode) && prevData.mode !== newMode) {
            newBorderColor = getRandomBorderColor();
            newBackgroundColor = getRandomDynamicColor();
          }
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
            timerValue: data.timerValue ?? null,
            correctAnswer: data.correctAnswer || null,
            questionInfo: data.questionInfo || null,
            fastestTeamData: data.fastestTeamData || null,
            gameInfo: data.gameInfo || null,
            targetNumber: data.targetNumber || null,
            answerRevealed: data.answerRevealed || false,
            results: data.results || null,
            nearestWinsData: data.nearestWinsData || null,
            wheelSpinnerData: data.wheelSpinnerData || null,
            gameMode: data.gameMode || prevData.gameMode || 'keypad',
            gameModeTimers: data.gameModeTimers || prevData.gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 },
            teamName: (data.data && data.data.teamName) || data.teamName || null,
            data: data.data || null,
            totalTime: data.totalTime || (data.data && data.data.totalTime) || prevData.totalTime || 30,
            textSize: data.textSize || prevData.textSize || 'medium',
            borderColor: newBorderColor,
            backgroundColor: newBackgroundColor
          };
        });
      });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (removeIpcListener) removeIpcListener();
    };
  }, []);

  // Handle external display window state changes and double-click
  useEffect(() => {
    console.log('[ExternalDisplayWindow] Setting up double-click and IPC listeners, isElectron:', isElectron);

    let stateChangeListener: (() => void) | undefined;

    if (isElectron) {
      // Listen for state changes from main process
      console.log('[ExternalDisplayWindow] 📡 Setting up IPC listener for external-display/state-changed');
      stateChangeListener = window.api?.ipc.on('external-display/state-changed', (data) => {
        console.log('[ExternalDisplayWindow] ✅ RECEIVED state-changed from IPC:', data);
        console.log('[ExternalDisplayWindow] Current state before update:', { isMinimized });
        setIsMinimized(data.isMinimized);
        console.log('[ExternalDisplayWindow] State update called, new value should be:', data.isMinimized);
      });
      console.log('[ExternalDisplayWindow] ✅ IPC listener attached');
    } else {
      console.warn('[ExternalDisplayWindow] ⚠️ Not in Electron environment');
    }

    // Add double-click handler to content area only (not the header)
    const handleDoubleClick = async (e: MouseEvent) => {
      console.log('[ExternalDisplayWindow] 🖱️ Double-click detected at:', { x: e.clientX, y: e.clientY });

      if (isElectron && window.api?.externalDisplay) {
        try {
          console.log('[ExternalDisplayWindow] 🔄 Calling toggleState via IPC...');
          const result = await window.api.externalDisplay.toggleState();
          console.log('[ExternalDisplayWindow] ✅ Toggle state completed with result:', result);
        } catch (err) {
          console.error('[ExternalDisplayWindow] ❌ Error toggling state:', err);
        }
      } else {
        console.warn('[ExternalDisplayWindow] ⚠️ Not in Electron or API unavailable. isElectron:', isElectron, 'hasAPI:', !!window.api?.externalDisplay);
      }
    };

    // Attach dblclick listener to content div only (not the header)
    const contentDiv = contentDivRef.current;
    if (contentDiv) {
      console.log('[ExternalDisplayWindow] Attaching dblclick event listener to content area');
      contentDiv.addEventListener('dblclick', handleDoubleClick);
    }

    return () => {
      console.log('[ExternalDisplayWindow] Cleaning up listeners');
      if (contentDiv) {
        contentDiv.removeEventListener('dblclick', handleDoubleClick);
      }
      if (stateChangeListener) stateChangeListener();
    };
  }, [isElectron]);

  // Setup Ctrl+V keyboard shortcut to close External Display window
  useEffect(() => {
    if (!isElectron || !window.api?.externalDisplay) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+V (or Cmd+V on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        // Check if the active element is a text input, textarea, or contenteditable
        const activeElement = document.activeElement as HTMLElement;
        const isTextInput =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          (activeElement && activeElement.getAttribute('contenteditable') === 'true');

        // Only trigger shortcut if NOT in a text input
        if (!isTextInput) {
          event.preventDefault();
          console.log('[ExternalDisplayWindow] ⌨️ Ctrl+V shortcut triggered - closing external display window');
          window.api?.externalDisplay?.closeWindow().catch((err: Error) => {
            console.error('[ExternalDisplayWindow] ❌ Error closing window via Ctrl+V:', err);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isElectron]);


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

  const renderContent = () => {
    switch (displayData.mode) {
      case 'basic': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
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
                <h1 style={{ fontSize: scaleFontSize('clamp(3rem, 12vw, 10rem)', textSizeMultiplier), fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'black', textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', lineHeight: 0.9 }}>
                  POP
                </h1>
                <h2 style={{ fontSize: scaleFontSize('clamp(3rem, 12vw, 10rem)', textSizeMultiplier), fontWeight: 900, letterSpacing: '0.05em', margin: 0, color: 'black', textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', lineHeight: 0.9 }}>
                  QUIZ!
                </h2>
              </div>
              <div style={{ position: 'absolute', top: '-1rem', left: '-1rem', fontSize: scaleFontSize('3rem', textSizeMultiplier), filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎯</div>
              <div style={{ position: 'absolute', top: '1.5rem', right: '-2rem', fontSize: scaleFontSize('2.5rem', textSizeMultiplier), filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🌟</div>
              <div style={{ position: 'absolute', bottom: '3rem', right: '-3rem', fontSize: scaleFontSize('2.5rem', textSizeMultiplier), filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🏆</div>
              <div style={{ position: 'absolute', bottom: '-2rem', left: '-2rem', fontSize: scaleFontSize('2rem', textSizeMultiplier), filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎵</div>
            </div>
          </div>
        );
      }

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
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        const questionFontSize = scaleFontSize(isMobileSize ? '40px' : '56px', textSizeMultiplier);
        const headerFontSize = scaleFontSize(isMobileSize ? '32px' : '48px', textSizeMultiplier);
        const optionFontSize = scaleFontSize(isMobileSize ? '18px' : '24px', textSizeMultiplier);
        const hasImage = Boolean(displayData.data?.imageDataUrl);

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: displayData.backgroundColor, position: 'relative', overflow: 'hidden' }}>
            {/* Progress bar at top - show only if timer is actively running */}
            {showProgressBar && (
              <div style={{
                height: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
            <div style={{ flex: 1, display: 'flex', padding: containerPadding, gap: gapSize, alignItems: hasImage ? 'stretch' : 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {/* Question and Options on Left - takes up left portion, shrinks if image present */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: displayData.data?.imageDataUrl ? '0 1 50%' : '0 0 auto',
                maxWidth: displayData.data?.imageDataUrl ? '50%' : '600px',
                overflow: 'auto',
                paddingRight: displayData.data?.imageDataUrl ? '0' : gapSize,
                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                border: `3px solid ${displayData.borderColor}`,
                borderRadius: '28px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}>
                {/* Question Header */}
                <div style={{ marginBottom: isMobileSize ? '10px' : '15px' }}>
                  <h1 style={{ fontSize: headerFontSize, fontWeight: 'bold', color: '#f97316', margin: '0 0 15px 0' }}>
                    Question {displayData.data?.questionNumber || 1} of {displayData.data?.totalQuestions || 1}
                  </h1>
                  {displayData.data?.hidden ? (
                    <div style={{ fontSize: scaleFontSize(isMobileSize ? '64px' : '96px', textSizeMultiplier), fontWeight: 'bold', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>?</div>
                  ) : (
                    <h2 style={{ fontSize: questionFontSize, fontWeight: '600', color: 'white', margin: '0', lineHeight: '1.2' }}>
                      {displayData.data?.text || 'Loading question...'}
                    </h2>
                  )}
                </div>

                {/* Options */}
                {displayData.data?.options && displayData.data.options.length > 0 && !displayData.data?.hidden && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${getOptimalGridColumns(displayData.data.options.length)}, 1fr)`,
                    gap: isMobileSize ? '10px' : '16px',
                    marginTop: isMobileSize ? '10px' : '20px',
                    justifyItems: 'center',
                    width: '100%',
                    maxWidth: '100%'
                  }}>
                    {displayData.data.options.map((option: string, index: number) => {
                      const letterMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                      const cols = parseInt(getOptimalGridColumns(displayData.data.options.length));
                      const isLastRowIncomplete = displayData.data.options.length % cols !== 0;
                      const itemsInLastRow = displayData.data.options.length % cols;
                      const isInLastRow = index >= displayData.data.options.length - itemsInLastRow;

                      return (
                        <div key={index} style={{
                          backgroundColor: '#374151',
                          border: `2px solid ${displayData.borderColor}`,
                          borderRadius: '16px',
                          padding: isMobileSize ? '10px' : '16px',
                          textAlign: 'center',
                          fontSize: optionFontSize,
                          fontWeight: '600',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          ...(isLastRowIncomplete && isInLastRow && { justifySelf: 'center' })
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: scaleFontSize(isMobileSize ? '18px' : '28px', textSizeMultiplier), color: displayData.borderColor }}>{letterMap[index]}</div>
                          <div>{option}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Image on Right (if present) - constrained to right half of screen */}
              {hasImage && (
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
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Progress bar at bottom - show while timer is running */}
            {showProgressBar && timeRemaining > 0 && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#f97316',
                  width: `${progressPercentage}%`,
                  transition: 'width 0.1s linear'
                }} />
              </div>
            )}


          </div>
        );
      }

      case 'picture': {
        // Display picture only - image on right, empty space on left
        // Uses same layout as question-with-timer so image stays in same position when question is revealed
        const isMobileSize = window.innerWidth < 1024;
        // Use much tighter padding and gap in picture mode to maximize image size
        const containerPadding = isMobileSize ? '8px' : '12px';
        const gapSize = isMobileSize ? '6px' : '12px';

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: displayData.backgroundColor, position: 'relative', overflow: 'hidden' }}>
            {/* Main content area with empty left and image on right */}
            <div style={{ flex: 1, display: 'flex', padding: containerPadding, gap: gapSize, alignItems: 'stretch', justifyContent: 'flex-start', overflow: 'hidden' }}>
              {/* Empty left side (where question text will appear later) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: '0 1 50%',
                maxWidth: '50%'
              }}>
              </div>

              {/* Image on Right */}
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
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'timer': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
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
                  transition: 'width 0.1s linear, background-color 0.3s ease',
                  boxShadow: `0 0 10px ${getProgressBarColor()}`
                }}></div>
              </div>
            )}

            {/* Content area - centered */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{
                textAlign: 'center',
                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                border: `3px solid ${displayData.borderColor}`,
                borderRadius: '28px',
                padding: '40px 60px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}>
                <h1 style={{ fontSize: scaleFontSize('72px', textSizeMultiplier), fontWeight: 'bold', color: '#f97316', margin: '0' }}>
                  Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
                </h1>
              </div>
            </div>

            {/* Progress bar at bottom - show while timer is active */}
            {isTimerActive && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '12px',
                backgroundColor: '#e5e7eb',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: getProgressBarColor(),
                  width: `${progressPercentage}%`,
                  transition: 'width 0.1s linear, background-color 0.3s ease',
                  boxShadow: `0 0 10px ${getProgressBarColor()}`
                }} />
              </div>
            )}



          </div>
        );
      }

      case 'question': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px', backgroundColor: displayData.backgroundColor, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '1200px', gap: '12px' }}>
              {/* Question Header */}
              <div style={{ marginBottom: '20px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '16px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
                <h1 style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: '#f97316', margin: '0 0 20px 0' }}>
                  Question {displayData.data?.questionNumber || 1} of {displayData.data?.totalQuestions || 1}
                </h1>
                {displayData.data?.hidden ? (
                  <div style={{ fontSize: scaleFontSize('120px', textSizeMultiplier), fontWeight: 'bold', color: '#9ca3af' }}>?</div>
                ) : (
                  <h2 style={{ fontSize: scaleFontSize('48px', textSizeMultiplier), fontWeight: '600', color: 'white', margin: '0', lineHeight: '1.2', maxWidth: '90vw' }}>
                    {displayData.data?.text || 'Loading question...'}
                  </h2>
                )}
              </div>

              {/* Options for Multiple Choice and Sequence */}
              {displayData.data?.options && displayData.data.options.length > 0 && !displayData.data?.hidden && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${getOptimalGridColumns(displayData.data.options.length)}, 1fr)`,
                  gap: '12px',
                  width: '100%',
                  justifyItems: 'center'
                }}>
                {displayData.data.options.map((option: string, index: number) => {
                  const letterMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                  const cols = parseInt(getOptimalGridColumns(displayData.data.options.length));
                  const isLastRowIncomplete = displayData.data.options.length % cols !== 0;
                  const itemsInLastRow = displayData.data.options.length % cols;
                  const isInLastRow = index >= displayData.data.options.length - itemsInLastRow;

                  return (
                    <div key={index} style={{
                      backgroundColor: '#374151',
                      border: `3px solid ${displayData.borderColor}`,
                      borderRadius: '16px',
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: scaleFontSize('28px', textSizeMultiplier),
                      fontWeight: '600',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      ...(isLastRowIncomplete && isInLastRow && { justifySelf: 'center' })
                    }}>
                      <div style={{ marginBottom: '10px', fontSize: scaleFontSize('36px', textSizeMultiplier), color: displayData.borderColor }}>{letterMap[index]}</div>
                      <div>{option}</div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        );
      }

      case 'resultsSummary': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px', backgroundColor: displayData.backgroundColor, alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
            {/* Question and Answer at top */}
            <div style={{ marginBottom: displayData.data?.correctCount !== undefined ? '20px' : '30px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '16px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
              <h1 style={{ fontSize: scaleFontSize('48px', textSizeMultiplier), fontWeight: 'bold', color: displayData.borderColor, margin: '0 0 20px 0' }}>
                Question {displayData.data?.questionNumber || 1}
              </h1>
              <h2 style={{ fontSize: scaleFontSize('40px', textSizeMultiplier), fontWeight: '600', color: 'white', margin: '0 0 30px 0', lineHeight: '1.3' }}>
                {displayData.data?.text || ''}
              </h2>
              <div style={{ fontSize: scaleFontSize('42px', textSizeMultiplier), fontWeight: 'bold', color: '#10b981', margin: '0 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <span style={{ fontSize: scaleFontSize('48px', textSizeMultiplier) }}>✓</span>
                <span>
                  {displayData.data?.answerText
                    ? `${displayData.data?.answerLetter || displayData.data?.answer}: ${displayData.data?.answerText}`
                    : displayData.data?.answer || 'No answer available'}
                </span>
              </div>
            </div>

            {/* Results Summary Grid - only show if team answer counts exist */}
            {displayData.data?.correctCount !== undefined && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '800px' }}>
              {/* Correct */}
              <div style={{
                backgroundColor: '#10b981',
                borderRadius: '24px',
                padding: '30px',
                textAlign: 'center',
                border: `4px solid ${displayData.borderColor}`,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>Correct</div>
                <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{displayData.data?.correctCount || 0}</div>
              </div>

              {/* Incorrect */}
              <div style={{
                backgroundColor: '#ef4444',
                borderRadius: '24px',
                padding: '30px',
                textAlign: 'center',
                border: `4px solid ${displayData.borderColor}`,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>Incorrect</div>
                <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{displayData.data?.incorrectCount || 0}</div>
              </div>

              {/* No Answer */}
              <div style={{
                backgroundColor: '#6b7280',
                borderRadius: '24px',
                padding: '30px',
                textAlign: 'center',
                border: `4px solid ${displayData.borderColor}`,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>No Answer</div>
                <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{displayData.data?.noAnswerCount || 0}</div>
              </div>
            </div>
            )}
          </div>
        );
      }

      case 'fastestTeam':
        return (
          <FastestTeamOverlaySimplified
            teamName={displayData.data?.teamName || 'No Team'}
            teamPhoto={displayData.data?.teamPhoto || undefined}
            textSize={displayData.textSize}
          />
        );

      case 'wheel-spinner': {
        const wheelData = displayData.wheelSpinnerData || {};
        const wheelItems = wheelData.wheelItems || [];
        const isSpinning = wheelData.isSpinning || false;
        const rotation = wheelData.rotation || 0;
        const winner = wheelData.winner || null;
        const spinDuration = wheelData.spinDuration || 0;

        const renderWheelSegments = () => {
          if (wheelItems.length === 0) return null;

          const itemAngle = 360 / wheelItems.length;

          return wheelItems.map((item: any, index: number) => {
            const startAngle = index * itemAngle;
            const endAngle = (index + 1) * itemAngle;
            const midAngle = (startAngle + endAngle) / 2;

            const radius = 200;
            const centerX = 200;
            const centerY = 200;

            const x1 = centerX + Math.cos((startAngle - 90) * Math.PI / 180) * radius;
            const y1 = centerY + Math.sin((startAngle - 90) * Math.PI / 180) * radius;
            const x2 = centerX + Math.cos((endAngle - 90) * Math.PI / 180) * radius;
            const y2 = centerY + Math.sin((endAngle - 90) * Math.PI / 180) * radius;

            const largeArcFlag = itemAngle > 180 ? 1 : 0;

            const pathData = [
              `M ${centerX} ${centerY}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');

            const textRadius = radius * 0.85;
            const textX = centerX + Math.cos((midAngle - 90) * Math.PI / 180) * textRadius;
            const textY = centerY + Math.sin((midAngle - 90) * Math.PI / 180) * textRadius;

            return (
              <g key={item.id}>
                <path
                  d={pathData}
                  fill={item.color}
                  stroke="#2c3e50"
                  strokeWidth="2"
                />
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  transform={`rotate(${midAngle - 90}, ${textX}, ${textY})`}
                >
                  {item.label}
                </text>
              </g>
            );
          });
        };

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937', position: 'relative', overflow: 'hidden' }}>
            {/* Pointer - right side */}
            <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translate(12px, -50%)', zIndex: 20 }}>
              <div style={{ width: 0, height: 0, borderTop: '36px solid transparent', borderBottom: '36px solid transparent', borderRight: '60px solid #f39c12', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}></div>
            </div>

            {/* Wheel Container */}
            <div style={{ position: 'relative', width: '90vmin', height: '90vmin', maxWidth: '800px', maxHeight: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Rotating Wheel */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: isSpinning ? `${spinDuration}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)',
                }}
              >
                <svg viewBox="0 0 400 400" width="100%" height="100%" style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))' }}>
                  {/* Outer circle */}
                  <circle cx="200" cy="200" r="200" fill="#2c3e50" stroke="#4a5568" strokeWidth="4" />

                  {/* Wheel segments */}
                  {renderWheelSegments()}

                  {/* Center circle */}
                  <circle cx="200" cy="200" r="28" fill="#34495e" stroke="#4a5568" strokeWidth="3" />
                  <text x="200" y="200" textAnchor="middle" dominantBaseline="middle" fill="#ecf0f1" fontSize="14" fontWeight="bold">
                    SPIN
                  </text>
                </svg>
              </div>
            </div>

            {/* Winner Overlay - full screen */}
            {winner && (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 30,
                animation: 'scaleInAnimation 0.5s ease-out'
              }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                  <div style={{ fontSize: 'clamp(4rem, 15vw, 12rem)', marginBottom: '20px', animation: 'bounce 1s infinite' }}>🎉</div>
                  <h2 style={{ fontSize: 'clamp(3rem, 10vw, 8rem)', fontWeight: 'bold', margin: '0 0 20px 0', color: '#f39c12' }}>
                    WINNER!
                  </h2>
                  <div style={{ fontSize: 'clamp(2rem, 8vw, 6rem)', fontWeight: 'bold', color: 'white', textShadow: '0 4px 20px rgba(243, 156, 18, 0.5)' }}>
                    {winner}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

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

      case 'correctAnswer': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        const answerData = displayData.correctAnswer;

        // Extract stats from either the answerData.stats object or individual properties
        const stats = answerData?.stats || {
          correct: answerData?.correctCount ?? displayData.data?.correctCount ?? 0,
          wrong: answerData?.incorrectCount ?? displayData.data?.incorrectCount ?? 0,
          noAnswer: answerData?.noAnswerCount ?? displayData.data?.noAnswerCount ?? 0
        };

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px', backgroundColor: displayData.backgroundColor, alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
            {/* Answer bubble - centered */}
            <div style={{ marginBottom: '30px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '20px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
              <h2 style={{ fontSize: scaleFontSize('36px', textSizeMultiplier), fontWeight: '600', color: 'white', margin: '0 0 20px 0', lineHeight: '1.2' }}>
                Correct Answer
              </h2>
              <div style={{ fontSize: scaleFontSize('42px', textSizeMultiplier), fontWeight: 'bold', color: '#10b981', margin: '0 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <span style={{ fontSize: scaleFontSize('48px', textSizeMultiplier) }}>✓</span>
                <span>
                  {answerData?.answerText
                    ? `${answerData?.answerLetter || answerData?.answer}: ${answerData?.answerText}`
                    : answerData?.correctAnswer || answerData?.answer || 'No answer available'}
                </span>
              </div>
            </div>

            {/* Results Summary Grid - show stats only after reveal */}
            {answerData?.revealed === true && (stats.correct !== undefined || stats.wrong !== undefined || stats.noAnswer !== undefined) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '800px' }}>
                {/* Correct */}
                <div style={{
                  backgroundColor: '#10b981',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>Correct</div>
                  <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{stats.correct ?? 0}</div>
                </div>

                {/* Incorrect */}
                <div style={{
                  backgroundColor: '#ef4444',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>Incorrect</div>
                  <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{stats.wrong ?? 0}</div>
                </div>

                {/* No Answer */}
                <div style={{
                  backgroundColor: '#6b7280',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>No Answer</div>
                  <div style={{ fontSize: scaleFontSize('56px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{stats.noAnswer ?? 0}</div>
                </div>
              </div>
            )}

            {/* Fastest Team info if available */}
            {answerData?.fastestTeam && (
              <div style={{ marginTop: '30px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '16px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
                <h3 style={{ fontSize: scaleFontSize('28px', textSizeMultiplier), fontWeight: '600', color: '#f97316', margin: '0 0 10px 0' }}>⚡ Fastest Team</h3>
                <div style={{ fontSize: scaleFontSize('32px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{answerData.fastestTeam?.name || answerData.fastestTeam?.team?.name || 'N/A'}</div>
              </div>
            )}
          </div>
        );
      }

      case 'questionWaiting': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        const questionInfo = displayData.questionInfo || {};

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: dynamicBackgroundColor, alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{
              textAlign: 'center',
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              border: `3px solid ${displayData.borderColor}`,
              borderRadius: '28px',
              padding: '40px 60px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <h1 style={{ fontSize: scaleFontSize('72px', textSizeMultiplier), fontWeight: 'bold', color: '#f97316', margin: '0' }}>
                Question {questionInfo.number || 1}
              </h1>
            </div>
          </div>
        );
      }

      case 'nearest-wins-question': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: displayData.backgroundColor, alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <div style={{ textAlign: 'center', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '40px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
              <h2 style={{ fontSize: scaleFontSize('36px', textSizeMultiplier), fontWeight: '600', color: 'white', margin: '0 0 30px 0' }}>
                Get as close as you can to...
              </h2>
              <div style={{ fontSize: scaleFontSize('120px', textSizeMultiplier), fontWeight: 'bold', color: '#f97316', margin: '0' }}>
                {displayData.targetNumber !== null && displayData.targetNumber !== undefined ? displayData.targetNumber : '?'}
              </div>
            </div>
          </div>
        );
      }

      case 'nearest-wins-results': {
        const textSizeMultiplier = getTextSizeMultiplier(displayData.textSize);
        const resultsData = displayData.results || {};

        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px', backgroundColor: displayData.backgroundColor, alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
            {/* Answer reveal bubble */}
            <div style={{ marginBottom: '30px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(31, 41, 55, 0.95)', border: `3px solid ${displayData.borderColor}`, borderRadius: '28px', padding: '20px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' }}>
              <h2 style={{ fontSize: scaleFontSize('36px', textSizeMultiplier), fontWeight: '600', color: 'white', margin: '0 0 20px 0', lineHeight: '1.2' }}>
                The Answer is...
              </h2>
              <div style={{ fontSize: scaleFontSize('96px', textSizeMultiplier), fontWeight: 'bold', color: '#10b981', margin: '0' }}>
                {displayData.answerRevealed && displayData.correctAnswer ? displayData.correctAnswer : '?'}
              </div>
            </div>

            {/* Results stats if available */}
            {resultsData && Object.keys(resultsData).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '800px' }}>
                {/* 1st Place */}
                <div style={{
                  backgroundColor: '#f59e0b',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>🥇 Closest</div>
                  <div style={{ fontSize: scaleFontSize('48px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{resultsData.closest?.name || 'N/A'}</div>
                </div>

                {/* 2nd Place */}
                <div style={{
                  backgroundColor: '#8b8b8b',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>🥈 2nd Close</div>
                  <div style={{ fontSize: scaleFontSize('48px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{resultsData.secondClosest?.name || 'N/A'}</div>
                </div>

                {/* 3rd Place */}
                <div style={{
                  backgroundColor: '#cd7f32',
                  borderRadius: '24px',
                  padding: '30px',
                  textAlign: 'center',
                  border: `4px solid ${displayData.borderColor}`,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  <div style={{ fontSize: scaleFontSize('24px', textSizeMultiplier), fontWeight: '600', color: 'white', marginBottom: '10px' }}>🥉 3rd Close</div>
                  <div style={{ fontSize: scaleFontSize('48px', textSizeMultiplier), fontWeight: 'bold', color: 'white' }}>{resultsData.thirdClosest?.name || 'N/A'}</div>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'fastTrack':
        return (
          <FastestTeamOverlaySimplified
            teamName={displayData.fastestTeamData?.teamName || 'No Team'}
            teamPhoto={displayData.fastestTeamData?.teamPhoto || undefined}
            textSize={displayData.textSize}
          />
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
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#111827', display: 'flex', flexDirection: 'column', border: isMinimized ? 'none' : 'none' }}>
      <style>{`
        /* CRITICAL: Ensure full screen coverage for Electron frameless window */
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: #111827;
        }

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
        [data-external-display-header="true"] {
          -webkit-app-region: drag;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>

      {/* Header - ONLY shown when minimized (for dragging and resizing) */}
      {isMinimized && (
        <div
          style={{
            position: 'relative',
            backgroundColor: '#374151',
            padding: '8px 12px',
            borderBottom: '2px solid #f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'grab',
            zIndex: 100,
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            minHeight: '36px',
          }}
          data-external-display-header="true"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>EXTERNAL DISPLAY</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            Drag to move • Double-click content to maximize
          </div>
        </div>
      )}

      <div
        ref={contentDivRef}
        style={{
          flex: 1,
          backgroundColor: 'black',
          position: 'relative',
          overflow: 'hidden',
          border: 'none',
          boxSizing: 'border-box',
          cursor: isMinimized ? 'grab' : 'default'
        }}
      >
        {renderContent()}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', fontSize: '12px', color: 'white', opacity: 0.3, fontFamily: 'monospace' }}>
          EXT-1
        </div>
      </div>
    </div>
  );
}
