import React, { useState, useEffect } from "react";
import { useSettings } from "../utils/SettingsContext";

// Type hint for our Electron preload API
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

// ✅ Detect if running inside Electron
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

  const colors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
    '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
    '#808080', '#000000', '#FFFFFF', '#90EE90', '#FFB6C1'
  ];

  const welcomeColors = [
    '#f39c12',
    '#e74c3c',
    '#e91e63',
    '#9b59b6',
    '#3498db',
    '#27ae60',
    '#f1c40f',
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
        '🎯', '🎪', '🎉', '🏆', '⭐', '💫', '🎊', '🎈',
        '🎺', '🐼', '🎨', '🎭', '🎸', '🎲', '🎳', '🎮',
        '🎱', '🎰', '🎵', '🌮', '🍕', '🍦', '🍪', '🍰',
        '🧁', '🍓', '🍊', '🍌', '🍍', '🐶', '🐱', '🐭',
        '🐹', '🐰', '🦊', '🐻', '🐨', '🐯', '🌸', '🌺',
        '🌻', '🌷', '🌹', '🌵', '🌲', '🌳', '🍀', '🍃',
        '✨', '🌙', '☀️', '🌤️', '⛅', '🌦️', '❄️', '🚀',
        '🛸', '🎡', '🎢', '🎠', '🔥', '💖', '🌈', '⚡'
      ];

      const spawnEmoji = () => {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const randomLeft = Math.random() * 80 + 10;

        const emojiDiv = document.createElement('div');
        emojiDiv.textContent = randomEmoji;
        emojiDiv.className = 'falling-emoji';
        emojiDiv.style.left = randomLeft + '%';
        emojiDiv.style.top = '-60px';
        emojiDiv.style.position = 'fixed';
        emojiDiv.style.fontSize = '3rem';
        emojiDiv.style.opacity = '1';
        emojiDiv.style.pointerEvents = 'none';
        emojiDiv.style.animation = 'fall 8s linear forwards';

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
        const existingEmojis = document.querySelectorAll('.falling-emoji');
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
          <div className="flex flex-col items-center justify-center">
            <div className="bg-black border-4 border-green-400 rounded-lg p-8" style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}>
              <div className="text-center font-mono text-green-400 text-[12rem] font-bold" style={{ textShadow: '0 0 10px currentColor' }}>
                {String(timerNum).padStart(2, '0')}
              </div>
            </div>
            <div className="text-center text-2xl text-green-300 mt-4">seconds</div>
          </div>
        );

      case 'pulsing':
        return (
          <div className="flex flex-col items-center justify-center">
            <div
              className="bg-blue-500 rounded-full flex flex-col items-center justify-center text-white font-bold"
              style={{
                width: '30rem',
                height: '30rem',
                animation: timerNum <= 10 ? 'pulse 0.5s ease-in-out infinite' : 'pulse 2s ease-in-out infinite'
              }}
            >
              <div className="text-[12rem]">{timerNum}</div>
              <div className="text-2xl mt-2">seconds</div>
            </div>
          </div>
        );

      case 'progress-bar':
        const progress = timerNum / totalTime;
        return (
          <div className="flex flex-col items-center justify-center gap-8 w-full max-w-4xl mx-auto">
            <div className="w-full h-12 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-linear"
                style={{
                  width: (progress * 100) + '%',
                  background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)'
                }}
              />
            </div>
            <div className="text-[12rem] font-bold text-blue-500">{timerNum}</div>
            <div className="text-2xl text-white">seconds</div>
          </div>
        );

      case 'matrix':
        return (
          <div className="flex flex-col items-center justify-center">
            <div
              className="bg-black border border-green-400 rounded-lg relative overflow-hidden"
              style={{ width: '30rem', height: '30rem' }}
            >
              <div className="absolute inset-0 z-10 flex items-center justify-center text-green-400 font-mono text-[12rem] font-bold" style={{ textShadow: '0 0 10px currentColor' }}>
                {String(timerNum).padStart(2, '0')}
              </div>
            </div>
            <div className="text-green-400 text-2xl mt-4">seconds</div>
          </div>
        );

      case 'liquid':
        const liquidProgress = timerNum / totalTime;
        return (
          <div className="flex flex-col items-center justify-center gap-8">
            <div
              className="relative rounded-full border-4 border-gray-300 overflow-hidden"
              style={{ width: '30rem', height: '30rem' }}
            >
              <div className="absolute inset-0 bg-gray-200"></div>
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-linear"
                style={{
                  height: (liquidProgress * 100) + '%',
                  background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[12rem] font-bold text-white z-10" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                {timerNum}
              </div>
            </div>
            <div className="text-2xl text-white">seconds</div>
          </div>
        );

      case 'gradient':
        const hue = (timerNum / totalTime) * 120;
        return (
          <div className="flex flex-col items-center justify-center gap-8">
            <div
              className="relative rounded-full overflow-hidden"
              style={{ width: '30rem', height: '30rem' }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, hsl(' + hue + ', 70%, 50%) 0%, hsl(60, 70%, 50%) 25%, hsl(30, 70%, 50%) 50%, hsl(0, 70%, 50%) 75%, hsl(' + hue + ', 70%, 50%) 100%)',
                  animation: 'spin 3s linear infinite'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[12rem] font-bold text-white z-10" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                {timerNum}
              </div>
            </div>
            <div className="text-2xl text-white">seconds</div>
          </div>
        );

      case 'circular':
      default:
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const circularProgress = timerNum / totalTime;
        const strokeOffset = circumference * (1 - circularProgress);

        return (
          <div className="relative inline-block">
            <svg
              style={{ width: '30rem', height: '30rem' }}
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
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[12rem] font-bold text-red-500">
                  {timerNum}
                </div>
                <div className="text-3xl text-white mt-2">
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
      case 'questionWaiting':
        return (
          <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800">
                Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
              </h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-8">Get ready...</div>
                <div className="text-[25rem] font-bold text-white mb-4 animate-pulse leading-none">
                  ?
                </div>
                <div className="text-2xl text-gray-400 animate-pulse">
                  Question will begin shortly
                </div>
              </div>
            </div>
          </div>
        );

      case 'basic':
        return (
          <div
            className="h-full w-full flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: getHSLColor(currentColorIndex) }}
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 bg-orange-400 rounded-full animate-pulse"></div>
              <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-1000"></div>
              <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse delay-2000"></div>
              <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse delay-500"></div>
            </div>

            <div className="relative z-10 text-center transform -rotate-6">
              <div className="bg-orange-500 text-black px-20 py-12 rounded-2xl shadow-2xl border-4 border-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <h1 className="text-[12rem] font-black tracking-wider drop-shadow-lg">
                  POP
                </h1>
                <h2 className="text-[12rem] font-black tracking-wider -mt-8 drop-shadow-lg">
                  QUIZ!
                </h2>
              </div>

              <div className="absolute -top-8 -left-8 text-6xl animate-bounce">🎯</div>
              <div className="absolute -top-8 -right-8 text-6xl animate-bounce delay-300">🧠</div>
              <div className="absolute -bottom-8 -left-8 text-6xl animate-bounce delay-700">🎵</div>
              <div className="absolute -bottom-8 -right-8 text-6xl animate-bounce delay-1000">🏆</div>
            </div>

            <div className="absolute top-1/4 left-1/4 text-4xl animate-spin">⭐</div>
            <div className="absolute top-3/4 right-1/4 text-4xl animate-spin delay-500">✨</div>
            <div className="absolute top-1/2 left-1/6 text-3xl animate-pulse">🎵</div>
            <div className="absolute top-1/3 right-1/6 text-3xl animate-pulse delay-300">⚡</div>
          </div>
        );

      case 'scores':
        return (
          <div className="h-full w-full flex items-center justify-center p-8">
            <div className="bg-gray-800 rounded-lg p-8 w-full max-w-4xl">
              <h1 className="text-4xl font-bold text-orange-400 text-center mb-8">★ LIVE SCORES ★</h1>
              <div className="space-y-4">
                {displayData.quizzes
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between bg-gray-700 p-4 rounded">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-blue-400">#{index + 1}</span>
                        <span className="text-xl text-white">{team.name}</span>
                      </div>
                      <span className="text-2xl font-bold text-green-400">{team.score || 0}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );

      case 'slideshow':
        if (displayData.images.length === 0) {
          return (
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-4">Image Slideshow</h1>
                <p className="text-lg text-gray-400">No images uploaded</p>
                <p className="text-sm text-gray-500 mt-2">Upload images in Display Settings to start slideshow</p>
              </div>
            </div>
          );
        }

        const currentImage = displayData.images[currentImageIndex];
        return (
          <div className="h-full w-full relative overflow-hidden bg-black">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={currentImage.url}
                alt={currentImage.name}
                className="max-h-full max-w-full object-contain"
                style={{
                  transition: 'opacity 0.5s ease-in-out',
                  filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))'
                }}
              />
            </div>

            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm">
              <div className="text-center">
                <div className="font-semibold">{currentImageIndex + 1} / {displayData.images.length}</div>
                <div className="text-xs opacity-75">{displayData.slideshowSpeed}s interval</div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
              <div className="font-medium">{currentImage.name}</div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
              <div
                className="h-full bg-blue-500 transition-all ease-linear"
                style={{
                  width: ((currentImageIndex + 1) / displayData.images.length * 100) + '%'
                }}
              ></div>
            </div>
          </div>
        );

      case 'leaderboard-intro':
        return (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-8xl mb-8 animate-bounce">♕</div>
              <h1 className="text-6xl font-bold text-orange-400 mb-4">AND THE SCORES ARE...</h1>
              <p className="text-2xl text-white opacity-80">Get ready for the results!</p>
            </div>
          </div>
        );

      case 'leaderboard-reveal':
        if (!displayData.leaderboardData?.team) {
          return (
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl mb-8 animate-bounce">♕</div>
                <h1 className="text-6xl font-bold text-orange-400 mb-4">WAITING FOR REVEAL...</h1>
                <p className="text-2xl text-white opacity-80">Host will start revealing teams soon!</p>
              </div>
            </div>
          );
        }

        const { team, position, revealedTeamsWithPositions } = displayData.leaderboardData;
        const teamsToDisplay = revealedTeamsWithPositions
          ? [...revealedTeamsWithPositions].sort((a, b) => (a.actualPosition || a.position || 0) - (b.actualPosition || b.position || 0))
          : [...displayData.revealedTeams].sort((a, b) => (a.actualPosition || 0) - (b.actualPosition || 0));

        return (
          <div className="h-full w-full flex flex-col">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-6 flex-shrink-0">
              <h1 className="text-5xl font-bold text-center">♕ LEADERBOARD ♕</h1>
            </div>

            <div className="flex-1 bg-gray-800 overflow-hidden flex flex-col">
              <div className="bg-orange-500 px-8 py-4 flex-shrink-0">
                <div className="grid grid-cols-12 gap-4 text-white text-3xl font-bold">
                  <div className="col-span-2 text-center">Position</div>
                  <div className="col-span-7">Team Name</div>
                  <div className="col-span-3 text-center">Score</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {teamsToDisplay
                  .map((revealedTeam) => {
                    const isCurrentTeam = team && revealedTeam.id === team.id;
                    const teamPosition = revealedTeam.actualPosition || revealedTeam.position || position;
                    return (
                      <div
                        key={revealedTeam.id}
                        className={'grid grid-cols-12 gap-4 px-8 py-8 border-b-2 border-gray-600 ' +
                          (isCurrentTeam ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white')}
                      >
                        <div className="col-span-2 flex items-center justify-center">
                          {teamPosition === 1 && <div className="text-6xl">①</div>}
                          {teamPosition === 2 && <div className="text-6xl">②</div>}
                          {teamPosition === 3 && <div className="text-6xl">③</div>}
                          {teamPosition > 3 && (
                            <div className="text-4xl font-bold px-6 py-3 rounded-full border-4 border-blue-400 text-blue-400">
                              {teamPosition}
                            </div>
                          )}
                        </div>
                        <div className="col-span-7 flex items-center">
                          <span className="text-4xl font-bold">{revealedTeam.name}</span>
                        </div>
                        <div className="col-span-3 flex items-center justify-center">
                          <div className="text-5xl font-bold text-blue-400">
                            {revealedTeam.score || 0}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        );

      case 'timer':
        return (
          <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800">
                Question {(displayData.questionInfo && displayData.questionInfo.number) || 1} • Timer
              </h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              <div className="flex items-center justify-center">
                {renderCountdownTimer(displayData.timerValue, displayData.countdownStyle, displayData.gameModeTimers && displayData.gameMode ? displayData.gameModeTimers[displayData.gameMode] : 30)}
              </div>
            </div>
          </div>
        );

      case 'correctAnswer':
        return (
          <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800">
                Question {(displayData.questionInfo && displayData.questionInfo.number) || 1} • Results
              </h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              {displayData.correctAnswer && displayData.correctAnswer.stats && (
                <div className="text-center mb-8">
                  <div className="flex justify-center items-center gap-4 mb-8">
                    {displayData.correctAnswer.stats.correct > 0 && (
                      <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                        {displayData.correctAnswer.stats.correct} Correct
                      </div>
                    )}

                    {displayData.correctAnswer.stats.wrong > 0 && (
                      <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                        {displayData.correctAnswer.stats.wrong} Wrong
                      </div>
                    )}

                    {displayData.correctAnswer.stats.noAnswer > 0 && (
                      <div className="bg-gray-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                        {displayData.correctAnswer.stats.noAnswer} No Answer
                      </div>
                    )}
                  </div>
                  <div className="w-full h-px bg-gray-600 my-8"></div>
                </div>
              )}

              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-8">The correct answer is...</div>

                <div className="text-8xl font-bold text-white mb-4">
                  {displayData.correctAnswer && displayData.correctAnswer.revealed ? (displayData.correctAnswer.correctAnswer || 'No Answer') : '...'}
                </div>

                {!(displayData.correctAnswer && displayData.correctAnswer.revealed) && (
                  <div className="text-2xl text-gray-400 animate-pulse">
                    Waiting for reveal...
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'nearest-wins-question':
        return (
          <div className="h-full w-full flex items-center justify-center bg-[#2c3e50]">
            <div className="text-center">
              <div className="text-6xl font-bold text-[#f39c12] mb-8">
                Nearest Wins Question {displayData.questionInfo?.number || 1}
              </div>
              <div className="text-4xl text-white mb-8">
                Guess as close as you can!
              </div>
              <div className="text-2xl text-[#95a5a6]">
                Teams: Submit your best guess now
              </div>
            </div>
          </div>
        );

      case 'nearest-wins-timer':
        return (
          <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800">Nearest Wins • Timer</h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              <div className="flex items-center justify-center">
                {renderCountdownTimer(displayData.timerValue, displayData.countdownStyle, displayData.gameInfo?.totalTime || displayData.gameModeTimers?.nearestwins || 10)}
              </div>
            </div>
          </div>
        );

      case 'nearest-wins-results':
        return (
          <div className="h-full w-full flex flex-col p-8 bg-gradient-to-br from-green-600 to-green-800">
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-white">
                ◉ NEAREST WINS • Results
              </h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              <div className="text-center">
                {displayData.answerRevealed && displayData.results ? (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">♕ WINNER ♕</div>
                    <div className="text-8xl font-bold text-green-400 mb-4">
                      {displayData.results.winner.name}
                    </div>
                    <div className="text-4xl text-white mb-4">
                      Guess: {displayData.results.winner.guess}
                    </div>
                    <div className="text-2xl text-gray-400">
                      Difference: {displayData.results.winner.difference}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">Results are in...</div>
                    <div className="text-8xl font-bold text-white mb-4 animate-pulse">
                      ◉
                    </div>
                    <div className="text-2xl text-gray-400 animate-pulse">
                      Waiting for reveal...
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'fastestTeam':
        return (
          <div className="h-full w-full flex flex-col p-8" style={{ backgroundColor: dynamicBackgroundColor }}>
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800">
                🏃 FASTEST TEAM 🏃
              </h1>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-12 flex flex-col justify-center">
              <div className="text-center">
                {displayData.fastestTeamData && displayData.fastestTeamData.fastestTeam && displayData.fastestTeamData.fastestTeam.name ? (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">⚡ Lightning Fast ⚡</div>
                    <div className="text-[8rem] font-bold text-white mb-4 leading-none">
                      {displayData.fastestTeamData.fastestTeam.name}
                    </div>
                    <div className="text-3xl text-gray-400 mb-4">
                      🏆 Fastest Correct Answer! 🏆
                    </div>
                    {displayData.fastestTeamData.responseTime && (
                      <div className="text-2xl text-gray-400 mb-4">
                        Response time: {(displayData.fastestTeamData.responseTime / 1000).toFixed(2)}s
                      </div>
                    )}
                    <div className="text-2xl text-gray-400">
                      Got the correct answer first!
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">⚡ Calculating... ⚡</div>
                    <div className="text-[8rem] font-bold text-white mb-4 animate-pulse leading-none">
                      🏃
                    </div>
                    <div className="text-2xl text-gray-400 animate-pulse">
                      Finding the fastest team...
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'fastTrack':
        const rainbowColors = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#FF00FF'];
        const fastTrackBgColor = rainbowColors[Math.floor(Date.now() / 500) % rainbowColors.length];

        return (
          <div
            className="h-full w-full flex flex-col p-8 relative overflow-hidden"
            style={{
              backgroundColor: fastTrackBgColor,
              transition: 'background-color 0.5s ease-in-out'
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl animate-ping"
                  style={{
                    left: Math.random() * 100 + '%',
                    top: Math.random() * 100 + '%',
                    animationDelay: Math.random() * 2 + 's',
                    animationDuration: (1 + Math.random() * 2) + 's',
                  }}
                >
                  ✨
                </div>
              ))}
            </div>

            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-6xl animate-spin"
                  style={{
                    left: (10 + i * 12) + '%',
                    top: (20 + (i % 3) * 25) + '%',
                    animationDuration: (2 + Math.random() * 2) + 's',
                    opacity: 0.6
                  }}
                >
                  ⚡
                </div>
              ))}
            </div>

            <div className="relative text-center mb-8 animate-bounce z-10">
              <h1
                className="text-8xl font-bold text-white drop-shadow-2xl"
                style={{
                  textShadow: '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.4)',
                  WebkitTextStroke: '3px black',
                }}
              >
                ⚡ FAST TRACK ⚡
              </h1>
              <div className="text-3xl text-white font-bold mt-4" style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
                Question {(displayData.questionInfo && displayData.questionInfo.number) || 1}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center relative z-10">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute text-8xl animate-bounce" style={{ left: '10%', animationDelay: '0s' }}>👑</div>
                <div className="absolute text-8xl animate-bounce" style={{ right: '10%', animationDelay: '0.3s' }}>👑</div>
              </div>

              <div className="text-center relative z-10">
                <div
                  className="text-5xl text-white mb-8 font-bold animate-pulse"
                  style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
                >
                  🏆 FAST TRACKED TO FIRST PLACE! 🏆
                </div>

                {displayData.fastestTeamData && displayData.fastestTeamData.fastestTeam && displayData.fastestTeamData.fastestTeam.name ? (
                  <div
                    className="font-bold text-white animate-pulse"
                    style={{
                      fontSize: '10rem',
                      textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)',
                      WebkitTextStroke: '4px black',
                      lineHeight: '1.2',
                    }}
                  >
                    {displayData.fastestTeamData.fastestTeam.name}
                  </div>
                ) : (
                  <div
                    className="font-bold text-white animate-pulse"
                    style={{
                      fontSize: '10rem',
                      textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)',
                      WebkitTextStroke: '4px black',
                      lineHeight: '1.2',
                    }}
                  >
                    Unknown Team
                  </div>
                )}

                <div className="mt-12 flex justify-center gap-8">
                  <div className="text-8xl animate-bounce" style={{ animationDelay: '0s' }}>🏆</div>
                  <div className="text-9xl animate-bounce" style={{ animationDelay: '0.2s' }}>🏆</div>
                  <div className="text-8xl animate-bounce" style={{ animationDelay: '0.4s' }}>🏆</div>
                </div>

                <div
                  className="text-6xl text-white font-bold mt-12 animate-pulse"
                  style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
                >
                  ⭐ 1ST PLACE WITH +1 POINT LEAD! ⭐
                </div>
              </div>
            </div>
          </div>
        );

      case 'team-welcome':
        return (
          <div
            className="w-full h-full relative overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: welcomeColors[welcomeColorIndex],
              transition: 'background-color 3s ease-in-out'
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-400 rounded-full animate-pulse"></div>
              <div className="absolute top-60 right-32 w-24 h-24 bg-red-400 rounded-full animate-pulse"></div>
              <div className="absolute bottom-60 left-40 w-40 h-40 bg-green-400 rounded-full animate-pulse"></div>
              <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse"></div>
              <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse"></div>
              <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse"></div>
            </div>

            <div className="relative z-10 text-center">
              <div className="text-4xl text-white mb-8 font-bold">
                🎉 Welcome! 🎉
              </div>
              <div className="text-8xl font-bold text-white mb-8 drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                {displayData.teamName || "Team Name"}
              </div>
              <div className="text-3xl text-white font-semibold">
                Let's hear your buzzer sound!
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-white">External Display</h1>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col">
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
      `}</style>

      <div className="bg-gray-700 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-white">EXTERNAL DISPLAY</span>
            <span className="text-xs px-2 py-1 rounded uppercase font-medium bg-orange-500 text-white">
              {displayData.mode}
            </span>
          </div>
          <div className="text-xs text-gray-400">1920x1080 • 16:9</div>
        </div>
      </div>

      <div className="flex-1 bg-black relative overflow-hidden">
        {renderContent()}
        <div className="absolute bottom-4 right-4 text-xs text-white opacity-30 font-mono">
          EXT-1
        </div>
      </div>
    </div>
  );
}
