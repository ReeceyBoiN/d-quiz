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

// =============== MAIN EXTERNAL DISPLAY ===================
export function ExternalDisplayWindow() {
  const { countdownStyle } = useSettings();
  const [displayMode, setDisplayMode] = useState<"basic" | "fastTrack">("basic");
  const [answerData, setAnswerData] = useState<any>(null);
  const [questionInfo, setQuestionInfo] = useState<{ number: number } | null>(null);

  // 🔹 Listen for messages from both postMessage (browser) and IPC (Electron)
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === "DISPLAY_UPDATE") {
        setDisplayMode(event.data.mode || "basic");
        setAnswerData(event.data.data || null);
        setQuestionInfo(event.data.questionInfo || null);
      }
    };

    window.addEventListener("message", messageHandler);

    let removeIpcListener: (() => void) | undefined;
    if (isElectron) {
      removeIpcListener = window.api?.ipc.on("external-display/update", (data) => {
        setDisplayMode(data.mode || "basic");
        setAnswerData(data.data || null);
        setQuestionInfo(data.questionInfo || null);
      });
    }

    return () => {
      window.removeEventListener("message", messageHandler);
      if (removeIpcListener) removeIpcListener();
    };
  }, []);

  const renderContent = () => {
    switch (displayMode) {
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
