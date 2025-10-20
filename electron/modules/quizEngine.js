const bus = require('../utils/bus');

async function startQuiz({ quizId, seed }) {
  // Replace with real logic; emit events to WS clients via bus
  bus.emit('quiz:start', { quizId, ts: Date.now() });
  return { started: true, quizId, seed: seed ?? null };
}

module.exports = { startQuiz };
