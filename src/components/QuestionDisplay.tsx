import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { getQuestionPacksPath, listDirectory, getParentPath } from "../utils/fileBrowser";
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

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ name: string; path: string; isDirectory: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadHome() {
    try {
      setLoading(true);
      const homePath = await getQuestionPacksPath();
      const items = await listDirectory(homePath);
      setCurrentPath(homePath);
      setEntries(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function openDir(dirPath: string) {
    try {
      setLoading(true);
      const items = await listDirectory(dirPath);
      setCurrentPath(dirPath);
      setEntries(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Load the user's Documents/PopQuiz/Question Packs by default
    loadHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md" onClick={loadHome}>
            Home
          </Button>
          
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md" onClick={() => {
            if (!currentPath) return;
            const parent = getParentPath(currentPath);
            if (parent) {
              openDir(parent);
            }
          }}>
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
          
          <Button className="bg-[#4A90E2] hover:bg-[#3498db] text-white py-3 text-base font-semibold transition-all duration-200 hover:scale-105 shadow-md" onClick={() => currentPath ? openDir(currentPath) : loadHome()}>
            Refresh
          </Button>
        </div>

        {/* File Browser */}
        <Card className="min-h-[400px] bg-[#34495e] border-[#4a5568]">
          <CardHeader>
            <CardTitle className="text-xl text-[#ecf0f1]">Select Quiz Pack File</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[350px] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Simulate folders and files */}
              {(entries.length === 0 && !loading) && (
                <div className="text-center col-span-full text-[#ecf0f1] opacity-80">No items</div>
              )}
              {entries.map((item, index) => (
                <div
                  key={item.path + index}
                  className="flex flex-col items-center p-4 rounded-lg bg-[#2c3e50] hover:bg-[#233242] cursor-pointer transition-all duration-200 hover:scale-105"
                  onClick={() => item.isDirectory && openDir(item.path)}
                  title={item.path}
                >
                  <svg
                    className="w-12 h-12 text-[#f39c12] mb-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                  </svg>
                  <span className="text-sm text-[#ecf0f1] text-center">
                    {item.name}
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
