async function scoreAttempt({ quizId, answers }) {
  const score = answers.reduce((s) => s + 1, 0);
  return { quizId, score, max: answers.length };
}

export { scoreAttempt };
