const { z } = require('zod');

const StartQuizSchema = z.object({
  quizId: z.string(),
  seed: z.number().optional()
});

const ScoreSchema = z.object({
  quizId: z.string(),
  answers: z.array(z.object({ q: z.string(), a: z.any() }))
});

module.exports = { StartQuizSchema, ScoreSchema };
