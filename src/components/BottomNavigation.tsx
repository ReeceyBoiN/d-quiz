import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Settings, Skull, ArrowLeftRight, Layers, Camera, Pause, RotateCcw, Trash2, EyeOff, Plus, Minus, LayoutGrid, Gamepad2, UserMinus, X, Volume2, Check } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";
import { ensureFileUrl } from "../utils/photoUrlConverter";
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
  // Bottom Navigation popup states from parent
  bottomNavPopupStates?: {
    teamPhotos: boolean;
    clearScores: boolean;
    emptyLobby: boolean;
  };
  onBottomNavPopupToggle?: (popupName: string, isOpen: boolean) => void;
}

interface ExtendedStatusBarProps extends StatusBarProps {
  leftSidebarWidth?: number;
  showQuizPackDisplay?: boolean;
  bottomNavPopupStates?: {
    teamPhotos: boolean;
    clearScores: boolean;
    emptyLobby: boolean;
  };
  onBottomNavPopupToggle?: (popupName: string, isOpen: boolean) => void;
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
  bottomNavPopupStates = { teamPhotos: false, clearScores: false, emptyLobby: false },
  onBottomNavPopupToggle,
}: ExtendedStatusBarProps) {
  // Refs for timeout management and fetch tracking
  const photoRefreshTimeoutRef = useRef<number | null>(null);
  const pendingTimeoutsRef = useRef<number[]>([]);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<number | null>(null);
  // FIX: Use ref to track photoStatuses in real-time (React state is async)
  // This ensures the filter uses the latest status even if state hasn't flushed yet
  const photoStatusesRef = useRef<{ [deviceId: string]: 'pending' | 'approved' | 'declined' }>({});
  // NEW: Track auto-approve setting in ref for access in event handlers
  // This ensures we read the current value synchronously in TEAM_PHOTO_UPDATED listener
  const autoApproveRef = useRef<boolean>(false);

  const {
    goWideEnabled: settingsGoWide,
    evilModeEnabled: settingsEvilMode,
    updateGoWideEnabled,
    updateEvilModeEnabled,
    teamPhotosAutoApprove,
    updateTeamPhotosAutoApprove
  } = useSettings();

  // Use popup states from parent props if provided
  const showClearScoresDialog = bottomNavPopupStates.clearScores;
  const setShowClearScoresDialog = (value: boolean) => onBottomNavPopupToggle?.('clearScores', value);

  const showEmptyLobbyDialog = bottomNavPopupStates.emptyLobby;
  const setShowEmptyLobbyDialog = (value: boolean) => onBottomNavPopupToggle?.('emptyLobby', value);

  const showTeamPhotosPopup = bottomNavPopupStates.teamPhotos;
  const setShowTeamPhotosPopup = (value: boolean) => onBottomNavPopupToggle?.('teamPhotos', value);
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ deviceId: string; teamName: string; teamPhoto: string }>>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoStatuses, setPhotoStatuses] = useState<{ [deviceId: string]: 'pending' | 'approved' | 'declined' }>({});

  // Keep ref in sync with state for immediate access in filters
  useEffect(() => {
    photoStatusesRef.current = photoStatuses;
  }, [photoStatuses]);

  // NEW: Keep auto-approve ref in sync with SettingsContext value
  // This ensures TEAM_PHOTO_UPDATED listener reads the current setting synchronously
  useEffect(() => {
    autoApproveRef.current = teamPhotosAutoApprove;
    console.log('[BottomNavigation] 🔄 Auto-approval setting changed:', teamPhotosAutoApprove);
  }, [teamPhotosAutoApprove]);

  // Derived state: check if there are pending team photos
  const hasPendingTeamPhotos = pendingPhotos.length > 0;

  // FIX 2: Log whenever hasPendingTeamPhotos state changes
  // This helps debug if fetch completes but state doesn't update
  useEffect(() => {
    console.log('[BottomNavigation] 🔔 hasPendingTeamPhotos changed:', hasPendingTeamPhotos);
    console.log('[BottomNavigation] 📊 Current pending photos count:', pendingPhotos.length);
    if (hasPendingTeamPhotos) {
      console.log('[BottomNavigation] ✨ PENDING PHOTOS DETECTED - orange flash should activate');
      pendingPhotos.forEach(photo => {
        console.log(`  - ${photo.teamName} (${photo.deviceId}): status=${photoStatuses[photo.normalizedDeviceId || photo.deviceId] || 'unknown'}`);
      });
    } else {
      console.log('[BottomNavigation] ✨ No pending photos - orange flash should be inactive');
    }
  }, [hasPendingTeamPhotos, pendingPhotos]);

  // PART 1: Wrap fetchPendingPhotos in useCallback to avoid stale closure issues
  // This ensures schedulePhotoRefresh always calls the current version
  const fetchPendingPhotos = React.useCallback(async () => {
    // Prevent concurrent fetch requests
    if (isFetchingRef.current) {
      console.log('[BottomNavigation] Fetch already in progress, skipping...');
      return;
    }

    // PHASE 2: Increased throttling window (400ms instead of 200ms) to prevent overlapping fetches
    // This gives the backend time to process updates before we check again
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 400) {
      console.log('[BottomNavigation] Throttling fetch request (400ms window)...');
      return;
    }
    lastFetchTimeRef.current = now;

    isFetchingRef.current = true;
    setLoadingPhotos(true);
    try {
      const result = await (window as any).api?.ipc?.invoke?.('network/all-players');

      // PHASE 4: Normalize IPC response handling - handle inconsistent shapes gracefully
      let players = [];
      if (Array.isArray(result)) {
        // Response is direct array
        players = result;
      } else if (result?.ok && Array.isArray(result.data)) {
        // Response is wrapped: { ok: true, data: [...] }
        players = result.data;
      } else if (result?.data && Array.isArray(result.data)) {
        // Response is wrapped without ok check: { data: [...] }
        players = result.data;
      }

      if (Array.isArray(players) && players.length >= 0) {
        // DETAILED LOGGING: Show what we got from backend
        console.log('[BottomNavigation] 📊 Backend returned', players.length, 'players');
        players.forEach((p: any, idx: number) => {
          const normalizedDeviceId = (p.deviceId || '').trim();
          const currentStatus = photoStatuses[normalizedDeviceId] || 'unknown';
          console.log(`  [${idx}] ${p.teamName} (${p.deviceId}):`, {
            hasTeamPhoto: !!p.teamPhoto,
            hasTeamPhotoPending: !!p.teamPhotoPending,
            teamPhotoPendingValue: p.teamPhotoPending || 'null/undefined',
            photoApprovedAt: p.photoApprovedAt || 'undefined/null',
            isPendingByTeamPhotoPending: !!p.teamPhotoPending,
            isPendingByApprovalStatus: !!(p.teamPhoto && !p.photoApprovedAt),
            currentUIStatus: currentStatus
          });
        });

        // Check for pending photos: either teamPhotoPending field OR teamPhoto without approval
        // CRITICAL: Only trust backend flags (teamPhotoPending, photoApprovedAt) NOT UI state (photoStatuses)
        // This ensures new photos from the same team are recognized as pending even if previous photo was approved
        const photosWithImages = players.filter(
          (p: any) => {
            // Trust ONLY the backend flags - if backend says it's pending, it's pending
            // Don't use photoStatuses here - that's only for UI display
            return (p.teamPhotoPending || (p.teamPhoto && !p.photoApprovedAt));
          }
        );
        console.log('[BottomNavigation] 🔍 Filtered to', photosWithImages.length, 'pending photos');
        console.log('[BottomNavigation] 📋 Breakdown:');
        console.log('  - Photos with teamPhotoPending=true:', players.filter((p: any) => !!p.teamPhotoPending).length);
        console.log('  - Photos with teamPhoto+no approval:', players.filter((p: any) => p.teamPhoto && !p.photoApprovedAt).length);

        // PHASE 3: Normalize DeviceId handling - ensure consistent keys throughout
        // The backend might send multiple events (PLAYER_JOIN, reconnections, photo updates)
        // We use a Map to ensure uniqueness by normalized deviceId, keeping the most recent entry
        const uniquePhotos = new Map();
        photosWithImages.forEach((photo: any) => {
          const normalizedDeviceId = (photo.deviceId || '').trim();
          // Ensure photo object has normalized deviceId for consistent lookups
          photo.normalizedDeviceId = normalizedDeviceId;
          uniquePhotos.set(normalizedDeviceId, photo);
        });
        const dedupedPhotos = Array.from(uniquePhotos.values());

        console.log('[BottomNavigation] 📦 Deduplication results:');
        console.log('  - Photos with images:', photosWithImages.length);
        console.log('  - Unique photos (by deviceId):', dedupedPhotos.length);
        if (photosWithImages.length !== dedupedPhotos.length) {
          console.log('  - Duplicates removed:', photosWithImages.length - dedupedPhotos.length);
          const deviceIds = photosWithImages.map((p: any) => `${p.teamName}(${p.deviceId})`);
          console.log('  - All entries:', deviceIds);
          const uniqueDeviceIds = Array.from(new Set(photosWithImages.map((p: any) => p.deviceId)));
          console.log('  - Unique deviceIds:', uniqueDeviceIds.length);
        }

        // CRITICAL FIX 1: Filter out photos that have been approved/declined by the user
        // This prevents approved photos from reappearing when backend sync is delayed
        // Only show photos that: (1) are not in photoStatuses OR (2) have status === 'pending'
        // NOTE: Use ref instead of state because state updates are async and might not have flushed yet
        const filteredPhotos = dedupedPhotos.filter((p: any) => {
          const deviceId = p.normalizedDeviceId || (p.deviceId || '').trim();
          const status = photoStatusesRef.current[deviceId];
          // Show photo if: no status yet (undefined/pending) OR status is explicitly 'pending'
          // HIDE photo if: status is 'approved' or 'declined'
          return status === undefined || status === 'pending';
        });

        console.log('[BottomNavigation] 📊 After filtering by approval status:');
        console.log('  - Deduped photos from backend:', dedupedPhotos.length);
        console.log('  - After removing approved/declined:', filteredPhotos.length);

        setPendingPhotos(filteredPhotos);

        // CRITICAL FIX 2: Update status map - preserve approved/declined statuses
        // Key principle: Status flows FORWARD (undefined → pending → approved/declined) NEVER BACKWARD
        // If a photo was approved, it stays 'approved' even if backend sync is slow
        setPhotoStatuses(prev => {
          const newStatuses = { ...prev };

          // For all photos currently in the deduped list from backend, initialize 'pending' if not seen before
          dedupedPhotos.forEach((p: any) => {
            const deviceId = p.normalizedDeviceId || (p.deviceId || '').trim();
            if (!(deviceId in newStatuses)) {
              // First time seeing this photo
              newStatuses[deviceId] = 'pending';
              console.log('[BottomNavigation] 📝 Initialized status for new photo:', deviceId, '→ pending');
            } else {
              // Photo already known - preserve its current status
              // This could be 'pending', 'approved', or 'declined'
              const currentStatus = newStatuses[deviceId];
              console.log('[BottomNavigation] 📝 Preserving status for existing photo:', deviceId, '→', currentStatus);
            }
          });

          // PART 4: Smart status cleanup - only delete 'pending' statuses for devices no longer in pending list
          // This preserves 'approved'/'declined' statuses so they don't reappear in the list
          const pendingDeviceIds = new Set(dedupedPhotos.map((p: any) => p.normalizedDeviceId || (p.deviceId || '').trim()));
          Object.keys(newStatuses).forEach(id => {
            if (!pendingDeviceIds.has(id) && newStatuses[id] === 'pending') {
              console.log('[BottomNavigation] 🗑️ Removing status for device no longer pending:', id);
              delete newStatuses[id];
            }
          });

          return newStatuses;
        });
      }
    } catch (err) {
      console.error('[BottomNavigation] Error fetching pending photos:', err);
    } finally {
      isFetchingRef.current = false;
      setLoadingPhotos(false);
    }
  }, []);

  // PART 2: Helper function to schedule photo refresh with timeout cancellation
  // This consolidates all refresh operations into a single place to avoid overlapping fetches
  const schedulePhotoRefresh = React.useCallback((delayMs: number = 500) => {
    // Cancel previous timeout if one exists
    if (photoRefreshTimeoutRef.current) {
      clearTimeout(photoRefreshTimeoutRef.current);
      console.log('[BottomNavigation] 🔄 Cancelled previous scheduled refresh');
    }

    // Schedule new fetch
    photoRefreshTimeoutRef.current = window.setTimeout(() => {
      console.log('[BottomNavigation] 🔄 Executing scheduled photo refresh (delay:', delayMs, 'ms)');
      fetchPendingPhotos();
    }, delayMs);
  }, [fetchPendingPhotos]);

  // Fetch pending photos when popup opens
  useEffect(() => {
    if (showTeamPhotosPopup) {
      fetchPendingPhotos();
    }
  }, [showTeamPhotosPopup, fetchPendingPhotos]);

  // Fetch pending photos on component mount to initialize the state
  useEffect(() => {
    fetchPendingPhotos();
  }, [fetchPendingPhotos]);

  const handleApprovePhoto = React.useCallback(async (deviceId: string, teamName: string) => {
    try {
      console.log('[BottomNavigation] 📸 handleApprovePhoto called:');
      console.log('  - deviceId:', deviceId);
      console.log('  - teamName:', teamName);

      if ((window as any).api?.network?.approveTeam) {
        console.log('[BottomNavigation] 📤 Calling api.network.approveTeam with isPhotoApproval: true');

        // PHASE 1: Wait for approval confirmation from backend
        const approvalResponse = await (window as any).api.network.approveTeam({ deviceId, teamName, isPhotoApproval: true });
        console.log('[BottomNavigation] ✅ Photo approval response received:', approvalResponse);
        console.log('[BottomNavigation] 🔍 Response properties:', {
          keys: Object.keys(approvalResponse || {}),
          approved: approvalResponse?.approved,
          hasPhotoApprovedAt: !!approvalResponse?.photoApprovedAt,
          photoApprovedAt: approvalResponse?.photoApprovedAt,
          hasPhotoUrl: !!approvalResponse?.photoUrl,
          timestamp: approvalResponse?.timestamp
        });

        // Verify confirmation was successful
        if (!approvalResponse?.photoApprovedAt) {
          console.warn('[BottomNavigation] ⚠️  Approval response missing photoApprovedAt confirmation');
          console.warn('[BottomNavigation] Full response object:', JSON.stringify(approvalResponse, null, 2));
        }

        // CRITICAL FIX: Normalize deviceId to match the key used in fetchPendingPhotos
        // This ensures photoStatuses updates use the same key format as the filter
        const normalizedStatusKey = (deviceId || '').trim();
        console.log('[BottomNavigation] 🔑 Normalizing deviceId for photoStatuses key:', {
          original: deviceId,
          normalized: normalizedStatusKey
        });

        // FIX: Update ref IMMEDIATELY (synchronously) so filter sees the approved status
        // State update is async and might not flush before refresh runs 500ms later
        photoStatusesRef.current[normalizedStatusKey] = 'approved';
        console.log('[BottomNavigation] ✅ Updated photoStatusesRef immediately to approved:', normalizedStatusKey);

        // Also update state for rendering
        setPhotoStatuses(prev => ({
          ...prev,
          [normalizedStatusKey]: 'approved'
        }));

        // PHASE 2: If we have confirmation data from backend, use it directly
        // Otherwise fetch updated player data
        let photoUrl = approvalResponse?.photoUrl;

        if (!photoUrl) {
          try {
            console.log('[BottomNavigation] 📸 No photoUrl in confirmation response - fetching updated player data');
            console.log('[BottomNavigation] 🔍 Attempting network/all-players fetch...');
            const result = await (window as any).api?.ipc?.invoke?.('network/all-players');

            // PHASE 4: Normalize response handling - try multiple response shapes
            let players = [];
            if (Array.isArray(result)) {
              players = result;
            } else if (result?.ok && Array.isArray(result.data)) {
              players = result.data;
            } else if (result?.data && Array.isArray(result.data)) {
              players = result.data;
            }

            console.log('[BottomNavigation] 📊 network/all-players result:', {
              hasResult: !!result,
              playersLength: players.length
            });

            if (Array.isArray(players) && players.length > 0) {
              // PHASE 3: Use normalized deviceId for consistent matching
              const normalizedDeviceId = (deviceId || '').trim();
              const updatedPlayer = players.find((p: any) => (p.deviceId || '').trim() === normalizedDeviceId);
              console.log('[BottomNavigation] 🔍 Updated player lookup:', {
                found: !!updatedPlayer,
                hasTeamPhoto: !!updatedPlayer?.teamPhoto,
                hasPhotoApprovedAt: !!updatedPlayer?.photoApprovedAt,
                photoApprovedAt: updatedPlayer?.photoApprovedAt
              });

              if (updatedPlayer?.teamPhoto) {
                photoUrl = updatedPlayer.teamPhoto;
                console.log('[BottomNavigation] ✅ Fetched approved photo URL for team:', teamName);
              }
            } else {
              console.error('[BottomNavigation] ❌ Invalid response from network/all-players - no players array:', result);
            }
          } catch (err) {
            console.error('[BottomNavigation] ❌ Error fetching updated player data:', err);
            // This is non-critical - will try refresh anyway
          }
        } else {
          console.log('[BottomNavigation] ✅ Using photoUrl from confirmation response');
        }

        // PHASE 3: Broadcast photo update to QuizHost
        if (photoUrl) {
          try {
            const { broadcastMessage } = await import('../network/wsHost');
            broadcastMessage({
              type: 'PHOTO_APPROVAL_UPDATED',
              data: {
                deviceId,
                teamName,
                photoUrl,
                timestamp: Date.now()
              }
            });
            console.log('[BottomNavigation] ✅ Broadcasted PHOTO_APPROVAL_UPDATED event to QuizHost');
          } catch (err) {
            console.error('[BottomNavigation] Error broadcasting photo update:', err);
          }
        }

        // PART 3: Use consolidated refresh scheduling to avoid overlapping fetches
        // 500ms delay ensures backend has persisted approval AND the 400ms throttle window has expired
        // This prevents the refresh from being throttled (which happens with 300ms delay)
        console.log('[BottomNavigation] 🔄 Scheduling photo refresh after approval (500ms delay)');
        schedulePhotoRefresh(500);
      }
    } catch (err) {
      console.error('[BottomNavigation] Error approving photo:', err);
    }
  }, []);

  const handleDeclinePhoto = async (deviceId: string, teamName: string) => {
    try {
      console.log('[BottomNavigation] 📸 handleDeclinePhoto called:');
      console.log('  - deviceId:', deviceId);
      console.log('  - teamName:', teamName);

      if ((window as any).api?.network?.declineTeam) {
        await (window as any).api.network.declineTeam({ deviceId, teamName });

        // CRITICAL FIX: Normalize deviceId to match the key used in fetchPendingPhotos
        // This ensures photoStatuses updates use the same key format as the filter
        const normalizedStatusKey = (deviceId || '').trim();
        console.log('[BottomNavigation] 🔑 Normalizing deviceId for photoStatuses key:', {
          original: deviceId,
          normalized: normalizedStatusKey
        });

        // FIX: Update ref IMMEDIATELY (synchronously) so filter sees the declined status
        // State update is async and might not flush before refresh runs 500ms later
        photoStatusesRef.current[normalizedStatusKey] = 'declined';
        console.log('[BottomNavigation] ✅ Updated photoStatusesRef immediately to declined:', normalizedStatusKey);

        // Also update state for rendering
        setPhotoStatuses(prev => ({
          ...prev,
          [normalizedStatusKey]: 'declined'
        }));

        // PART 3: Use consolidated refresh scheduling to avoid overlapping fetches
        // 500ms delay ensures backend has persisted decline AND the 400ms throttle window has expired
        // This prevents the refresh from being throttled (which happens with 300ms delay)
        console.log('[BottomNavigation] 🔄 Scheduling photo refresh after decline (500ms delay)');
        schedulePhotoRefresh(500);
      }
    } catch (err) {
      console.error('[BottomNavigation] Error declining photo:', err);
    }
  };

  // Listen for team photo updates and refresh the pending photos list
  useEffect(() => {
    const handleNetworkTeamPhotoUpdated = async (data: any) => {
      try {
        console.log('[BottomNavigation] 📸 TEAM_PHOTO_UPDATED received:', data);
        const { deviceId, teamName } = data;
        const normalizedDeviceId = (deviceId || '').trim();

        // NEW FIX: Check if auto-approve is enabled
        // If auto-approve is ON, skip resetting status to pending and let QuizHost auto-approve silently
        // If auto-approve is OFF, reset status to pending so photo appears in approval dialog
        if (autoApproveRef.current === true) {
          console.log('[BottomNavigation] ✅ Auto-approve is ON - skipping pending status reset, letting QuizHost auto-approve silently');
          // Do NOT reset status, do NOT add photo to pending list
          // QuizHost will auto-approve it in the background
          // Schedule a longer refresh to verify final state after QuizHost approves
          schedulePhotoRefresh(1000); // Longer delay to let QuizHost complete auto-approval
          return;
        }

        // EXISTING: Only do this if auto-approve is OFF
        // CRITICAL FIX 3: Reset approval status when new photo arrives
        // This ensures that if a team uploads a new photo after approval, it shows as pending
        // Example: User approves photo A (status='approved'), then team uploads photo B
        // We need to reset status to 'pending' so photo B shows in the list
        console.log('[BottomNavigation] 🔄 New photo detected - resetting status from approved to pending for:', teamName);
        setPhotoStatuses(prev => {
          const currentStatus = prev[normalizedDeviceId];
          if (currentStatus === 'approved' || currentStatus === 'declined') {
            return {
              ...prev,
              [normalizedDeviceId]: 'pending'
            };
          }
          return prev;
        });

        // NOTE: Auto-approval is now handled by QuizHost.tsx (always-mounted component)
        // BottomNavigation only handles UI updates here
        console.log('[BottomNavigation] 📸 TEAM_PHOTO_UPDATED received - will refresh UI');

        // ALWAYS refresh pending photos when event arrives (regardless of popup state)
        // This ensures the button indicator updates even when popup is closed
        console.log('[BottomNavigation] 🔄 Refreshing pending photos on TEAM_PHOTO_UPDATED event...');

        // PHASE 2: Use consolidated refresh scheduling
        // 300ms delay ensures backend has processed the update before we check
        schedulePhotoRefresh(300);
      } catch (err) {
        console.error('[BottomNavigation] Error handling TEAM_PHOTO_UPDATED:', err);
      }
    };

    // Register listener for TEAM_PHOTO_UPDATED messages
    const unsubscribeTEAM_PHOTO = onNetworkMessage('TEAM_PHOTO_UPDATED', handleNetworkTeamPhotoUpdated);

    // Clean up listener, timeout, and all pending timeouts on unmount
    return () => {
      unsubscribeTEAM_PHOTO();

      // Clear the photo refresh timeout
      if (photoRefreshTimeoutRef.current) {
        clearTimeout(photoRefreshTimeoutRef.current);
        photoRefreshTimeoutRef.current = null;
      }

      // Clear all pending timeouts from approve/decline operations
      pendingTimeoutsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      pendingTimeoutsRef.current = [];
    };
  }, []); // No dependencies - listener should stay registered

  // NEW: Listen for PLAYER_JOIN events to trigger photo refresh
  // This helps catch photos that arrive along with new team joins
  useEffect(() => {
    const handleNetworkPlayerJoin = (data: any) => {
      try {
        const { deviceId, teamName } = data;
        console.log('[BottomNavigation] 👤 PLAYER_JOIN detected for team:', teamName, '(', deviceId, ')');
        console.log('[BottomNavigation] 🔍 Checking for pending photos from this new/reconnected team...');

        // PHASE 2: Use consolidated refresh scheduling
        // 300ms delay ensures backend has processed the join and any photo updates
        schedulePhotoRefresh(300);
      } catch (err) {
        console.error('[BottomNavigation] Error handling PLAYER_JOIN:', err);
      }
    };

    // Register listener for PLAYER_JOIN messages
    const unsubscribePLAYER_JOIN = onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);

    return () => {
      unsubscribePLAYER_JOIN();
    };
  }, []);

  // PHASE 5: Polling interval - refresh pending photos every 10 seconds
  // Event-driven refreshes handle real-time updates; polling is safety net only
  // This reduces backend load compared to previous 3 second interval
  useEffect(() => {
    console.log('[BottomNavigation] 🕐 Starting photo polling interval (10 seconds as safety net)...');

    // Call fetchPendingPhotos immediately to ensure orange indicator works on load
    // Using a wrapper to avoid dependency array issues
    const initialFetch = async () => {
      try {
        console.log('[BottomNavigation] 🔄 Calling fetchPendingPhotos on mount');
        // Re-initialize lastFetchTimeRef to allow immediate fetch
        lastFetchTimeRef.current = 0;
        await fetchPendingPhotos();
      } catch (err) {
        console.error('[BottomNavigation] Error in initial photo fetch:', err);
      }
    };

    initialFetch();

    // PHASE 5: Increased interval from 3 seconds to 10 seconds
    // Event-driven updates (TEAM_PHOTO_UPDATED, PLAYER_JOIN) provide real-time responsiveness
    // Polling serves as safety net in case events are missed
    pollingIntervalRef.current = window.setInterval(() => {
      try {
        console.log('[BottomNavigation] 🔄 Periodic photo poll triggered (safety net)...');
        fetchPendingPhotos();
      } catch (err) {
        console.error('[BottomNavigation] Error in polling interval:', err);
      }
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      console.log('[BottomNavigation] 🛑 Stopped photo polling');
    };
  }, []);

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
            className={`px-3 flex items-center gap-1.5 transition-colors border-r border-border ${
              hasPendingTeamPhotos
                ? 'bg-[#ea580c] animate-flash-orange text-white shadow-lg'
                : 'hover:bg-accent'
            }`}
            style={hasPendingTeamPhotos ? {
              backgroundColor: 'rgb(234, 88, 12)',
              color: 'white'
            } : undefined}
            onClick={() => setShowTeamPhotosPopup(true)}
            title={hasPendingTeamPhotos ? "Team photo pending approval! Click to view" : "Team Photos"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Background overlay with blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTeamPhotosPopup(false)}
          />
          
          {/* Popup window */}
          <div
            className="relative bg-card border border-border rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-6xl overflow-hidden"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            {/* Close button in top-right corner */}
            <button
              onClick={() => setShowTeamPhotosPopup(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors border border-border shadow-sm"
              title="Close"
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
            
            {/* Popup content */}
            <div className="p-8 h-full" style={{ WebkitAppRegion: 'no-drag' }}>
              <div className="flex flex-col h-full">
                <div className="mb-6 flex items-center justify-between" style={{ WebkitAppRegion: 'no-drag' }}>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Team Photos</h2>
                    <p className="text-muted-foreground">Manage and view team photos for your quiz participants.</p>
                  </div>
                  <button
                    onClick={() => {
                      console.log('[BottomNavigation] 🔄 Manual refresh button clicked');
                      setLoadingPhotos(true);
                      lastFetchTimeRef.current = 0; // Reset throttle to allow immediate fetch
                      fetchPendingPhotos();
                    }}
                    disabled={loadingPhotos}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-md font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                    title="Manually refresh the pending photos list"
                  >
                    <RotateCcw className={`h-4 w-4 ${loadingPhotos ? 'animate-spin' : ''}`} />
                    {loadingPhotos ? 'Refreshing...' : 'Refresh'}
                  </button>
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
                                src={ensureFileUrl(photo.teamPhotoPending || photo.teamPhoto)}
                                alt={photo.teamName}
                                className="w-full h-full object-cover"
                                onLoad={() => {
                                  console.log('[BottomNavigation] ✅ Successfully loaded team photo:', photo.teamPhotoPending || photo.teamPhoto);
                                }}
                                onError={(e) => {
                                  console.error('[BottomNavigation] ❌ Failed to load team photo:', photo.teamPhotoPending || photo.teamPhoto);
                                  e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">Unable to load image</div>';
                                }}
                              />
                            </div>

                            {/* Team Name */}
                            <div className="text-center">
                              <p className="font-semibold text-foreground truncate w-full">{photo.teamName}</p>
                              <p className="text-xs text-muted-foreground">
                                {photoStatuses[photo.normalizedDeviceId || photo.deviceId] === 'approved' ? '✓ Approved' :
                                 photoStatuses[photo.normalizedDeviceId || photo.deviceId] === 'declined' ? '✗ Declined' :
                                 'Pending'}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            {/* PHASE 3: Use normalizedDeviceId for consistent key matching */}
                            {photoStatuses[photo.normalizedDeviceId || photo.deviceId] === 'pending' && (
                              <div className="flex gap-2 w-full">
                                <button
                                  onClick={() => handleApprovePhoto(photo.normalizedDeviceId || photo.deviceId, photo.teamName)}
                                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1"
                                  title="Approve this photo"
                                >
                                  <Check className="h-4 w-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleDeclinePhoto(photo.normalizedDeviceId || photo.deviceId, photo.teamName)}
                                  className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1"
                                  title="Decline this photo"
                                >
                                  <X className="h-4 w-4" />
                                  Decline
                                </button>
                              </div>
                            )}

                            {photoStatuses[photo.normalizedDeviceId || photo.deviceId] === 'approved' && (
                              <button
                                disabled
                                className="w-full px-3 py-2 bg-green-500/50 text-white rounded-md font-semibold text-sm opacity-75 cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                <Check className="h-4 w-4" />
                                Approved
                              </button>
                            )}

                            {photoStatuses[photo.normalizedDeviceId || photo.deviceId] === 'declined' && (
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
