import { Router, type Request, type Response } from 'express';
import { RiskGraphBuilder } from '../../services/risk/graph';
import { propagateRiskSignal } from '../../services/risk/propagate';

const router = Router();
const builder = new RiskGraphBuilder();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_required',
      message: 'Provide clinicianId to fetch risk graph',
    });
  }

  try {
    const snapshot = await builder.generate(clinicianId, {
      anchor: String(req.query.anchor ?? 'true') !== 'false',
    });
    return res.json(snapshot);
  } catch (error) {
    console.error('[recruiter][risk-graph] fetch failed', error);
    return res.status(500).json({
      error: 'risk_graph_failed',
      message: error instanceof Error ? error.message : 'Unable to build risk graph',
    });
  }
});

router.post('/:clinicianId/propagate', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  const signal = typeof req.body?.signal === 'string' ? req.body.signal : 'sanctions';
  const severity = Number(req.body?.severity ?? 0.75);
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_required',
      message: 'Provide clinicianId to propagate risk',
    });
  }

  try {
    const snapshot = await propagateRiskSignal({
      clinicianId,
      signal,
      severity: Number.isFinite(severity) ? severity : 0.75,
    });
    return res.json(snapshot);
  } catch (error) {
    console.error('[recruiter][risk-graph] propagate failed', error);
    return res.status(500).json({
      error: 'risk_propagation_failed',
      message: error instanceof Error ? error.message : 'Unable to propagate risk signal',
    });
  }
});

export default router;










