import React, { useState, useEffect } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useSettings } from '../utils/SettingsContext';

export function CountdownDebugScreen() {
  const { countdownStyle, updateCountdownStyle } = useSettings();
  const [currentTime, setCurrentTime] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<"circular" | "digital" | "pulsing" | "progress-bar" | "flip" | "matrix" | "liquid" | "gradient">(countdownStyle);

  const countdownStyles = [
    { value: "circular", label: "Circular Progress" },
    { value: "digital", label: "Digital Clock" },
    { value: "pulsing", label: "Pulsing Scale" },
    { value: "progress-bar", label: "Progress Bar" },
    { value: "flip", label: "Flip Card" },
    { value: "matrix", label: "Matrix Rain" },
    { value: "liquid", label: "Liquid Fill" },
    { value: "gradient", label: "Gradient Spin" }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && currentTime >= 0) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newValue = prev - 1;
          
          
          if (newValue < 0) {
            setIsRunning(false);
            
            
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, currentTime]);

  const resetTimer = () => {
    setCurrentTime(10);
    setIsRunning(false);
  };

  const startTimer = () => {
    if (currentTime === 0) setCurrentTime(10);
    setIsRunning(true);
    
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const handleStyleChange = (value: string) => {
    const newStyle = value as "circular" | "digital" | "pulsing" | "progress-bar" | "flip" | "matrix" | "liquid" | "gradient";
    setSelectedStyle(newStyle);
    updateCountdownStyle(newStyle);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Countdown Timer Debug Screen</h1>
          <p className="text-gray-300">Test all countdown timer styles - changes will apply to external displays</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Timer Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Global Countdown Style</label>
                <Select 
                  value={selectedStyle} 
                  onValueChange={handleStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countdownStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div className="flex items-center gap-2">
                          {style.value === "circular" && <div className="w-4 h-4 border-2 border-blue-500 rounded-full"></div>}
                          {style.value === "digital" && <div className="w-4 h-4 bg-black border border-green-400 text-green-400 text-xs flex items-center justify-center font-mono">00</div>}
                          {style.value === "pulsing" && <div className="w-4 h-4 bg-blue-500 rounded animate-pulse"></div>}
                          {style.value === "progress-bar" && <div className="w-4 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="w-2/3 h-full bg-blue-500"></div></div>}
                          {style.value === "flip" && <div className="w-4 h-4 bg-gray-800 text-white text-xs flex items-center justify-center font-mono rounded">00</div>}
                          {style.value === "matrix" && <div className="w-4 h-4 bg-black border border-green-400 text-green-400 text-xs flex items-center justify-center font-mono">01</div>}
                          {style.value === "liquid" && <div className="w-4 h-4 bg-gray-200 rounded-full overflow-hidden"><div className="w-full h-1/2 bg-blue-500 mt-2"></div></div>}
                          {style.value === "gradient" && <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>}
                          {style.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={startTimer} disabled={isRunning}>
                  Start
                </Button>
                <Button onClick={stopTimer} disabled={!isRunning}>
                  Stop
                </Button>
                <Button onClick={resetTimer}>
                  Reset
                </Button>
              </div>

              <div className="text-sm text-gray-300 space-y-1">
                <p>Time: {currentTime} seconds</p>
                <p>Status: {isRunning ? "Running" : "Stopped"}</p>
                <p>Current Style: {countdownStyles.find(s => s.value === countdownStyle)?.label}</p>
                <p className="text-yellow-400">This style applies to all external display timers</p>
              </div>
            </CardContent>
          </Card>

          {/* Timer Display */}
          <Card>
            <CardHeader>
              <CardTitle>Live Timer Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center min-h-[400px] bg-gray-800 rounded-lg">
              <CountdownTimer
                currentTime={currentTime}
                totalTime={10}
                size={80}
                showLabel={true}
                label="seconds"
              />
            </CardContent>
          </Card>
        </div>

        {/* All Styles Grid */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">All Available Countdown Styles</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {countdownStyles.map((style) => (
              <Card 
                key={style.value} 
                className={`bg-gray-800 cursor-pointer transition-all ${
                  countdownStyle === style.value 
                    ? 'ring-2 ring-blue-500 bg-gray-700' 
                    : 'hover:bg-gray-700'
                }`}
                onClick={() => handleStyleChange(style.value)}
              >
                <CardHeader>
                  <CardTitle className="text-sm text-center text-white">
                    {style.label}
                    {countdownStyle === style.value && (
                      <span className="block text-xs text-blue-400 mt-1">Active</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[200px]">
                  <CountdownTimer
                    currentTime={7}
                    totalTime={10}
                    size={40}
                    showLabel={false}
                    overrideStyle={style.value as any}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Click on any style above to apply it globally to all external display timers
          </p>
        </div>
      </div>
    </div>
  );
}
