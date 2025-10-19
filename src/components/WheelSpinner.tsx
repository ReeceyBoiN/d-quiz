import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Play, Square, RotateCcw, Settings, Plus, Minus, X } from 'lucide-react';

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  scrambled?: boolean;
}

interface WheelSpinnerProps {
  quizzes: Quiz[];
  onClose: () => void;
}

type WheelContentType = 'teams' | 'random-points';

interface WheelItem {
  id: string;
  label: string;
  color: string;
}

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#e67e22', '#1abc9c', '#34495e', '#f1c40f', '#e91e63',
  '#ff5722', '#607d8b', '#795548', '#ff9800', '#4caf50'
];

export function WheelSpinner({ quizzes, onClose }: WheelSpinnerProps) {
  const [contentType, setContentType] = useState<WheelContentType>('teams');
  const [wheelItems, setWheelItems] = useState<WheelItem[]>([]);
  const [customPointValues, setCustomPointValues] = useState<number[]>([50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [spinDuration, setSpinDuration] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Generate wheel items based on content type
  useEffect(() => {
    let items: WheelItem[] = [];
    
    if (contentType === 'teams') {
      items = quizzes.map((quiz, index) => ({
        id: quiz.id,
        label: quiz.name,
        color: COLORS[index % COLORS.length]
      }));
    } else if (contentType === 'random-points') {
      items = customPointValues.map((points, index) => ({
        id: `points-${points}`,
        label: `${points} pts`,
        color: COLORS[index % COLORS.length]
      }));
    }
    
    setWheelItems(items);
    setWinner(null);
  }, [contentType, quizzes, customPointValues]);

  const spinWheel = () => {
    if (isSpinning || wheelItems.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    // Random spin: 3-6 full rotations plus random position
    const fullRotations = Math.floor(Math.random() * 4) + 3; // 3-6 rotations
    const finalPosition = Math.random() * 360;
    const totalRotation = rotation + fullRotations * 360 + finalPosition;
    
    // Duration: 3-5 seconds
    const duration = Math.random() * 2000 + 3000;
    setSpinDuration(duration);
    setRotation(totalRotation);

    // Determine winner after spin completes
    setTimeout(() => {
      const normalizedRotation = totalRotation % 360;
      const itemAngle = 360 / wheelItems.length;
      // Adjust for wheel orientation (right arrow at 0 degrees, add 90 degrees offset)
      const winnerIndex = Math.floor(((360 - normalizedRotation + 90 + itemAngle / 2) % 360) / itemAngle);
      const validIndex = Math.min(winnerIndex, wheelItems.length - 1);
      
      setWinner(wheelItems[validIndex]?.label || null);
      setIsSpinning(false);
    }, duration);
  };

  const resetWheel = () => {
    if (isSpinning) return;
    setRotation(0);
    setWinner(null);
  };

  const addPointSlice = () => {
    const newValue = Math.max(...customPointValues) + 50;
    setCustomPointValues([...customPointValues, newValue]);
  };

  const removePointSlice = (index: number) => {
    if (customPointValues.length > 2) { // Minimum 2 slices
      const newValues = customPointValues.filter((_, i) => i !== index);
      setCustomPointValues(newValues);
    }
  };

  const updatePointValue = (index: number, value: number) => {
    if (value > 0) {
      const newValues = [...customPointValues];
      newValues[index] = value;
      setCustomPointValues(newValues);
    }
  };

  const renderWheelSegments = () => {
    if (wheelItems.length === 0) return null;

    const itemAngle = 360 / wheelItems.length;
    
    return wheelItems.map((item, index) => {
      const startAngle = index * itemAngle;
      const endAngle = (index + 1) * itemAngle;
      const midAngle = (startAngle + endAngle) / 2;
      
      // Create SVG path for segment
      const radius = 200;
      const centerX = 200;
      const centerY = 200;
      
      const x1 = centerX + Math.cos((startAngle - 90) * Math.PI / 180) * radius;
      const y1 = centerY + Math.sin((startAngle - 90) * Math.PI / 180) * radius;
      const x2 = centerX + Math.cos((endAngle - 90) * Math.PI / 180) * radius;
      const y2 = centerY + Math.sin((endAngle - 90) * Math.PI / 180) * radius;
      
      const largeArcFlag = itemAngle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      // Text position - move closer to edge for side placement
      const textRadius = radius * 0.85;
      const textX = centerX + Math.cos((midAngle - 90) * Math.PI / 180) * textRadius;
      const textY = centerY + Math.sin((midAngle - 90) * Math.PI / 180) * textRadius;

      return (
        <g key={item.id}>
          <path
            d={pathData}
            fill={item.color}
            stroke="#2c3e50"
            strokeWidth="2"
          />
          <text
            x={textX}
            y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="12"
            fontWeight="bold"
            transform={`rotate(${midAngle - 90}, ${textX}, ${textY})`}
          >
            {item.label}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="fixed z-40" style={{ 
      left: '345px', 
      top: '70px', 
      right: '0', 
      bottom: '64px' 
    }}>
      {/* Wheel spinner content */}
      <div className="w-full h-full bg-[#34495e] p-6 overflow-y-auto border-l-2 border-[#4a5568]">
        <div className="h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#ecf0f1] text-2xl font-semibold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Wheel Spinner
            </h2>
            <Button
              onClick={onClose}
              variant="outline"
              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white border-[#e74c3c]"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Left Configuration Panel */}
            <div className="lg:w-72 space-y-4">
              <div>
                <label className="block text-[#ecf0f1] mb-2 font-medium">
                  Wheel Content Type
                </label>
                <Select value={contentType} onValueChange={(value: WheelContentType) => setContentType(value)}>
                  <SelectTrigger className="bg-[#2c3e50] border-[#4a5568] text-[#ecf0f1] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2c3e50] border-[#4a5568]">
                    <SelectItem value="teams" className="text-[#ecf0f1] focus:bg-[#34495e]">
                      Teams ({quizzes.length} teams)
                    </SelectItem>
                    <SelectItem value="random-points" className="text-[#ecf0f1] focus:bg-[#34495e]">
                      Random Points ({customPointValues.length} slices)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Points Configuration */}
              {contentType === 'random-points' && (
                <Card className="bg-[#2c3e50] border-[#4a5568]">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[#ecf0f1] text-base">
                        Point Values
                      </CardTitle>
                      <Button
                        onClick={addPointSlice}
                        className="bg-[#27ae60] hover:bg-[#229954] text-white h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                    {customPointValues.map((value, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => updatePointValue(index, parseInt(e.target.value) || 0)}
                          className="bg-[#34495e] border-[#4a5568] text-[#ecf0f1] h-8 flex-1 text-sm"
                          min="1"
                        />
                        <Button
                          onClick={() => removePointSlice(index)}
                          disabled={customPointValues.length <= 2}
                          variant="outline"
                          className="border-[#e74c3c] text-[#e74c3c] hover:bg-[#e74c3c] hover:text-white h-8 w-8 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Control Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={spinWheel}
                  disabled={isSpinning || wheelItems.length === 0}
                  className="bg-[#27ae60] hover:bg-[#229954] text-white flex items-center justify-center gap-2 h-12"
                >
                  <Play className="h-4 w-4" />
                  {isSpinning ? 'Spinning...' : 'Spin Wheel'}
                </Button>
                
                <Button
                  onClick={resetWheel}
                  disabled={isSpinning}
                  variant="outline"
                  className="border-[#4a5568] text-[#ecf0f1] hover:bg-[#4a5568] flex items-center justify-center gap-2 h-10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Wheel
                </Button>
              </div>

              {/* Winner Display */}
              {winner && (
                <Card className="bg-[#f39c12] border-[#e67e22]">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white mb-2">🎉 Winner! 🎉</h3>
                      <p className="text-lg font-semibold text-white">{winner}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wheel Items List */}
              <Card className="bg-[#2c3e50] border-[#4a5568]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[#ecf0f1] text-base">
                    Wheel Items ({wheelItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-32 overflow-y-auto">
                  <div className="space-y-1">
                    {wheelItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[#ecf0f1] truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {wheelItems.length === 0 && (
                <Card className="bg-[#e74c3c] border-[#c0392b]">
                  <CardContent className="p-3">
                    <p className="text-white text-center text-sm">
                      No items available for the selected content type.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Wheel Display */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                {/* Pointer - moved to right side */}
                <div className="absolute top-1/2 right-0 transform translate-x-3 -translate-y-1/2 z-10">
                  <div className="w-0 h-0 border-t-6 border-b-6 border-l-10 border-t-transparent border-b-transparent border-l-[#f39c12] drop-shadow-lg"></div>
                </div>
                
                {/* Wheel SVG */}
                <div
                  ref={wheelRef}
                  className="transition-transform ease-out"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transitionDuration: isSpinning ? `${spinDuration}ms` : '0ms',
                    transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                  }}
                >
                  <svg width="400" height="400" className="drop-shadow-xl">
                    <circle
                      cx="200"
                      cy="200"
                      r="200"
                      fill="#2c3e50"
                      stroke="#4a5568"
                      strokeWidth="4"
                    />
                    {renderWheelSegments()}
                    {/* Center circle */}
                    <circle
                      cx="200"
                      cy="200"
                      r="28"
                      fill="#34495e"
                      stroke="#4a5568"
                      strokeWidth="3"
                    />
                    {/* Center logo/text */}
                    <text
                      x="200"
                      y="200"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ecf0f1"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      SPIN
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}