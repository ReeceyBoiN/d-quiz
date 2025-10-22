// testQuiz.js
const { loadQuizFromFile } = require("./quizLoader.js");

(async () => {
  const filePath = "C:\\Users\\Reece N Gaming PC\\Desktop\\Round 1 - Keypad.sqq";

  try {
    const quiz = await loadQuizFromFile(filePath);
    console.log("✅ File loaded successfully!");
    console.log("Game:", quiz.game);
    console.log("Title:", quiz.title);
    console.log("Questions:", quiz.questions.length);
    console.log("Example question:", quiz.questions[0]);
  } catch (err) {
    console.error("❌ Error loading file:", err.message);
  }
})();
