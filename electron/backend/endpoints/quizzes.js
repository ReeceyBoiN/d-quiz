import { z } from 'zod';
import bus from '../../utils/bus.js';

export default (app) => {
  app.get('/quizzes', (_req, res) => {
    res.json([{ id: 'sample', title: 'Sample Quiz' }]);
  });

  app.post('/quizzes/:id/start', (req, res) => {
    const schema = z.object({ seed: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues });
    bus.emit('quiz:start', { quizId: req.params.id, seed: parsed.data.seed ?? null, ts: Date.now() });
    res.json({ ok: true, quizId: req.params.id });
  });
};
