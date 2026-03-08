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

function exportLeaderboardImage(teams: Quiz[]) {
  // Sort teams by score descending (best first) for the export
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  const logoUrl = 'https://cdn.builder.io/api/v1/image/assets%2Ffc9fa4b494f14138b58309dabb6bd450%2Fb0568b833d844f8db7ee325b5de9e5fb?format=webp&width=800&height=1200';

  // Load logo first, then draw canvas
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.onload = () => {
    const padding = 40;
    const rowHeight = 52;
    const logoHeight = 120;
    const logoAspect = logo.naturalWidth / logo.naturalHeight;
    const logoWidth = logoHeight * logoAspect;
    const headerHeight = logoHeight + 80; // logo + subtitle + divider spacing
    const footerHeight = 50;
    const width = 700;
    const height = headerHeight + ranked.length * rowHeight + footerHeight + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Decorative top bar
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#f39c12');
    grad.addColorStop(1, '#e67e22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 6);

    // Draw logo centered at top
    const logoX = (width - logoWidth) / 2;
    const logoY = padding + 10;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

    // Subtitle below logo
    const subtitleY = logoY + logoHeight + 28;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('LEADERBOARD', width / 2, subtitleY);

    // Divider line
    const dividerY = subtitleY + 18;
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, dividerY);
    ctx.lineTo(width - padding, dividerY);
    ctx.stroke();

    // Column headers
    const tableTop = padding + headerHeight;
    ctx.fillStyle = '#95a5a6';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RANK', padding + 10, tableTop - 10);
    ctx.fillText('TEAM', padding + 90, tableTop - 10);
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', width - padding - 10, tableTop - 10);

    // Team rows
    ranked.forEach((team, i) => {
      const y = tableTop + i * rowHeight;
      const pos = i + 1;

      // Alternating row background
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(padding, y, width - padding * 2, rowHeight);
      }

      // Highlight top 3
      const medal = pos === 1 ? '\u{1F947}' : pos === 2 ? '\u{1F948}' : pos === 3 ? '\u{1F949}' : null;
      const nameColor = pos === 1 ? '#f1c40f' : pos === 2 ? '#bdc3c7' : pos === 3 ? '#e67e22' : '#ecf0f1';

      // Position
      ctx.textAlign = 'left';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = nameColor;
      const posText = medal ? `${medal}` : `${pos}`;
      ctx.fillText(posText, padding + 16, y + 34);

      // Team name (truncate if too long to avoid overlapping score)
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = nameColor;
      const maxNameWidth = width - padding * 2 - 90 - 80; // space between name start and score column
      let displayName = team.name;
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxNameWidth) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '…';
      }
      ctx.fillText(displayName, padding + 90, y + 34);

      // Score
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#3498db';
      ctx.fillText(`${team.score}`, width - padding - 16, y + 34);
    });

    // Footer watermark
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(243, 156, 18, 0.4)';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('popquiz', width / 2, height - 20);

    // Trigger download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PopQuiz_Leaderboard.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // Fallback if logo fails to load — export without logo
  logo.onerror = () => {
    console.warn('Failed to load logo, exporting without it');
    const padding = 40;
    const rowHeight = 52;
    const headerHeight = 160;
    const footerHeight = 50;
    const width = 700;
    const height = headerHeight + ranked.length * rowHeight + footerHeight + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#f39c12');
    grad.addColorStop(1, '#e67e22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 6);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.fillText('POP QUIZ', width / 2, padding + 50);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('LEADERBOARD', width / 2, padding + 90);

    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 110);
    ctx.lineTo(width - padding, padding + 110);
    ctx.stroke();

    const tableTop = padding + headerHeight;
    ctx.fillStyle = '#95a5a6';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RANK', padding + 10, tableTop - 10);
    ctx.fillText('TEAM', padding + 90, tableTop - 10);
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', width - padding - 10, tableTop - 10);

    ranked.forEach((team, i) => {
      const y = tableTop + i * rowHeight;
      const pos = i + 1;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(padding, y, width - padding * 2, rowHeight);
      }
      const medal = pos === 1 ? '\u{1F947}' : pos === 2 ? '\u{1F948}' : pos === 3 ? '\u{1F949}' : null;
      const nameColor = pos === 1 ? '#f1c40f' : pos === 2 ? '#bdc3c7' : pos === 3 ? '#e67e22' : '#ecf0f1';
      ctx.textAlign = 'left';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = nameColor;
      ctx.fillText(medal ? `${medal}` : `${pos}`, padding + 16, y + 34);
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = nameColor;
      const maxNameWidth = width - padding * 2 - 90 - 80;
      let displayName = team.name;
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxNameWidth) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '…';
      }
      ctx.fillText(displayName, padding + 90, y + 34);
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#3498db';
      ctx.fillText(`${team.score}`, width - padding - 16, y + 34);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(243, 156, 18, 0.4)';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('popquiz', width / 2, height - 20);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PopQuiz_Leaderboard.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  logo.src = logoUrl;
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
              onClick={() => exportLeaderboardImage(quizzes)}
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
