import { useState, useEffect } from "react";
import { Check, X, Star, Skull, Zap, Flag } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { BuzzInDisplay } from "./BuzzInDisplay";
import { useSettings } from "../utils/SettingsContext";
import { playBuzzCorrectSound, playBuzzWrongSound } from "../utils/audioUtils";



interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  score?: number;
  scrambled?: boolean;
}

interface BuzzInInterfaceProps {
  quizzes?: Quiz[];
  teams?: Quiz[];
  onClose: () => void;
  onStartMode?: (mode: "points" | "classic", points: number, soundCheck: boolean) => void;
  onAwardPoints?: (correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string) => void;
  onEndRound?: () => void;
  externalWindow?: any;
  onExternalDisplayUpdate?: any;
  onEvilModePenalty?: any;
}

export function BuzzInInterface({ quizzes: quizzesProp, teams, onClose, onStartMode, onAwardPoints, onEndRound, externalWindow, onExternalDisplayUpdate, onEvilModePenalty }: BuzzInInterfaceProps) {
  const quizzes = teams || quizzesProp || [];
  const { defaultPoints, gameModePoints, updateGameModePoints, oneGuessPerTeam, updateOneGuessPerTeam, evilModeEnabled, updateEvilModeEnabled } = useSettings();

  const [points, setPoints] = useState([gameModePoints.buzzin]);
  const [soundCheckEnabled, setSoundCheckEnabled] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  // Sync local state with settings context
  useEffect(() => {
    setPoints([gameModePoints.buzzin]);
  }, [gameModePoints.buzzin]);

  const handlePointsChange = (value: number[]) => {
    if (value[0] !== points[0]) {
      setPoints(value);
      updateGameModePoints('buzzin', value[0]);
    }
  };

  const handleStartRound = () => {
    // Notify QuizHost to update flowState BEFORE broadcasting question
    onStartMode?.("points", points[0], soundCheckEnabled);

    setGameStarted(true);

    // Broadcast QUESTION message to player portal devices to ensure they show the question screen
    // instead of display modes (BASIC/SCORES/SLIDESHOW)
    try {
      (window as any).api?.ipc?.invoke('network/broadcast-question', {
        question: {
          type: 'buzzin',
          text: 'Buzz in to answer...',
          timestamp: Date.now()
        }
      }).catch((error: any) => {
        console.warn('[BuzzIn] Failed to broadcast question to players:', error);
        // This is non-critical - if players aren't connected, it's fine
      });
    } catch (err) {
      console.warn('[BuzzIn] Error calling broadcast-question IPC:', err);
    }
  };

  const handleEndRound = () => {
    setGameStarted(false);
    if (onEndRound) {
      onEndRound(); // Use the proper end round handler with sound and navigation
    } else {
      onClose(); // Fallback to just closing
    }
  };

  const getTeamColor = (teamId: string) => {
    const colors = [
      "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
      "#1abc9c", "#e67e22", "#34495e", "#f1c40f", "#95a5a6"
    ];
    const index = parseInt(teamId) - 1;
    return colors[index % colors.length];
  };

  // Convert quizzes to teams format for BuzzInDisplay
  const displayTeams = quizzes.map(quiz => ({
    id: quiz.id,
    name: quiz.name,
    color: getTeamColor(quiz.id)
  }));

  if (gameStarted) {
    return (
      <BuzzInDisplay
        mode="points"
        points={points[0]}
        soundCheck={soundCheckEnabled}
        teams={displayTeams}
        onEndRound={handleEndRound}
      />
    );
  }

  return (
    <div className="h-full bg-[#2c3e50] text-[#ecf0f1] p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Buzz-In Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-3 bg-[#f39c12] px-6 py-3 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white tracking-wide">BUZZ-IN ROUND</h2>
            <Zap className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-[#95a5a6] mt-2">Teams buzz in on their devices, then answer verbally. You judge correct or incorrect.</p>
        </div>

        {/* 2x2 Compact Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Points */}
          <div>
            <Card className="bg-[#34495e] border-[#4a5568] mb-2">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-2 rounded-lg mb-2">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{points[0]}</div>
                  <h4 className="font-semibold mb-1 text-sm">Points</h4>
                  <p className="text-xs text-[rgba(255,255,255,1)] mb-2">
                    Points awarded for each correct answer.
                  </p>
                  <Slider
                    value={points}
                    onValueChange={handlePointsChange}
                    max={10}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evil Mode */}
          <div>
            <Card
              className={`border-[#4a5568] mb-2 transition-all cursor-pointer ${
                evilModeEnabled ? 'bg-[#8b0000] border-[#8b0000]' : 'bg-[#7f8c8d]'
              }`}
              onClick={() => updateEvilModeEnabled(!evilModeEnabled)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#95a5a6] p-2 rounded-lg mb-2">
                    <Skull className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Checkbox
                      checked={evilModeEnabled}
                      onCheckedChange={updateEvilModeEnabled}
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <h4 className="font-semibold text-sm">Evil Mode</h4>
                  </div>
                  <p className="text-xs text-[#2c3e50] mb-2">
                    Evil mode takes the available points to win, away from the teams score if they answer incorectly.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* One Guess Per Team */}
          <div>
            <Card
              className={`border-[#4a5568] mb-2 transition-all cursor-pointer ${
                oneGuessPerTeam ? 'bg-[#c0392b] border-[#c0392b]' : 'bg-[#7f8c8d]'
              }`}
              onClick={() => updateOneGuessPerTeam(!oneGuessPerTeam)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#95a5a6] p-2 rounded-lg mb-2">
                    <Flag className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Checkbox
                      checked={oneGuessPerTeam}
                      onCheckedChange={updateOneGuessPerTeam}
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <h4 className="font-semibold text-sm">One Guess Per Team</h4>
                  </div>
                  <p className="text-xs text-[#2c3e50]">
                    Teams that answer incorrectly cannot buzz in again for that question.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Demo and Test Sounds */}
          <div>
            <Card className="bg-[#34495e] border-[#4a5568] mb-2">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <h4 className="font-semibold mb-1 text-sm">Demo and Test Sounds</h4>
                  <p className="text-xs text-[rgba(255,255,255,1)] mb-3">
                    Familiarise your teams with the game sounds.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={(e) => { e.stopPropagation(); playBuzzCorrectSound(); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-green-500 text-white shadow-lg hover:bg-green-600"
                      size="icon"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); playBuzzWrongSound(); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-red-500 text-white shadow-lg hover:bg-red-600"
                      size="icon"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleStartRound}
            className="flex-1 h-16 bg-[#f39c12] hover:bg-[#e67e22] text-white flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            <Zap className="h-5 w-5" />
            START ROUND
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-16 border-[#4a5568] hover:bg-[#4a5568] text-[#ecf0f1] flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            CANCEL
          </Button>
        </div>
      </div>
    </div>
  );
}
