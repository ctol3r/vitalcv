import { Router, type Request, type Response } from 'express';
import { runOnboardingSimulationV3 } from '../../services/onboarding/simulate';

const router = Router();

router.get('/api/onboarding/eta/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'missing_clinician_id',
      message: 'Provide clinicianId in the path parameter.',
    });
  }

  try {
    const simulation = await runOnboardingSimulationV3({
      clinicianId,
      orgId: typeof req.query.orgId === 'string' ? req.query.orgId : undefined,
    });

    return res.json({
      clinicianId,
      orgId: simulation.orgId ?? null,
      velocity: simulation.velocity,
      phases: simulation.phases,
      bottlenecks: simulation.bottlenecks,
      expediteSuggestions: simulation.expediteSuggestions,
      efficiency: simulation.efficiency,
      projectedCompletionDate: simulation.velocity.projectedCompletionDate,
      export: simulation.exportPayload,
    });
  } catch (error) {
    console.error('[onboarding][eta] simulation failed', error);
    return res.status(500).json({
      error: 'onboarding_eta_failed',
      message: error instanceof Error ? error.message : 'Unable to simulate onboarding timeline',
    });
  }
});

export default router;










