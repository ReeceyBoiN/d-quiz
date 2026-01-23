import bus from '../utils/bus.js';

async function startQuiz({ quizId, seed }) {
  bus.emit('quiz:start', { quizId, ts: Date.now() });
  return { started: true, quizId, seed: seed ?? null };
}

export { startQuiz };
