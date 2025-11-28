import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PopoutDisplay, type QuizStage } from "./PopoutDisplay";
import { Play, Pause, RotateCcw, Monitor } from "lucide-react";

interface QuizControllerProps {
  onOpenPopout: () => void;
}

export function QuizController({ onOpenPopout }: QuizControllerProps) {
  const [currentStage, setCurrentStage] = useState<QuizStage>("loading");
  const [timerValue, setTimerValue] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [popoutWindow, setPopoutWindow] = useState<Window | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stages: QuizStage[] = [
    "loading",
    "question", 
    "possibleAnswers", 
    "timer", 
    "questionRepeat", 
    "correctAnswer", 
    "fastestTeam"
  ];

  const questionData = {
    question: "What is the capital of France?",
    answers: ["A) London", "B) Berlin", "C) Paris", "D) Madrid"],
    correctAnswer: "C) Paris",
    fastestTeam: "Team Thunder"
  };

  // Timer logic
  useEffect(() => {
    if (currentStage === "timer" && isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerValue(prev => {
          const newValue = prev - 1;
          
          // Use text-to-speech for countdown - only at 5-second intervals
          if (newValue > 0 && newValue % 5 === 0) {
            const utterance = new SpeechSynthesisUtterance(newValue.toString());
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;
            speechSynthesis.speak(utterance);
          }
          
          // Send timer update to popout window
          if (popoutWindow && !popoutWindow.closed) {
            popoutWindow.postMessage({
              type: "TIMER_UPDATE",
              value: newValue < 0 ? 0 : newValue
            }, "*");
          }
          
          if (newValue < 0) {
            setIsTimerRunning(false);
            
            // Say "Time's up!" at the end
            const finalUtterance = new SpeechSynthesisUtterance("Time's up!");
            finalUtterance.rate = 1;
            finalUtterance.pitch = 1;
            finalUtterance.volume = 1;
            speechSynthesis.speak(finalUtterance);
            
            nextStage(); // Auto-advance when timer reaches 0
            return 30; // Reset timer
          }
          return newValue;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentStage, isTimerRunning, popoutWindow]);

  // Auto-start timer when entering timer stage
  useEffect(() => {
    if (currentStage === "timer") {
      setIsTimerRunning(true);
      setTimerValue(30); // Reset timer when entering timer stage
      
      // Announce the starting time immediately if it's a 5-second interval
      if (30 % 5 === 0) {
        const utterance = new SpeechSynthesisUtterance("30");
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        speechSynthesis.speak(utterance);
      }
    }
  }, [currentStage]);

  // Send stage updates to popout window
  useEffect(() => {
    if (popoutWindow && !popoutWindow.closed) {
      popoutWindow.postMessage({
        type: "STAGE_CHANGE",
        stage: currentStage
      }, "*");
    }
  }, [currentStage, popoutWindow]);

  const nextStage = () => {
    const currentIndex = stages.indexOf(currentStage);
    const nextIndex = (currentIndex + 1) % stages.length;
    setCurrentStage(stages[nextIndex]);
    
    if (stages[nextIndex] !== "timer") {
      setIsTimerRunning(false);
    }
  };

  const skipTimer = () => {
    if (currentStage === "timer") {
      setIsTimerRunning(false);
      setTimerValue(30);
      nextStage();
    }
  };

  const resetQuiz = () => {
    setCurrentStage("loading");
    setTimerValue(30);
    setIsTimerRunning(false);
  };

  const openPopout = () => {
    const popout = window.open(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Quiz Display</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                font-family: system-ui, -apple-system, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";
              }
              .emoji {
                font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
                font-variant-emoji: emoji;
              }
              #root { 
                width: 100vw; 
                height: 100vh; 
              }
            </style>
          </head>
          <body>
            <div id="root">
              <div style="
                height: 100vh;
                width: 100vw;
                background: #2c3e50;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ecf0f1;
                font-size: 24px;
              ">
                Quiz Display - Waiting for content...
                <div style="margin-left: 20px; font-size: 16px; color: #95a5a6;">
                  Press SPACEBAR in main window to advance stages
                </div>
              </div>
            </div>
          </body>
        </html>
      `)}`, 
      "QuizDisplay", 
      "width=1920,height=1080,scrollbars=no,resizable=yes,toolbar=no,menubar=no,location=no,status=no"
    );
    
    if (popout) {
      setPopoutWindow(popout);
      
      // Handle window close
      const checkClosed = setInterval(() => {
        if (popout.closed) {
          setPopoutWindow(null);
          clearInterval(checkClosed);
        }
      }, 1000);
      
      // Send initial stage
      setTimeout(() => {
        if (!popout.closed) {
          popout.postMessage({
            type: "STAGE_CHANGE",
            stage: currentStage
          }, "*");
        }
      }, 100);
    }
    
    onOpenPopout();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space" && currentStage !== "timer") {
        event.preventDefault();
        nextStage();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentStage]);

  return (
    <div className="space-y-4 p-3">
      {/* Quiz Controls */}
      <Card className="bg-[#34495e] border-[#4a5568]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#ecf0f1] text-center text-base font-semibold">QUIZ CONTROL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={openPopout}
            className="w-full bg-[#2980b9] hover:bg-[#1f5582] text-white text-sm py-3 flex items-center justify-center gap-2 font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <Monitor className="h-5 w-5" />
            {popoutWindow && !popoutWindow.closed ? "POPOUT OPEN" : "OPEN DISPLAY"}
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={nextStage}
              disabled={currentStage === "timer"}
              className="bg-[#27ae60] hover:bg-[#229954] text-white text-sm py-3 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 hover:scale-105 shadow-md"
            >
              <Play className="h-4 w-4" />
              NEXT
            </Button>
            <Button
              onClick={resetQuiz}
              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white text-sm py-3 flex items-center justify-center gap-1 font-semibold transition-all duration-200 hover:scale-105 shadow-md"
            >
              <RotateCcw className="h-4 w-4" />
              RESET
            </Button>
          </div>

          {currentStage === "timer" && (
            <Button
              onClick={skipTimer}
              className="w-full bg-[#f39c12] hover:bg-[#e67e22] text-white text-sm py-3 font-semibold transition-all duration-200 hover:scale-105 shadow-md"
            >
              SKIP TIMER ({timerValue}s)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
