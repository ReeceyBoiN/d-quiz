import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Trophy, Medal, Award, ChevronRight, RotateCcw, Users, Download } from "lucide-react";

interface Quiz {
  id: string;
  name: string;
  score: number;
  scrambled?: boolean;
}

interface LeaderboardRevealProps {
  quizzes: Quiz[];
  onExternalDisplayUpdate: (content: string, data?: any) => void;
}

export function LeaderboardReveal({ quizzes, onExternalDisplayUpdate }: LeaderboardRevealProps) {
  const [currentRevealIndex, setCurrentRevealIndex] = useState(-1);
  const [isRevealing, setIsRevealing] = useState(false);
  const [sortedTeams, setSortedTeams] = useState<Quiz[]>([]);

  // Sort teams by score (ascending - worst to best for dramatic reveal)
  useEffect(() => {
    const sorted = [...quizzes].sort((a, b) => a.score - b.score);
    setSortedTeams(sorted);
  }, [quizzes]);

  // Auto-start reveal when component mounts
  useEffect(() => {
    // Automatically start the reveal process when component mounts
    setIsRevealing(true);
    setCurrentRevealIndex(-1);
    onExternalDisplayUpdate("leaderboard-intro");
  }, []); // Empty dependency array - only run once on mount

  const handleStartReveal = () => {
    setIsRevealing(true);
    setCurrentRevealIndex(-1);
    onExternalDisplayUpdate("leaderboard-intro");
  };

  const handleNext = () => {
    if (currentRevealIndex < sortedTeams.length - 1) {
      const nextIndex = currentRevealIndex + 1;
      setCurrentRevealIndex(nextIndex);
      
      // Update external display with current team reveal
      const currentTeam = sortedTeams[nextIndex];
      const position = sortedTeams.length - nextIndex;
      
      // Create an enhanced revealed teams list with actual positions
      const revealedTeamsWithPositions = sortedTeams.slice(0, nextIndex + 1).map((team, index) => ({
        ...team,
        actualPosition: sortedTeams.length - index // Actual position in the overall ranking
      }));
      
      onExternalDisplayUpdate("leaderboard-reveal", {
        team: currentTeam,
        position: position,
        totalTeams: sortedTeams.length,
        isLast: nextIndex === sortedTeams.length - 1,
        revealedTeamsWithPositions: revealedTeamsWithPositions
      });
    }
  };

  const handleReset = () => {
    setIsRevealing(false);
    setCurrentRevealIndex(-1);
    onExternalDisplayUpdate("leaderboard-intro");
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-12 h-12 text-yellow-500" />;
      case 2:
        return <Medal className="w-12 h-12 text-gray-400" />;
      case 3:
        return <Award className="w-12 h-12 text-amber-600" />;
      default:
        return <div className="w-12 h-12 flex items-center justify-center text-4xl font-bold text-primary bg-primary/20 rounded-full">{position}</div>;
    }
  };

  const getPositionSuffix = (position: number) => {
    if (position % 10 === 1 && position !== 11) return "st";
    if (position % 10 === 2 && position !== 12) return "nd";
    if (position % 10 === 3 && position !== 13) return "rd";
    return "th";
  };

  // Spacebar shortcut for Next Team button
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not in an input field
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        
        // Next Team button
        if (currentRevealIndex < sortedTeams.length - 1) {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentRevealIndex, sortedTeams.length]);

  const currentTeam = currentRevealIndex >= 0 ? sortedTeams[currentRevealIndex] : null;
  const currentPosition = currentTeam ? sortedTeams.length - currentRevealIndex : null;

  // Get the NEXT team to be revealed (one step ahead for host preparation)
  const nextTeamIndex = currentRevealIndex + 1;
  const nextTeam = nextTeamIndex < sortedTeams.length ? sortedTeams[nextTeamIndex] : null;
  const nextPosition = nextTeam ? sortedTeams.length - nextTeamIndex : null;

  return (
    <div className="flex flex-col h-full bg-background p-6">
      {/* Header with Controls */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Leaderboard Reveal</h1>
          <div className="flex gap-3">
            <Button 
              onClick={handleNext}
              disabled={currentRevealIndex >= sortedTeams.length - 1}
              className="bg-primary hover:bg-primary/90 text-primary-foreground transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none text-lg px-6 py-3"
            >
              <ChevronRight className="w-5 h-5 mr-2" />
              Next Team
            </Button>
            <Button 
              onClick={() => {
                // Placeholder for export functionality - to be implemented later
                console.log('Export Image clicked - functionality to be added');
              }}
              variant="outline"
              className="border-border text-foreground hover:bg-accent transform hover:scale-105 transition-all duration-200 text-base px-4 py-3"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Image
            </Button>
            <Button 
              onClick={handleReset}
              variant="outline"
              className="border-border text-foreground hover:bg-accent transform hover:scale-105 transition-all duration-200 text-lg px-6 py-3"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-4 text-lg text-muted-foreground">
          <span>Progress:</span>
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-lg px-4 py-2">
            {Math.max(0, currentRevealIndex + 1)} / {sortedTeams.length}
          </Badge>
          {currentRevealIndex >= 0 && (
            <span className="text-primary font-semibold">
              {currentRevealIndex === sortedTeams.length - 1 ? "🏆 REVEALING WINNER!" : `Revealing ${currentPosition}${getPositionSuffix(currentPosition!)} place`}
            </span>
          )}
        </div>
      </div>

      {/* Current Team Display */}
      <div className="flex-1 flex items-center justify-center">
        {currentRevealIndex === -1 ? (
          <div className="text-center">
            <div className="bg-orange-500/10 border border-orange-500 p-8 rounded-lg max-w-3xl">
              <div className="text-4xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold text-orange-500 mb-3">GET READY TO ANNOUNCE</h2>
              <p className="text-lg text-foreground opacity-80 mb-4">
                External display shows: "AND THE SCORES ARE..."
              </p>
              {nextTeam && (
                <div className="bg-card p-6 rounded-lg border-2 border-border mt-4">
                  <p className="text-base text-muted-foreground mb-3">Say:</p>
                  <div className="text-xl text-foreground mb-2">
                    "In {nextPosition}{getPositionSuffix(nextPosition!)} place with {nextTeam.score} point{nextTeam.score !== 1 ? 's' : ''}, it's..."
                  </div>
                  <h3 className="text-4xl font-bold text-orange-500 mb-3">
                    {nextTeam.name}
                  </h3>
                </div>
              )}
              <p className="text-base text-muted-foreground mt-4">
                Say the above, then click "Next Team" to reveal them
              </p>
            </div>
          </div>
        ) : nextTeam ? (
          <div className="text-center">
            <Card className="bg-card border-4 border-orange-500 p-8 max-w-5xl shadow-2xl">
              <div className="space-y-4">
                {/* Current Status */}
                <div className="bg-background p-4 rounded-lg border-2 border-border">
                  <div className="text-sm text-muted-foreground mb-1">Currently Showing on External Display:</div>
                  <div className="text-xl font-bold text-primary">
                    {currentTeam?.name} - {currentPosition}{getPositionSuffix(currentPosition!)} place
                  </div>
                </div>

                {/* Next Team to Announce */}
                <div className="border-4 border-green-500 bg-green-500/10 p-6 rounded-lg">
                  <div className="text-lg text-green-500 font-bold mb-3">🎯 NEXT TO ANNOUNCE</div>
                  
                  {/* Announcement text */}
                  <div className="bg-background p-4 rounded-lg border-2 border-border mb-4">
                    <div className="text-sm text-muted-foreground mb-2">Say:</div>
                    <div className="text-2xl text-foreground mb-3">
                      "In {nextPosition}{getPositionSuffix(nextPosition!)} place with {nextTeam.score} point{nextTeam.score !== 1 ? 's' : ''}, it's..."
                    </div>
                    <h1 className="text-5xl font-bold text-orange-500 leading-tight">
                      {nextTeam.name}
                    </h1>
                  </div>

                  {/* Winner indicator */}
                  {nextPosition === 1 && (
                    <div className="text-2xl animate-pulse text-orange-500">
                      🏆 WINNER! 🏆
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  Say the above announcement, then click "Next Team" to reveal them on screen
                </div>
              </div>
            </Card>
          </div>
        ) : currentTeam ? (
          <div className="text-center">
            <Card className="bg-[#34495e] border-4 border-[#27ae60] p-12 max-w-4xl shadow-2xl">
              <div className="space-y-8">
                {/* Final Team Revealed */}
                <div className="text-3xl font-bold text-[#27ae60] mb-4">
                  🎉 ALL TEAMS REVEALED! 🎉
                </div>
                
                {/* Current Winner */}
                <div className="flex items-center justify-center gap-4">
                  {getPositionIcon(currentPosition!)}
                  <div className="text-6xl font-bold text-[#f39c12]">
                    WINNER: {currentTeam.name}
                  </div>
                </div>

                {/* Score */}
                <div className="bg-[#2c3e50] p-8 rounded-lg border-2 border-[#4a5568]">
                  <div className="text-2xl text-[#95a5a6] mb-2">Winning Score</div>
                  <div className="text-7xl font-bold text-[#3498db]">
                    {currentTeam.score}
                  </div>
                  <div className="text-xl text-[#95a5a6] mt-2">
                    point{currentTeam.score !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="text-5xl animate-pulse">
                  🏆 CONGRATULATIONS! 🏆
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-[#34495e] rounded-lg border border-[#4a5568]">
        <h3 className="font-semibold text-[#ecf0f1] mb-2">How it works:</h3>
        <ul className="text-sm text-[#95a5a6] space-y-1">
          <li>• Click "Next Team" to reveal each team from last place to first place</li>
          <li>��� Each team appears simultaneously on this screen and the external display</li>
          <li>• Build suspense by revealing the winner last!</li>
          <li>• Use "Reset" to start over if needed</li>
        </ul>
      </div>
    </div>
  );
}