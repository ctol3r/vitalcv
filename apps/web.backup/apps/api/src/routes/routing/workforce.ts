import { Router, type Request, type Response } from 'express';
import {
  calculateRoutingEligibility,
  calculateCrossBorderRouting,
  calculateSurgeRouting,
  detectRoutingConflicts,
  suggestNextStates,
  anchorRoutingSnapshot,
} from '@/services/routing/workforceRouting';

const router = Router();

// Calculate routing eligibility
router.get('/:clinicianId/eligibility', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await calculateRoutingEligibility(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[WorkforceRouting] Eligibility calculation failed', error);
    return res.status(500).json({
      error: 'eligibility_calculation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cross-border routing
router.post('/cross-border', async (req: Request, res: Response) => {
  try {
    const { clinicianId, sourceCountry, targetCountry } = req.body;
    if (!clinicianId || !sourceCountry) {
      return res.status(400).json({ error: 'clinicianId and sourceCountry required' });
    }

    const result = await calculateCrossBorderRouting(clinicianId, sourceCountry, targetCountry);
    return res.json(result);
  } catch (error) {
    console.error('[WorkforceRouting] Cross-border routing failed', error);
    return res.status(500).json({
      error: 'cross_border_routing_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Surge routing
router.post('/surge', async (req: Request, res: Response) => {
  try {
    const { clinicianId, targetState, emergencyType } = req.body;
    if (!clinicianId || !targetState || !emergencyType) {
      return res.status(400).json({ error: 'clinicianId, targetState, and emergencyType required' });
    }

    const result = await calculateSurgeRouting(clinicianId, targetState, emergencyType);
    return res.json(result);
  } catch (error) {
    console.error('[WorkforceRouting] Surge routing failed', error);
    return res.status(500).json({
      error: 'surge_routing_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detect conflicts
router.get('/:clinicianId/conflicts', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await detectRoutingConflicts(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[WorkforceRouting] Conflict detection failed', error);
    return res.status(500).json({
      error: 'conflict_detection_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Suggest next states
router.get('/:clinicianId/suggestions', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await suggestNextStates(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[WorkforceRouting] Suggestions failed', error);
    return res.status(500).json({
      error: 'suggestions_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get routing
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
    const routing = await prisma.workforceRouting.findUnique({
      where: { clinicianId },
    });

    if (!routing) {
      return res.status(404).json({ error: 'routing_not_found' });
    }

    return res.json(routing);
  } catch (error) {
    console.error('[WorkforceRouting] Get failed', error);
    return res.status(500).json({
      error: 'get_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

