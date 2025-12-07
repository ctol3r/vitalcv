import { Router, type Request, type Response } from 'express';
import { calculateRegImpact, generateRegImpactExport } from '../services/reg-impact';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { region, changes } = req.body;
    if (!region || !changes) return res.status(400).json({ error: 'region and changes required' });
    const result = await calculateRegImpact(region, changes);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'calculation_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.regImpactGrid.findUnique({ where: { region } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.grid);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:region/export', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const dossier = await generateRegImpactExport(region);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

