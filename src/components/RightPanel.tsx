import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Hash, Zap, Target, Grid3X3, Music, ArrowUp, ArrowDown } from "lucide-react";
import { WheelSpinner } from "./WheelSpinner";
import { BuzzInModal } from "./BuzzInModal";

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  scrambled?: boolean;
}

interface RightPanelProps {
  quizzes: Quiz[];
  onKeypadClick: () => void;
  onBuzzInStart?: (mode: "points" | "classic" | "advanced", points: number, soundCheck: boolean) => void;
  onBuzzInClick?: () => void;
  onWheelSpinnerClick?: () => void;
  onNearestWinsClick?: () => void;
}

export function RightPanel({ quizzes, onKeypadClick, onBuzzInStart, onBuzzInClick, onWheelSpinnerClick, onNearestWinsClick }: RightPanelProps) {

  const [showBuzzInModal, setShowBuzzInModal] = useState(false);
  
  return (
    <div className="space-y-4 p-3">
      {/* Hosts Choice Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-1 pt-2">
          <CardTitle className="text-card-foreground text-center text-base font-semibold text-[24px]">ON THE SPOT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 -mt-5">
          <Button 
            onClick={onKeypadClick}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4"
          >
            <Hash className="h-4 w-4" />
            <span>KEYPAD</span>
            <Hash className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => onBuzzInClick ? onBuzzInClick() : setShowBuzzInModal(true)}
            className="w-full bg-[#f39c12] hover:bg-[#e67e22] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4"
          >
            <Zap className="h-4 w-4" />
            <span>BUZZ-IN</span>
            <Zap className="h-4 w-4" />
          </Button>
          <Button 
            onClick={onNearestWinsClick}
            className="w-full bg-[#27ae60] hover:bg-[#229954] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4"
          >
            <Target className="h-4 w-4" />
            <span>NEAREST WINS</span>
            <Target className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Game Modes Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-1 pt-2">
          <CardTitle className="text-card-foreground text-center text-base font-semibold text-[24px]">GAME MODES</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 -mt-5">
          <Button 
            onClick={onWheelSpinnerClick}
            className="w-full bg-[rgba(217,204,0,1)] hover:bg-[#1e8449] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4"
          >
            <ArrowUp className="h-4 w-4" />
            <span>WHEEL SPIN</span>
            <ArrowDown className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Game Modes Section - Duplicate */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-1 pt-2">
          <CardTitle className="text-card-foreground text-center text-base font-semibold text-[24px]">Coming Soon!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 -mt-5">
          <Button className="w-full bg-[rgba(60,114,231,1)] hover:bg-[rgba(45,86,173,1)] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4">
            <Grid3X3 className="h-4 w-4" />
            <span>BINGO</span>
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button className="w-full bg-[rgba(255,0,251,1)] hover:bg-[rgba(192,0,189,1)] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4">
            <Music className="h-4 w-4" />
            <span>MUSIC BINGO</span>
            <Music className="h-4 w-4" />
          </Button>
          <Button className="w-full bg-[rgba(255,127,39,1)] hover:bg-[rgba(204,85,0,1)] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md flex items-center justify-between px-4">
            <Music className="h-4 w-4" />
            <span>MUSIC ROUND</span>
            <Music className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      
      {/* Modals */}
      
      {showBuzzInModal && (
        <BuzzInModal
          onClose={() => setShowBuzzInModal(false)}
          onStartRound={(mode, points, soundCheck) => {
            setShowBuzzInModal(false);
            onBuzzInStart?.(mode, points, soundCheck);
          }}
        />
      )}
    </div>
  );
}