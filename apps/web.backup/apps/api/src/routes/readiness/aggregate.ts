import { Router, type Request, type Response } from 'express';
import { aggregateReadinessV3 } from '../../services/readiness/aggregate';
import { synthesizeReadinessV5 } from '../../services/readiness/synthesize';
import { listReadinessChangelog } from '../../services/readiness/changelog';

const router = Router();

router.get('/:clinicianId/v3', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const result = await aggregateReadinessV3(clinicianId, {
      refreshSignals: req.query.refresh === 'true',
      recruiterSubscribers: Array.isArray(req.query.recipient)
        ? (req.query.recipient as string[])
        : typeof req.query.recipient === 'string'
          ? [req.query.recipient]
          : [],
      locale: req.locale,
    });

    return res.json({
      clinicianId,
      readinessScore: result.readinessScore,
      dimensions: result.dimensions,
      penalties: result.penalties,
      titleVII: result.titleVII,
      alerts: result.alerts,
    });
  } catch (error) {
    console.error('[readiness][aggregate]', error);
    return res.status(500).json({
      error: 'readiness_aggregate_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:clinicianId/v5', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const refreshSignals = req.query.refresh === 'true';
    const [result, history] = await Promise.all([
      synthesizeReadinessV5(clinicianId, { refreshSignals }),
      Promise.resolve(listReadinessChangelog(clinicianId, 32)),
    ]);

    const trend =
      history.length > 0
        ? history.map((entry) => ({
            timestamp: entry.changedAt,
            score: entry.nextScore,
            delta: entry.delta,
            drivers: entry.drivers,
            anchorTx: entry.anchorTx,
            merkleRoot: entry.merkleRoot,
          }))
        : [
            {
              timestamp: new Date().toISOString(),
              score: result.readinessScore,
              delta: 0,
              drivers: [],
              anchorTx: 'n/a',
              merkleRoot: 'n/a',
            },
          ];

    return res.json({
      clinicianId,
      readinessScore: result.readinessScore,
      recencyPenalty: result.recencyPenalty,
      signalBreakdown: result.signalBreakdown,
      recommendedActions: result.recommendedActions,
      weights: result.weights,
      trend,
    });
  } catch (error) {
    console.error('[readiness][synthesize]', error);
    return res.status(500).json({
      error: 'readiness_synthesis_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

