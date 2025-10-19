import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Hash, Zap, Target, ArrowUp, ArrowDown } from "lucide-react";

interface GlobalGameModeSelectorProps {
  onKeypadClick: () => void;
  onBuzzInClick: () => void;
  onWheelSpinnerClick: () => void;
  onNearestWinsClick: () => void;
  className?: string;
}

export function GlobalGameModeSelector({ 
  onKeypadClick, 
  onBuzzInClick, 
  onWheelSpinnerClick, 
  onNearestWinsClick,
  className = ""
}: GlobalGameModeSelectorProps) {
  return (
    <div className={`space-y-4 p-3 ${className}`}>
      {/* On The Spot Section */}
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
            onClick={onBuzzInClick}
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
    </div>
  );
}