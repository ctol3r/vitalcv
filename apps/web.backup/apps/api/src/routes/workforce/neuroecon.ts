import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  buildNeuroEconomicTensor,
  predictEconomicMicroshock,
  generateLaborFlowEmbeddings,
  predictSpecialtyRegionMigration,
  forecastRoleEvolution,
} from '../../services/workforce/neuroecon';

const prisma = new PrismaClient();
const router = Router();

/**
 * Task 519.19 — Implement /api/workforce/neuroecon
 * Main endpoint for workforce neuroeconomic flow
 */
router.get('/workforce/neuroecon', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as string | undefined;
    const specialty = req.query.specialty as string | undefined;

    const tensor = await buildNeuroEconomicTensor({ prisma, region, specialty });

    return res.json({
      tensor,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[workforce][neuroecon] get failed', error);
    return res.status(500).json({
      error: 'neuroecon_tensor_get_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/workforce/neuroecon/microshock', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as string | undefined;
    const specialty = req.query.specialty as string | undefined;

    const result = await predictEconomicMicroshock({ prisma, region, specialty });

    return res.json(result);
  } catch (error) {
    console.error('[workforce][neuroecon][microshock] get failed', error);
    return res.status(500).json({
      error: 'microshock_prediction_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/workforce/neuroecon/embeddings', async (_req: Request, res: Response) => {
  try {
    const result = await generateLaborFlowEmbeddings({ prisma });

    return res.json(result);
  } catch (error) {
    console.error('[workforce][neuroecon][embeddings] get failed', error);
    return res.status(500).json({
      error: 'embeddings_generation_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/workforce/neuroecon/migration', async (req: Request, res: Response) => {
  try {
    const specialty = req.query.specialty as string;
    const fromRegion = req.query.fromRegion as string;
    const toRegion = req.query.toRegion as string;

    if (!specialty || !fromRegion || !toRegion) {
      return res.status(400).json({
        error: 'specialty, fromRegion, and toRegion required',
      });
    }

    const result = await predictSpecialtyRegionMigration({
      prisma,
      specialty,
      fromRegion,
      toRegion,
    });

    return res.json(result);
  } catch (error) {
    console.error('[workforce][neuroecon][migration] get failed', error);
    return res.status(500).json({
      error: 'migration_prediction_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/workforce/neuroecon/role-evolution', async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string;
    const horizon = req.query.horizon
      ? parseInt(req.query.horizon as string, 10)
      : undefined;

    if (!role) {
      return res.status(400).json({ error: 'role required' });
    }

    const result = await forecastRoleEvolution({ prisma, role, horizon });

    return res.json(result);
  } catch (error) {
    console.error('[workforce][neuroecon][role-evolution] get failed', error);
    return res.status(500).json({
      error: 'role_evolution_forecast_failed',
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

