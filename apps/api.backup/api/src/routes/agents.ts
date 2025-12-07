import { PrismaClient } from '@prisma/client';
import express, { Request, Response } from 'express';
import { emitEvent } from '../agents/bus.js';

const router = express.Router();
const prisma = new PrismaClient();

// Manual trigger (useful from UI or tests)
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { npi, type } = req.body || {};
    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ message: 'Invalid NPI' });
    }

    const t = String(type || 'NPLOOKUP_VIEW');
    emitEvent({ type: t as any, npi });
    return res.json({ ok: true, triggered: t, npi });
  } catch (error: any) {
    console.error('Trigger agent error:', error);
    return res.status(500).json({ error: 'Failed to trigger agent', details: error.message });
  }
});

// Recent runs
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const npi = req.query.npi ? String(req.query.npi) : undefined;
    const rows = await prisma.agentRun.findMany({
      where: npi ? { npi } : {},
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (error: any) {
    console.error('Get agent runs error:', error);
    return res.status(500).json({ error: 'Failed to get agent runs', details: error.message });
  }
});

export default router;
