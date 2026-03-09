import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Trophy, Medal, Award, ChevronRight, RotateCcw, Download } from "lucide-react";
import { playApplauseSound } from "../utils/audioUtils";

interface Quiz {
  id: string;
  name: string;
  score: number;
  scrambled?: boolean;
  buzzerSound?: string;
  photoUrl?: string;
}

export interface RevealedTeamWithPosition {
  id: string;
  name: string;
  score: number;
  position: number;
  isJoint: boolean;
  buzzerSound?: string;
  photoUrl?: string;
}

interface LeaderboardRevealProps {
  quizzes: Quiz[];
  onExternalDisplayUpdate: (content: string, data?: any) => void;
  onPlayTeamBuzzer?: (buzzerSound: string) => void;
}

/**
 * Calculate positions accounting for ties.
 * Teams are sorted ascending by score (worst first).
 * Position = number of teams in the FULL list with a higher score + 1.
 * isJoint = another team shares the same score.
 */
function calculatePositions(sortedTeamsAsc: Quiz[]): RevealedTeamWithPosition[] {
  return sortedTeamsAsc.map((team) => {
    const betterCount = sortedTeamsAsc.filter(t => t.score > team.score).length;
    const position = betterCount + 1;
    const isJoint = sortedTeamsAsc.filter(t => t.score === team.score).length > 1;
    return {
      id: team.id,
      name: team.name,
      score: team.score,
      position,
      isJoint,
      buzzerSound: team.buzzerSound,
      photoUrl: team.photoUrl,
    };
  });
}

function formatPosition(position: number, isJoint: boolean): string {
  const suffix = getPositionSuffix(position);
  return isJoint ? `Joint ${position}${suffix}` : `${position}${suffix}`;
}

function getPositionSuffix(position: number) {
  if (position % 10 === 1 && position !== 11) return "st";
  if (position % 10 === 2 && position !== 12) return "nd";
  if (position % 10 === 3 && position !== 13) return "rd";
  return "th";
}

function exportLeaderboardImage(teams: Quiz[]) {
  // Sort teams by score descending (best first) for the export
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  const logoUrl = 'https://cdn.builder.io/api/v1/image/assets%2Ffc9fa4b494f14138b58309dabb6bd450%2Fb0568b833d844f8db7ee325b5de9e5fb?format=webp&width=800&height=1200';

  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.onload = () => {
    const padding = 40;
    const rowHeight = 52;
    const logoHeight = 120;
    const logoAspect = logo.naturalWidth / logo.naturalHeight;
    const logoWidth = logoHeight * logoAspect;
    const headerHeight = logoHeight + 80;
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

    const logoX = (width - logoWidth) / 2;
    const logoY = padding + 10;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

    const subtitleY = logoY + logoHeight + 28;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('LEADERBOARD', width / 2, subtitleY);

    const dividerY = subtitleY + 18;
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, dividerY);
    ctx.lineTo(width - padding, dividerY);
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

export function LeaderboardReveal({ quizzes, onExternalDisplayUpdate, onPlayTeamBuzzer }: LeaderboardRevealProps) {
  const [currentRevealIndex, setCurrentRevealIndex] = useState(-1);
  const [sortedTeams, setSortedTeams] = useState<Quiz[]>([]);
  const [teamsWithPositions, setTeamsWithPositions] = useState<RevealedTeamWithPosition[]>([]);

  // Sort teams by score (ascending - worst to best for dramatic reveal)
  useEffect(() => {
    const sorted = [...quizzes].sort((a, b) => a.score - b.score);
    setSortedTeams(sorted);
    setTeamsWithPositions(calculatePositions(sorted));
  }, [quizzes]);

  // Auto-start reveal when component mounts
  useEffect(() => {
    setCurrentRevealIndex(-1);
    onExternalDisplayUpdate("leaderboard-intro");
  }, []);

  const handleNext = () => {
    if (currentRevealIndex < sortedTeams.length - 1) {
      const nextIndex = currentRevealIndex + 1;
      setCurrentRevealIndex(nextIndex);
      playApplauseSound();

      const currentTeam = sortedTeams[nextIndex];
      const teamPos = teamsWithPositions[nextIndex];
      const isWinner = nextIndex === sortedTeams.length - 1;

      // Build revealed teams list (all teams revealed so far, sorted by position asc)
      const revealedTeamsWithPositions = teamsWithPositions
        .slice(0, nextIndex + 1)
        .sort((a, b) => a.position - b.position);

      // If this is the winner (1st place), also play their buzzer sound
      if (isWinner && currentTeam.buzzerSound && onPlayTeamBuzzer) {
        onPlayTeamBuzzer(currentTeam.buzzerSound);
      }

      if (isWinner && currentTeam.photoUrl) {
        // For the winner, first show their photo on the external display
        onExternalDisplayUpdate("leaderboard-winner-photo", {
          team: currentTeam,
          position: teamPos.position,
          totalTeams: sortedTeams.length,
          photoUrl: currentTeam.photoUrl,
        });

        // After 5 seconds, transition back to the leaderboard with all teams revealed
        setTimeout(() => {
          onExternalDisplayUpdate("leaderboard-reveal", {
            team: currentTeam,
            position: teamPos.position,
            isJoint: teamPos.isJoint,
            totalTeams: sortedTeams.length,
            isLast: true,
            revealedTeamsWithPositions,
          });
        }, 5000);
      } else {
        onExternalDisplayUpdate("leaderboard-reveal", {
          team: currentTeam,
          position: teamPos.position,
          isJoint: teamPos.isJoint,
          totalTeams: sortedTeams.length,
          isLast: isWinner,
          revealedTeamsWithPositions,
        });
      }
    }
  };

  const handleReset = () => {
    setCurrentRevealIndex(-1);
    onExternalDisplayUpdate("leaderboard-intro");
  };

  // Spacebar shortcut for Next Team button
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (currentRevealIndex < sortedTeams.length - 1) {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentRevealIndex, sortedTeams.length, teamsWithPositions]);

  const allRevealed = currentRevealIndex >= sortedTeams.length - 1 && sortedTeams.length > 0;

  // Build the full list for display: revealed teams show data, unrevealed show placeholder
  const displayRows = teamsWithPositions.map((team, index) => {
    const isRevealed = index <= currentRevealIndex;
    const isCurrentReveal = index === currentRevealIndex;
    return { ...team, isRevealed, isCurrentReveal };
  }).sort((a, b) => a.position - b.position); // Sort by position (1st at top)

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-orange-500" />
          <h1 className="text-lg font-bold text-foreground">Leaderboard Reveal</h1>
          <span className="text-sm text-muted-foreground">
            {currentRevealIndex + 1} / {sortedTeams.length} revealed
          </span>
          {allRevealed && (
            <Badge className="bg-green-600 text-white text-xs">Complete</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleNext}
            disabled={allRevealed}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
          >
            <ChevronRight className="w-4 h-4 mr-1" />
            Next Team
          </Button>
          <Button
            onClick={() => exportLeaderboardImage(quizzes)}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main table area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            <div className="col-span-2">Pos</div>
            <div className="col-span-7">Team</div>
            <div className="col-span-3 text-right">Score</div>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-border">
            {displayRows.map((row) => {
              const posIcon = row.position === 1 ? <Trophy className="w-5 h-5 text-yellow-500" /> :
                              row.position === 2 ? <Medal className="w-5 h-5 text-gray-400" /> :
                              row.position === 3 ? <Award className="w-5 h-5 text-amber-600" /> : null;

              if (!row.isRevealed) {
                // Unrevealed row — dimmed placeholder
                return (
                  <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-3 opacity-30">
                    <div className="col-span-2 text-sm text-muted-foreground">???</div>
                    <div className="col-span-7 text-sm text-muted-foreground">???</div>
                    <div className="col-span-3 text-right text-sm text-muted-foreground">—</div>
                  </div>
                );
              }

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 transition-colors ${
                    row.isCurrentReveal
                      ? 'bg-orange-500/15 border-l-4 border-l-orange-500'
                      : ''
                  }`}
                >
                  {/* Position */}
                  <div className="col-span-2 flex items-center gap-1">
                    {posIcon || (
                      <span className="text-sm font-bold text-primary">{row.position}</span>
                    )}
                    {row.isJoint && (
                      <span className="text-[10px] text-orange-400 font-medium">Joint</span>
                    )}
                  </div>

                  {/* Team name */}
                  <div className="col-span-7 flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      row.isCurrentReveal ? 'text-orange-500' : 'text-foreground'
                    }`}>
                      {row.name}
                    </span>
                    {row.isCurrentReveal && (
                      <span className="text-xs text-orange-400 animate-pulse">NEW</span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-3 text-right">
                    <span className="text-sm font-bold text-blue-400">{row.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">SPACE</kbd> or click "Next Team" to reveal
      </div>
    </div>
  );
}
