import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Play, RotateCcw, FileText, ChevronUp, ChevronDown, X, Minus, Square, WifiOff, ShieldOff, Pause } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  backgroundColor?: string; // Background color for this team in the list
  disconnected?: boolean; // Whether the team is disconnected from their device
  blocked?: boolean; // Whether the team is blocked from earning points
  scrambled?: boolean; // Whether the team's keypad is scrambled
}

interface LeftSidebarProps {
  quizzes: Quiz[];
  selectedQuiz: string | null;
  onQuizSelect: (quizId: string) => void;
  onScoreChange: (teamId: string, change: number) => void;
  onScoreSet: (teamId: string, newScore: number) => void;
  onNameChange: (teamId: string, newName: string) => void;
  onDeleteTeam: (teamId: string, teamName: string, score: number) => void;
  onTeamDoubleClick?: (teamId: string) => void;
  teamAnswers?: {[teamId: string]: string};
  teamResponseTimes?: {[teamId: string]: number};
  lastResponseTimes?: {[teamId: string]: number};
  showAnswers?: boolean;
  scoresPaused?: boolean;
  scoresHidden?: boolean;
  teamAnswerStatuses?: {[teamId: string]: 'correct' | 'incorrect' | 'no-answer'};
  teamCorrectRankings?: {[teamId: string]: number};
  pendingTeams?: Array<{deviceId: string, playerId: string, teamName: string, timestamp: number}>;
  onApprovePendingTeam?: (deviceId: string, teamName: string) => void;
  onDeclinePendingTeam?: (deviceId: string, teamName: string) => void;
}

export function LeftSidebar({ quizzes, selectedQuiz, onQuizSelect, onScoreChange, onScoreSet, onNameChange, onDeleteTeam, onTeamDoubleClick, teamAnswers = {}, teamResponseTimes = {}, lastResponseTimes = {}, showAnswers = false, scoresPaused = false, scoresHidden = false, teamAnswerStatuses = {}, teamCorrectRankings = {}, pendingTeams = [], onApprovePendingTeam, onDeclinePendingTeam }: LeftSidebarProps) {
  const { responseTimesEnabled } = useSettings();
  
  // Debug logging - disabled for performance
  // console.log('LeftSidebar Debug:', {
  //   responseTimesEnabled,
  //   teamResponseTimes,
  //   teamAnswers,
  //   showAnswers
  // });
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingScore && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingScore]);

  const handleDoubleClick = (teamId: string, currentScore: number) => {
    setEditingScore(teamId);
    setEditValue(currentScore.toString());
  };

  // Removed handleDoubleClickName - double-click now opens TeamWindow instead

  const handleSaveScore = (teamId: string) => {
    const newScore = parseInt(editValue);
    if (!isNaN(newScore)) {
      onScoreSet(teamId, newScore);
    }
    setEditingScore(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingScore(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, teamId: string) => {
    if (e.key === "Enter") {
      handleSaveScore(teamId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Helper function to determine team background color with answer status priority
  const getTeamBackgroundColor = (quiz: Quiz) => {
    // If disconnected, use grey
    if (quiz.disconnected) {
      return '#6b7280';
    }
    
    // Answer status colors take priority (for keypad modes)
    const answerStatus = teamAnswerStatuses[quiz.id];
    if (answerStatus) {
      switch (answerStatus) {
        case 'correct':
          // Different shades of green based on ranking for correct teams
          const ranking = teamCorrectRankings[quiz.id];
          if (ranking === 1) {
            return 'var(--team-green-1st)'; // Brightest green for 1st place
          } else if (ranking === 2) {
            return 'var(--team-green-2nd)'; // Slightly less bright for 2nd place
          } else if (ranking === 3) {
            return 'var(--team-green-3rd)'; // Medium bright for 3rd place
          } else {
            return 'var(--team-green-rest)'; // Lighter green for 4th+ place
          }
        case 'incorrect':
          return '#ef4444'; // Red
        case 'no-answer':
          return '#9ca3af'; // Grey
      }
    }
    
    // Fall back to user-set background color
    return quiz.backgroundColor || undefined;
  };

  // Helper function to get team border style for top 3 correct teams
  const getTeamBorderStyle = (quiz: Quiz) => {
    const answerStatus = teamAnswerStatuses[quiz.id];
    if (answerStatus === 'correct') {
      const ranking = teamCorrectRankings[quiz.id];
      if (ranking === 1) {
        return 'border-emerald-600 border-2 shadow-lg shadow-emerald-600/30'; // 1st place - bold border and glow
      } else if (ranking === 2) {
        return 'border-emerald-500 border-2 shadow-md shadow-emerald-500/20'; // 2nd place - medium border and glow
      } else if (ranking === 3) {
        return 'border-emerald-400 border-2 shadow-sm shadow-emerald-400/15'; // 3rd place - light border and glow
      }
    }
    return 'border-transparent border-2'; // Default transparent border
  };

  return (
    <div className="w-full h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Teams header */}
      <div className="bg-sidebar-accent border-b border-sidebar-border px-2 py-2 flex-shrink-0" style={{ WebkitAppRegion: 'drag' }}>
        <div className="text-sm font-semibold text-sidebar-foreground flex items-center justify-between">
          {/* Window Control Buttons */}
          <div className="flex items-center">
            <button 
              className="w-14 h-7 bg-transparent hover:bg-red-600 transition-colors duration-150 flex items-center justify-center group border-r border-sidebar-border/30"
              title="Close"
              onClick={() => (window as any).api?.window?.close()}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <X className="w-4 h-4 text-sidebar-foreground group-hover:text-white transition-colors duration-150" />
            </button>
            <button 
              className="w-14 h-7 bg-transparent hover:bg-blue-500 transition-colors duration-150 flex items-center justify-center group border-r border-sidebar-border/30"
              title="Maximize"
              onClick={() => (window as any).api?.window?.maximize()}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <Square className="w-3 h-3 text-sidebar-foreground group-hover:text-white transition-colors duration-150" />
            </button>
            <button 
              className="w-14 h-7 bg-transparent hover:bg-blue-500 transition-colors duration-150 flex items-center justify-center group"
              title="Minimize"
              onClick={() => (window as any).api?.window?.minimize()}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <Minus className="w-4 h-4 text-sidebar-foreground group-hover:text-white transition-colors duration-150" />
            </button>
          </div>
          
          {/* Teams label and count moved to right */}
          <div className="flex items-center">
            TEAMS
            <Badge variant="secondary" className="ml-2 text-xs px-2 py-0 h-5">
              {quizzes.length}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Teams list */}
      <div className="flex-1 p-3 flex flex-col overflow-y-auto">
        {quizzes
          .map((quiz, index) => (
          <div key={`${quiz.id}-${quiz.scrambled}`} className="flex-1 flex flex-col">
            <div 
              className={`flex items-center w-full transition-all duration-200 hover:bg-sidebar-accent rounded-md flex-1 min-h-[3.5rem] relative ${quiz.disconnected ? 'opacity-60' : ''} ${getTeamBorderStyle(quiz)}`}
              style={{ backgroundColor: getTeamBackgroundColor(quiz) }}
              onDoubleClick={(e) => {
                // Only trigger if not double-clicking on score edit input or score badge
                const target = e.target as HTMLElement;
                if (!target.closest('input') && !target.closest('[title*="Double-click to edit score"]')) {
                  onTeamDoubleClick?.(quiz.id);
                }
              }}
            >
              {/* Delete button - positioned at top left */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTeam(quiz.id, quiz.name, quiz.score || 0);
                }}
                className="absolute top-1 left-1 z-10 h-4 w-4 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete team"
              >
                <X className="w-3 h-3" />
              </Button>

              {/* Team name button - responsive width area */}
              <Button
                variant="ghost"
                className="flex-1 justify-start px-3 py-0 h-full border-0 rounded-none text-sidebar-foreground hover:bg-transparent hover:text-sidebar-foreground min-w-0 items-center pl-8"
                onClick={() => onQuizSelect(quiz.id)}
                title="Click to select team"
              >
                <div className="w-full h-full overflow-hidden flex items-center gap-2">
                  {quiz.disconnected && (
                    <WifiOff className="w-4 h-4 text-red-500 flex-shrink-0" title="Team is disconnected" />
                  )}
                  {quiz.blocked && (
                    <ShieldOff className="w-4 h-4 text-orange-500 flex-shrink-0" title="Team is blocked from earning points" />
                  )}
                  {scoresPaused && (
                    <Pause className="w-4 h-4 text-orange-500 bg-orange-100 dark:bg-orange-900 rounded p-0.5 flex-shrink-0" title="Scores are paused - team points cannot change" />
                  )}
                  {quiz.scrambled && (
                    <RotateCcw className="w-4 h-4 text-purple-600 bg-purple-100 dark:bg-purple-900 rounded p-0.5 flex-shrink-0" title="Team's keypad is scrambled" />
                  )}
                  {/* Debug logging for scrambled state */}
                  {process.env.NODE_ENV === 'development' && console.log(`🔀 LeftSidebar render: Team ${quiz.name} (${quiz.id}) scrambled state:`, quiz.scrambled)}
                  <div className="leading-[1.15] text-left break-words whitespace-normal max-h-full text-[17px] flex-1">
                    {quiz.name}
                  </div>
                </div>
              </Button>
              
              {/* Team Answer Box with Response Time */}
              {showAnswers && ((responseTimesEnabled && teamResponseTimes[quiz.id] !== undefined) || teamAnswers[quiz.id]) && (
                <div className="flex flex-col items-center mr-2 flex-shrink-0">
                  {/* Response Time Display - shown when enabled and team has a response time for current question */}
                  {responseTimesEnabled && teamResponseTimes[quiz.id] !== undefined && (
                    <div className="bg-gray-400 rounded flex items-center justify-center flex-shrink-0 mb-1 px-1 py-0.5">
                      <span className="text-white text-xs font-bold leading-none">
                        {(teamResponseTimes[quiz.id] / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  {/* Answer box - only show when team has submitted an answer */}
                  {teamAnswers[quiz.id] && (
                    <div className="w-10 h-6 bg-black border border-sidebar-border rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {teamAnswers[quiz.id]}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Score badge with permanent controls - fixed position */}
              {quiz.score !== undefined && !scoresHidden && (
                <div 
                  className="flex items-center gap-2 flex-shrink-0 mr-3 ml-auto"
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {editingScore === quiz.id ? (
                    <input
                      ref={inputRef}
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, quiz.id)}
                      onBlur={() => handleSaveScore(quiz.id)}
                      className="text-sm px-2 py-1 h-6 bg-[#27ae60] text-white border-[#27ae60] min-w-[3rem] text-center rounded focus:outline-none focus:ring-1 focus:ring-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="text-sm px-2 py-1 h-6 bg-[#27ae60] text-white border-[#27ae60] min-w-[3rem] justify-center cursor-pointer hover:bg-[#2ecc71] transition-colors"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClick(quiz.id, quiz.score || 0);
                      }}
                      title="Double-click to edit score manually"
                    >
                      {quiz.score}
                    </Badge>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const amount = e.shiftKey ? 10 : 1;
                        onScoreChange(quiz.id, amount);
                      }}
                      className="p-1 hover:bg-sidebar-accent text-[#27ae60] transition-all duration-150 rounded hover:scale-110 active:scale-95"
                      title="Increase score by 1 (SHIFT+Click for 10)"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const amount = e.shiftKey ? -10 : -1;
                        onScoreChange(quiz.id, amount);
                      }}
                      className="p-1 hover:bg-sidebar-accent text-[#e74c3c] transition-all duration-150 rounded hover:scale-110 active:scale-95"
                      title="Decrease score by 1 (SHIFT+Click for 10)"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Separator line - shown after every item except the last */}
            {index < quizzes.length - 1 && (
              <div className="mx-3 my-1 border-t border-sidebar-border opacity-60"></div>
            )}
          </div>
        ))}
      </div>

      {/* Pending Teams Section */}
      {pendingTeams && pendingTeams.length > 0 && (
        <div className="border-t border-sidebar-border bg-sidebar-accent/30">
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="text-sm font-semibold text-sidebar-foreground flex items-center justify-between">
              <span>PENDING APPROVAL</span>
              <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
                {pendingTeams.length}
              </Badge>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
            {pendingTeams.map((team) => (
              <div key={team.deviceId} className="flex items-center gap-2 p-2 bg-sidebar rounded border border-sidebar-border/50 hover:border-sidebar-border/80 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sidebar-foreground truncate">
                    {team.teamName}
                  </div>
                  <div className="text-xs text-sidebar-foreground/60">
                    {new Date(team.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onApprovePendingTeam?.(team.deviceId, team.teamName)}
                    className="h-6 w-6 p-0 text-green-600 hover:bg-green-600/10"
                    title="Approve team"
                  >
                    <span className="text-sm font-bold">✓</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeclinePendingTeam?.(team.deviceId, team.teamName)}
                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-600/10"
                    title="Decline team"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
