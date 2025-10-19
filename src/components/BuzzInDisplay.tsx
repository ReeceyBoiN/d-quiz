import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Zap, Trophy, Users, Timer, CheckCircle } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { useSettings } from "../utils/SettingsContext";

type BuzzInMode = "points" | "classic" | "advanced";
type BuzzInState = "waiting" | "buzzed" | "answered" | "complete";

interface Team {
  id: string;
  name: string;
  color: string;
}

interface BuzzInDisplayProps {
  mode: BuzzInMode;
  points: number;
  soundCheck: boolean;
  teams: Team[];
  onEndRound: () => void;
}

export function BuzzInDisplay({ mode, points, soundCheck, teams, onEndRound }: BuzzInDisplayProps) {
  const { countdownStyle, gameModeTimers } = useSettings();
  const [buzzedTeam, setBuzzedTeam] = useState<Team | null>(null);
  const [state, setState] = useState<BuzzInState>("waiting");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Set<string>>(new Set());
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});

  // Mock teams if none provided
  const displayTeams = teams.length > 0 ? teams : [
    { id: "1", name: "Team Thunder", color: "#e74c3c" },
    { id: "2", name: "Quiz Masters", color: "#3498db" },
    { id: "3", name: "Brain Storm", color: "#2ecc71" },
    { id: "4", name: "Smart Cookies", color: "#f39c12" },
  ];

  // Simulate buzz-in
  const handleBuzzIn = (team: Team) => {
    if (state === "waiting") {
      setBuzzedTeam(team);
      setState("buzzed");
      setTimeRemaining(gameModeTimers.buzzin); // Use settings timer duration
    }
  };

  // Handle answer
  const handleCorrectAnswer = () => {
    if (buzzedTeam) {
      setCorrectAnswers(prev => new Set([...prev, buzzedTeam.id]));
      setTeamScores(prev => ({
        ...prev,
        [buzzedTeam.id]: (prev[buzzedTeam.id] || 0) + points
      }));
      
      if (mode === "classic") {
        setState("complete");
      } else {
        setState("waiting");
        setBuzzedTeam(null);
        setTimeRemaining(null);
      }
    }
  };

  const handleWrongAnswer = () => {
    if (mode === "classic") {
      setState("waiting");
      setBuzzedTeam(null);
      setTimeRemaining(null);
    } else {
      setState("waiting");
      setBuzzedTeam(null);
      setTimeRemaining(null);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      handleWrongAnswer();
    }
  }, [timeRemaining]);

  const getModeTitle = () => {
    switch (mode) {
      case "points": return `Points Mode (${points} pts)`;
      case "classic": return "Classic Buzz-In";
      case "advanced": return "Advanced Mode";
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case "points": return `First to buzz in gets ${points} points for correct answers`;
      case "classic": return "Players buzz in and answer verbally until someone gets it right";
      case "advanced": return "Teams can agree/disagree with answers for additional points";
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-[#2c3e50] to-[#34495e] p-6 text-white">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="h-12 w-12 text-yellow-400 animate-pulse" />
            <h1 className="text-6xl font-bold">BUZZ-IN MODE</h1>
            <Zap className="h-12 w-12 text-yellow-400 animate-pulse" />
          </div>
          <div className="bg-orange-500 text-black px-6 py-2 rounded-full inline-block font-semibold text-xl">
            {getModeTitle()}
          </div>
          <p className="text-gray-300 mt-2 text-lg">{getModeDescription()}</p>
        </div>

        {/* Current State */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {state === "waiting" && (
            <div className="text-center">
              <p className="text-2xl text-gray-300 mb-6">Waiting for teams to buzz in...</p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  className="bg-purple-600 border-purple-500 text-white hover:bg-purple-700 px-8 py-4 text-lg"
                >
                  📸 MAKE THIS A PICTURE QUESTION.
                </Button>
                <Button
                  variant="outline"
                  className="bg-green-600 border-green-500 text-white hover:bg-green-700 px-8 py-4 text-lg"
                >
                  🎵 MAKE THIS A MUSIC OR AUDIO QUESTION.
                </Button>
              </div>
            </div>
          )}

          {state === "buzzed" && buzzedTeam && (
            <div className="text-center">
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center mb-6 text-4xl font-bold border-4 border-white animate-pulse"
                style={{ backgroundColor: buzzedTeam.color }}
              >
                <Zap className="h-16 w-16 text-white" />
              </div>
              <h2 className="text-5xl font-bold mb-4" style={{ color: buzzedTeam.color }}>
                {buzzedTeam.name.toUpperCase()}
              </h2>
              <p className="text-2xl text-gray-300 mb-6">BUZZED IN!</p>
              
              {timeRemaining !== null && (
                <div className="mb-6">
                  <CountdownTimer
                    currentTime={timeRemaining}
                    totalTime={gameModeTimers.buzzin}
                    size={48}
                    showLabel={false}
                  />
                </div>
              )}
              
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleCorrectAnswer}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-2xl"
                >
                  <CheckCircle className="h-6 w-6 mr-2" />
                  CORRECT
                </Button>
                <Button
                  onClick={handleWrongAnswer}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-2xl"
                >
                  ❌ WRONG
                </Button>
              </div>
            </div>
          )}

          {state === "complete" && (
            <div className="text-center">
              <div className="text-8xl mb-8">🏆</div>
              <h2 className="text-4xl font-bold mb-4 text-green-400">ROUND COMPLETE!</h2>
              {buzzedTeam && (
                <p className="text-2xl text-gray-300 mb-6">
                  {buzzedTeam.name} got the correct answer!
                </p>
              )}
              <Button
                onClick={onEndRound}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-2xl"
              >
                END ROUND
              </Button>
            </div>
          )}
        </div>

        {/* Teams Grid */}
        <div className="mt-8">
          {/* Empty container ready for new content */}
        </div>

        {/* Controls */}
        <div className="flex justify-center mt-6">
          <Button
            onClick={onEndRound}
            variant="outline"
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 px-6 py-3"
          >
            END BUZZ-IN MODE
          </Button>
        </div>
      </div>
    </div>
  );
}