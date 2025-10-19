import { useState, useEffect } from "react";
import { Check, X, Award, Users, Brain, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Slider } from "./ui/slider";
import { BuzzInDisplay } from "./BuzzInDisplay";
import { useSettings } from "../utils/SettingsContext";

type BuzzInMode = "points" | "classic" | "advanced";

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  scrambled?: boolean;
}

interface BuzzInInterfaceProps {
  quizzes: Quiz[];
  onClose: () => void;
  onAwardPoints?: (correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string) => void;
  onEndRound?: () => void;
}

export function BuzzInInterface({ quizzes, onClose, onAwardPoints, onEndRound }: BuzzInInterfaceProps) {
  const { defaultPoints, defaultSpeedBonus, gameModePoints, updateDefaultScores, updateGameModePoints } = useSettings();
  
  const [selectedMode, setSelectedMode] = useState<BuzzInMode>("classic");
  const [points, setPoints] = useState([gameModePoints.buzzin]);
  const [soundCheckEnabled, setSoundCheckEnabled] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

  const modes = [
    {
      id: "points" as const,
      title: "Points",
      icon: <Award className="h-12 w-12 text-white" />,
      color: "#f39c12",
      description: "Number of points awarded for each correct answer.",
      hasSlider: true
    },
    {
      id: "classic" as const,
      title: "Classic",
      icon: <Users className="h-12 w-12 text-white" />,
      color: "#f39c12",
      description: "Players buzz in and answer verbally, continuing until a correct answer is given.",
      hasSlider: false,
      hasAdvancedToggle: true
    }
  ];

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
    setGameStarted(true);
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
  const teams = quizzes.map(quiz => ({
    id: quiz.id,
    name: quiz.name,
    color: getTeamColor(quiz.id)
  }));

  // Determine actual mode to pass to BuzzInDisplay
  const actualMode = selectedMode === "classic" && advancedModeEnabled ? "advanced" : selectedMode;

  if (gameStarted) {
    return (
      <BuzzInDisplay
        mode={actualMode}
        points={points[0]}
        soundCheck={soundCheckEnabled}
        teams={teams}
        onEndRound={handleEndRound}
      />
    );
  }

  return (
    <div className="h-full bg-background p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">


        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {modes.map((mode) => (
            <Card 
              key={mode.id}
              className="border-2 border-border"
            >
              {/* Orange header section */}
              <div 
                className="h-24 flex items-center justify-center rounded-t-lg"
                style={{ backgroundColor: mode.color }}
              >
                {mode.icon}
              </div>
              
              {/* Content section */}
              <CardContent className="p-6 text-center">
                <h3 className="text-foreground text-xl font-semibold mb-3">
                  {mode.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {mode.description}
                </p>
                
                {/* Points slider for Points mode */}
                {mode.hasSlider && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-lg">
                        {points[0]} points
                      </div>
                    </div>
                    <Slider
                      value={points}
                      onValueChange={handlePointsChange}
                      max={10}
                      min={0}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                )}

                {/* Advanced mode toggle for Classic mode */}
                {mode.hasAdvancedToggle && (
                  <div className="space-y-4 mt-4 pt-4 border-t border-border">
                    {/* Game Mode Label */}
                    <div className="text-center">
                      <span className="text-sm font-semibold text-foreground">Game Mode</span>
                    </div>
                    
                    {/* Classic vs Advanced sections */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Classic section */}
                      <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <span className={`text-sm font-medium transition-colors ${!advancedModeEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                            Classic
                          </span>
                        </div>
                        {!advancedModeEnabled && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Standard buzz-in gameplay
                          </p>
                        )}
                      </div>
                      
                      {/* Vertical divider */}
                      <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-border"></div>
                        <div className="text-center space-y-2 pl-4">
                          <div className="flex items-center justify-center gap-2">
                            <Brain className="h-5 w-5 text-muted-foreground" />
                            <span className={`text-sm font-medium transition-colors ${advancedModeEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                              Advanced
                            </span>
                          </div>
                          {advancedModeEnabled && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Teams can agree/disagree with answers
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Toggle button at bottom */}
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdvancedModeEnabled(!advancedModeEnabled);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          advancedModeEnabled ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            advancedModeEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sound Check Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-semibold text-xl mb-2">Demo and Test Sounds</h3>
                <p className="text-muted-foreground">Familiarise your teams with the game sounds.</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => {}} 
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-green-500 text-white shadow-lg hover:bg-green-600"
                  size="icon"
                >
                  <Check className="h-6 w-6" />
                </Button>
                <Button
                  onClick={() => {}}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-red-500 text-white shadow-lg hover:bg-red-600"
                  size="icon"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleStartRound}
            className="flex-1 h-16 bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            START ROUND
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-16 border-border hover:bg-muted text-foreground flex items-center justify-center gap-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg text-xl font-bold"
          >
            CANCEL
          </Button>
        </div>
      </div>
    </div>
  );
}