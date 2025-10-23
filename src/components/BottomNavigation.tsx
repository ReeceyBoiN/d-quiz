import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Settings, Skull, ArrowLeftRight, Layers, Camera, Pause, RotateCcw, Trash2, EyeOff, Plus, Minus, LayoutGrid, Gamepad2, UserMinus, X, Volume2 } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "./ui/alert-dialog";

interface StatusBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  teamCount?: number;
  displayMode?: "basic" | "slideshow" | "scores";
  onDisplayModeChange?: (mode: "basic" | "slideshow" | "scores") => void;
  onHandsetSettings?: () => void;
  onDisplaySettings?: () => void;
  currentGameMode?: "keypad" | "buzzin" | "nearestwins" | "wheelspinner" | null;
  goWideEnabled?: boolean;
  evilModeEnabled?: boolean;
  onGoWideToggle?: () => void;
  onEvilModeToggle?: () => void;
  onClearScores?: () => void;
  onEmptyLobby?: () => void;
  onGlobalScrambleKeypad?: () => void;
  scoresPaused?: boolean;
  onPauseScoresToggle?: () => void;
  // Additional button states for highlighting
  scoresHidden?: boolean;
  onToggleHideScores?: () => void;
  teamLayoutMode?: 'default' | 'alphabetical' | 'random';
  onChangeTeamLayout?: () => void;
  hostControllerEnabled?: boolean;
  onToggleHostController?: () => void;
  teams?: Array<{ id: string; name: string; scrambled?: boolean; }>;
  currentRoundPoints?: number | null;
  currentRoundSpeedBonus?: number | null;
  onCurrentRoundPointsChange?: (points: number) => void;
  onCurrentRoundSpeedBonusChange?: (speedBonus: number) => void;
  currentRoundWinnerPoints?: number | null;
  onCurrentRoundWinnerPointsChange?: (winnerPoints: number) => void;
  // Game interface states
  showKeypadInterface?: boolean;
  showBuzzInInterface?: boolean;
  showNearestWinsInterface?: boolean;
  showWheelSpinnerInterface?: boolean;
  showBuzzInMode?: boolean;
  showQuizPackDisplay?: boolean;
  onEndRound?: () => void;
  onOpenBuzzersManagement?: () => void;
  // Quiz pack question mode button
  onPrimaryAction?: () => void;
  onSilentTimer?: () => void;
  primaryButtonLabel?: string;
  flowState?: string;
}

interface ExtendedStatusBarProps extends StatusBarProps {
  leftSidebarWidth?: number;
  showQuizPackDisplay?: boolean;
}

interface GameModeConfigPanelProps {
  gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner";
  goWideEnabled: boolean;
  evilModeEnabled: boolean;
  onGoWideToggle?: () => void;
  onEvilModeToggle?: () => void;
  currentRoundPoints?: number | null;
  currentRoundSpeedBonus?: number | null;
  onCurrentRoundPointsChange?: (points: number) => void;
  onCurrentRoundSpeedBonusChange?: (speedBonus: number) => void;
  currentRoundWinnerPoints?: number | null;
  onCurrentRoundWinnerPointsChange?: (winnerPoints: number) => void;
  showKeypadInterface?: boolean;
  showBuzzInInterface?: boolean;
  showNearestWinsInterface?: boolean;
  showWheelSpinnerInterface?: boolean;
  showBuzzInMode?: boolean;
  onEndRound?: () => void;
}

function GameModeConfigPanel({ 
  gameMode, 
  goWideEnabled, 
  evilModeEnabled, 
  onGoWideToggle, 
  onEvilModeToggle,
  currentRoundPoints,
  currentRoundSpeedBonus,
  onCurrentRoundPointsChange,
  onCurrentRoundSpeedBonusChange,
  currentRoundWinnerPoints,
  onCurrentRoundWinnerPointsChange,
  showKeypadInterface = false,
  showBuzzInInterface = false,
  showNearestWinsInterface = false,
  showWheelSpinnerInterface = false,
  showBuzzInMode = false,
  onEndRound
}: GameModeConfigPanelProps) {
  const { 
    defaultPoints, 
    defaultSpeedBonus, 
    gameModePoints,
    updateGameModePoints,
    staggeredEnabled,
    updateStaggeredEnabled,
    updateGoWideEnabled,
    updateEvilModeEnabled,
    punishmentEnabled,
    updatePunishmentEnabled
  } = useSettings();
  
  // Use current round scores from props when available, otherwise fallback to defaults
  // For buzz-in mode, use gameModePoints.buzzin from settings context
  // This ensures that once current round scores are set, they stay independent of default changes
  const localPoints = gameMode === "buzzin" 
    ? gameModePoints.buzzin 
    : (currentRoundPoints !== null ? currentRoundPoints : defaultPoints);
  const localSpeedBonus = currentRoundSpeedBonus !== null ? currentRoundSpeedBonus : defaultSpeedBonus;
  const localWinnerPoints = currentRoundWinnerPoints !== null ? currentRoundWinnerPoints : gameModePoints.nearestwins;

  const handlePointsChange = (value: string | number) => {
    const num = typeof value === 'string' ? (isNaN(parseInt(value)) ? 0 : parseInt(value)) : value;
    
    // For buzz-in mode, update gameModePoints.buzzin in settings context
    if (gameMode === "buzzin") {
      if (num !== localPoints) {
        updateGameModePoints('buzzin', num);
      }
    } else {
      // For other modes, use the onCurrentRoundPointsChange prop
      if (num !== localPoints && onCurrentRoundPointsChange) {
        onCurrentRoundPointsChange(num);
      }
    }
  };

  const handleSpeedBonusChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num !== localSpeedBonus && onCurrentRoundSpeedBonusChange) {
      onCurrentRoundSpeedBonusChange(num);
    }
  };

  const handleWinnerPointsChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num !== localWinnerPoints && onCurrentRoundWinnerPointsChange) {
      onCurrentRoundWinnerPointsChange(num);
    }
  };

  return (
    <div className="flex-1 h-full flex items-center gap-2">
      {/* Points section - show for keypad and buzzin modes */}
      {(gameMode === "keypad" || gameMode === "buzzin") && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-2 py-0.5 border shadow-sm">
          <div className="flex flex-col gap-0.5 w-32">
            <div className="w-full h-5 flex items-center justify-center">
              <span className="text-white text-xs font-medium font-bold font-normal text-[15px]">POINTS</span>
            </div>
            <div className="flex gap-1 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => {
                  const currentValue = parseInt(localPoints.toString()) || 0;
                  const newValue = Math.max(0, currentValue - 1);
                  handlePointsChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-6 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localPoints}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => handlePointsChange((localPoints + 1).toString())}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Speed Bonus section - only show for keypad mode, not buzzin */}
      {gameMode === "keypad" && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-2 py-0.5 border shadow-sm">
          <div className="flex flex-col gap-0.5 w-24">
            <div className="w-full h-5 flex items-center justify-center">
              <span className="text-white text-xs font-medium font-bold no-underline font-normal text-[15px]">BONUS</span>
            </div>
            <div className="flex gap-1 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => {
                  const currentValue = parseInt(localSpeedBonus.toString()) || 0;
                  const newValue = Math.max(0, currentValue - 1);
                  handleSpeedBonusChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-6 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localSpeedBonus}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => handleSpeedBonusChange((localSpeedBonus + 1).toString())}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modes section - only show for keypad mode */}
      {gameMode === "keypad" && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-2 py-0.5 border shadow-sm">
          <div className="flex flex-col gap-0.5 w-40">
            <div className="w-full h-5 flex items-center justify-center">
              <span className="text-white text-xs font-medium font-bold font-normal text-[15px]">MODES</span>
            </div>
            <div className="flex gap-1 w-full">
              {/* Staggered Mode */}
              <Button 
                variant={staggeredEnabled ? "default" : "outline"} 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => updateStaggeredEnabled(!staggeredEnabled)}
                title="Staggered Mode"
              >
                <Layers className="h-3 w-3" />
              </Button>
              
              {/* Go Wide Mode */}
              <Button 
                variant={goWideEnabled ? "default" : "outline"} 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => updateGoWideEnabled(!goWideEnabled)}
                title="Go Wide Mode"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </Button>
              
              {/* Evil Mode */}
              <Button 
                variant={evilModeEnabled ? "default" : "outline"} 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => updateEvilModeEnabled(!evilModeEnabled)}
                title="Evil Mode"
              >
                <Skull className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Points section - only show for nearest wins mode */}
      {gameMode === "nearestwins" && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-2 py-0.5 border shadow-sm">
          <div className="flex flex-col gap-0.5 w-36">
            <div className="w-full h-5 flex items-center justify-center">
              <span className="text-white text-xs font-medium font-bold font-normal text-[15px]">WINNER POINTS</span>
            </div>
            <div className="flex gap-1 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => {
                  const currentValue = parseInt(localWinnerPoints.toString()) || 0;
                  const newValue = Math.max(0, currentValue - 1);
                  handleWinnerPointsChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-6 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localWinnerPoints}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 flex-1 p-0 border border-border rounded shadow-sm mx-0.5"
                onClick={() => handleWinnerPointsChange((localWinnerPoints + 1).toString())}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Wheel Spinner Mode Indicator */}
      {gameMode === "wheelspinner" && (
        <div className="bg-[rgba(217,204,0,1)] rounded px-3 py-0.5 border shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-semibold">WHEEL SPINNER ACTIVE</span>
            <ArrowLeftRight className="h-4 w-4 text-white" />
          </div>
        </div>
      )}



      {/* Game mode indicator */}
      <div className="ml-auto flex items-center gap-2">

      </div>
    </div>
  );
}

export function StatusBar({
  activeTab,
  onTabChange,
  teamCount,
  displayMode = "basic",
  onDisplayModeChange,
  onHandsetSettings,
  onDisplaySettings,
  leftSidebarWidth = 480,
  currentGameMode = null,
  goWideEnabled = false,
  evilModeEnabled = false,
  onGoWideToggle,
  onEvilModeToggle,
  onClearScores,
  onEmptyLobby,
  onGlobalScrambleKeypad,
  scoresPaused = false,
  onPauseScoresToggle,
  scoresHidden = false,
  onToggleHideScores,
  teamLayoutMode = 'default',
  onChangeTeamLayout,
  hostControllerEnabled = false,
  onToggleHostController,
  teams = [],
  currentRoundPoints,
  currentRoundSpeedBonus,
  onCurrentRoundPointsChange,
  onCurrentRoundSpeedBonusChange,
  currentRoundWinnerPoints,
  onCurrentRoundWinnerPointsChange,
  showKeypadInterface = false,
  showBuzzInInterface = false,
  showNearestWinsInterface = false,
  showWheelSpinnerInterface = false,
  showBuzzInMode = false,
  showQuizPackDisplay = false,
  onEndRound,
  onOpenBuzzersManagement,
  onPrimaryAction,
  onSilentTimer,
  primaryButtonLabel = 'Send Question',
  flowState = 'idle'
}: ExtendedStatusBarProps) {
  const { 
    goWideEnabled: settingsGoWide, 
    evilModeEnabled: settingsEvilMode,
    updateGoWideEnabled,
    updateEvilModeEnabled,
    teamPhotosAutoApprove,
    updateTeamPhotosAutoApprove
  } = useSettings();
  
  // Clear scores confirmation dialog state
  const [showClearScoresDialog, setShowClearScoresDialog] = useState(false);
  
  // Empty lobby confirmation dialog state
  const [showEmptyLobbyDialog, setShowEmptyLobbyDialog] = useState(false);
  
  // Team photos popup state
  const [showTeamPhotosPopup, setShowTeamPhotosPopup] = useState(false);
  
  return (
    <div 
      className="fixed bottom-0 right-0 bg-sidebar-accent border-t border-sidebar-border px-4 py-2 h-[60px] flex items-center z-30 transition-[left] duration-0"
      style={{ left: `${leftSidebarWidth}px` }}
    >
      {/* END ROUND button - show when any game interface is active */}
      {(showKeypadInterface || showBuzzInInterface || showNearestWinsInterface || showWheelSpinnerInterface || showBuzzInMode || showQuizPackDisplay) && (
        <Button
          onClick={() => {
            // TODO: Add sound effect here
            // Navigate back to home screen
            if (onEndRound) {
              onEndRound();
            }
          }}
          className="h-8 px-4 bg-[#e74c3c] hover:bg-[#c0392b] text-white border shadow-sm mr-4 text-sm font-semibold rounded"
        >
          END ROUND
        </Button>
      )}


      {/* Dynamic game mode configuration panel */}
      {currentGameMode ? (
        <GameModeConfigPanel 
          gameMode={currentGameMode}
          goWideEnabled={settingsGoWide}
          evilModeEnabled={settingsEvilMode}
          onGoWideToggle={updateGoWideEnabled}
          onEvilModeToggle={updateEvilModeEnabled}
          currentRoundPoints={currentRoundPoints}
          currentRoundSpeedBonus={currentRoundSpeedBonus}
          onCurrentRoundPointsChange={onCurrentRoundPointsChange}
          onCurrentRoundSpeedBonusChange={onCurrentRoundSpeedBonusChange}
          currentRoundWinnerPoints={currentRoundWinnerPoints}
          onCurrentRoundWinnerPointsChange={onCurrentRoundWinnerPointsChange}
          showKeypadInterface={showKeypadInterface}
          showBuzzInInterface={showBuzzInInterface}
          showNearestWinsInterface={showNearestWinsInterface}
          showWheelSpinnerInterface={showWheelSpinnerInterface}
          showBuzzInMode={showBuzzInMode}
          onEndRound={onEndRound}
        />
      ) : (
        <div className="flex-1 h-full flex items-stretch">
          
          {/* Home screen toggle buttons - full height with vertical separators */}
          
          {/* Buzzers */}
          <button 
            className="px-4 flex items-center gap-2 hover:bg-accent transition-colors border-r border-border"
            onClick={() => onOpenBuzzersManagement?.()}
            title="Buzzer Management"
          >
            <Volume2 className="h-4 w-4" />
            <span className="text-sm text-center">Buzzers</span>
          </button>

          {/* Empty Lobby */}
          <button 
            className="px-4 flex items-center gap-2 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowEmptyLobbyDialog(true)}
            title="Empty Lobby"
          >
            <UserMinus className="h-4 w-4" />
            <span className="text-sm text-center">Empty Lobby</span>
          </button>

          {/* Team Photos */}
          <button 
            className="px-4 flex items-center gap-2 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowTeamPhotosPopup(true)}
            title="Team Photos"
          >
            <Camera className="h-4 w-4" />
            <span className="text-sm text-center">Team Photos</span>
          </button>

          {/* Pause Scores */}
          <button 
            className={`px-4 flex items-center gap-2 transition-colors border-r border-border ${
              scoresPaused 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'hover:bg-accent'
            }`}
            onClick={() => onPauseScoresToggle?.()}
            title={scoresPaused ? "Scores are paused - click to unpause" : "Pause all score changes"}
          >
            <Pause className="h-4 w-4" />
            <span className="text-sm text-center">{scoresPaused ? 'Scores Paused' : 'Pause Scores'}</span>
          </button>

          {/* Scramble Keypad */}
          <button 
            className={`px-4 flex items-center gap-2 transition-colors border-r border-border ${(() => {
              if (!teams || teams.length === 0) return 'hover:bg-accent';
              const scrambledCount = teams.filter(team => team.scrambled).length;
              return scrambledCount > 0 
                ? 'bg-purple-500 text-white hover:bg-purple-600' 
                : 'hover:bg-accent';
            })()}`}
            onClick={() => onGlobalScrambleKeypad?.()}
            title={(() => {
              if (!teams || teams.length === 0) return "Scramble Keypad";
              const scrambledCount = teams.filter(team => team.scrambled).length;
              const totalCount = teams.length;
              if (scrambledCount === 0) return "Scramble All Keypads";
              if (scrambledCount === totalCount) return "Unscramble All Keypads";
              return "Toggle All Keypads";
            })()}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-sm text-center">
              {(() => {
                if (!teams || teams.length === 0) return "Scramble Keypad";
                const scrambledCount = teams.filter(team => team.scrambled).length;
                const totalCount = teams.length;
                if (scrambledCount === 0) return "Scramble All";
                if (scrambledCount === totalCount) return "Unscramble All";
                return `Scramble All (${scrambledCount}/${totalCount})`;
              })()}
            </span>
          </button>

          {/* Clear Scores */}
          <button 
            className="px-4 flex items-center gap-2 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowClearScoresDialog(true)}
            title="Clear Scores"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm text-center">Clear Scores</span>
          </button>

          {/* Hide Scores & Positions */}
          <button 
            className={`px-4 flex items-center gap-2 transition-colors border-r border-border ${
              scoresHidden 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'hover:bg-accent'
            }`}
            onClick={() => onToggleHideScores?.()}
            title={scoresHidden ? "Scores are hidden - click to show" : "Hide Scores & Positions"}
          >
            <EyeOff className="h-4 w-4" />
            <span className="text-sm text-center">{scoresHidden ? 'Scores Hidden' : 'Hide Scores & Positions'}</span>
          </button>

          {/* Font Size Down */}
          <button 
            className="px-3 flex items-center justify-center hover:bg-accent transition-colors border-r border-border p-[0px]"
            onClick={() => {/* TODO: Add font size down functionality */}}
            title="Font Size Down"
          >
            <Minus className="h-4 w-4" />
          </button>

          {/* Font Size Label */}
          <div className="px-3 flex items-center justify-center text-sm text-muted-foreground border-r border-border text-center">
            Font Size
          </div>

          {/* Font Size Up */}
          <button 
            className="px-3 flex items-center justify-center hover:bg-accent transition-colors border-r border-border p-[0px]"
            onClick={() => {/* TODO: Add font size up functionality */}}
            title="Font Size Up"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Change Teams Layout */}
          <button 
            className={`px-4 flex items-center gap-2 transition-colors border-r border-border ${
              teamLayoutMode !== 'default' 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'hover:bg-accent'
            }`}
            onClick={() => onChangeTeamLayout?.()}
            title={
              teamLayoutMode === 'default' ? 'Change Teams Layout' :
              teamLayoutMode === 'alphabetical' ? 'Teams sorted alphabetically - click for random' :
              'Teams in random order - click for default'
            }
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="text-sm text-center">
              {teamLayoutMode === 'default' ? 'Change Teams Layout' :
               teamLayoutMode === 'alphabetical' ? 'Layout: Alphabetical' :
               'Layout: Random'}
            </span>
          </button>

          {/* Host Controller */}
          <button 
            className={`px-4 flex items-center gap-2 transition-colors ${
              hostControllerEnabled 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'hover:bg-accent'
            }`}
            onClick={() => onToggleHostController?.()}
            title={hostControllerEnabled ? "Host Controller is active - click to disable" : "Enable Host Controller"}
          >
            <Gamepad2 className="h-4 w-4" />
            <span className="text-sm text-center">{hostControllerEnabled ? 'Controller Active' : 'Host Controller'}</span>
          </button>

        </div>
      )}
      
      {/* Clear Scores Confirmation Dialog */}
      <AlertDialog open={showClearScoresDialog} onOpenChange={setShowClearScoresDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Clear All Team Scores</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to clear all teams' scores? This will set every team's score to 0. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              No, Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onClearScores?.();
                setShowClearScoresDialog(false);
              }}
            >
              Yes, Clear Scores
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Empty Lobby Confirmation Dialog */}
      <AlertDialog open={showEmptyLobbyDialog} onOpenChange={setShowEmptyLobbyDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Empty Lobby</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to empty the lobby? This will delete all teams and their scores. The teams column will become blank. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              No, Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onEmptyLobby?.();
                setShowEmptyLobbyDialog(false);
              }}
            >
              Yes, Empty Lobby
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Team Photos Popup */}
      {showTeamPhotosPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Background overlay with blur */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTeamPhotosPopup(false)}
          />
          
          {/* Popup window */}
          <div className="relative bg-card border border-border rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-6xl overflow-hidden">
            {/* Close button in top-right corner */}
            <button
              onClick={() => setShowTeamPhotosPopup(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors border border-border shadow-sm"
              title="Close"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
            
            {/* Popup content */}
            <div className="p-8 h-full">
              <div className="flex flex-col h-full">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Team Photos</h2>
                  <p className="text-muted-foreground">Manage and view team photos for your quiz participants.</p>
                </div>
                
                {/* Settings section */}
                <div className="mb-6 bg-background rounded-lg border border-border p-4">
                  <h3 className="text-lg font-medium text-foreground mb-4">Photo Settings</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Team Photos Auto Approval
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically approve team photos when they are uploaded
                      </p>
                    </div>
                    <Switch
                      checked={teamPhotosAutoApprove}
                      onCheckedChange={(checked) => updateTeamPhotosAutoApprove(checked)}
                    />
                  </div>
                </div>

                {/* Content area - ready for team photos functionality */}
                <div className="flex-1 bg-muted/30 rounded-lg border border-border flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">Team Photos Coming Soon</p>
                    <p className="text-sm">This feature will allow you to manage team photos and display them during the quiz.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
