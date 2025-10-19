import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface Participant {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
  lastAnswerTime?: number;
  streak: number;
  answer?: string; // Team's answer for the current question
}

interface ScoreBoardProps {
  participants: Participant[];
  currentQuestionNumber: number;
  showAnswers?: boolean; // Whether to show the answer boxes
}

export function ScoreBoard({ participants, currentQuestionNumber, showAnswers = false }: ScoreBoardProps) {
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return "🥇";
      case 1: return "🥈";
      case 2: return "🥉";
      default: return `#${index + 1}`;
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 5) return "bg-[#9b59b6]";
    if (streak >= 3) return "bg-[#f39c12]";
    if (streak >= 2) return "bg-[#3498db]";
    return "bg-[#7f8c8d]";
  };

  return (
    <Card className="h-full bg-[#34495e] border-[#4a5568]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-[#ecf0f1]">
          Leaderboard
          <Badge variant="secondary" className="bg-[#7f8c8d] text-[#ecf0f1]">
            {participants.filter(p => p.isConnected).length} online
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
        {sortedParticipants.map((participant, index) => (
          <div
            key={participant.id}
            className={`flex items-center gap-2 p-3 rounded border transition-all ${
              participant.isConnected 
                ? 'bg-[#2c3e50] border-[#4a5568] hover:bg-[#233242]' 
                : 'bg-[#34495e] border-[#4a5568] opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg font-medium min-w-[2rem] text-center text-[#ecf0f1]">
                {getRankIcon(index)}
              </span>
              
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-sm bg-[#3498db] text-white">
                  {participant.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-[#ecf0f1]">{participant.name}</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={participant.isConnected ? "default" : "secondary"}
                    className={`text-xs ${
                      participant.isConnected 
                        ? "bg-[#27ae60] text-white" 
                        : "bg-[#7f8c8d] text-[#ecf0f1]"
                    }`}
                  >
                    {participant.isConnected ? "Online" : "Offline"}
                  </Badge>
                  {participant.streak > 1 && (
                    <Badge 
                      className={`text-xs text-white ${getStreakColor(participant.streak)}`}
                    >
                      {participant.streak}🔥
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Team Answer Box */}
            {showAnswers && (
              <div className="flex items-center gap-2">
                <div className="w-12 h-8 bg-black border border-[#4a5568] rounded flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {participant.answer || '—'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="text-right">
              <p className="font-bold text-lg text-[#ecf0f1]">{participant.score}</p>
              {participant.lastAnswerTime && (
                <p className="text-xs text-[#95a5a6]">
                  {participant.lastAnswerTime.toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        ))}
        
        {participants.length === 0 && (
          <div className="text-center py-8 text-[#95a5a6]">
            <p>No participants yet</p>
            <p className="text-sm">Share the quiz code to get started!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}