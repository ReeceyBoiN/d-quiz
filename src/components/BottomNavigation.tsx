import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Settings, Skull, ArrowLeftRight, Layers, Camera, Pause, RotateCcw, Trash2, EyeOff, Plus, Minus, LayoutGrid, Gamepad2, UserMinus, X, Volume2, Check } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { onNetworkMessage } from "../network/wsHost";
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
  // Timer state
  isOnTheSpotTimerRunning?: boolean; // Disable scoring controls when on-the-spot timer is running
  isQuizPackTimerRunning?: boolean; // Disable scoring controls when quiz pack timer is running
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
  isOnTheSpotTimerRunning?: boolean;
  isQuizPackTimerRunning?: boolean;
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
  onEndRound,
  isOnTheSpotTimerRunning = false,
  isQuizPackTimerRunning = false
}: GameModeConfigPanelProps) {
  const timerIsRunning = isOnTheSpotTimerRunning || isQuizPackTimerRunning;
  useEffect(() => {
    console.log('[GameModeConfigPanel] Timer running:', { isOnTheSpotTimerRunning, isQuizPackTimerRunning, timerIsRunning });
  }, [isOnTheSpotTimerRunning, isQuizPackTimerRunning, timerIsRunning]);
  const { 
    defaultPoints, 
    defaultSpeedBonus, 
    gameModePoints,
    updateGameModePoints,
    staggeredEnabled,
    updateStaggeredEnabled,
    updateGoWideEnabled,
    updateEvilModeEnabled,
  } = useSettings();
  
  const localPoints: number = gameMode === "buzzin" 
    ? (gameModePoints.buzzin ?? 0)
    : (currentRoundPoints ?? defaultPoints ?? 0);
  const localSpeedBonus: number = currentRoundSpeedBonus ?? defaultSpeedBonus ?? 0;
  const localWinnerPoints: number = currentRoundWinnerPoints ?? (gameModePoints.nearestwins ?? 0);

  const handlePointsChange = (value: string | number) => {
    const num = typeof value === 'string' ? (isNaN(parseInt(value)) ? 0 : parseInt(value)) : value;
    
    if (gameMode === "buzzin") {
      if (num !== localPoints) {
        updateGameModePoints('buzzin', num);
      }
    } else {
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
    <div className="flex-1 h-full flex items-center justify-center">
      {/* Points section - show for keypad and buzzin modes */}
      {(gameMode === "keypad" || gameMode === "buzzin") && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-1.5 py-0 border shadow-sm h-full flex flex-col justify-center items-center" style={{ margin: '0 5px', opacity: timerIsRunning ? 0.5 : 1, pointerEvents: timerIsRunning ? 'none' : 'auto' }}>
          <div className="flex flex-col gap-0.5 w-28">
            <div className="w-full h-5 flex items-center justify-center">
              <span className="text-white text-xs font-medium text-[15px]">POINTS</span>
            </div>
            <div className="flex gap-0.5 w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  const newValue = Math.max(0, localPoints - 1);
                  handlePointsChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-5 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localPoints}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  handlePointsChange((localPoints + 1).toString());
                }}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Speed Bonus section - only show for keypad mode, not buzzin */}
      {gameMode === "keypad" && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-1.5 py-0 border shadow-sm h-full flex flex-col justify-center items-center" style={{ opacity: timerIsRunning ? 0.5 : 1, pointerEvents: timerIsRunning ? 'none' : 'auto' }}>
          <div className="flex flex-col gap-0.5 w-28">
            <div className="w-full flex items-center justify-center" style={{ marginRight: '23px' }}>
              <span className="text-white text-xs font-medium text-[15px]">BONUS</span>
            </div>
            <div className="flex gap-0.5 w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  const newValue = Math.max(0, localSpeedBonus - 1);
                  handleSpeedBonusChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-5 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localSpeedBonus}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  handleSpeedBonusChange((localSpeedBonus + 1).toString());
                }}
              >
                <span className="text-xs">▲</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modes section - only show for keypad mode */}
      {gameMode === "keypad" && (
        <div className="bg-[rgba(92,97,107,1)] rounded px-1.5 py-0 border shadow-sm h-full flex flex-col justify-center items-center" style={{ marginLeft: '5px', opacity: timerIsRunning ? 0.5 : 1, pointerEvents: timerIsRunning ? 'none' : 'auto' }}>
          <div className="flex flex-col gap-0.5 w-32">
            <div className="w-full flex items-center justify-center">
              <span className="text-white text-xs font-medium text-[15px]">MODES</span>
            </div>
            <div className="flex gap-0.5 w-full">
              {/* Staggered Mode */}
              <Button
                variant={staggeredEnabled ? "default" : "outline"}
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  updateStaggeredEnabled(!staggeredEnabled);
                }}
                title="Staggered Mode"
              >
                <Layers className="h-3 w-3" />
              </Button>

              {/* Go Wide Mode */}
              <Button
                variant={goWideEnabled ? "default" : "outline"}
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  updateGoWideEnabled(!goWideEnabled);
                }}
                title="Go Wide Mode"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </Button>

              {/* Evil Mode */}
              <Button
                variant={evilModeEnabled ? "default" : "outline"}
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  updateEvilModeEnabled(!evilModeEnabled);
                }}
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
        <div className="bg-[rgba(92,97,107,1)] rounded px-1.5 py-0 border shadow-sm h-full flex flex-col justify-center" style={{ opacity: timerIsRunning ? 0.5 : 1, pointerEvents: timerIsRunning ? 'none' : 'auto' }}>
          <div className="flex flex-col gap-0.5 w-32">
            <div className="w-full flex items-center justify-center">
              <span className="text-white text-xs font-medium text-[15px]">WINNER POINTS</span>
            </div>
            <div className="flex gap-0.5 w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  const newValue = Math.max(0, localWinnerPoints - 1);
                  handleWinnerPointsChange(newValue.toString());
                }}
              >
                <span className="text-xs">▼</span>
              </Button>
              <div className="h-5 flex-1 bg-background flex items-center justify-center rounded border shadow-sm">
                <span className="text-xs font-medium">{localWinnerPoints}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-5 flex-1 p-0 border border-border rounded shadow-sm mx-0.25"
                style={{
                  opacity: timerIsRunning ? 0.4 : 1,
                  backgroundColor: timerIsRunning ? '#374151' : undefined,
                  borderColor: timerIsRunning ? '#6b7280' : undefined,
                  color: timerIsRunning ? '#9ca3af' : undefined,
                  cursor: timerIsRunning ? 'not-allowed' : 'pointer',
                  pointerEvents: timerIsRunning ? 'none' : 'auto',
                }}
                disabled={timerIsRunning}
                onClick={() => {
                  if (timerIsRunning) return;
                  handleWinnerPointsChange((localWinnerPoints + 1).toString());
                }}
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
  isOnTheSpotTimerRunning = false,
  isQuizPackTimerRunning = false,
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
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ deviceId: string; teamName: string; teamPhoto: string }>>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoStatuses, setPhotoStatuses] = useState<{ [deviceId: string]: 'pending' | 'approved' | 'declined' }>({});

  // Fetch pending photos when popup opens
  useEffect(() => {
    if (showTeamPhotosPopup) {
      fetchPendingPhotos();
    }
  }, [showTeamPhotosPopup]);

  const fetchPendingPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const result = await (window as any).api?.ipc?.invoke?.('network/all-players');
      if (result?.ok && Array.isArray(result.data)) {
        const photosWithImages = result.data.filter(
          (p: any) => p.teamPhoto && p.status === 'pending'
        );
        setPendingPhotos(photosWithImages);

        // Initialize photo statuses
        const statuses: { [deviceId: string]: 'pending' | 'approved' | 'declined' } = {};
        photosWithImages.forEach((p: any) => {
          statuses[p.deviceId] = 'pending';
        });
        setPhotoStatuses(statuses);
      }
    } catch (err) {
      console.error('[BottomNavigation] Error fetching pending photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleApprovePhoto = async (deviceId: string, teamName: string) => {
    try {
      console.log('[BottomNavigation] Approving photo for team:', teamName);

      if ((window as any).api?.network?.approveTeam) {
        await (window as any).api.network.approveTeam({ deviceId, teamName });

        // Update status
        setPhotoStatuses(prev => ({
          ...prev,
          [deviceId]: 'approved'
        }));

        // Refresh pending photos after a short delay
        setTimeout(() => {
          fetchPendingPhotos();
        }, 500);
      }
    } catch (err) {
      console.error('[BottomNavigation] Error approving photo:', err);
    }
  };

  const handleDeclinePhoto = async (deviceId: string, teamName: string) => {
    try {
      console.log('[BottomNavigation] Declining photo for team:', teamName);

      if ((window as any).api?.network?.declineTeam) {
        await (window as any).api.network.declineTeam({ deviceId, teamName });

        // Update status
        setPhotoStatuses(prev => ({
          ...prev,
          [deviceId]: 'declined'
        }));

        // Refresh pending photos after a short delay
        setTimeout(() => {
          fetchPendingPhotos();
        }, 500);
      }
    } catch (err) {
      console.error('[BottomNavigation] Error declining photo:', err);
    }
  };

  // Listen for team photo updates and refresh the photos list if popup is open
  useEffect(() => {
    const handleNetworkTeamPhotoUpdated = (data: any) => {
      console.log('[BottomNavigation] 📸 TEAM_PHOTO_UPDATED received:', data);
      // Refresh pending photos if Team Photos popup is open
      if (showTeamPhotosPopup) {
        console.log('[BottomNavigation] Team Photos popup is open, refreshing pending photos...');
        // Small delay to ensure backend has processed the update
        setTimeout(() => {
          fetchPendingPhotos();
        }, 500);
      } else {
        console.log('[BottomNavigation] Team Photos popup is closed, skipping refresh');
      }
    };

    // Register listener for TEAM_PHOTO_UPDATED messages
    const unsubscribe = onNetworkMessage('TEAM_PHOTO_UPDATED', handleNetworkTeamPhotoUpdated);

    // Clean up listener on unmount
    return unsubscribe;
  }, [showTeamPhotosPopup]); // Re-register when popup state changes

  return (
    <div
      className="w-full bg-sidebar-accent border-t border-sidebar-border px-2 py-0 h-[41px] flex items-center justify-center z-40"
      style={{ marginTop: '-13px', minHeight: '10px' }}
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
          className="px-2.5 bg-[#e74c3c] hover:bg-[#c0392b] text-white border shadow-sm font-semibold rounded flex items-center"
          style={{ fontSize: '12px', padding: '0 10px', height: '100%' }}
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
          isOnTheSpotTimerRunning={isOnTheSpotTimerRunning}
          isQuizPackTimerRunning={isQuizPackTimerRunning}
        />
      ) : (
        <div className="flex-1 h-full flex items-stretch">
          
          {/* Home screen toggle buttons - full height with vertical separators */}
          
          {/* Buzzers */}
          <button
            className="px-3 flex items-center gap-1.5 hover:bg-accent transition-colors border-r border-border"
            onClick={() => onOpenBuzzersManagement?.()}
            title="Buzzer Management"
          >
            <Volume2 className="h-4 w-4" />
            <span className="text-sm text-center">Buzzers</span>
          </button>

          {/* Empty Lobby */}
          <button
            className="px-3 flex items-center gap-1.5 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowEmptyLobbyDialog(true)}
            title="Empty Lobby"
          >
            <UserMinus className="h-4 w-4" />
            <span className="text-sm text-center">Empty Lobby</span>
          </button>

          {/* Team Photos */}
          <button
            className="px-3 flex items-center gap-1.5 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowTeamPhotosPopup(true)}
            title="Team Photos"
          >
            <Camera className="h-4 w-4" />
            <span className="text-sm text-center">Team Photos</span>
          </button>

          {/* Pause Scores */}
          <button
            className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
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
            className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${(() => {
              if (!teams || teams.length === 0) return 'hover:bg-accent';
              const scrambledCount = teams.filter(team => team.scrambled).length;
              return scrambledCount > 0
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'hover:bg-accent';
            })()}`}
            onClick={() => {
              if (onGlobalScrambleKeypad) {
                onGlobalScrambleKeypad();
              }
            }}
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
            className="px-3 flex items-center gap-1.5 hover:bg-accent transition-colors border-r border-border"
            onClick={() => setShowClearScoresDialog(true)}
            title="Clear Scores"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm text-center">Clear Scores</span>
          </button>

          {/* Hide Scores & Positions */}
          <button
            className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
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
            className="px-2.5 flex items-center justify-center hover:bg-accent transition-colors border-r border-border p-[0px]"
            onClick={() => {/* TODO: Add font size down functionality */}}
            title="Font Size Down"
          >
            <Minus className="h-4 w-4" />
          </button>

          {/* Font Size Label */}
          <div className="px-2.5 flex items-center justify-center text-sm text-muted-foreground border-r border-border text-center">
            Font Size
          </div>

          {/* Font Size Up */}
          <button
            className="px-2.5 flex items-center justify-center hover:bg-accent transition-colors border-r border-border p-[0px]"
            onClick={() => {/* TODO: Add font size up functionality */}}
            title="Font Size Up"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Change Teams Layout */}
          <button
            className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
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
            className={`px-3 flex items-center gap-1.5 transition-colors ${
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
                      onCheckedChange={(checked: boolean) => updateTeamPhotosAutoApprove(checked)}
                    />
                  </div>
                </div>

                {/* Content area - team photos list */}
                <div className="flex-1 bg-muted/30 rounded-lg border border-border overflow-hidden flex flex-col">
                  {loadingPhotos ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <div className="animate-spin inline-block h-8 w-8 border-4 border-foreground border-t-transparent rounded-full mb-4"></div>
                        <p>Loading team photos...</p>
                      </div>
                    </div>
                  ) : pendingPhotos.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No pending photos</p>
                        <p className="text-sm">Team photos will appear here when teams upload them.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1 p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                        {pendingPhotos.map((photo) => (
                          <div key={photo.deviceId} className="flex flex-col items-center gap-3">
                            {/* Photo Thumbnail */}
                            <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-border bg-background shadow-md hover:shadow-lg transition-shadow">
                              <img
                                src={photo.teamPhoto.startsWith('file://') || photo.teamPhoto.startsWith('data:') ? photo.teamPhoto : `file://${photo.teamPhoto}`}
                                alt={photo.teamName}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Team Name */}
                            <div className="text-center">
                              <p className="font-semibold text-foreground truncate w-full">{photo.teamName}</p>
                              <p className="text-xs text-muted-foreground">
                                {photoStatuses[photo.deviceId] === 'approved' ? '✓ Approved' :
                                 photoStatuses[photo.deviceId] === 'declined' ? '✗ Declined' :
                                 'Pending'}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            {photoStatuses[photo.deviceId] === 'pending' && (
                              <div className="flex gap-2 w-full">
                                <button
                                  onClick={() => handleApprovePhoto(photo.deviceId, photo.teamName)}
                                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1"
                                  title="Approve this photo"
                                >
                                  <Check className="h-4 w-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleDeclinePhoto(photo.deviceId, photo.teamName)}
                                  className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1"
                                  title="Decline this photo"
                                >
                                  <X className="h-4 w-4" />
                                  Decline
                                </button>
                              </div>
                            )}

                            {photoStatuses[photo.deviceId] === 'approved' && (
                              <button
                                disabled
                                className="w-full px-3 py-2 bg-green-500/50 text-white rounded-md font-semibold text-sm opacity-75 cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                <Check className="h-4 w-4" />
                                Approved
                              </button>
                            )}

                            {photoStatuses[photo.deviceId] === 'declined' && (
                              <button
                                disabled
                                className="w-full px-3 py-2 bg-red-500/50 text-white rounded-md font-semibold text-sm opacity-75 cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                <X className="h-4 w-4" />
                                Declined
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
