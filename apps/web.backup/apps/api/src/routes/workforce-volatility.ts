/**
 * Batch 434 — Workforce Predictive Volatility Engine v7
 */

import { Router, type Request, type Response } from 'express';
import { generateVolatilityProfile, exportVolatilityPack } from '../services/workforce-volatility';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { region, signals } = req.body;
    if (!region || !signals) {
      return res.status(400).json({ error: 'region and signals required' });
    }
    const result = await generateVolatilityProfile(region, signals);
    return res.json(result);
  } catch (error) {
    console.error('[workforce-volatility] error', error);
    return res.status(500).json({ error: 'workforce_volatility_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.workforceVolatility.findUnique({ where: { region } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.volatility);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:region/export', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const dossier = await exportVolatilityPack(region);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








