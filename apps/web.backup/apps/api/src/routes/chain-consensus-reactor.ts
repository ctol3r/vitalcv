/**
 * Batch 435 — Chain Integrity Consensus Reactor v7
 */

import { Router, type Request, type Response } from 'express';
import { generateConsensusReactor, exportConsensusPack } from '../services/chain-consensus-reactor';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { signals } = req.body;
    if (!signals) {
      return res.status(400).json({ error: 'signals required' });
    }
    const result = await generateConsensusReactor(signals);
    return res.json(result);
  } catch (error) {
    console.error('[chain-consensus] error', error);
    return res.status(500).json({ error: 'chain_consensus_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.chainConsensusReactor.findUnique({ where: { id: 'current' } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.reactor);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const dossier = await exportConsensusPack();
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








