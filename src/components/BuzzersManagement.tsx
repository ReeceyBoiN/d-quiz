import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Play, Volume2, Users, Folder, AlertCircle } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useHostInfo } from "../hooks/useHostInfo";
import { getBuzzersList, getBuzzerUrl, getBuzzerFilePath } from "../utils/api";

interface Team {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  buzzerSound?: string;
  photoUrl?: string;
  backgroundColor?: string;
}

interface BuzzersManagementProps {
  teams: Team[];
  onBuzzerChange: (teamId: string, buzzerSound: string) => void;
  onClose: () => void;
  onShowTeamOnDisplay?: (teamName: string) => void;
}

export function BuzzersManagement({ teams, onBuzzerChange, onClose, onShowTeamOnDisplay }: BuzzersManagementProps) {
  const [playingBuzzer, setPlayingBuzzer] = useState<string | null>(null);
  const [welcomeMode, setWelcomeMode] = useState(false);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [buzzerSounds, setBuzzerSounds] = useState<string[]>([]);
  const [isSelectingBuzzerFolder, setIsSelectingBuzzerFolder] = useState(false);
  const [buzzerFolderError, setBuzzerFolderError] = useState<string | null>(null);
  const [defaultBuzzerPath, setDefaultBuzzerPath] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const { hostInfo, isLoading: loadingHostInfo } = useHostInfo();
  const { buzzerFolderPath, updateBuzzerFolderPath } = useSettings();

  const loadingBuzzers = loadingHostInfo || buzzerSounds.length === 0;

  // Helper function to normalize buzzer name (remove .mp3 extension)
  const getNormalizedBuzzerName = (filename: string): string => {
    if (!filename) return '';
    return filename.replace(/\.mp3$/i, '');
  };

  // Load default buzzer path on component mount
  useEffect(() => {
    const loadDefaultBuzzerPath = async () => {
      try {
        console.log('[BuzzersManagement] Loading default buzzer path...');
        const result = await window.api?.files.getDefaultBuzzerPath();
        if (result?.path) {
          console.log('[BuzzersManagement] ✅ Default buzzer path loaded:', result.path);
          setDefaultBuzzerPath(result.path);
        } else {
          console.warn('[BuzzersManagement] getDefaultBuzzerPath returned no path:', result);
          // Set to empty string to stop showing "Loading..." text
          setDefaultBuzzerPath('');
        }
      } catch (error) {
        console.error('[BuzzersManagement] Error loading default buzzer path:', error);
        // Set to empty string to stop showing "Loading..." text
        setDefaultBuzzerPath('');
      }
    };
    loadDefaultBuzzerPath();
  }, []);

  // Load buzzer sounds from API
  useEffect(() => {
    const loadBuzzers = async () => {
      if (!hostInfo) {
        console.log('[BuzzersManagement] Waiting for host info...');
        return;
      }

      try {
        console.log('[BuzzersManagement] Loading buzzers from API...');
        const buzzers = await getBuzzersList(hostInfo);
        console.log('[BuzzersManagement] Loaded buzzers:', buzzers);
        setBuzzerSounds(buzzers);
      } catch (error) {
        console.error('[BuzzersManagement] Error loading buzzer list:', error);
        setBuzzerSounds([]);
      }
    };

    loadBuzzers();
  }, [hostInfo]);

  // Function to handle next team welcome
  const handleNextTeam = () => {
    if (currentTeamIndex < teams.length) {
      const team = teams[currentTeamIndex];
      
      // Play the team's buzzer sound
      playBuzzerSound(team.id, team.buzzerSound);
      
      // Show team name on external display
      onShowTeamOnDisplay?.(team.name);
      
      // Move to next team
      setCurrentTeamIndex(prev => prev + 1);
    }
  };

  // Function to reset welcome mode
  const resetWelcomeMode = () => {
    setWelcomeMode(false);
    setCurrentTeamIndex(0);
  };

  // Function to play buzzer sound - tries IPC file path first, falls back to HTTP
  const playBuzzerSound = async (teamId: string, buzzerSound?: string) => {
    if (!buzzerSound) return;

    setPlayingBuzzer(teamId);

    try {
      let audioUrl: string | null = null;

      // Try to get file:// URL via IPC first (more efficient and avoids CSP issues)
      try {
        console.log('[BuzzersManagement] Attempting to load buzzer via IPC:', buzzerSound);
        audioUrl = await getBuzzerFilePath(buzzerSound);
        console.log('[BuzzersManagement] Successfully got file URL via IPC:', audioUrl);
      } catch (ipcError) {
        console.warn('[BuzzersManagement] IPC file path failed, falling back to HTTP:', (ipcError as Error).message);

        // Fallback to HTTP URL if IPC fails
        if (hostInfo) {
          audioUrl = getBuzzerUrl(hostInfo, buzzerSound);
          console.log('[BuzzersManagement] Using HTTP fallback URL:', audioUrl);
        }
      }

      if (!audioUrl) {
        throw new Error('No valid audio URL available');
      }

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play().catch((error) => {
          console.error('[BuzzersManagement] Error playing buzzer:', error);
        });
      }
    } catch (error) {
      console.error('[BuzzersManagement] Error in playBuzzerSound:', error);
      setPlayingBuzzer(null);
    }
  };

  const handleSelectBuzzerFolder = async () => {
    try {
      setIsSelectingBuzzerFolder(true);
      setBuzzerFolderError(null);

      // Call the IPC handler to open folder selection dialog
      const result = await window.api?.ipc.invoke('buzzer/select-folder');

      if (result?.ok && result.data?.selectedPath) {
        const newPath = result.data.selectedPath;
        console.log('[BuzzersManagement] Buzzer folder selected:', newPath);

        // Show confirmation dialog about clearing selections
        const confirmed = window.confirm(
          'Changing the buzzer folder will clear all team buzzer selections. Players will need to re-select their buzzers. Continue?'
        );

        if (confirmed) {
          try {
            // Update the settings context
            updateBuzzerFolderPath(newPath);
            console.log('[BuzzersManagement] Updated settings context with new folder path');

            // Notify the backend about the folder change
            try {
              const ipcResult = await window.api?.ipc.invoke('buzzer/update-folder-path', { folderPath: newPath });
              if (ipcResult?.ok) {
                console.log('[BuzzersManagement] ✅ Backend successfully notified of folder change');
              } else {
                console.warn('[BuzzersManagement] ⚠️ Backend notification returned non-ok status:', ipcResult?.error);
                setBuzzerFolderError('Warning: Folder saved locally but backend notification may have failed');
              }
            } catch (ipcError: any) {
              console.error('[BuzzersManagement] Error notifying backend of folder change:', ipcError);
              setBuzzerFolderError('Failed to notify players: ' + (ipcError.message || 'Unknown error'));
              // Continue anyway - folder was saved locally
            }

            // Reload buzzer list for the new folder
            if (hostInfo) {
              console.log('[BuzzersManagement] Reloading buzzer list for new folder...');
              const buzzers = await getBuzzersList(hostInfo);
              setBuzzerSounds(buzzers);
              console.log('[BuzzersManagement] ✅ Buzzer list reloaded with new folder:', buzzers);

              if (!buzzers || buzzers.length === 0) {
                console.warn('[BuzzersManagement] ⚠️ Selected folder has no buzzer files');
                setBuzzerFolderError('Warning: Selected folder contains no buzzer sound files. Using default folder instead.');
              }
            }

            console.log('[BuzzersManagement] ✅ Buzzer folder change complete');
          } catch (processError: any) {
            console.error('[BuzzersManagement] Error during folder change process:', processError);
            setBuzzerFolderError('Error: ' + (processError.message || 'Unknown error'));
          }
        } else {
          // User cancelled the confirmation dialog
          console.log('[BuzzersManagement] User cancelled buzzer folder change confirmation');
        }
      } else if (result?.data?.selectedPath === null) {
        // User cancelled the dialog
        console.log('[BuzzersManagement] User cancelled folder selection');
      } else {
        throw new Error(result?.error || 'Failed to select folder');
      }
    } catch (error: any) {
      console.error('[BuzzersManagement] Error in handleSelectBuzzerFolder:', error);
      setBuzzerFolderError(error.message || 'Failed to select folder');
    } finally {
      setIsSelectingBuzzerFolder(false);
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] w-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Buzzer Management</h1>
              <p className="text-sm text-muted-foreground">
                Test and configure buzzer sounds for each team
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            Close
          </Button>
        </div>
      </div>

      {/* Buzzer Folder Section */}
      <div className="border-b border-border bg-card/50 flex-shrink-0">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Buzzer Folder:</div>
                {buzzerFolderPath ? (
                  <p className="text-sm text-foreground truncate">{buzzerFolderPath}</p>
                ) : defaultBuzzerPath ? (
                  <p className="text-sm text-muted-foreground truncate">{defaultBuzzerPath}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No buzzer folder selected</p>
                )}
              </div>
            </div>
            <Button
              onClick={handleSelectBuzzerFolder}
              disabled={isSelectingBuzzerFolder}
              variant="outline"
              size="sm"
              className="ml-4 flex-shrink-0"
            >
              {isSelectingBuzzerFolder ? 'Selecting...' : 'Change Folder'}
            </Button>
          </div>
          {buzzerFolderError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {buzzerFolderError}
            </div>
          )}
        </div>
      </div>

      {/* Welcome Mode Controls */}
      <div className="border-b border-border bg-card/50 flex-shrink-0">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!welcomeMode ? (
                <Button
                  onClick={() => setWelcomeMode(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Welcome
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    Welcome Mode Active ({currentTeamIndex}/{teams.length} teams introduced)
                  </div>
                  <Button
                    onClick={handleNextTeam}
                    disabled={currentTeamIndex >= teams.length}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    {currentTeamIndex >= teams.length ? "All Teams Introduced" :
                     currentTeamIndex < teams.length ? `Next Team: ${teams[currentTeamIndex]?.name}` : "Next Team"}
                  </Button>
                  <Button
                    onClick={resetWelcomeMode}
                    variant="outline"
                    size="sm"
                  >
                    End Welcome
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="flex-1 overflow-y-auto min-h-0 mb-16">
        {teams.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-lg text-muted-foreground">No teams available</p>
              <p className="text-sm text-muted-foreground mt-1">Add teams to configure their buzzers</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border pb-8">
            {teams.map((team, index) => (
              <div
                key={team.id}
                className="px-6 py-3 hover:bg-accent/50 transition-colors flex items-center gap-4"
              >
                {/* Team Photo */}
                <div className="flex-shrink-0">
                  {team.photoUrl ? (
                    <img
                      src={team.photoUrl}
                      alt={team.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-border"
                      onLoad={() => {
                        console.log('[BuzzersManagement] ✅ Successfully loaded team photo:', team.photoUrl);
                      }}
                      onError={(e) => {
                        console.error('[BuzzersManagement] ❌ Failed to load team photo:', team.photoUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <span
                        className="text-xl"
                        style={{
                          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
                        }}
                      >
                        {(() => {
                          const icon = team.icon || '👤';
                          const corrections: {[k: string]: string} = {'â­': '⭐', 'ðŸŽª': '🎪', 'ðŸŽ‰': '🎉', 'ðŸ†': '🏆', 'ðŸ\'«': '👫', 'ðŸŽŠ': '🎊', 'ï¿½ï¿½ï¿½ï¿½': '🎸', 'ðŸŽ¯': '🎯', 'âœ¨': '✨'};
                          return corrections[icon] || icon;
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Team Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {team.name}
                  </h3>
                </div>

                {/* Buzzer Sound Selector */}
                <div className="w-56">
                  <Select
                    value={team.buzzerSound || ""}
                    onValueChange={(value) => onBuzzerChange(team.id, value)}
                    disabled={loadingBuzzers}
                  >
                    <SelectTrigger
                      className="w-full h-9"
                      style={{
                        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
                      }}
                    >
                      <SelectValue
                        placeholder={loadingBuzzers ? "Loading..." : "Select buzzer sound"}
                      />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
                      }}
                    >
                      {buzzerSounds.map((sound) => {
                        const isSelected = team.buzzerSound === sound;
                        const normalizedName = getNormalizedBuzzerName(sound);

                        return (
                          <SelectItem
                            key={sound}
                            value={sound}
                            style={{
                              fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
                            }}
                          >
                            <span>
                              {isSelected && <span className="text-green-500">✓ </span>}
                              {normalizedName}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Play Button */}
                <Button
                  onClick={() => playBuzzerSound(team.id, team.buzzerSound)}
                  disabled={playingBuzzer === team.id || !team.buzzerSound || loadingBuzzers}
                  variant="default"
                  size="sm"
                  className="w-32"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {playingBuzzer === team.id ? "Playing..." : "Play Buzzer"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden audio element for buzzer playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingBuzzer(null)}
        className="hidden"
      />
    </div>
  );
}
