import { useState, useEffect, useRef, useContext } from 'react';
import { NetworkContext } from '../context/NetworkContext';
import { usePlayerSettings, type KeypadColor, type Theme } from '../hooks/usePlayerSettings';

const KEYPAD_COLORS: { name: KeypadColor; label: string; bgClass: string }[] = [
  { name: 'cyan', label: 'Cyan', bgClass: 'bg-cyan-500' },
  { name: 'blue', label: 'Blue', bgClass: 'bg-blue-500' },
  { name: 'purple', label: 'Purple', bgClass: 'bg-purple-500' },
  { name: 'green', label: 'Green', bgClass: 'bg-green-500' },
  { name: 'orange', label: 'Orange', bgClass: 'bg-orange-500' },
  { name: 'pink', label: 'Pink', bgClass: 'bg-pink-500' },
];

export function SettingsBar() {
  const networkContext = useContext(NetworkContext);
  const { teamName, isConnected, playerId, deviceId, sendMessage } = networkContext || { teamName: '', isConnected: false, playerId: '', deviceId: '', sendMessage: undefined };
  const {
    settings,
    isLoaded,
    updateTeamPhoto,
    updateBuzzerSound,
    updateTheme,
    updateKeypadColor,
  } = usePlayerSettings();

  const [isExpanded, setIsExpanded] = useState(false);
  const [buzzerList, setBuzzerList] = useState<string[]>([]);
  const [playingBuzzer, setPlayingBuzzer] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Load buzzer list from host API
  useEffect(() => {
    const loadBuzzers = async () => {
      try {
        console.log('[SettingsBar] Loading buzzers from API...');

        // Get host info to construct correct API URL
        const hostInfoResponse = await fetch('/api/host-info');
        const hostInfo = await hostInfoResponse.json();
        const apiUrl = `http://${hostInfo.localIP}:${hostInfo.port}/api/buzzers/list`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to load buzzers: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[SettingsBar] Loaded buzzers:', data.buzzers);
        setBuzzerList(data.buzzers || []);
      } catch (error) {
        console.error('[SettingsBar] Error loading buzzer list:', error);
        setBuzzerList([]);
      }
    };

    if (isExpanded) {
      loadBuzzers();
    }
  }, [isExpanded]);

  // Handle team photo upload
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[SettingsBar] handlePhotoUpload called');
    const file = event.target.files?.[0];
    console.log('[SettingsBar] File selected:', file?.name, file?.size, file?.type);
    if (!file) {
      console.log('[SettingsBar] No file selected, returning');
      return;
    }

    console.log('[SettingsBar] File size check:', file.size);
    // Check file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      console.error('[SettingsBar] File size exceeds 500MB limit:', file.size);
      alert('File size exceeds 500MB limit');
      return;
    }

    try {
      console.log('[SettingsBar] Creating FileReader...');
      const reader = new FileReader();

      reader.onload = (e) => {
        console.log('[SettingsBar] FileReader onload fired');
        const base64 = e.target?.result as string;
        console.log('[SettingsBar] Base64 data received, length:', base64?.length);
        console.log('[SettingsBar] Base64 prefix (first 100 chars):', base64?.substring(0, 100));
        console.log('[SettingsBar] Calling updateTeamPhoto...');
        updateTeamPhoto(base64);
        console.log('[SettingsBar] ✅ Team photo uploaded and saved');
        console.log('[SettingsBar] Current settings after upload:', {
          teamPhoto: settings.teamPhoto ? `<base64 data: ${settings.teamPhoto.length} bytes>` : null,
          buzzerSound: settings.buzzerSound,
          theme: settings.theme,
          keypadColor: settings.keypadColor,
        });

        // Send TEAM_PHOTO_UPDATE message to host if connected
        console.log('[SettingsBar] About to send TEAM_PHOTO_UPDATE - Checking conditions...');
        console.log('[SettingsBar] - isConnected:', isConnected);
        console.log('[SettingsBar] - sendMessage function exists:', !!sendMessage);
        console.log('[SettingsBar] - deviceId:', deviceId);
        console.log('[SettingsBar] - teamName:', teamName);

        if (isConnected && sendMessage && deviceId && teamName) {
          console.log('[SettingsBar] 🚀 All conditions met, constructing TEAM_PHOTO_UPDATE payload...');
          const updatePayload = {
            type: 'TEAM_PHOTO_UPDATE',
            playerId,
            deviceId,
            teamName,
            photoData: base64,
            timestamp: Date.now(),
          };
          console.log('[SettingsBar] Payload constructed successfully');
          console.log('[SettingsBar] - type:', updatePayload.type);
          console.log('[SettingsBar] - playerId:', updatePayload.playerId);
          console.log('[SettingsBar] - deviceId:', updatePayload.deviceId);
          console.log('[SettingsBar] - teamName:', updatePayload.teamName);
          console.log('[SettingsBar] - photoData length:', updatePayload.photoData.length, 'bytes');
          console.log('[SettingsBar] Calling sendMessage function...');
          console.log('[SettingsBar] NOTE: WebSocket state and bufferedAmount will be logged in sendMessage');
          sendMessage(updatePayload);
          console.log('[SettingsBar] ✅ TEAM_PHOTO_UPDATE message sent via sendMessage');
        } else {
          console.warn('[SettingsBar] ❌ Cannot send TEAM_PHOTO_UPDATE - Missing conditions:');
          console.warn('[SettingsBar] - isConnected:', isConnected);
          console.warn('[SettingsBar] - sendMessage:', !!sendMessage);
          console.warn('[SettingsBar] - deviceId:', !!deviceId);
          console.warn('[SettingsBar] - teamName:', !!teamName);
        }
      };

      reader.onerror = (error) => {
        console.error('[SettingsBar] FileReader error:', error);
        alert('Error reading file');
      };

      console.log('[SettingsBar] Calling readAsDataURL...');
      reader.readAsDataURL(file);
      console.log('[SettingsBar] readAsDataURL called successfully');
    } catch (error) {
      console.error('[SettingsBar] Error uploading photo:', error);
      alert('Error uploading photo');
    }
  };

  // Handle buzzer sound preview/play
  const handlePlayBuzzer = async (buzzerName: string) => {
    try {
      setPlayingBuzzer(buzzerName);

      // Get host info to construct correct API URL
      const hostInfoResponse = await fetch('/api/host-info');
      const hostInfo = await hostInfoResponse.json();
      const audioUrl = `http://${hostInfo.localIP}:${hostInfo.port}/api/buzzers/${buzzerName}`;

      console.log('[SettingsBar] Playing buzzer from:', audioUrl);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((error) => {
          console.error('[SettingsBar] Error playing buzzer:', error);
          alert('Error playing buzzer sound');
          setPlayingBuzzer(null);
        });
      }
    } catch (error) {
      console.error('[SettingsBar] Error in handlePlayBuzzer:', error);
      setPlayingBuzzer(null);
    }
  };

  // Handle buzzer selection - update local settings and send to host
  const handleSelectBuzzer = (buzzerName: string) => {
    updateBuzzerSound(buzzerName);
    console.log('[SettingsBar] Selected buzzer:', buzzerName);

    // Send PLAYER_BUZZER_SELECT message to host
    if (isConnected && sendMessage && deviceId && teamName) {
      console.log('[SettingsBar] Sending PLAYER_BUZZER_SELECT message...');
      const buzzerSelectPayload = {
        type: 'PLAYER_BUZZER_SELECT',
        playerId,
        deviceId,
        teamName,
        buzzerSound: buzzerName,
        timestamp: Date.now(),
      };
      console.log('[SettingsBar] Sending PLAYER_BUZZER_SELECT:', buzzerSelectPayload);
      sendMessage(buzzerSelectPayload);
    } else {
      console.warn('[SettingsBar] Cannot send PLAYER_BUZZER_SELECT - Missing conditions:');
      console.warn('[SettingsBar] - isConnected:', isConnected);
      console.warn('[SettingsBar] - sendMessage:', !!sendMessage);
      console.warn('[SettingsBar] - deviceId:', !!deviceId);
      console.warn('[SettingsBar] - teamName:', !!teamName);
    }
  };

  // Handle theme toggle
  const handleThemeToggle = () => {
    const newTheme: Theme = settings.theme === 'dark' ? 'light' : 'dark';
    updateTheme(newTheme);
    // Apply theme to document
    if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Handle keypad color selection
  const handleColorSelect = (color: KeypadColor) => {
    updateKeypadColor(color);
    console.log('[SettingsBar] Selected keypad color:', color);
  };

  if (!isConnected || !isLoaded) {
    return null;
  }

  return (
    <div ref={menuRef} className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
      {/* Collapsed View */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700 transition-colors h-16 flex items-center justify-center"
        >
          <span className="text-slate-200 font-medium text-lg">{teamName || 'Team Settings'}</span>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="bg-slate-800 border-t border-slate-700 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Team Settings</h2>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white transition-colors text-xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Team Photo Section */}
          <div className="px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-cyan-400 text-lg">📷</span>
              <h3 className="text-white font-semibold">Team Photo</h3>
            </div>
            <div className="flex items-center gap-4">
              {settings.teamPhoto && (
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
                  <img
                    src={settings.teamPhoto}
                    alt="Team"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {!settings.teamPhoto && (
                <div className="w-20 h-20 rounded-lg bg-slate-700 flex items-center justify-center">
                  <span className="text-slate-500 text-2xl">📷</span>
                </div>
              )}
              <div className="flex-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Buzzer Sound Section */}
          <div className="px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-cyan-400 text-lg">🔊</span>
              <h3 className="text-white font-semibold">Buzzer Sound</h3>
            </div>
            <div className="space-y-2">
              <div className="bg-slate-700 rounded-lg p-3 text-slate-300 text-sm">
                Current: <span className="text-cyan-400 font-semibold">{settings.buzzerSound || 'Not selected'}</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {buzzerList.map((buzzer) => (
                  <div key={buzzer} className="flex gap-2">
                    <button
                      onClick={() => handlePlayBuzzer(buzzer)}
                      disabled={playingBuzzer === buzzer}
                      className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      {playingBuzzer === buzzer ? '🔊 Playing...' : '▶ Play'}
                    </button>
                    <button
                      onClick={() => handleSelectBuzzer(buzzer)}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                        settings.buzzerSound === buzzer
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      {settings.buzzerSound === buzzer ? '✓ Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Theme Section */}
          <div className="px-6 py-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 text-lg">🌙</span>
                <h3 className="text-white font-semibold">Dark Mode</h3>
              </div>
              <button
                onClick={handleThemeToggle}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  settings.theme === 'dark' ? 'bg-cyan-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    settings.theme === 'dark' ? 'translate-x-1' : 'translate-x-7'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Keypad Color Section */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-cyan-400 text-lg">🎨</span>
              <h3 className="text-white font-semibold">Keypad Color</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {KEYPAD_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color.name)}
                  className={`p-4 rounded-lg font-semibold text-white transition-all transform ${
                    color.bgClass
                  } ${
                    settings.keypadColor === color.name
                      ? 'ring-2 ring-white scale-105'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  {color.label}
                  {settings.keypadColor === color.name && <span className="ml-1">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-700 text-slate-400 text-xs text-center">
            Settings are saved automatically
          </div>
        </div>
      )}

      {/* Hidden audio element for buzzer preview */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingBuzzer(null)}
        className="hidden"
      />
    </div>
  );
}
