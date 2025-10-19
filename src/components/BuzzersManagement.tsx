import React, { useState } from "react";
import { Button } from "./ui/button";
import { Play, Volume2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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

const buzzerSounds = [
  { value: "classic", label: "🔔 Classic Buzzer" },
  { value: "ding", label: "🎵 Ding" },
  { value: "horn", label: "📯 Horn" },
  { value: "bell", label: "🔔 Bell" },
  { value: "chime", label: "🎐 Chime" },
  { value: "gong", label: "🔨 Gong" },
  { value: "whistle", label: "🎵 Whistle" },
  { value: "beep", label: "📢 Beep" },
];

export function BuzzersManagement({ teams, onBuzzerChange, onClose, onShowTeamOnDisplay }: BuzzersManagementProps) {
  const [playingBuzzer, setPlayingBuzzer] = useState<string | null>(null);
  const [welcomeMode, setWelcomeMode] = useState(false);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);

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

  // Function to play buzzer sound
  const playBuzzerSound = (teamId: string, buzzerSound?: string) => {
    setPlayingBuzzer(teamId);
    
    // Get the buzzer sound type (default to classic if not set)
    const soundType = buzzerSound || "classic";
    
    // Create audio context for playing buzzer sounds
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported');
        setTimeout(() => setPlayingBuzzer(null), 1000);
        return;
      }
      
      const audioContext = new AudioContextClass();
      
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies and patterns for different buzzer sounds
      let duration = 0.3;
      
      switch (soundType) {
        case "classic":
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
          duration = 0.3;
          break;
        case "ding":
          oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.2);
          duration = 0.4;
          break;
        case "horn":
          oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
          duration = 0.5;
          break;
        case "bell":
          oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
          duration = 0.6;
          break;
        case "chime":
          oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.4);
          duration = 0.7;
          break;
        case "gong":
          oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
          duration = 1.0;
          break;
        case "whistle":
          oscillator.frequency.setValueAtTime(3000, audioContext.currentTime);
          duration = 0.3;
          break;
        case "beep":
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          duration = 0.2;
          break;
        default:
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      }
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      
      setTimeout(() => {
        try {
          oscillator.disconnect();
          gainNode.disconnect();
          audioContext.close();
          setPlayingBuzzer(null);
        } catch (error) {
          console.warn('Error during audio cleanup:', error);
          setPlayingBuzzer(null);
        }
      }, duration * 1000 + 100);
      
    } catch (error) {
      console.warn('Could not play buzzer sound:', error);
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
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <span className="text-xl">{team.icon || "👤"}</span>
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
                    value={team.buzzerSound || "classic"}
                    onValueChange={(value) => onBuzzerChange(team.id, value)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select buzzer sound" />
                    </SelectTrigger>
                    <SelectContent>
                      {buzzerSounds.map((sound) => (
                        <SelectItem key={sound.value} value={sound.value}>
                          {sound.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Play Button */}
                <Button
                  onClick={() => playBuzzerSound(team.id, team.buzzerSound)}
                  disabled={playingBuzzer === team.id}
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
    </div>
  );
}
