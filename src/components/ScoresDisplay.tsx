import React from "react";
import { Trophy, Crown, Medal } from "lucide-react";

interface Quiz {
  id: string;
  name: string;
  type: string;
  score?: number;
  scrambled?: boolean;
}

interface ScoresDisplayProps {
  quizzes: Quiz[];
}

export function ScoresDisplay({ quizzes }: ScoresDisplayProps) {
  const sortedQuizzes = [...quizzes].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  const getPositionIcon = (index: number) => {
    if (index === 0) return <Crown className="w-8 h-8 text-[#f1c40f]" />;
    if (index === 1) return <Medal className="w-6 h-6 text-[#95a5a6]" />;
    if (index === 2) return <Medal className="w-6 h-6 text-[#cd7f32]" />;
    return <div className="w-8 h-8 flex items-center justify-center text-[#ecf0f1] text-xl font-bold">{index + 1}</div>;
  };

  const getPositionColor = (index: number) => {
    if (index === 0) return "from-[#f1c40f]/20 to-[#f39c12]/20 border-[#f1c40f]/30";
    if (index === 1) return "from-[#95a5a6]/20 to-[#7f8c8d]/20 border-[#95a5a6]/30";
    if (index === 2) return "from-[#cd7f32]/20 to-[#d35400]/20 border-[#cd7f32]/30";
    return "from-[#34495e]/20 to-[#2c3e50]/20 border-[#4a5568]/30";
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#2c3e50] to-[#34495e] p-8 overflow-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Trophy className="w-12 h-12 text-[#f39c12]" />
          <h1 className="text-6xl font-bold text-[#ecf0f1] tracking-wide">LEADERBOARD</h1>
        </div>
        <div className="text-xl text-[#95a5a6]">Current Team Standings</div>
        <div className="w-24 h-1 bg-gradient-to-r from-[#3498db] to-[#f39c12] mx-auto mt-4 rounded-full"></div>
      </div>

      {/* Scores List */}
      <div className="max-w-4xl mx-auto space-y-3">
        {sortedQuizzes.map((quiz, index) => (
          <div
            key={quiz.id}
            className={`
              relative flex items-center gap-6 p-6 rounded-2xl border backdrop-blur-sm
              bg-gradient-to-r ${getPositionColor(index)}
              transform transition-all duration-300 hover:scale-102
              ${index === 0 ? 'shadow-2xl scale-105' : 'shadow-lg'}
            `}
          >
            {/* Position */}
            <div className="flex items-center justify-center min-w-[4rem]">
              {getPositionIcon(index)}
            </div>

            {/* Team Name */}
            <div className="flex-1">
              <h3 className={`text-2xl font-bold text-[#ecf0f1] ${index === 0 ? 'text-3xl' : ''}`}>
                {quiz.name}
              </h3>
              {index < 3 && (
                <div className="text-sm text-[#95a5a6] mt-1">
                  {index === 0 ? "🏆 Champion" : index === 1 ? "🥈 Runner-up" : "🥉 Third Place"}
                </div>
              )}
            </div>

            {/* Score */}
            <div className="text-right min-w-[6rem]">
              <div className={`text-4xl font-bold ${
                index === 0 ? 'text-[#f1c40f] text-5xl' : 
                index === 1 ? 'text-[#95a5a6]' : 
                index === 2 ? 'text-[#cd7f32]' : 'text-[#3498db]'
              }`}>
                {quiz.score || 0}
              </div>
              <div className="text-sm text-[#95a5a6]">POINTS</div>
            </div>

            {/* Ranking indicator for top 3 */}
            {index < 3 && (
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{
                backgroundColor: index === 0 ? '#f1c40f' : index === 1 ? '#95a5a6' : '#cd7f32'
              }}>
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-[#7f8c8d]">
        <div className="text-lg">Quiz Competition • Real-time Standings</div>
        <div className="text-sm mt-2">Updated automatically during gameplay</div>
      </div>
    </div>
  );
}