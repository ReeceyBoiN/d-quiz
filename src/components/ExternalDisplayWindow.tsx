import React, { useState, useEffect } from "react";
import { useSettings } from "../utils/SettingsContext";

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
    data: null as any
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
            data: event.data.data || null
          };
        });
      }
    };

    window.addEventListener('message', handleMessage);

    let removeIpcListener: (() => void) | undefined;
    if (isElectron) {
      removeIpcListener = window.api?.ipc.on("external-display/update", (data) => {
        const newMode = data.mode || 'basic';
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
            data: data.data || null
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

  const renderCountdownTimer = (currentTime: number | null, style: string, totalTime = 30) => {
    const timerNum = currentTime || 0;

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
        const progress = timerNum / totalTime;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%', maxWidth: '64rem', margin: '0 auto' }}>
            <div style={{ width: '100%', height: '48px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', transition: 'all 1000ms linear ease-in-out',
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
        const liquidProgress = timerNum / totalTime;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            <div style={{ position: 'relative', borderRadius: '50%', border: '4px solid #d1d5db', overflow: 'hidden', width: '30rem', height: '30rem' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#e5e7eb' }}></div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, transition: 'all 1000ms linear ease-in-out',
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
        const circularProgress = timerNum / totalTime;
        const strokeOffset = circumference * (1 - circularProgress);

        return (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <svg style={{ width: '30rem', height: '30rem', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r={radius} stroke="#e74c3c" strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={strokeOffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
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

      case 'timer':
        return (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '32px', backgroundColor: dynamicBackgroundColor }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#1f2937' }}>
                Question {(displayData.questionInfo && displayData.questionInfo.number) || 1} • Timer
              </h1>
            </div>
            <div style={{ flex: 1, backgroundColor: '#1f2937', borderRadius: '24px', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {renderCountdownTimer(displayData.timerValue, displayData.countdownStyle, displayData.gameModeTimers && displayData.gameMode ? displayData.gameModeTimers[displayData.gameMode] : 30)}
              </div>
            </div>
          </div>
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
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#111827', display: 'flex', flexDirection: 'column' }}>
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
      `}</style>

      <div style={{ backgroundColor: '#374151', padding: '12px', flex: '0 0 auto' }}>
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

      <div style={{ flex: 1, backgroundColor: 'black', position: 'relative', overflow: 'hidden' }}>
        {renderContent()}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', fontSize: '12px', color: 'white', opacity: 0.3, fontFamily: 'monospace' }}>
          EXT-1
        </div>
      </div>
    </div>
  );
}
