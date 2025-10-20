async function scoreAttempt({ quizId, answers }) {
  // Pure logic; keep deterministic
  const score = answers.reduce((s) => s + 1, 0);
  return { quizId, score, max: answers.length };
}

module.exports = { scoreAttempt };
