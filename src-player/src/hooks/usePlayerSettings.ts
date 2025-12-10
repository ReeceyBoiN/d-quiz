import { useState, useEffect, useCallback } from 'react';

export type KeypadColor = 'cyan' | 'blue' | 'purple' | 'green' | 'orange' | 'pink';
export type Theme = 'light' | 'dark';

export interface PlayerSettings {
  teamPhoto: string | null; // Base64 encoded image
  buzzerSound: string | null; // Buzzer filename/id
  theme: Theme;
  keypadColor: KeypadColor;
}

const DEFAULT_SETTINGS: PlayerSettings = {
  teamPhoto: null,
  buzzerSound: null,
  theme: 'dark',
  keypadColor: 'blue',
};

const STORAGE_KEY = 'popquiz-player-settings';

export function usePlayerSettings() {
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
        });
      }
    } catch (error) {
      console.error('[usePlayerSettings] Error loading settings from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[usePlayerSettings] Error saving settings to localStorage:', error);
    }
  }, [settings, isLoaded]);

  const updateSetting = useCallback(<K extends keyof PlayerSettings>(
    key: K,
    value: PlayerSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const updateTeamPhoto = useCallback((photo: string | null) => {
    updateSetting('teamPhoto', photo);
  }, [updateSetting]);

  const updateBuzzerSound = useCallback((buzzer: string | null) => {
    updateSetting('buzzerSound', buzzer);
  }, [updateSetting]);

  const updateTheme = useCallback((theme: Theme) => {
    updateSetting('theme', theme);
  }, [updateSetting]);

  const updateKeypadColor = useCallback((color: KeypadColor) => {
    updateSetting('keypadColor', color);
  }, [updateSetting]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    isLoaded,
    updateSetting,
    updateTeamPhoto,
    updateBuzzerSound,
    updateTheme,
    updateKeypadColor,
    resetSettings,
  };
}
