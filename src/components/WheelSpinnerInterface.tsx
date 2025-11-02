import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Play, Square, RotateCcw, Settings, Plus, Minus, X, Home, ArrowLeft } from 'lucide-react';

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  scrambled?: boolean;
}

interface WheelSpinnerInterfaceProps {
  quizzes: Quiz[];
  onBack: () => void;
  onHome: () => void;
  onAwardPoints?: (correctTeamIds: string[], gameMode: "keypad" | "buzzin" | "nearestwins" | "wheelspinner", fastestTeamId?: string) => void; // Award points callback
  onExternalDisplayUpdate?: (mode: string, data?: any) => void; // External display update callback
}

type WheelContentType = 'teams' | 'random-points' | 'custom';

interface WheelItem {
  id: string;
  label: string;
  color: string;
}

interface CustomWheelItem {
  id: string;
  label: string;
}

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#e67e22', '#1abc9c', '#00bcd4', '#f1c40f', '#e91e63',
  '#ff5722', '#8e44ad', '#795548', '#ff9800', '#4caf50'
];

export function WheelSpinnerInterface({ quizzes, onBack, onHome, onAwardPoints, onExternalDisplayUpdate }: WheelSpinnerInterfaceProps) {
  const [contentType, setContentType] = useState<WheelContentType>('teams');
  const [wheelItems, setWheelItems] = useState<WheelItem[]>([]);
  const [customPointValues, setCustomPointValues] = useState<number[]>([50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
  const [customWheelItems, setCustomWheelItems] = useState<CustomWheelItem[]>([
    { id: '1', label: 'Option 1' },
    { id: '2', label: 'Option 2' },
    { id: '3', label: 'Option 3' },
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [spinDuration, setSpinDuration] = useState(0);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const wheelRef = useRef<HTMLDivElement>(null);

  // Generate wheel items based on content type
  useEffect(() => {
    let items: WheelItem[] = [];
    
    if (contentType === 'teams') {
      items = quizzes
        .filter(quiz => !removedItems.has(quiz.id))
        .map((quiz, index) => ({
          id: quiz.id,
          label: quiz.name,
          color: COLORS[index % COLORS.length]
        }));
    } else if (contentType === 'random-points') {
      items = customPointValues
        .filter((points, index) => !removedItems.has(`points-${points}`))
        .map((points, index) => ({
          id: `points-${points}`,
          label: `${points} pts`,
          color: COLORS[index % COLORS.length]
        }));
    } else if (contentType === 'custom') {
      items = customWheelItems
        .filter(item => !removedItems.has(item.id))
        .map((item, index) => ({
          id: item.id,
          label: item.label,
          color: COLORS[index % COLORS.length]
        }));
    }
    
    setWheelItems(items);
    setWinner(null);
  }, [contentType, quizzes, customPointValues, customWheelItems, removedItems]);

  // Update external display when wheel spinner is active
  useEffect(() => {
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate && wheelItems.length > 0) {
      onExternalDisplayUpdate('wheel-spinner', {
        contentType,
        wheelItems,
        isSpinning,
        rotation,
        winner,
        spinDuration,
        gameMode: 'wheelspinner'
      });
    }
  }, [externalWindow, onExternalDisplayUpdate, wheelItems, contentType, isSpinning, rotation, winner]);

  // Initialize external display when component mounts
  useEffect(() => {
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('wheel-spinner', {
        contentType: 'teams',
        wheelItems: [],
        isSpinning: false,
        rotation: 0,
        winner: null,
        spinDuration: 0,
        gameMode: 'wheelspinner'
      });
    }
  }, []);

  // Cleanup effect when component unmounts - return external display to basic mode
  useEffect(() => {
    return () => {
      if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
        onExternalDisplayUpdate('basic');
      }
    };
  }, [onExternalDisplayUpdate]);

  // Spacebar shortcut for spinning the wheel
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        
        // Spin wheel if not already spinning and has items
        if (!isSpinning && wheelItems.length > 0) {
          spinWheel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isSpinning, wheelItems.length]);

  const spinWheel = () => {
    if (isSpinning || wheelItems.length === 0) return;

    // Remove previous winner from wheel if option is enabled
    if (removeWinner && winner) {
      const previousWinnerItem = wheelItems.find(item => item.label === winner);
      if (previousWinnerItem) {
        setRemovedItems(prev => new Set([...prev, previousWinnerItem.id]));
      }
    }

    setIsSpinning(true);
    setWinner(null);

    // Random spin: 3-6 full rotations plus random position
    const fullRotations = Math.floor(Math.random() * 4) + 3; // 3-6 rotations
    const finalPosition = Math.random() * 360;
    const totalRotation = rotation + fullRotations * 360 + finalPosition;
    
    // Duration: 3-5 seconds in main app
    const duration = Math.random() * 2000 + 3000;
    setSpinDuration(duration);
    setRotation(totalRotation);

    // Update external display with spin start and duration
    if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
      onExternalDisplayUpdate('wheel-spinner', {
        contentType,
        wheelItems,
        isSpinning: true,
        rotation: totalRotation,
        winner: null,
        spinDuration: duration,
        gameMode: 'wheelspinner'
      });
    }

    // Determine winner after spin completes
    setTimeout(() => {
      const normalizedRotation = totalRotation % 360;
      const itemAngle = 360 / wheelItems.length;
      // Arrow is at 0 degrees (right side), segments start at -90 degrees (top) going clockwise
      // When wheel rotates clockwise by R degrees, arrow points at -R degrees on the wheel
      // Find which segment contains angle (-R) on the wheel, relative to segments starting at -90
      const winnerIndex = Math.floor((((90 - normalizedRotation) % 360 + 360) % 360) / itemAngle) % wheelItems.length;
      
      const winnerItem = wheelItems[winnerIndex];
      const winnerLabel = winnerItem?.label || null;
      setWinner(winnerLabel);
      setIsSpinning(false);
      
      // Update external display with final result
      if (externalWindow && !externalWindow.closed && onExternalDisplayUpdate) {
        onExternalDisplayUpdate('wheel-spinner', {
          contentType,
          wheelItems,
          isSpinning: false,
          rotation: totalRotation,
          winner: winnerLabel,
          spinDuration: 0,
          gameMode: 'wheelspinner'
        });
      }
    }, duration);
  };

  const resetWheel = () => {
    if (isSpinning) return;
    setRotation(0);
    setWinner(null);
    setRemovedItems(new Set()); // Clear removed items
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

  const addCustomItem = () => {
    const newId = `custom-${Date.now()}`;
    const newLabel = `Option ${customWheelItems.length + 1}`;
    setCustomWheelItems([...customWheelItems, { id: newId, label: newLabel }]);
  };

  const removeCustomItem = (index: number) => {
    if (customWheelItems.length > 2) { // Minimum 2 items
      const newItems = customWheelItems.filter((_, i) => i !== index);
      setCustomWheelItems(newItems);
    }
  };

  const updateCustomItemLabel = (index: number, label: string) => {
    const newItems = [...customWheelItems];
    newItems[index] = { ...newItems[index], label };
    setCustomWheelItems(newItems);
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
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="bg-sidebar-accent border-b border-sidebar-border p-4 flex items-center justify-center">
        <h2 className="text-xl font-semibold">
          Wheel Spinner
        </h2>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-6 h-full items-start">
          {/* Left Configuration Panel */}
          <div className="lg:w-64 space-y-4 overflow-y-auto flex-shrink-0">
            <div>
              <label className="block text-foreground mb-2 font-medium">
                Wheel Content Type
              </label>
              <Select value={contentType} onValueChange={(value: WheelContentType) => setContentType(value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teams">
                    Teams ({quizzes.length} teams)
                  </SelectItem>
                  <SelectItem value="random-points">
                    Random Points ({customPointValues.length} slices)
                  </SelectItem>
                  <SelectItem value="custom">
                    Blank Wheel ({customWheelItems.length} slices)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Points Configuration */}
            {contentType === 'random-points' && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
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
                        className="h-8 flex-1 text-sm"
                        min="1"
                      />
                      <Button
                        onClick={() => removePointSlice(index)}
                        disabled={customPointValues.length <= 2}
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Custom Wheel Items Configuration */}
            {contentType === 'custom' && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Wheel Items
                    </CardTitle>
                    <Button
                      onClick={addCustomItem}
                      className="bg-[#27ae60] hover:bg-[#229954] text-white h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                  {customWheelItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <Input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateCustomItemLabel(index, e.target.value)}
                        className="h-8 flex-1 text-sm"
                        placeholder="Enter label"
                      />
                      <Button
                        onClick={() => removeCustomItem(index)}
                        disabled={customWheelItems.length <= 2}
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
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
                className="flex items-center justify-center gap-2 h-10"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Wheel
              </Button>
            </div>

            {/* Winner Display - always rendered to prevent layout shift */}
            <Card className={`transition-all duration-300 ${winner ? 'bg-[#f39c12] border-[#e67e22]' : 'bg-transparent border-transparent'}`}>
              <CardContent className="p-4">
                <div className="text-center min-h-[4rem] flex flex-col items-center justify-center">
                  {winner ? (
                    <>
                      <h3 className="text-xl font-bold text-white mb-2">🎉 Winner! 🎉</h3>
                      <p className="text-lg font-semibold text-white">{winner}</p>
                    </>
                  ) : (
                    <div className="opacity-0">
                      <h3 className="text-xl font-bold mb-2">🎉 Winner! 🎉</h3>
                      <p className="text-lg font-semibold">Placeholder</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Wheel Display */}
          <div className="flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 gap-6">
            <div className="relative flex-shrink-0">
              {/* Pointer - moved to right side */}
              <div className="absolute top-1/2 right-0 transform translate-x-3 -translate-y-1/2 z-10">
                <div className="w-0 h-0 border-t-9 border-b-9 border-r-15 border-t-transparent border-b-transparent border-r-[#f39c12] drop-shadow-lg"></div>
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
            
            {/* Wheel Settings */}
            <Card className="w-full max-w-md">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remove-winner"
                    checked={removeWinner}
                    onCheckedChange={(checked) => setRemoveWinner(checked === true)}
                    disabled={isSpinning}
                  />
                  <Label
                    htmlFor="remove-winner"
                    className="cursor-pointer select-none"
                  >
                    Remove winner from wheel after each spin
                  </Label>
                </div>
                {removedItems.size > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {removedItems.size} item{removedItems.size !== 1 ? 's' : ''} removed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Wheel Items List */}
          <div className="lg:w-64 space-y-4 flex-shrink-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Wheel Items ({wheelItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto">
                {wheelItems.length > 0 ? (
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
                        <span className="truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center text-sm py-4">
                    No items available for the selected content type.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
