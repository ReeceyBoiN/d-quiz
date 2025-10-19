import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Grid3X3, Star, Zap } from "lucide-react";
import { Slider } from "./ui/slider";

interface GoWideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoWideModal({ isOpen, onClose }: GoWideModalProps) {
  const [maxAnswers, setMaxAnswers] = useState([3]);
  const [pointsPerAnswer, setPointsPerAnswer] = useState([2]);
  const [penaltyPoints, setPenaltyPoints] = useState([1]);

  const handleStartRound = () => {
    // Handle start round logic here
    console.log("Starting Go Wide round with:", { maxAnswers, pointsPerAnswer, penaltyPoints });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-[#34495e] border-[#4a5568] text-[#ecf0f1]">
        <DialogHeader className="bg-[#7f8c8d] text-white px-6 py-4 -mx-6 -mt-6 mb-6">
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Go Wide</span>
            <span className="text-sm font-normal">Multiple Answer Mode | Strategic Gameplay</span>
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Configure Go Wide mode settings for multiple answer submission gameplay.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8">
          {/* Settings Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Settings</h3>
            
            {/* Max Answers */}
            <Card className="bg-[#2c3e50] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#7f8c8d] p-4 rounded-lg mb-4">
                    <Grid3X3 className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{maxAnswers[0]}</div>
                  <h4 className="font-semibold mb-2">Max Answers</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Maximum number of answers each team can submit.
                  </p>
                  <Slider
                    value={maxAnswers}
                    onValueChange={setMaxAnswers}
                    max={6}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Points Per Answer */}
            <Card className="bg-[#2c3e50] border-[#4a5568]">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#27ae60] p-4 rounded-lg mb-4">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{pointsPerAnswer[0]}</div>
                  <h4 className="font-semibold mb-2">Points Per Answer</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Points awarded for each correct answer submitted.
                  </p>
                  <Slider
                    value={pointsPerAnswer}
                    onValueChange={setPointsPerAnswer}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Strategy Section */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Strategy</h3>
            
            {/* Penalty Points */}
            <Card className="bg-[#2c3e50] border-[#4a5568] mb-4">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#e74c3c] p-4 rounded-lg mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">{penaltyPoints[0]}</div>
                  <h4 className="font-semibold mb-2">Penalty Points</h4>
                  <p className="text-sm text-[#95a5a6] mb-4">
                    Points deducted for each incorrect answer submitted.
                  </p>
                  <Slider
                    value={penaltyPoints}
                    onValueChange={setPenaltyPoints}
                    max={5}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Game Rules */}
            <Card className="bg-[#2c3e50] border-[#4a5568]">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-3 text-center">How Go Wide Works</h4>
                <div className="space-y-2 text-sm text-[#95a5a6]">
                  <p>• Teams can submit multiple answers</p>
                  <p>• Each correct answer earns points</p>
                  <p>• Incorrect answers may have penalties</p>
                  <p>• Strategic risk vs reward gameplay</p>
                  <p>• Higher engagement and excitement</p>
                </div>
              </CardContent>
            </Card>
          </div>
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