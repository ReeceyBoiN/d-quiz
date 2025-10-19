import { useState } from "react";
import { Check, X, Award, Users, Brain } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Slider } from "./ui/slider";

type BuzzInMode = "points" | "classic" | "advanced";

interface BuzzInModalProps {
  onClose: () => void;
  onStartRound: (mode: BuzzInMode, points: number, soundCheck: boolean) => void;
}

export function BuzzInModal({ onClose, onStartRound }: BuzzInModalProps) {
  const [selectedMode, setSelectedMode] = useState<BuzzInMode>("classic");
  const [points, setPoints] = useState([4]);
  const [soundCheckEnabled, setSoundCheckEnabled] = useState(true);

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
      hasSlider: false
    },
    {
      id: "advanced" as const,
      title: "Advanced",
      icon: <Brain className="h-8 w-8 text-white opacity-60" />,
      color: "#7f8c8d",
      description: "Allows other teams to earn points by agreeing or disagreeing with the original answer given.",
      hasSlider: false
    }
  ];

  const handleStartRound = () => {
    onStartRound(selectedMode, points[0], soundCheckEnabled);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2c3e50] rounded-lg p-6 w-full max-w-4xl">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {modes.map((mode) => (
            <Card 
              key={mode.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedMode === mode.id 
                  ? 'border-blue-500 ring-2 ring-blue-500/20' 
                  : 'border-[#4a5568] hover:border-[#5a6578]'
              }`}
              onClick={() => setSelectedMode(mode.id)}
            >
              {/* Orange header section */}
              <div 
                className="h-24 flex items-center justify-center"
                style={{ backgroundColor: mode.color }}
              >
                {mode.icon}
              </div>
              
              {/* Content section */}
              <CardContent className="p-4 bg-[#34495e] text-center">
                <h3 className="text-white text-lg font-semibold mb-2">
                  {mode.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {mode.description}
                </p>
                
                {/* Points slider for Points mode */}
                {mode.hasSlider && selectedMode === mode.id && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-center">
                      <div className="bg-[#2c3e50] px-3 py-1 rounded text-white font-semibold">
                        {points[0]}
                      </div>
                    </div>
                    <Slider
                      value={points}
                      onValueChange={setPoints}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1</span>
                      <span>10</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sound Check Section */}
        <div className="mb-6">
          <div className="bg-[#34495e] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">Sound Check?</h3>
                <p className="text-gray-300 text-sm">Familiarise your teams with the game sounds.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSoundCheckEnabled(true)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    soundCheckEnabled 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                  }`}
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSoundCheckEnabled(false)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    !soundCheckEnabled 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="px-8 py-2 bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            CANCEL
          </Button>
          <Button
            onClick={handleStartRound}
            className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            START ROUND
          </Button>
        </div>
      </div>
    </div>
  );
}