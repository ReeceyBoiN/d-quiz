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

type CountdownStyle = "circular" | "digital" | "pulsing" | "progress-bar" | "matrix" | "liquid" | "gradient";
type KeypadDesign = "neon-glow" | "gaming-beast" | "matrix-green" | "bubble-pop" | "ocean-wave" | "cyber-chrome" | "fire-storm" | "cosmic-space";

interface SettingsContextType {
  version: string;
  defaultPoints: number;
  defaultSpeedBonus: number;
  gameModePoints: GameModePoints;
  gameModeTimers: GameModeTimers;
  nearestWinsTimer: number;
  countdownStyle: CountdownStyle;
  keypadDesign: KeypadDesign;
  responseTimesEnabled: boolean;
  teamPhotosAutoApprove: boolean;
  goWideEnabled: boolean;
  evilModeEnabled: boolean;
  staggeredEnabled: boolean;
  punishmentEnabled: boolean;
  voiceCountdown: boolean;
  hideQuizPackAnswers: boolean;
  buzzerFolderPath: string | null;
  updateDefaultScores: (points: number, speedBonus: number) => void;
  updateGameModePoints: (gameMode: keyof GameModePoints, points: number) => void;
  updateGameModeTimer: (gameMode: keyof GameModeTimers, timer: number) => void;
  updateNearestWinsTimer: (timer: number) => void;
  updateCountdownStyle: (style: CountdownStyle) => void;
  updateKeypadDesign: (design: KeypadDesign) => void;
  updateResponseTimesEnabled: (enabled: boolean) => void;
  updateTeamPhotosAutoApprove: (enabled: boolean) => void;
  updateGoWideEnabled: (enabled?: boolean) => void;
  updateEvilModeEnabled: (enabled?: boolean) => void;
  updateStaggeredEnabled: (enabled?: boolean) => void;
  updatePunishmentEnabled: (enabled?: boolean) => void;
  updateVoiceCountdown: (enabled: boolean) => void;
  updateHideQuizPackAnswers: (enabled: boolean) => void;
  updateBuzzerFolderPath: (path: string | null) => void;
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
  
  const [defaultPoints, setDefaultPoints] = useState(4);
  const [defaultSpeedBonus, setDefaultSpeedBonus] = useState(2);
  const [gameModePoints, setGameModePoints] = useState<GameModePoints>({
    keypad: 4,
    buzzin: 4,
    nearestwins: 4,
    wheelspinner: 4
  });
  const [gameModeTimers, setGameModeTimers] = useState<GameModeTimers>({
    keypad: 30,
    buzzin: 30,
    nearestwins: 10
  });
  const [nearestWinsTimer, setNearestWinsTimer] = useState(10);
  const [countdownStyle, setCountdownStyle] = useState<CountdownStyle>("circular");
  const [keypadDesign, setKeypadDesign] = useState<KeypadDesign>("neon-glow"); // Default to Neon Glow
  const [responseTimesEnabled, setResponseTimesEnabled] = useState(true); // Default to true for testing
  const [teamPhotosAutoApprove, setTeamPhotosAutoApprove] = useState(false);
  const [goWideEnabled, setGoWideEnabled] = useState(false);
  const [evilModeEnabled, setEvilModeEnabled] = useState(false);
  const [staggeredEnabled, setStaggeredEnabled] = useState(false);
  const [punishmentEnabled, setPunishmentEnabled] = useState(false);
  const [voiceCountdown, setVoiceCountdown] = useState(true);
  const [hideQuizPackAnswers, setHideQuizPackAnswers] = useState(false);
  const [buzzerFolderPath, setBuzzerFolderPath] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('quizHostSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
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
        
        setDefaultPoints(parsed.defaultPoints !== undefined ? parsed.defaultPoints : 4);
        setDefaultSpeedBonus(parsed.defaultSpeedBonus !== undefined ? parsed.defaultSpeedBonus : 2);
        setGameModePoints(newGameModePoints);
        setGameModeTimers(newGameModeTimers);
        setNearestWinsTimer(parsed.nearestWinsTimer || 10);
        setCountdownStyle(parsed.countdownStyle || "circular");
        setKeypadDesign(parsed.keypadDesign || "neon-glow");
        setResponseTimesEnabled(parsed.responseTimesEnabled !== undefined ? parsed.responseTimesEnabled : true);
        setTeamPhotosAutoApprove(parsed.teamPhotosAutoApprove || false);
        setGoWideEnabled(parsed.goWideEnabled || false);
        setEvilModeEnabled(parsed.evilModeEnabled || false);
        setStaggeredEnabled(parsed.staggeredEnabled || false);
        setPunishmentEnabled(parsed.punishmentEnabled || false);
        setVoiceCountdown(parsed.voiceCountdown !== undefined ? parsed.voiceCountdown : true);
        setHideQuizPackAnswers(parsed.hideQuizPackAnswers || false);
        setBuzzerFolderPath(parsed.buzzerFolderPath || null);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

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
          const newCountdownStyle = parsed.countdownStyle || "circular";
          if (newCountdownStyle !== countdownStyle) {
            console.log('SettingsContext: Countdown style changed from', countdownStyle, 'to', newCountdownStyle);
            setCountdownStyle(newCountdownStyle);
          }
          setKeypadDesign(parsed.keypadDesign || "neon-glow");
          setResponseTimesEnabled(parsed.responseTimesEnabled !== undefined ? parsed.responseTimesEnabled : true);
          setTeamPhotosAutoApprove(parsed.teamPhotosAutoApprove || false);
          setGoWideEnabled(parsed.goWideEnabled || false);
          setEvilModeEnabled(parsed.evilModeEnabled || false);
          setStaggeredEnabled(parsed.staggeredEnabled || false);
          setPunishmentEnabled(parsed.punishmentEnabled || false);
          setVoiceCountdown(parsed.voiceCountdown !== undefined ? parsed.voiceCountdown : true);
          setHideQuizPackAnswers(parsed.hideQuizPackAnswers || false);
          setBuzzerFolderPath(parsed.buzzerFolderPath || null);
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

  const updateCountdownStyle = (style: CountdownStyle) => {
    console.log('SettingsContext: Updating countdown style to', style);
    setCountdownStyle(style);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, countdownStyle: style };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
    
    // Force a re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('countdownStyleChanged', { detail: style }));
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

  const updateTeamPhotosAutoApprove = (enabled: boolean) => {
    setTeamPhotosAutoApprove(enabled);
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, teamPhotosAutoApprove: enabled };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
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
    // Save to localStorage and trigger event
    const currentSettings = JSON.parse(localStorage.getItem('quizHostSettings') || '{}');
    const updatedSettings = { ...currentSettings, buzzerFolderPath: path };
    localStorage.setItem('quizHostSettings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  return (
    <SettingsContext.Provider
      value={{
        version,
        defaultPoints,
        defaultSpeedBonus,
        gameModePoints,
        gameModeTimers,
        nearestWinsTimer,
        countdownStyle,
        keypadDesign,
        responseTimesEnabled,
        teamPhotosAutoApprove,
        goWideEnabled,
        evilModeEnabled,
        staggeredEnabled,
        punishmentEnabled,
        voiceCountdown,
        hideQuizPackAnswers,
        buzzerFolderPath,
        updateDefaultScores,
        updateGameModePoints,
        updateGameModeTimer,
        updateNearestWinsTimer,
        updateCountdownStyle,
        updateKeypadDesign,
        updateResponseTimesEnabled,
        updateTeamPhotosAutoApprove,
        updateGoWideEnabled,
        updateEvilModeEnabled,
        updateStaggeredEnabled,
        updatePunishmentEnabled,
        updateVoiceCountdown,
        updateHideQuizPackAnswers,
        updateBuzzerFolderPath,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
