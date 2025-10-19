import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Star, Zap, Grid3X3, Skull } from "lucide-react";
import { Slider } from "./ui/slider";

interface KeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeypadModal({ isOpen, onClose }: KeypadModalProps) {
  const [points, setPoints] = useState([4]);
  const [speedBonus, setSpeedBonus] = useState([2]);
  const [bonusType, setBonusType] = useState<"fixed" | "sliding">("fixed");

  const handleStartRound = () => {
    // Handle start round logic here
    console.log("Starting keypad round with:", { points, speedBonus, bonusType });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-[#34495e] border-[#4a5568] text-[#ecf0f1]">
        <DialogHeader className="bg-[#e74c3c] text-white px-6 py-4 -mx-6 -mt-6 mb-6">
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Keypad</span>
            <span className="text-sm font-normal">Your On the Fly round | 1 Questions</span>
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Configure keypad game mode settings including points, speed bonus, and game modes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8">
          {/* Scoring Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Scoring</h3>
            
            {/* Points */}
            <Card className="bg-[#2c3e50] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-4 rounded-lg mb-4">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{points[0]}</div>
                  <h4 className="font-semibold mb-2">Points</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Number of points awarded for each correct answer.
                  </p>
                  <Slider
                    value={points}
                    onValueChange={setPoints}
                    max={10}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Speed Bonus */}
            <Card className="bg-[#2c3e50] border-[#4a5568]">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-4 rounded-lg mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{speedBonus[0]}</div>
                  <h4 className="font-semibold mb-2">Speed Bonus</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Bonus points awarded for the fastest correct answer(s).
                  </p>
                  <Slider
                    value={speedBonus}
                    onValueChange={setSpeedBonus}
                    max={10}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Modes Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Modes</h3>
            
            {/* Go Wide */}
            <Card className="bg-[#7f8c8d] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#95a5a6] p-4 rounded-lg mb-4">
                    <Grid3X3 className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Go Wide</h4>
                  <p className="text-sm text-[#2c3e50]">
                    Players have option to submit multiple answers for reduced points.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Evil Mode */}
            <Card className="bg-[#7f8c8d] border-[#4a5568]">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#95a5a6] p-4 rounded-lg mb-4">
                    <Skull className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold mb-2">Evil Mode</h4>
                  <p className="text-sm text-[#2c3e50]">
                    Those who answer incorrectly lose points at the question value.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="flex gap-4 mt-6">
          <Button
            variant={bonusType === "fixed" ? "default" : "outline"}
            onClick={() => setBonusType("fixed")}
            className={`px-4 py-2 text-sm ${
              bonusType === "fixed"
                ? "bg-[#f39c12] hover:bg-[#e67e22] text-white" 
                : "bg-transparent border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
            }`}
          >
            FIXED
          </Button>
          <Button
            variant={bonusType === "sliding" ? "default" : "outline"}
            onClick={() => setBonusType("sliding")}
            className={`px-4 py-2 text-sm ${
              bonusType === "sliding"
                ? "bg-[#f39c12] hover:bg-[#e67e22] text-white" 
                : "bg-transparent border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
            }`}
          >
            SLIDING
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={handleStartRound}
            className="flex-1 bg-[#3498db] hover:bg-[#2980b9] text-white py-3 font-semibold"
          >
            START ROUND
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="px-8 py-3 bg-transparent border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568]"
          >
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}