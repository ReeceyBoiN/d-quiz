import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface GameModePoints {
  keypad: number;
  buzzin: number;
  nearestwins: number;
  wheelspinner: number;
}

interface GameModeTimers {
  keypad: number;
  buzzin: number;
  nearestwins: number;
}

type KeypadDesign = "neon-glow" | "gaming-beast" | "matrix-green" | "bubble-pop" | "ocean-wave" | "cyber-chrome" | "fire-storm" | "cosmic-space";

interface SettingsContextType {
  version: string;
  defaultPoints: number;
  defaultSpeedBonus: number;
  gameModePoints: GameModePoints;
  gameModeTimers: GameModeTimers;
  nearestWinsTimer: number;
  keypadDesign: KeypadDesign;
  responseTimesEnabled: boolean;
  teamPhotosAutoApprove: boolean;
  goWideEnabled: boolean;
  evilModeEnabled: boolean;
  staggeredEnabled: boolean;
  punishmentEnabled: boolean;
  oneGuessPerTeam: boolean;
  voiceCountdown: boolean;
  hideQuizPackAnswers: boolean;
  buzzerFolderPath: string | null;
  musicRoundDefaultClipLength: number;
  musicRoundDefaultPoints: number;
  musicRoundDefaultSpeedBonus: number;
  musicRoundDefaultVolume: number;
  musicRoundElimination: boolean;
  musicRoundReversed: boolean;
  updateDefaultScores: (points: number, speedBonus: number) => void;
  updateGameModePoints: (gameMode: keyof GameModePoints, points: number) => void;
  updateGameModeTimer: (gameMode: keyof GameModeTimers, timer: number) => void;
  updateNearestWinsTimer: (timer: number) => void;
  updateKeypadDesign: (design: KeypadDesign) => void;
  updateResponseTimesEnabled: (enabled: boolean) => void;
  updateTeamPhotosAutoApprove: (enabled: boolean) => void;
  updateGoWideEnabled: (enabled?: boolean) => void;
  updateEvilModeEnabled: (enabled?: boolean) => void;
  updateStaggeredEnabled: (enabled?: boolean) => void;
  updatePunishmentEnabled: (enabled?: boolean) => void;
  updateOneGuessPerTeam: (enabled?: boolean) => void;
  updateVoiceCountdown: (enabled: boolean) => void;
  updateHideQuizPackAnswers: (enabled: boolean) => void;
  updateBuzzerFolderPath: (path: string | null) => void;
  updateMusicRoundDefaultClipLength: (length: number) => void;
  updateMusicRoundDefaultPoints: (points: number) => void;
  updateMusicRoundDefaultSpeedBonus: (bonus: number) => void;
  updateMusicRoundDefaultVolume: (volume: number) => void;
  updateMusicRoundElimination: (enabled: boolean) => void;
  updateMusicRoundReversed: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  // Application version - read-only, not saved to localStorage
  const version = "25.12.10";

  // Helper to get initial settings synchronously
  const getInitialSettings = () => {
    try {
      const savedSettings = localStorage.getItem('quizHostSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
    }
    return {};
  };

  const initialSettings = getInitialSettings();

  const [defaultPoints, setDefaultPoints] = useState(initialSettings.defaultPoints !== undefined ? initialSettings.defaultPoints : 4);
  const [defaultSpeedBonus, setDefaultSpeedBonus] = useState(initialSettings.defaultSpeedBonus !== undefined ? initialSettings.defaultSpeedBonus : 2);
  const [gameModePoints, setGameModePoints] = useState<GameModePoints>(initialSettings.gameModePoints || {
    keypad: 4,
    buzzin: 4,
    nearestwins: 4,
    wheelspinner: 4
  });
  const [gameModeTimers, setGameModeTimers] = useState<GameModeTimers>(initialSettings.gameModeTimers || {
    keypad: 30,
    buzzin: 30,
    nearestwins: 10
  });
  const [nearestWinsTimer, setNearestWinsTimer] = useState(initialSettings.nearestWinsTimer || 10);
  const [keypadDesign, setKeypadDesign] = useState<KeypadDesign>(initialSettings.keypadDesign || "neon-glow"); // Default to Neon Glow
  const [responseTimesEnabled, setResponseTimesEnabled] = useState(initialSettings.responseTimesEnabled !== undefined ? initialSettings.responseTimesEnabled : true); // Default to true for testing
  const [teamPhotosAutoApprove, setTeamPhotosAutoApprove] = useState(initialSettings.teamPhotosAutoApprove === true || initialSettings.teamPhotosAutoApprove === 'true');
  const [goWideEnabled, setGoWideEnabled] = useState(initialSettings.goWideEnabled || false);
  const [evilModeEnabled, setEvilModeEnabled] = useState(initialSettings.evilModeEnabled || false);
  const [staggeredEnabled, setStaggeredEnabled] = useState(initialSettings.staggeredEnabled || false);
  const [punishmentEnabled, setPunishmentEnabled] = useState(initialSettings.punishmentEnabled || false);
  const [oneGuessPerTeam, setOneGuessPerTeam] = useState(initialSettings.oneGuessPerTeam || false);
  const [voiceCountdown, setVoiceCountdown] = useState(initialSettings.voiceCountdown !== undefined ? initialSettings.voiceCountdown : true);
  const [hideQuizPackAnswers, setHideQuizPackAnswers] = useState(initialSettings.hideQuizPackAnswers || false);
  const [buzzerFolderPath, setBuzzerFolderPath] = useState<string | null>(initialSettings.buzzerFolderPath || null);
  const [musicRoundDefaultClipLength, setMusicRoundDefaultClipLength] = useState(initialSettings.musicRoundDefaultClipLength !== undefined ? initialSettings.musicRoundDefaultClipLength : 10);
  const [musicRoundDefaultPoints, setMusicRoundDefaultPoints] = useState(initialSettings.musicRoundDefaultPoints !== undefined ? initialSettings.musicRoundDefaultPoints : 4);
  const [musicRoundDefaultSpeedBonus, setMusicRoundDefaultSpeedBonus] = useState(initialSettings.musicRoundDefaultSpeedBonus !== undefined ? initialSettings.musicRoundDefaultSpeedBonus : 4);
  const [musicRoundDefaultVolume, setMusicRoundDefaultVolume] = useState(initialSettings.musicRoundDefaultVolume !== undefined ? initialSettings.musicRoundDefaultVolume : 80);
  const [musicRoundElimination, setMusicRoundElimination] = useState(initialSettings.musicRoundElimination !== undefined ? initialSettings.musicRoundElimination : true);
  const [musicRoundReversed, setMusicRoundReversed] = useState(initialSettings.musicRoundReversed !== undefined ? initialSettings.musicRoundReversed : false);

  // Remove the useEffect that loads settings on mount as it is now done synchronously
  // Listen for storage changes (when settings are updated in Settings component)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedSettings = localStorage.getItem('quizHostSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          const newPoints = parsed.defaultPoints !== undefined ? parsed.defaultPoints : 4;
          const newSpeedBonus = parsed.defaultSpeedBonus !== undefined ? parsed.defaultSpeedBonus : 2;
          const newGameModePoints = parsed.gameModePoints || {
            keypad: 4,
            buzzin: 4,
            nearestwins: 4,
            wheelspinner: 4
          };
          const newGameModeTimers = parsed.gameModeTimers || {
            keypad: 30,
            buzzin: 30,
            nearestwins: 10
          };
          
          setDefaultPoints(current => current !== newPoints ? newPoints : current);
          setDefaultSpeedBonus(current => current !== newSpeedBonus ? newSpeedBonus : current);
          setGameModePoints(current => {
            const hasChanged = Object.keys(newGameModePoints).some(key => 
              current[key as keyof GameModePoints] !== newGameModePoints[key as keyof GameModePoints]
            );
            return hasChanged ? newGameModePoints : current;
          });
          setGameModeTimers(current => {
            const hasChanged = Object.keys(newGameModeTimers).some(key => 
              current[key as keyof GameModeTimers] !== newGameModeTimers[key as keyof GameModeTimers]
            );
            return hasChanged ? newGameModeTimers : current;
          });
          setNearestWinsTimer(parsed.nearestWinsTimer || 10);
          setKeypadDesign(parsed.keypadDesign || "neon-glow");
          setResponseTimesEnabled(parsed.responseTimesEnabled !== undefined ? parsed.responseTimesEnabled : true);
          setTeamPhotosAutoApprove(parsed.teamPhotosAutoApprove === true || parsed.teamPhotosAutoApprove === 'true');
          setGoWideEnabled(parsed.goWideEnabled || false);
          setEvilModeEnabled(parsed.evilModeEnabled || false);
          setStaggeredEnabled(parsed.staggeredEnabled || false);
          setPunishmentEnabled(parsed.punishmentEnabled || false);
          setOneGuessPerTeam(parsed.oneGuessPerTeam || false);
          setVoiceCountdown(parsed.voiceCountdown !== undefined ? parsed.voiceCountdown : true);
          setHideQuizPackAnswers(parsed.hideQuizPackAnswers || false);
          setBuzzerFolderPath(parsed.buzzerFolderPath || null);
          if (parsed.musicRoundDefaultClipLength !== undefined) setMusicRoundDefaultClipLength(parsed.musicRoundDefaultClipLength);
          if (parsed.musicRoundDefaultPoints !== undefined) setMusicRoundDefaultPoints(parsed.musicRoundDefaultPoints);
          if (parsed.musicRoundDefaultSpeedBonus !== undefined) setMusicRoundDefaultSpeedBonus(parsed.musicRoundDefaultSpeedBonus);
          if (parsed.musicRoundDefaultVolume !== undefined) setMusicRoundDefaultVolume(parsed.musicRoundDefaultVolume);
          if (parsed.musicRoundElimination !== undefined) setMusicRoundElimination(parsed.musicRoundElimination);
          if (parsed.musicRoundReversed !== undefined) setMusicRoundReversed(parsed.musicRoundReversed);
        } catch (error) {
          console.error('Failed to parse saved settings:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    window.addEventListener('settingsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleStorageChange);
    };
  }, []);

  const updateDefaultScores = (points: number, speedBonus: number) => {
    // Only update if values have actually changed
    if (defaultPoints === points && defaultSpeedBonus === speedBonus) return;
    
    setDefaultPoints(points);
    setDefaultSpeedBonus(speedBonus);
    
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, defaultPoints: points, defaultSpeedBonus: speedBonus };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateGameModePoints = (gameMode: keyof GameModePoints, points: number) => {
    // Only update if the value has actually changed
    if (gameModePoints[gameMode] === points) return;
    
    const newGameModePoints = { ...gameModePoints, [gameMode]: points };
    setGameModePoints(newGameModePoints);
    
    // Save to localStorage and trigger event immediately
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, gameModePoints: newGameModePoints };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateGameModeTimer = (gameMode: keyof GameModeTimers, timer: number) => {
    // Only update if the value has actually changed
    if (gameModeTimers[gameMode] === timer) return;
    
    const newGameModeTimers = { ...gameModeTimers, [gameMode]: timer };
    setGameModeTimers(newGameModeTimers);
    
    // Save to localStorage and trigger event immediately
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, gameModeTimers: newGameModeTimers };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateNearestWinsTimer = (timer: number) => {
    setNearestWinsTimer(timer);
  };

  const updateKeypadDesign = (design: KeypadDesign) => {
    setKeypadDesign(design);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, keypadDesign: design };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateResponseTimesEnabled = (enabled: boolean) => {
    setResponseTimesEnabled(enabled);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, responseTimesEnabled: enabled };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateTeamPhotosAutoApprove = async (enabled: boolean) => {
    setTeamPhotosAutoApprove(enabled);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, teamPhotosAutoApprove: enabled };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));

    // Sync with backend via IPC (Electron environment only)
    if ((window as any).api?.ipc?.invoke) {
      try {
        // STEP 1: Sync backend setting and WAIT for confirmation
        console.log('[SettingsContext] 🔄 Syncing auto-approve setting to backend:', enabled);
        const syncResult = await (window as any).api.ipc.invoke('network/set-team-photos-auto-approve', { enabled });
        console.log('[SettingsContext] ✅ Successfully synced auto-approve setting to backend:', enabled, syncResult);

        // STEP 2: If enabling auto-approval, retroactively approve all pending photos
        if (enabled === true) {
          console.log('[SettingsContext] 🔄 Auto-approval enabled - fetching pending photos to approve...');

          // STEP 2A: Fetch all players to find pending photos
          const result = await (window as any).api.ipc.invoke('network/all-players');
          let players = Array.isArray(result) ? result : result?.data || [];

          // Filter for photos that are pending: either in teamPhotoPending OR in teamPhoto without approval timestamp
          const pendingPhotos = players.filter((p: any) =>
            p.teamPhotoPending || (p.teamPhoto && !p.photoApprovedAt)
          );

          if (pendingPhotos.length === 0) {
            console.log('[SettingsContext] ✅ No pending photos to auto-approve');
            return;
          }

          console.log(`[SettingsContext] 📸 Found ${pendingPhotos.length} pending photos - auto-approving...`);
          console.log('[SettingsContext] Pending photos breakdown:');
          console.log('  - In teamPhotoPending:', pendingPhotos.filter((p: any) => p.teamPhotoPending).length);
          console.log('  - In teamPhoto without approval:', pendingPhotos.filter((p: any) => p.teamPhoto && !p.photoApprovedAt).length);

          // STEP 2B: Approve each pending photo sequentially
          for (const p of pendingPhotos) {
            try {
              console.log(`[SettingsContext] 📤 Approving photo for team: ${p.teamName} (${p.deviceId})`);
              const approvalResult = await (window as any).api.network.approveTeam({
                deviceId: p.deviceId,
                teamName: p.teamName,
                isPhotoApproval: true
              });
              console.log(`[SettingsContext] ✅ Auto-approved photo for team: ${p.teamName}`, approvalResult);
            } catch (err) {
              console.error(`[SettingsContext] ❌ Failed to auto-approve photo for ${p.teamName}:`, err);
            }
          }

          console.log(`[SettingsContext] ✅ All ${pendingPhotos.length} pending photos auto-approval attempts completed`);

          // STEP 2C: Fetch updated player data and broadcast photo updates to QuizHost
          try {
            const updatedPlayersResult = await (window as any).api.ipc.invoke('network/all-players');
            const updatedPlayers = Array.isArray(updatedPlayersResult)
              ? updatedPlayersResult
              : updatedPlayersResult?.data || [];

            // Import broadcastMessage to notify QuizHost
            const { broadcastMessage } = await import('../network/wsHost');
            const { ensureFileUrl } = await import('./photoUrlConverter');

            // Broadcast PHOTO_APPROVAL_UPDATED for each approved photo
            pendingPhotos.forEach((originalPlayer: any) => {
              const updatedPlayer = updatedPlayers.find(p => p.deviceId === originalPlayer.deviceId);
              if (updatedPlayer?.teamPhoto && updatedPlayer?.photoApprovedAt) {
                const photoUrl = ensureFileUrl(updatedPlayer.teamPhoto);
                broadcastMessage({
                  type: 'PHOTO_APPROVAL_UPDATED',
                  data: {
                    deviceId: updatedPlayer.deviceId,
                    teamName: updatedPlayer.teamName,
                    photoUrl: photoUrl,
                    timestamp: Date.now()
                  }
                });
                console.log(`[SettingsContext] 📢 Broadcasted PHOTO_APPROVAL_UPDATED for ${updatedPlayer.teamName}`);
              }
            });
          } catch (err) {
            console.error('[SettingsContext] ❌ Failed to broadcast photo updates:', err);
          }
        }
      } catch (err) {
        console.error('[SettingsContext] ❌ Error in auto-approval flow:', err);
      }
    }
  };

  const updateGoWideEnabled = (enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !goWideEnabled;
    setGoWideEnabled(newValue);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, goWideEnabled: newValue };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateEvilModeEnabled = (enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !evilModeEnabled;
    setEvilModeEnabled(newValue);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, evilModeEnabled: newValue };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateStaggeredEnabled = (enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !staggeredEnabled;
    setStaggeredEnabled(newValue);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, staggeredEnabled: newValue };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updatePunishmentEnabled = (enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !punishmentEnabled;
    setPunishmentEnabled(newValue);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, punishmentEnabled: newValue };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateOneGuessPerTeam = (enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !oneGuessPerTeam;
    setOneGuessPerTeam(newValue);
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, oneGuessPerTeam: newValue };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateVoiceCountdown = (enabled: boolean) => {
    setVoiceCountdown(enabled);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, voiceCountdown: enabled };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateHideQuizPackAnswers = (enabled: boolean) => {
    setHideQuizPackAnswers(enabled);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, hideQuizPackAnswers: enabled };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateBuzzerFolderPath = (path: string | null) => {
    setBuzzerFolderPath(path);
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, buzzerFolderPath: path };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateMusicRoundSetting = (key: string, value: any, setter: (v: any) => void) => {
    setter(value);
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, [key]: value };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const updateMusicRoundDefaultClipLength = (length: number) => updateMusicRoundSetting('musicRoundDefaultClipLength', length, setMusicRoundDefaultClipLength);
  const updateMusicRoundDefaultPoints = (points: number) => updateMusicRoundSetting('musicRoundDefaultPoints', points, setMusicRoundDefaultPoints);
  const updateMusicRoundDefaultSpeedBonus = (bonus: number) => updateMusicRoundSetting('musicRoundDefaultSpeedBonus', bonus, setMusicRoundDefaultSpeedBonus);
  const updateMusicRoundDefaultVolume = (volume: number) => updateMusicRoundSetting('musicRoundDefaultVolume', volume, setMusicRoundDefaultVolume);
  const updateMusicRoundElimination = (enabled: boolean) => updateMusicRoundSetting('musicRoundElimination', enabled, setMusicRoundElimination);
  const updateMusicRoundReversed = (enabled: boolean) => updateMusicRoundSetting('musicRoundReversed', enabled, setMusicRoundReversed);

  return (
    <SettingsContext.Provider
      value={{
        version,
        defaultPoints,
        defaultSpeedBonus,
        gameModePoints,
        gameModeTimers,
        nearestWinsTimer,
        keypadDesign,
        responseTimesEnabled,
        teamPhotosAutoApprove,
        goWideEnabled,
        evilModeEnabled,
        staggeredEnabled,
        punishmentEnabled,
        oneGuessPerTeam,
        voiceCountdown,
        hideQuizPackAnswers,
        buzzerFolderPath,
        musicRoundDefaultClipLength,
        musicRoundDefaultPoints,
        musicRoundDefaultSpeedBonus,
        musicRoundDefaultVolume,
        musicRoundElimination,
        musicRoundReversed,
        updateDefaultScores,
        updateGameModePoints,
        updateGameModeTimer,
        updateNearestWinsTimer,
        updateKeypadDesign,
        updateResponseTimesEnabled,
        updateTeamPhotosAutoApprove,
        updateGoWideEnabled,
        updateEvilModeEnabled,
        updateStaggeredEnabled,
        updatePunishmentEnabled,
        updateOneGuessPerTeam,
        updateVoiceCountdown,
        updateHideQuizPackAnswers,
        updateBuzzerFolderPath,
        updateMusicRoundDefaultClipLength,
        updateMusicRoundDefaultPoints,
        updateMusicRoundDefaultSpeedBonus,
        updateMusicRoundDefaultVolume,
        updateMusicRoundElimination,
        updateMusicRoundReversed,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
