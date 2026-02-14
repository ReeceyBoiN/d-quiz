import { z } from 'zod';

const StartQuizSchema = z.object({
  quizId: z.string(),
  seed: z.number().optional()
});

const ScoreSchema = z.object({
  quizId: z.string(),
  answers: z.array(z.object({ q: z.string(), a: z.any() }))
});

const GetBuzzerPathSchema = z.object({
  buzzerName: z.string().min(1, 'Buzzer name is required')
});

export { StartQuizSchema, ScoreSchema, GetBuzzerPathSchema };
