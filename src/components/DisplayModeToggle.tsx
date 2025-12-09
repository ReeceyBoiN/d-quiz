import React, { useState, useEffect } from "react";
import { Monitor, Images, Trophy, Square, Check, Settings, Lock } from "lucide-react";
import { Button } from "./ui/button";

type DisplayMode = "basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal";

interface DisplayModeToggleProps {
  currentMode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  className?: string;
  isExternalDisplayOpen?: boolean;
  onExternalDisplayToggle?: () => void;
  onDisplaySettings?: () => void;
}

// Only include the 3 user-selectable modes
const userModes: { key: "basic" | "slideshow" | "scores"; label: string; icon: React.ReactNode; color: string; hoverColor: string }[] = [
  { key: "basic", label: "Basic", icon: <Square className="w-4 h-4" />, color: "#27ae60", hoverColor: "#2ecc71" },
  { key: "slideshow", label: "Slideshow", icon: <Images className="w-4 h-4" />, color: "#9b59b6", hoverColor: "#b370c7" },
  { key: "scores", label: "Scores", icon: <Trophy className="w-4 h-4" />, color: "#3498db", hoverColor: "#5dade2" }
];

const DELAY_DURATION = 3000; // 3 seconds

export function DisplayModeToggle({
  currentMode,
  onModeChange,
  className = "",
  isExternalDisplayOpen = false,
  onExternalDisplayToggle,
  onDisplaySettings
}: DisplayModeToggleProps) {
  const [isDelayActive, setIsDelayActive] = useState(false);
  const [delayCountdown, setDelayCountdown] = useState(0);

  // Find current mode in user modes, default to basic if it's a leaderboard mode
  const effectiveMode = userModes.find(mode => mode.key === currentMode)?.key || "basic";
  const currentModeIndex = userModes.findIndex(mode => mode.key === effectiveMode);
  const currentModeData = userModes[currentModeIndex];

  // Handle delay countdown
  useEffect(() => {
    if (!isDelayActive) return;

    const interval = setInterval(() => {
      setDelayCountdown(prev => {
        if (prev <= 100) {
          setIsDelayActive(false);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isDelayActive]);

  const handleToggle = () => {
    if (isDelayActive) {
      return; // Don't allow clicks while delay is active
    }

    const nextIndex = (currentModeIndex + 1) % userModes.length;
    onModeChange(userModes[nextIndex].key);

    // Activate 3-second delay
    setIsDelayActive(true);
    setDelayCountdown(DELAY_DURATION);
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Settings Button */}
      <button
        onClick={onDisplaySettings}
        className="h-9 px-1 bg-[#3d5166] text-[#ecf0f1] hover:bg-[#4a617a] hover:text-white border border-[#4a5568] rounded-l-md transition-all duration-200 hover:scale-102 flex items-center justify-center border-r-0"
        title="Display Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
      
      {/* Thin separator line */}
      <div className="w-[1px] h-6 bg-[#4a5568]"></div>
      
      {/* Display Mode Button */}
      <button
        onClick={handleToggle}
        disabled={isDelayActive}
        className={`h-9 w-28 border-t border-b border-[#4a5568] transition-all duration-200 flex flex-col items-center justify-center relative ${
          isDelayActive
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-102'
        } ${
          isExternalDisplayOpen
            ? 'text-white'
            : 'text-[#ecf0f1] bg-[#3d5166] hover:bg-[#4a617a] hover:text-white'
        }`}
        style={isExternalDisplayOpen ? {
          backgroundColor: isDelayActive ? '#95a5a6' : currentModeData.color,
        } : {}}
        onMouseEnter={(e) => {
          if (isExternalDisplayOpen && !isDelayActive) {
            e.currentTarget.style.backgroundColor = currentModeData.hoverColor;
          }
        }}
        onMouseLeave={(e) => {
          if (isExternalDisplayOpen && !isDelayActive) {
            e.currentTarget.style.backgroundColor = currentModeData.color;
          }
        }}
        title={isDelayActive ? `Display mode locked for ${Math.ceil(delayCountdown / 1000)}s (prevents accidental changes)` : `Display Mode: ${currentModeData.label} (click to cycle)`}
      >
        {isDelayActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
        )}
        {!isDelayActive && (
          <>
            <div className="text-xs opacity-75 leading-tight">External Display</div>
            <div className="flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              <span className="uppercase tracking-wide text-xs">{currentModeData.label}</span>
            </div>
          </>
        )}
      </button>
      
      {/* Thin separator line */}
      <div className="w-[1px] h-6 bg-[#4a5568]"></div>
      
      {/* External Display Checkbox */}
      {onExternalDisplayToggle && (
        <button
          onClick={onExternalDisplayToggle}
          className="h-9 px-1 bg-[#3d5166] hover:bg-[#4a617a] border border-[#4a5568] rounded-r-md transition-all duration-200 hover:scale-102 flex items-center justify-center border-l-0"
          title={isExternalDisplayOpen ? "Close External Display" : "Open External Display"}
        >
          <div className={`w-5 h-5 flex items-center justify-center border-2 rounded transition-all duration-200 ${
            isExternalDisplayOpen 
              ? 'bg-[#27ae60] border-[#27ae60]' 
              : 'bg-transparent border-[#95a5a6]'
          }`}>
            {isExternalDisplayOpen && (
              <Check className="w-4 h-4 text-white" />
            )}
          </div>
        </button>
      )}
    </div>
  );
}
