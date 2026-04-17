import { Router, Request, Response } from 'express';
import { OmegaOrchestrator } from '../services/decision/omegaOrchestrator';

const router = Router();

/**
 * GET /api/omega/:npi — Read-only Omega state (Recognition + Acceptance graph)
 */
router.get('/:npi', async (req: Request, res: Response) => {
  const { npi } = req.params;

  // Basic NPI format validation
  if (!/^\d{10}$/.test(npi)) {
    res.status(400).json({ error: 'Invalid NPI format. Must be 10 digits.' });
    return;
  }

  try {
    const state = await OmegaOrchestrator.readState(npi);
    res.json(state);
  } catch (err) {
    console.error('[Omega] readState failed:', err);
    res.status(500).json({ error: 'Omega read failed' });
  }
});

/**
 * POST /api/omega/:npi — Evaluate an action (Recognition + Acceptance → Start)
 */
router.post('/:npi', async (req: Request, res: Response) => {
  const { npi } = req.params;
  const { employerId, orgId, role, action, comment } = req.body;

  if (!/^\d{10}$/.test(npi)) {
    res.status(400).json({ error: 'Invalid NPI format. Must be 10 digits.' });
    return;
  }

  if (!employerId || !orgId || !action) {
    res.status(400).json({ error: 'Missing required fields: employerId, orgId, action' });
    return;
  }

  if (!['accept', 'request_data', 'flag'].includes(action)) {
    res.status(400).json({ error: 'Invalid action. Must be: accept, request_data, flag' });
    return;
  }

  try {
    const result = await OmegaOrchestrator.evaluateAction({
      npi,
      employerId,
      orgId,
      role,
      action,
      comment,
    });
    res.json(result);
  } catch (err) {
    console.error('[Omega] evaluateAction failed:', err);
    res.status(500).json({ error: 'Omega evaluation failed' });
  }
});

export default router;
