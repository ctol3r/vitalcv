import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  buildTrustFabric,
  calculateTrustDepth,
  estimateTrustDiffusion,
  synthesizeVeracityNexus,
} from '../../services/trust/fabric';

const prisma = new PrismaClient();
const router = Router();

/**
 * Task 517.29 — Implement /api/trust/fabric
 * Main endpoint for trust fabric operations
 */
router.get('/trust/fabric', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as string | undefined;
    const global = String(req.query.global ?? 'true').toLowerCase() === 'true';

    const fabric = await buildTrustFabric({ prisma, region, global });

    return res.json({
      fabric,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[trust][fabric] get failed', error);
    return res.status(500).json({
      error: 'trust_fabric_get_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/trust/fabric/depth', async (req: Request, res: Response) => {
  try {
    const identityId = req.query.identityId as string;
    const chainId = req.query.chainId as string | undefined;

    if (!identityId) {
      return res.status(400).json({ error: 'identityId required' });
    }

    const depth = await calculateTrustDepth({ prisma, chainId, identityId });

    return res.json({ identityId, chainId, depth });
  } catch (error) {
    console.error('[trust][fabric][depth] get failed', error);
    return res.status(500).json({
      error: 'trust_depth_get_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/trust/fabric/diffusion', async (_req: Request, res: Response) => {
  try {
    const diffusion = await estimateTrustDiffusion({ prisma });

    return res.json(diffusion);
  } catch (error) {
    console.error('[trust][fabric][diffusion] get failed', error);
    return res.status(500).json({
      error: 'trust_diffusion_get_failed',
      message: extractMessage(error),
    });
  }
});

router.post('/trust/fabric/veracity', async (req: Request, res: Response) => {
  try {
    const { proofs } = req.body;

    if (!Array.isArray(proofs)) {
      return res.status(400).json({ error: 'proofs must be an array' });
    }

    const result = await synthesizeVeracityNexus({ prisma, proofs });

    return res.json(result);
  } catch (error) {
    console.error('[trust][fabric][veracity] post failed', error);
    return res.status(500).json({
      error: 'veracity_nexus_failed',
      message: extractMessage(error),
    });
  }
});

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;

