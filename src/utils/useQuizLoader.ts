import { useCallback } from "react";
import { useQuizData } from "./QuizDataContext";

export function useQuizLoader() {
  const { setCurrentQuiz } = useQuizData();

  const handleQuizFileSelection = useCallback(async (file: File | string) => {
    try {
      const { loadQuizFromFile } = await import("./quizLoader");
      const quiz = await loadQuizFromFile(file);

      setCurrentQuiz({ ...quiz, isQuizPack: true });

      console.log("✅ Quiz loaded:", quiz);
      console.log("Game:", quiz.game);
      console.log("Title:", quiz.title);
      console.log("Questions:", Array.isArray(quiz.questions) ? quiz.questions.length : 0);

      if (typeof alert !== "undefined") {
        const count = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
        alert(`Loaded quiz: ${quiz.title || quiz.game} (${count} questions)`);
      }

      return quiz;
    } catch (err) {
      console.error("❌ Error loading quiz file:", err);
      if (typeof alert !== "undefined") {
        alert("Failed to load quiz file. See console for details.");
      }
      throw err;
    }
  }, [setCurrentQuiz]);

  return { handleQuizFileSelection };
}
