import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { openFromFile } from "../utils/openFromFile";
import { Eye, ArrowRight, Trophy } from "lucide-react";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
}

interface QuestionDisplayProps {
  question: Question;
  currentQuestionNumber: number;
  totalQuestions: number;
  timeRemaining: number;
  onRevealAnswer: () => void;
  onNextQuestion: () => void;
  showAnswer: boolean;
}

export function QuestionDisplay({
  question,
  currentQuestionNumber,
  totalQuestions,
  timeRemaining,
  onRevealAnswer,
  onNextQuestion,
  showAnswer
}: QuestionDisplayProps) {
  const timeProgress = (timeRemaining / question.timeLimit) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Main Title/Brand */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-[#ecf0f1] tracking-wide">
          POP QUIZ
        </h1>
      </div>

      {/* Quiz Pack Selection Section */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-center text-[#ecf0f1] text-lg font-medium mb-4">
          Quiz Pack Selection
        </h2>
        
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md">
            Home
          </Button>
          
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md">
            Back
          </Button>
          
          <Button
            className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md"
            onClick={async () => {
              try {
                const res = await openFromFile();
                if (!res || res.ok === false) console.error(res?.error || 'Failed to open folder');
              } catch (e) {
                console.error(e);
              }
            }}
          >
            Open From File
          </Button>
          
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md">
            Refresh
          </Button>
        </div>

        {/* File Browser Simulation */}
        <Card className="min-h-[400px] bg-[#34495e] border-[#4a5568]">
          <CardHeader>
            <CardTitle className="text-xl text-[#ecf0f1]">Select Quiz Pack File</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[350px] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Simulate folders and files */}
              {[
                'Quiz Pack 1', 'Quiz Pack 2', 'Holiday Quiz', 'Sports Quiz', 
                'Music Quiz', 'Science Quiz', 'History Quiz', 'Movie Quiz',
                'Geography Quiz', 'Art Quiz', 'Literature Quiz', 'General Knowledge',
                'Math Quiz', 'Chemistry Quiz', 'Physics Quiz', 'Biology Quiz',
                'Pop Culture Quiz', 'TV Shows Quiz', 'Celebrity Quiz', 'Food Quiz',
                'Travel Quiz', 'Nature Quiz', 'Animals Quiz', 'Space Quiz',
                'Technology Quiz', 'Gaming Quiz', 'Fashion Quiz', 'Architecture Quiz',
                'Philosophy Quiz', 'Psychology Quiz', 'Economics Quiz', 'Politics Quiz',
                'Religion Quiz', 'Mythology Quiz', 'Languages Quiz', 'Cooking Quiz'
              ].map((folderName, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center p-4 rounded-lg bg-[#2c3e50] hover:bg-[#233242] cursor-pointer transition-all duration-200 hover:scale-105"
                >
                  <svg
                    className="w-12 h-12 text-[#f39c12] mb-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                  </svg>
                  <span className="text-sm text-[#ecf0f1] text-center">
                    {folderName}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
