import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildWorkforceGrid, ingestSupplyChainNodes } from '../../services/workforce/grid';

const prisma = new PrismaClient();
const router = Router();

router.get('/workforce/grid', async (req: Request, res: Response) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : 'global';
    const snapshot = await buildWorkforceGrid(region, { prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[workforce][grid] fetch failed', error);
    return res.status(500).json({ error: 'workforce_grid_failed', message: extractMessage(error) });
  }
});

router.post('/workforce/grid/ingest', async (req: Request, res: Response) => {
  try {
    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
    if (!nodes.length) {
      return res.status(400).json({ error: 'nodes_required' });
    }
    await ingestSupplyChainNodes(
      nodes.map((node) => ({
        region: node.region ?? 'global',
        specialty: node.specialty ?? 'general',
        supply: Number(node.supply ?? 0),
        demand: Number(node.demand ?? 0),
        readiness: typeof node.readiness === 'number' ? node.readiness : 1,
      })),
      { prisma },
    );
    const snapshot = await buildWorkforceGrid('global', { prisma });
    return res.json(snapshot);
  } catch (error) {
    console.error('[workforce][grid] ingest failed', error);
    return res.status(500).json({ error: 'workforce_ingest_failed', message: extractMessage(error) });
  }
});

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;

