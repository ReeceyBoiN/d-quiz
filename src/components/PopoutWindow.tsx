import { useEffect, useState } from "react";
import { PopoutDisplay, type QuizStage } from "./PopoutDisplay";
import { CountdownTimer } from "./CountdownTimer";
import { useSettings } from "../utils/SettingsContext";

interface PopoutWindowProps {
  onClose?: () => void;
}

export function PopoutWindow({ onClose }: PopoutWindowProps) {
  const { gameModeTimers } = useSettings();
  const [currentStage, setCurrentStage] = useState<QuizStage>("loading");
  const [timerValue, setTimerValue] = useState(30);

  const questionData = {
    question: "What is the capital of France?",
    answers: ["A) London", "B) Berlin", "C) Paris", "D) Madrid"],
    correctAnswer: "C) Paris",
    fastestTeam: "Team Thunder"
  };

  const stages: QuizStage[] = [
    "loading",
    "question", 
    "possibleAnswers", 
    "timer", 
    "questionRepeat", 
    "correctAnswer", 
    "fastestTeam"
  ];

  const nextStage = () => {
    const currentIndex = stages.indexOf(currentStage);
    const nextIndex = (currentIndex + 1) % stages.length;
    setCurrentStage(stages[nextIndex]);
    
    if (stages[nextIndex] === "timer") {
      setTimerValue(gameModeTimers.keypad); // Default to keypad timer
    }
  };

  const skipTimer = () => {
    if (currentStage === "timer") {
      nextStage();
    }
  };

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "STAGE_CHANGE") {
        setCurrentStage(event.data.stage);
      }
      if (event.data.type === "TIMER_UPDATE") {
        setTimerValue(event.data.value);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      onClose?.();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [onClose]);

  // Don't render timer or correctAnswer stages - handle them with clean displays
  if (currentStage === "timer") {
    return (
      <div className="h-screen w-screen bg-[#f1c40f] flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-[#2c3e50]">
            Question 1 • Timer
          </div>
        </div>
        <CountdownTimer
          currentTime={timerValue}
          totalTime={gameModeTimers.keypad}
          size={80}
          showLabel={true}
          label="seconds"
          className="mb-8"
        />
      </div>
    );
  }

  if (currentStage === "correctAnswer") {
    return (
      <div className="h-screen w-screen bg-[#27ae60] flex flex-col items-center justify-center">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-white">
            Question 1 • Results
          </div>
        </div>
        <div className="text-6xl font-bold text-white mb-8">
          {questionData.correctAnswer}
        </div>
      </div>
    );
  }

  return (
    <PopoutDisplay
      stage={currentStage}
      onNext={nextStage}
      onSkipTimer={skipTimer}
      questionData={questionData}
      timerValue={timerValue}
    />
  );
}
