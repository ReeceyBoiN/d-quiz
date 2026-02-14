import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Play, Volume2, Users } from "lucide-react";
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
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const { hostInfo, isLoading: loadingHostInfo } = useHostInfo();

  const loadingBuzzers = loadingHostInfo || buzzerSounds.length === 0;

  // Helper function to normalize buzzer name (remove .mp3 extension)
  const getNormalizedBuzzerName = (filename: string): string => {
    if (!filename) return '';
    return filename.replace(/\.mp3$/i, '');
  };

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
