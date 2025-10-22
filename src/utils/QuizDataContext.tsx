import React, { createContext, useContext, useState, ReactNode } from "react";

export interface LoadedQuizQuestion {
  type: 'letters' | 'multi' | 'numbers' | 'nearest' | 'sequence' | 'buzzin' | string;
  q: string;
  answerText?: string;
  options?: string[];
  correctIndex?: number;
  imageDataUrl?: string;
  meta?: { short_answer?: string; user_view?: string };
}

export interface LoadedQuiz {
  game: string;
  title?: string;
  gameVariation?: string;
  questions: LoadedQuizQuestion[];
}

interface QuizDataContextValue {
  currentQuiz: LoadedQuiz | null;
  setCurrentQuiz: (quiz: LoadedQuiz | null) => void;
}

const QuizDataContext = createContext<QuizDataContextValue | undefined>(undefined);

export function QuizDataProvider({ children }: { children: ReactNode }) {
  const [currentQuiz, setCurrentQuiz] = useState<LoadedQuiz | null>(null);

  return (
    <QuizDataContext.Provider value={{ currentQuiz, setCurrentQuiz }}>
      {children}
    </QuizDataContext.Provider>
  );
}

export function useQuizData() {
  const ctx = useContext(QuizDataContext);
  if (!ctx) throw new Error("useQuizData must be used within a QuizDataProvider");
  return ctx;
}
