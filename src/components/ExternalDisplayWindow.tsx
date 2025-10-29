import React, { useEffect, useState } from "react";
import { PopoutDisplay, type QuizStage } from "./PopoutDisplay";
import { ImageSlideshow } from "./ImageSlideshow";
import { ScoresDisplay } from "./ScoresDisplay";
import { BasicDisplay } from "./BasicDisplay";
import { Zap, Trophy, Sparkles, Crown } from "lucide-react";
import { StoredImage } from "../utils/imageStorage";
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

// =============== FAST TRACK DISPLAY ===================
function FastTrackDisplay({
  teamName,
  questionNumber,
}: {
  teamName: string;
  questionNumber: number;
}) {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);

  const rainbowColors = [
    "#FF00FF",
    "#00FFFF",
    "#FFFF00",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FF00FF",
  ];

  useEffect(() => {
    const interval = setInterval(
      () => setCurrentColorIndex((p) => (p + 1) % rainbowColors.length),
      500
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => setPulseScale((p) => (p === 1 ? 1.1 : 1)),
      300
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex flex-col p-8 transition-colors duration-500"
      style={{
        backgroundColor: rainbowColors[currentColorIndex],
        zIndex: 99999,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
            }}
          >
            <Sparkles className="h-8 w-8 text-white opacity-70" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-spin"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            <Zap className="h-16 w-16 text-yellow-300 opacity-60" fill="currentColor" />
          </div>
        ))}
      </div>

      <div className="relative text-center mb-8 animate-bounce">
        <h1
          className="text-8xl font-bold text-white drop-shadow-2xl"
          style={{
            textShadow:
              "0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.4)",
            WebkitTextStroke: "3px black",
          }}
        >
          ⚡ FAST TRACK ⚡
        </h1>
        <div
          className="text-3xl text-white font-bold mt-4"
          style={{ textShadow: "0 0 10px rgba(0,0,0,0.8)" }}
        >
          Question {questionNumber}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Crown
            className="h-32 w-32 text-yellow-300 absolute animate-bounce"
            style={{ left: "10%", animationDelay: "0s" }}
          />
          <Crown
            className="h-32 w-32 text-yellow-300 absolute animate-bounce"
            style={{ right: "10%", animationDelay: "0.3s" }}
          />
        </div>

        <div className="text-center relative z-10">
          <div
            className="text-5xl text-white mb-8 font-bold animate-pulse"
            style={{
              textShadow:
                "0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)",
            }}
          >
            🏆 FAST TRACKED TO FIRST PLACE! 🏆
          </div>

          <div
            className="font-bold text-white transition-transform duration-300"
            style={{
              fontSize: "10rem",
              textShadow:
                "0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)",
              WebkitTextStroke: "4px black",
              transform: `scale(${pulseScale})`,
              lineHeight: "1.2",
            }}
          >
            {teamName}
          </div>

          <div className="mt-12 flex justify-center gap-8">
            <Trophy
              className="h-24 w-24 text-yellow-300 animate-bounce"
              fill="currentColor"
            />
            <Trophy
              className="h-32 w-32 text-yellow-400 animate-bounce"
              style={{ animationDelay: "0.2s" }}
              fill="currentColor"
            />
            <Trophy
              className="h-24 w-24 text-yellow-300 animate-bounce"
              style={{ animationDelay: "0.4s" }}
              fill="currentColor"
            />
          </div>

          <div
            className="text-6xl text-white font-bold mt-12 animate-pulse"
            style={{
              textShadow:
                "0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)",
            }}
          >
            ⭐ 1ST PLACE WITH +1 POINT LEAD! ⭐
          </div>
        </div>
      </div>
    </div>
  );
}

// =============== COUNTDOWN TIMER DISPLAY ===================
function CountdownTimerDisplay({ initialSeconds, questionNumber = 1 }: { initialSeconds: number, questionNumber?: number }) {
  const { countdownStyle } = useSettings();
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    setSecondsRemaining(initialSeconds);
    setIsRunning(true);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const progressPercent = (secondsRemaining / initialSeconds) * 100;
  const strokeColor = progressPercent > 25 ? '#ff6b5b' : '#e74c3c';

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden">
      {/* Pink Header */}
      <div className="bg-[#ff5a9d] px-8 py-6 text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          Question {questionNumber} • Timer
        </h1>
      </div>

      {/* Timer Display Area */}
      <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden">
        <div className="relative flex items-center justify-center" style={{ width: '500px', height: '500px' }}>
          {/* Progress ring */}
          <svg className="absolute w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="250"
              cy="250"
              r="200"
              fill="none"
              stroke="#4a5568"
              strokeWidth="20"
            />
            <circle
              cx="250"
              cy="250"
              r="200"
              fill="none"
              stroke={strokeColor}
              strokeWidth="20"
              strokeDasharray={`${(progressPercent / 100) * 2 * Math.PI * 200} ${2 * Math.PI * 200}`}
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>

          {/* Timer text */}
          <div className="absolute text-center">
            <div className="text-9xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {secondsRemaining}
            </div>
            <div className="text-2xl text-slate-300 mt-4">seconds</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============== MAIN EXTERNAL DISPLAY ===================
export function ExternalDisplayWindow() {
  const { countdownStyle } = useSettings();
  const [displayMode, setDisplayMode] = useState<"basic" | "fastTrack" | "timer">("basic");
  const [answerData, setAnswerData] = useState<any>(null);
  const [questionInfo, setQuestionInfo] = useState<{ number: number } | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [gameModeTimers, setGameModeTimers] = useState<any>(null);

  // 🔹 Listen for messages from both postMessage (browser) and IPC (Electron)
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === "DISPLAY_UPDATE") {
        const mode = event.data.mode || "basic";
        setDisplayMode(mode);
        setAnswerData(event.data.data || null);
        setQuestionInfo(event.data.questionInfo || null);

        // Handle timer mode
        if (mode === "timer" || mode === "nearest-wins-timer") {
          // Use provided timerValue, or fall back to keypad timer from settings, or default to 30
          const timerValue = event.data.timerValue ||
                            event.data.gameModeTimers?.keypad ||
                            30;
          setTimerSeconds(timerValue);
          setGameModeTimers(event.data.gameModeTimers);
        }
      } else if (event.data?.type === "TIMER") {
        setTimerSeconds(event.data.data?.seconds || 30);
        setDisplayMode("timer");
      }
    };

    window.addEventListener("message", messageHandler);

    let removeIpcListener: (() => void) | undefined;
    if (isElectron) {
      removeIpcListener = window.api?.ipc.on("external-display/update", (data) => {
        setDisplayMode(data.mode || "basic");
        setAnswerData(data.data || null);
        setQuestionInfo(data.questionInfo || null);

        if (data.mode === "timer" || data.mode === "nearest-wins-timer") {
          const timerValue = data.timerValue || data.gameModeTimers?.keypad || 30;
          setTimerSeconds(timerValue);
          setGameModeTimers(data.gameModeTimers);
        }
      });
    }

    return () => {
      window.removeEventListener("message", messageHandler);
      if (removeIpcListener) removeIpcListener();
    };
  }, []);

  const renderContent = () => {
    switch (displayMode) {
      case "timer":
        return (
          <CountdownTimerDisplay
            initialSeconds={timerSeconds}
            questionNumber={questionInfo?.number || 1}
          />
        );
      case "fastTrack":
        return (
          <FastTrackDisplay
            teamName={answerData?.fastestTeam?.name || "Unknown Team"}
            questionNumber={questionInfo?.number || 1}
          />
        );
      case "basic":
      default:
        return <BasicDisplay />;
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden font-sans">
      {renderContent()}

      <div className="absolute bottom-4 right-4 text-xs text-white/40 font-mono">
        EXT-1
      </div>

      {!isElectron && (
        <button
          onClick={() => {
            const url =
              window.location.origin +
              window.location.pathname +
              "?external=1";
            window.open(
              url,
              "externalDisplay",
              "width=1920,height=1080,scrollbars=no,resizable=yes,status=no,location=no,toolbar=no,menubar=no"
            );
          }}
          className="fixed bottom-4 left-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-white text-sm"
        >
          Open in New Window
        </button>
      )}
    </div>
  );
}
