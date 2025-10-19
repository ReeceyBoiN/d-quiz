import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Skull, Zap, Star, AlertTriangle } from "lucide-react";
import { Slider } from "./ui/slider";

interface EvilModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EvilModeModal({ isOpen, onClose }: EvilModeModalProps) {
  const [correctPoints, setCorrectPoints] = useState([5]);
  const [penaltyPoints, setPenaltyPoints] = useState([3]);
  const [bonusMultiplier, setBonusMultiplier] = useState([2]);

  const handleStartRound = () => {
    // Handle start round logic here
    console.log("Starting Evil Mode round with:", { correctPoints, penaltyPoints, bonusMultiplier });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-[#34495e] border-[#4a5568] text-[#ecf0f1]">
        <DialogHeader className="bg-[#8b0000] text-white px-6 py-4 -mx-6 -mt-6 mb-6">
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Skull className="h-6 w-6" />
              Evil Mode
            </span>
            <span className="text-sm font-normal">High Risk, High Reward | Punishment Mode</span>
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Configure Evil Mode settings where wrong answers result in point penalties.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8">
          {/* Scoring Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Scoring</h3>
            
            {/* Correct Points */}
            <Card className="bg-[#2c3e50] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#27ae60] p-4 rounded-lg mb-4">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{correctPoints[0]}</div>
                  <h4 className="font-semibold mb-2">Correct Answer Points</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Points awarded for each correct answer.
                  </p>
                  <Slider
                    value={correctPoints}
                    onValueChange={setCorrectPoints}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Penalty Points */}
            <Card className="bg-[#2c3e50] border-[#4a5568]">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-4 rounded-lg mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">-{penaltyPoints[0]}</div>
                  <h4 className="font-semibold mb-2">Wrong Answer Penalty</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Points deducted for each incorrect answer.
                  </p>
                  <Slider
                    value={penaltyPoints}
                    onValueChange={setPenaltyPoints}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evil Features Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Evil Features</h3>
            
            {/* Bonus Multiplier */}
            <Card className="bg-[#2c3e50] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#8b0000] p-4 rounded-lg mb-4">
                    <AlertTriangle className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">x{bonusMultiplier[0]}</div>
                  <h4 className="font-semibold mb-2">Streak Multiplier</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Multiplier for consecutive correct answers.
                  </p>
                  <Slider
                    value={bonusMultiplier}
                    onValueChange={setBonusMultiplier}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Evil Rules */}
            <Card className="bg-[#2c3e50] border-[#4a5568]">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-3 text-center text-red-400">
                  ⚠️ Evil Mode Rules ⚠️
                </h4>
                <div className="space-y-2 text-sm text-[#95a5a6]">
                  <p>• Wrong answers lose points!</p>
                  <p>• No mercy for incorrect responses</p>
                  <p>• Streak bonuses for risk-takers</p>
                  <p>• High stakes gameplay</p>
                  <p>• Only the brave survive</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Warning Banner */}
        <Card className="bg-[#8b0000] border-[#dc2626] mt-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-white">
              <Skull className="h-6 w-6" />
              <div>
                <h4 className="font-semibold">Warning: Evil Mode Active</h4>
                <p className="text-sm opacity-90">Teams will lose points for wrong answers. Proceed with caution!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={handleStartRound}
            className="flex-1 bg-[#8b0000] hover:bg-[#7a0000] text-white py-3 font-semibold"
          >
            ACTIVATE EVIL MODE
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