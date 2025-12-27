import { Router } from 'express';
import { list } from './service';
import { log } from '../../obs/logger';

const router = Router();

router.get('/pulse', async (req, res) => {
  const limitParam = Number(req.query.limit || 0);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  try {
    const events = await list(limit);
    res.json({ events });
  } catch (error) {
    log('error', 'pulse_list_failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Unable to load pulse events' });
  }
});

export default router;
