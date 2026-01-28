import React, { useState } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { X, MapPin, Volume2, Trash2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  location?: { x: number; y: number };
  buzzerSound?: string;
  backgroundColor?: string;
  photoUrl?: string;
  scrambled?: boolean;
  blocked?: boolean;
}

interface FastestTeamDisplayProps {
  fastestTeam: {
    team: Team;
    responseTime: number;
  } | null;
  teams: Team[];
  hostLocation?: { x: number; y: number } | null;
  onClose: () => void;
  onFastestTeamLocationChange?: (teamId: string, location: { x: number; y: number }) => void;
  onHostLocationChange?: (location: { x: number; y: number } | null) => void;
  onScrambleKeypad?: (teamId: string) => void;
  onBlockTeam?: (teamId: string, blocked: boolean) => void;
}

export function FastestTeamDisplay({ 
  fastestTeam, 
  teams, 
  hostLocation, 
  onClose,
  onFastestTeamLocationChange,
  onHostLocationChange,
  onScrambleKeypad,
  onBlockTeam
}: FastestTeamDisplayProps) {
  // Buzzer volume state (0-100)
  const [buzzerVolume, setBuzzerVolume] = useState([75]);
  
  // Interaction state
  const [isDraggingHost, setIsDraggingHost] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPlacingFastestTeam, setIsPlacingFastestTeam] = useState(false);

  // Create 10x10 grid positions
  const gridPositions = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      gridPositions.push({ x: col, y: row });
    }
  }

  const getTeamAtPosition = (x: number, y: number) => {
    return teams.find(team => team.location?.x === x && team.location?.y === y);
  };

  const formatResponseTime = (timeMs: number) => {
    return `${(timeMs / 1000).toFixed(2)}s`;
  };

  // Mouse event handlers for drag and drop
  const handleMouseMove = (e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDraggingHost(false);
  };

  React.useEffect(() => {
    if (isDraggingHost) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingHost]);

  // Handle fastest team location placement
  const handleFastestTeamPlacement = (x: number, y: number) => {
    if (fastestTeam && onFastestTeamLocationChange) {
      onFastestTeamLocationChange(fastestTeam.team.id, { x, y });
    }
  };

  // Handle host location drop
  const handleHostDrop = (x: number, y: number) => {
    if (onHostLocationChange) {
      onHostLocationChange({ x, y });
    }
    setIsDraggingHost(false);
  };

  // Generate mock historical stats for the team (in a real app, this would come from a database)
  const getTeamStats = (teamId: string) => {
    // Using team ID to generate consistent mock data
    const seed = parseInt(teamId) || 1;
    const correctAnswers = Math.floor(Math.random() * 25) + 15; // 15-40 correct answers
    const incorrectAnswers = Math.floor(Math.random() * 12) + 3; // 3-15 incorrect answers
    const totalQuestions = correctAnswers + incorrectAnswers;
    const correctPercentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    return {
      correctAnswers,
      incorrectAnswers,
      totalQuestions,
      correctPercentage
    };
  };

  return (
    <div className="flex-1 flex flex-col bg-background relative">
      {/* Header */}
      <div className="border-b border-border p-6 bg-card" style={{ flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏃</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Fastest Team</h1>
              <p className="text-muted-foreground">
                {fastestTeam ? `${fastestTeam.team.name} answered in ${formatResponseTime(fastestTeam.responseTime)}` : 'No data available'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content - Three Column Layout */}
      <div className="flex gap-6" style={{ flex: 1, minHeight: 0 }}>
        {/* Left side - Team Photo Area */}
        <div className="w-80 overflow-y-auto" style={{ flexShrink: 0 }}>
          <div className="p-6" style={{ minHeight: '100%' }}>
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="font-semibold text-foreground mb-4 text-center">Team Photo</h3>
              
              {/* Photo container - always visible */}
              <div className="w-full aspect-square bg-[#f8f9fa] dark:bg-[#2c3e50] rounded-lg border-2 border-border p-4 flex items-center justify-center relative group">
                {fastestTeam?.team.photoUrl ? (
                  <>
                    <img 
                      src={fastestTeam.team.photoUrl} 
                      alt={`${fastestTeam.team.name} photo`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {/* Delete Photo Button - appears on hover */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0"
                      onClick={() => {
                        // TODO: Implement delete photo functionality
                        console.log('Delete photo for team:', fastestTeam.team.id);
                      }}
                      title="Delete team photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {/* Empty state - just blank */}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Center - Team Name and Info */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6" style={{ minHeight: '100%' }}>
            {fastestTeam ? (
              <>
                {/* Main Team Display - Large Central Highlight */}
                <div className="bg-gradient-to-br from-[#2ecc71]/10 to-[#27ae60]/5 border-2 border-[#2ecc71] rounded-xl p-8 text-center relative overflow-hidden">
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-[#2ecc71] rounded-full -translate-x-16 -translate-y-16"></div>
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#27ae60] rounded-full translate-x-20 translate-y-20"></div>
                  </div>
                  
                  <div className="relative z-10">
                    {/* Team Icon */}
                    <div className="text-6xl drop-shadow-lg mb-6">{fastestTeam.team.icon || "🎯"}</div>

                    {/* Large Team Name */}
                    <h2 className="text-5xl font-bold text-[#2ecc71] mb-4 drop-shadow-sm">
                      {fastestTeam.team.name}
                    </h2>
                    
                    {/* Response Time Badge */}
                    <div className="inline-block bg-[#2ecc71] text-white px-6 py-3 rounded-full text-2xl font-bold shadow-lg mb-6">
                      ⚡ {formatResponseTime(fastestTeam.responseTime)}
                    </div>
                    
                    {/* Score Display */}
                    <div className="text-lg text-muted-foreground">
                      Current Score: <span className="font-bold text-foreground">{fastestTeam.team.score || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Compact Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Performance Stats - Compact */}
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <h3 className="font-semibold text-foreground mb-2 text-xs">Performance</h3>
                    {(() => {
                      const stats = getTeamStats(fastestTeam.team.id);
                      return (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rank</span>
                            <span className="font-bold text-[#3498db]">
                              {teams.findIndex(t => t.id === fastestTeam.team.id) + 1} of {teams.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Correct</span>
                            <span className="font-medium text-[#2ecc71]">{stats.correctAnswers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Success</span>
                            <span className="font-bold text-[#3498db]">{stats.correctPercentage}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Buzzer Settings - Compact */}
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <h3 className="font-semibold text-foreground mb-2 text-xs flex items-center gap-1">
                      <Volume2 className="h-3 w-3" />
                      Buzzer
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Volume</span>
                        <span className="font-medium">{buzzerVolume[0]}%</span>
                      </div>
                      <Slider
                        value={buzzerVolume}
                        onValueChange={setBuzzerVolume}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>


                </div>

                {/* Team Control Actions */}
                <div className="bg-card rounded-lg p-4 border border-border">
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Team Controls</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Block Scoring Toggle Button */}
                    <Button
                      variant={fastestTeam.team.blocked ? "outline" : "destructive"}
                      size="sm"
                      className={`w-full text-xs transition-all duration-200 ${
                        fastestTeam.team.blocked 
                          ? "border-green-500 text-green-500 hover:bg-green-500 hover:text-white hover:scale-105 hover:shadow-lg hover:shadow-green-500/30" 
                          : "hover:scale-105 hover:shadow-lg hover:shadow-red-500/30"
                      }`}
                      onClick={() => {
                        if (onBlockTeam && fastestTeam) {
                          onBlockTeam(fastestTeam.team.id, !fastestTeam.team.blocked);
                        }
                      }}
                    >
                      {fastestTeam.team.blocked ? "✅ Unblock Team" : "🚫 Block Team"}
                    </Button>
                    
                    {/* Scramble Keypad Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full text-xs transition-all duration-200 ${
                        fastestTeam.team.scrambled 
                          ? "border-green-500 text-green-500 hover:bg-green-500 hover:text-white" 
                          : "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                      }`}
                      onClick={() => {
                        if (onScrambleKeypad && fastestTeam) {
                          onScrambleKeypad(fastestTeam.team.id);
                        }
                      }}
                    >
                      {fastestTeam.team.scrambled ? "✅ Unscramble Keypad" : "🔀 Scramble Keypad"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-card rounded-lg p-8 border border-border text-center">
                <div className="text-6xl mb-4">🤔</div>
                <h2 className="text-xl font-bold text-foreground mb-2">No Fastest Team Data</h2>
                <p className="text-muted-foreground">
                  Start a keypad round and have teams answer to see the fastest team information here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right side - 10x10 Grid */}
        <div className="w-80 overflow-y-auto" style={{ flexShrink: 0 }}>
          <div className="p-6" style={{ minHeight: '100%' }}>
            <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="font-semibold text-foreground mb-4 text-center">Physical Layout</h3>
            
            {/* Grid container */}
            <div className="relative w-full aspect-square bg-[#f8f9fa] dark:bg-[#2c3e50] rounded-lg border-2 border-border p-2">
              {/* Grid lines */}
              <div className="absolute inset-2 grid grid-cols-10 grid-rows-10">
                {gridPositions.map((pos, index) => {
                  const teamAtPos = getTeamAtPosition(pos.x, pos.y);
                  const isFastestTeam = fastestTeam && teamAtPos?.id === fastestTeam.team.id;
                  const isHovered = hoveredCell?.x === pos.x && hoveredCell?.y === pos.y;
                  const isHostAtPos = hostLocation && hostLocation.x === pos.x && hostLocation.y === pos.y;
                  
                  return (
                    <button
                      key={index}
                      className={`border border-[#dee2e6] dark:border-[#4a5568] bg-white dark:bg-[#34495e] flex items-center justify-center relative transition-all duration-200 ${
                        isDraggingHost && isHovered
                          ? 'bg-red-200 dark:bg-red-800 scale-110'
                          : isPlacingFastestTeam && isHovered
                          ? 'bg-green-200 dark:bg-green-800 scale-110'
                          : !teamAtPos && fastestTeam && isHovered
                          ? 'bg-blue-100 dark:bg-blue-900 scale-105'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onMouseEnter={() => setHoveredCell({ x: pos.x, y: pos.y })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => {
                        if (isDraggingHost) {
                          handleHostDrop(pos.x, pos.y);
                        } else if (isPlacingFastestTeam) {
                          handleFastestTeamPlacement(pos.x, pos.y);
                          setIsPlacingFastestTeam(false);
                        } else if (fastestTeam && !teamAtPos) {
                          // Direct placement: click empty cell to place fastest team
                          handleFastestTeamPlacement(pos.x, pos.y);
                        }
                      }}
                      onMouseUp={() => {
                        if (isDraggingHost) {
                          handleHostDrop(pos.x, pos.y);
                        }
                      }}
                      title={`Position (${pos.x + 1}, ${pos.y + 1})${teamAtPos ? ` - ${teamAtPos.name}` : ''}${isHostAtPos ? ' - Host Location' : ''}${isPlacingFastestTeam && fastestTeam ? ` - Click to place ${fastestTeam.team.name} here` : !teamAtPos && fastestTeam ? ` - Click to place ${fastestTeam.team.name} here` : ''}`}
                    >
                      {/* Team at this position */}
                      {teamAtPos && (
                        <div 
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 ${
                            isFastestTeam 
                              ? isPlacingFastestTeam
                                ? 'bg-[#2ecc71] border-[#27ae60] text-white shadow-lg animate-bounce cursor-pointer scale-125'
                                : 'bg-[#2ecc71] border-[#27ae60] text-white shadow-lg animate-pulse cursor-pointer hover:scale-110'
                              : 'bg-[#3498db] border-[#2980b9] text-white'
                          }`}
                          onClick={(e) => {
                            if (isFastestTeam) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsPlacingFastestTeam(!isPlacingFastestTeam);
                            }
                          }}
                          title={`${teamAtPos.name}${isFastestTeam ? isPlacingFastestTeam ? ' (Fastest!) - Placement mode active - Click a grid cell' : ' (Fastest!) - Click to activate placement mode' : ''}`}
                        >
                          {teamAtPos.name.charAt(0)}
                        </div>
                      )}

                      {/* Host location */}
                      {isHostAtPos && (
                        <div 
                          className="w-3 h-3 bg-[#e74c3c] rounded-full border border-white shadow-sm cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingHost(true);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDragOffset({
                              x: e.clientX - rect.left - rect.width / 2,
                              y: e.clientY - rect.top - rect.height / 2
                            });
                            setMousePosition({ x: e.clientX, y: e.clientY });
                            // Clear the current host location so it can be moved
                            if (onHostLocationChange) {
                              onHostLocationChange(null);
                            }
                          }}
                          title="Host Location - Drag to move"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Floating dragged host */}
              {isDraggingHost && (
                <div 
                  className="fixed w-3 h-3 bg-[#e74c3c] rounded-full border border-white shadow-lg z-50 pointer-events-none"
                  style={{
                    left: mousePosition.x - dragOffset.x,
                    top: mousePosition.y - dragOffset.y
                  }}
                />
              )}

              {/* Placement mode indicator */}
              {isPlacingFastestTeam && fastestTeam && (
                <div className="absolute top-2 left-2 right-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium text-center z-20">
                  Click on any grid cell to move {fastestTeam.team.name} there
                </div>
              )}

              {/* Grid labels */}
              <div className="absolute -top-6 left-2 right-2 grid grid-cols-10 text-xs text-muted-foreground">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="text-center">{i + 1}</div>
                ))}
              </div>
              <div className="absolute -left-6 top-2 bottom-2 grid grid-rows-10 text-xs text-muted-foreground">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="flex items-center justify-center">{i + 1}</div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#2ecc71] border border-[#27ae60]"></div>
                <span className="text-muted-foreground">Fastest Team (Click to move)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3498db] border border-[#2980b9]"></div>
                <span className="text-muted-foreground">Other Teams</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#e74c3c] border border-white"></div>
                <span className="text-muted-foreground">Host Location (Draggable)</span>
              </div>
              
              {/* Instructions */}
              <div className="mt-3 space-y-2">


              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
