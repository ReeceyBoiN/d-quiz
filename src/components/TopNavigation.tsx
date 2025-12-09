import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Settings, Maximize, User, AlertTriangle, Home, Smartphone, Lock } from "lucide-react";
import { DisplayModeToggle } from "./DisplayModeToggle";
import { LoginDialog } from "./LoginDialog";
import { useAuth } from "../utils/AuthContext";
import { useSettings } from "../utils/SettingsContext";

interface TopNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  teamCount?: number;
  displayMode?: "basic" | "slideshow" | "scores";
  onDisplayModeChange?: (mode: "basic" | "slideshow" | "scores") => void;
  onHandsetSettings?: () => void;
  onDisplaySettings?: () => void;
  isExternalDisplayOpen?: boolean;
  onExternalDisplayToggle?: () => void;
  onSettingsOpen?: () => void; // Add settings handler
  onPlayerDevicesSettings?: () => void; // Add player devices settings handler
  playerDevicesDisplayMode?: "basic" | "slideshow" | "scores"; // Player devices display mode
  onPlayerDevicesDisplayModeChange?: (mode: "basic" | "slideshow" | "scores") => void; // Player devices display mode change handler
}

export function TopNavigation({ 
  activeTab, 
  onTabChange, 
  teamCount, 
  displayMode = "basic",
  onDisplayModeChange,
  onHandsetSettings,
  onDisplaySettings,
  isExternalDisplayOpen = false,
  onExternalDisplayToggle,
  onSettingsOpen,
  onPlayerDevicesSettings,
  playerDevicesDisplayMode = "basic",
  onPlayerDevicesDisplayModeChange
}: TopNavigationProps) {
  const { isLoggedIn, user } = useAuth();
  const { version } = useSettings();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const tabs = [
    { id: "home", label: "Home" },
    { id: "leaderboard-reveal", label: "Leaderboard" },
    ...(isLoggedIn ? [{ id: "user-status", label: "User Status" }] : [])
  ];

  // Handle Home button click - always navigate to home screen
  const handleHomeClick = () => {
    onTabChange("home");
  };

  const handleUserClick = () => {
    if (isLoggedIn) {
      onTabChange("user-status");
    } else {
      setShowLoginDialog(true);
    }
  };

  return (
    <div className="bg-sidebar-accent border-b border-sidebar-border px-4 py-2">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes flash-warning {
            0%, 100% {
              background-color: #f39c12;
            }
            50% {
              background-color: #c0392b;
            }
          }
          .flash-warning {
            animation: flash-warning 1.5s infinite;
          }
          .flash-warning:hover {
            animation: flash-warning 1.2s infinite;
            background-color: #e67e22 !important;
          }
        `
      }} />
      <div className="flex items-center justify-between gap-2">
        {/* Left side - Navigation tabs */}
        <div className="flex items-center gap-1.5">
          {/* Navigation tabs */}
          {tabs.filter(tab => tab.id !== "user-status").map((tab, index) => (
            <div key={tab.id} className="flex">
              <Button
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  if (tab.id === "home") {
                    handleHomeClick();
                  } else if (tab.id === "user-status") {
                    onTabChange("user-status");
                  } else {
                    onTabChange(tab.id);
                  }
                }}
                className={`text-sm px-3 py-2 h-8 font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#f39c12] text-white hover:bg-[#e67e22] shadow-lg transform scale-105"
                    : "bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-102 border border-sidebar-border"
                }`}
              >
                {tab.id === "home" && <Home className="w-4 h-4" />}
                {tab.id === "user-status" && <User className="w-4 h-4" />}
                {tab.label}
                {tab.count !== undefined && (
                  <Badge variant="secondary" className="ml-2 text-xs px-2 py-0 h-5">
                    {tab.count}
                  </Badge>
                )}
              </Button>
            </div>
          ))}
          
          {/* Display Mode Toggle */}
          <DisplayModeToggle 
            currentMode={displayMode}
            onModeChange={onDisplayModeChange || (() => {})}
            isExternalDisplayOpen={isExternalDisplayOpen}
            onExternalDisplayToggle={onExternalDisplayToggle}
            onDisplaySettings={onDisplaySettings}
          />
          
          {/* Player Devices Section */}
          <div className="flex items-center ml-1">
            {/* Settings Button */}
            <button
              onClick={onPlayerDevicesSettings}
              className="h-9 px-0.5 bg-[#3d5166] text-[#ecf0f1] hover:bg-[#4a617a] hover:text-white border border-[#4a5568] rounded-l-md transition-all duration-200 hover:scale-102 flex items-center justify-center border-r-0"
              title="Player Devices Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {/* Thin separator line */}
            <div className="w-[1px] h-6 bg-[#4a5568]"></div>
            
            {/* Player Devices Button - Toggleable with broadcast debounce delay */}
            <button
              onClick={() => {
                console.log('[TopNavigation] Player button clicked, current mode:', playerDevicesDisplayMode);
                const modes: ("basic" | "slideshow" | "scores")[] = ["basic", "slideshow", "scores"];
                const currentIndex = modes.indexOf(playerDevicesDisplayMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                const nextMode = modes[nextIndex];

                console.log('[TopNavigation] Switching to next mode:', nextMode);
                // Call parent handler - debounce is handled in parent for broadcast
                onPlayerDevicesDisplayModeChange?.(nextMode);
              }}
              className="h-9 w-24 border border-[#4a5568] rounded-r-md transition-all duration-200 flex flex-col items-center justify-center text-[#ecf0f1] bg-[#3d5166] hover:bg-[#4a617a] hover:text-white border-l-0 relative hover:scale-102"
              title={`Player Devices Display Mode: ${playerDevicesDisplayMode} (click to cycle - broadcasts after 2s of inactivity)`}
            >
              <div className="text-xs opacity-75 leading-tight">Player</div>
              <div className="flex items-center gap-0.5">
                <Smartphone className="w-3 h-3" />
                <span className="uppercase tracking-wide text-xs">{playerDevicesDisplayMode}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-2">
          {/* Title and version - moved to right side */}
          <div className="text-center -mt-1 mr-1">
            <h1 className="text-sidebar-foreground text-3xl font-medium tracking-wider">POP QUIZ</h1>
            <p className="text-muted-foreground text-xs -mt-1">{version}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flash-warning text-white text-sm px-2.5 py-1.5 h-auto hover:scale-105 transition-transform duration-200"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">No Wi-Fi Detected</div>
                  <div className="text-xs opacity-90">Click for more info</div>
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Wi-Fi Hub Detected?</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSettingsOpen}
                className="text-sidebar-foreground hover:bg-sidebar hover:text-sidebar-foreground p-1.5 h-7 w-7 transition-all duration-200 hover:scale-110"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quiz Settings</p>
            </TooltipContent>
          </Tooltip>
          

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground hover:bg-sidebar hover:text-sidebar-foreground flex items-center gap-1.5 px-2 py-1.5 h-auto transition-all duration-200 hover:scale-105"
                onClick={handleUserClick}
              >
                <User className="w-4 h-4" />
                <span className={`text-sm font-medium ${
                  isLoggedIn ? "text-green-500" : "text-red-500"
                }`}>
                  {isLoggedIn ? "LOGGED IN" : "UNREGISTERED"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isLoggedIn ? "User Status" : "Login"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <LoginDialog 
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </div>
  );
}
