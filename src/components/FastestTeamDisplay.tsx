import React, { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { X, MapPin, Volume2, Trash2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  type: "test" | "round";
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

  // Mouse event handlers for drag and drop - memoized to prevent memory leaks
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDraggingHost(false);
  }, []);

  React.useEffect(() => {
    if (isDraggingHost) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingHost, handleMouseMove, handleMouseUp]);

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
      <div className="border-b border-border p-6 bg-card z-20" style={{ flexShrink: 0 }}>
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

      {/* Content Area - 2x3 Grid Layout */}
      <div className="grid grid-cols-3 grid-rows-2 gap-4 flex-1 overflow-hidden relative p-4 bg-background">
        {/* Cell 1: Team Name Block (spans 2 columns, top-left) */}
        <div className="col-span-2 row-span-1 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-border p-6 flex items-center justify-center">
          {fastestTeam && (
            <h2 className="text-4xl font-bold text-foreground text-center">
              {fastestTeam.team.name}
            </h2>
          )}
        </div>

        {/* Cell 2: Team Stats (top-right) */}
        <div className="col-span-1 row-span-1 bg-card rounded-lg border border-border p-4 flex flex-col gap-3 overflow-y-auto">
          {fastestTeam ? (
            <>
              {/* Score Display */}
              <div className="bg-gradient-to-br from-[#2ecc71]/10 to-[#27ae60]/5 border-2 border-[#2ecc71] rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Current Score</div>
                <div className="text-3xl font-bold text-[#2ecc71]">
                  {fastestTeam.team.score || 0}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Cell 3: Team Photo (bottom-left) */}
        <div className="col-span-1 row-span-1 flex flex-col items-center justify-center bg-card rounded-lg border border-border p-4">
          {/* Photo Container - Responsive sizing */}
          {fastestTeam?.team.photoUrl ? (
            <div className="relative w-[200px] h-[200px] rounded-lg overflow-hidden shadow-lg border border-border bg-white dark:bg-slate-800 flex items-center justify-center group">
              {/* Photo Image */}
              <img
                src={fastestTeam.team.photoUrl}
                alt={`${fastestTeam.team.name} photo`}
                className="max-w-full max-h-full object-contain"
                onLoad={() => {
                  console.log('[FastestTeamDisplay] Successfully loaded team photo:', fastestTeam.team.photoUrl);
                }}
                onError={(e) => {
                  console.error('[FastestTeamDisplay] Failed to load team photo:', fastestTeam.team.photoUrl);
                }}
              />

              {/* Delete Photo Button - appears on hover */}
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0 z-10"
                onClick={() => {
                  // TODO: Implement delete photo functionality
                  console.log('Delete photo for team:', fastestTeam?.team.id);
                }}
                title="Delete team photo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-border shadow-lg">
              {fastestTeam ? (
                <div className="bg-[#2ecc71] text-white px-6 py-3 rounded-full text-lg font-bold">
                  ⚡ {formatResponseTime(fastestTeam.responseTime)}
                </div>
              ) : (
                <p className="text-muted-foreground">No photo available</p>
              )}
            </div>
          )}
        </div>

        {/* Cell 4: Physical Layout Grid (bottom-middle) */}
        <div className="col-span-1 row-span-1 bg-card rounded-lg border border-border p-4 flex flex-col overflow-hidden">
          {fastestTeam ? (
            <>
              <h3 className="font-semibold text-foreground mb-2 text-center text-sm">Physical Layout</h3>
              {/* Grid container */}
              <div className="relative w-full bg-[#f8f9fa] dark:bg-[#2c3e50] rounded-lg border-2 border-border p-2 flex-1" style={{ aspectRatio: '1' }}>
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
                              handleFastestTeamPlacement(pos.x, pos.y);
                            }
                          }}
                          onMouseUp={() => {
                            if (isDraggingHost) {
                              handleHostDrop(pos.x, pos.y);
                            }
                          }}
                          title={`Position (${pos.x + 1}, ${pos.y + 1})${teamAtPos ? ` - ${teamAtPos.name}` : ''}${isHostAtPos ? ' - Host Location' : ''}`}
                        >
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
                              title={`${teamAtPos.name}${isFastestTeam ? ' (Fastest!)' : ''}`}
                            >
                              {teamAtPos.name.charAt(0)}
                            </div>
                          )}

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

                  {isDraggingHost && (
                    <div
                      className="fixed w-3 h-3 bg-[#e74c3c] rounded-full border border-white shadow-lg z-50 pointer-events-none"
                      style={{
                        left: mousePosition.x - dragOffset.x,
                        top: mousePosition.y - dragOffset.y
                      }}
                    />
                  )}

                  {isPlacingFastestTeam && fastestTeam && (
                    <div className="absolute top-2 left-2 right-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium text-center z-20">
                      Click on any grid cell to move {fastestTeam.team.name} there
                    </div>
                  )}

                  <div className="absolute -top-5 left-2 right-2 grid grid-cols-10 text-xs text-muted-foreground">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="text-center">{i + 1}</div>
                    ))}
                  </div>
                  <div className="absolute -left-5 top-2 bottom-2 grid grid-rows-10 text-xs text-muted-foreground">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="flex items-center justify-center">{i + 1}</div>
                    ))}
                  </div>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#2ecc71] border border-[#27ae60]"></div>
                  <span className="text-muted-foreground">Fastest Team</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#3498db] border border-[#2980b9]"></div>
                  <span className="text-muted-foreground">Other Teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#e74c3c] border border-white"></div>
                  <span className="text-muted-foreground">Host Location</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Cell 5: Team Controls (bottom-right) */}
        <div className="col-span-1 row-span-1 bg-card rounded-lg border border-border p-4 flex flex-col gap-3">
          {fastestTeam ? (
            <>
              <h3 className="font-semibold text-foreground text-sm">Team Controls</h3>
              <div className="flex flex-col gap-3">
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

              {/* Performance Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 border border-border">
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

              {/* Buzzer Settings */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 border border-border">
                <h3 className="font-semibold text-foreground mb-2 text-xs flex items-center gap-2">
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
