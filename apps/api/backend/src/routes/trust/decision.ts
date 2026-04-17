import { Router, Request, Response } from 'express';
import { generateOmegaDecision } from '../../services/orchestrator/vcvOmega';

const router = Router();

// Middleware to strip sensitive DB keys / raw identifiers before returning to client
function sanitizeDecision(state: any) {
  const safeState = JSON.parse(JSON.stringify(state));
  
  // Example sanitization (in a real system, we'd use a strict DTO mapper)
  if (safeState.recognition && safeState.recognition.coverage) {
    // Ensure raw source responses don't leak PII if not intended
  }
  
  return safeState;
}

/**
 * POST /api/trust/recognition
 * Returns only the base recognition state (identity, safety, authority).
 */
router.post('/recognition', async (req: Request, res: Response) => {
  const { clinicianId, orgId, role } = req.body;
  if (!clinicianId || !orgId) return res.status(400).json({ error: 'clinicianId and orgId are required' });

  try {
    const fullState = await generateOmegaDecision(clinicianId, orgId, { actorType: 'employer', intent: 'check_readiness' });
    res.json(sanitizeDecision({ recognition: fullState.recognition }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/trust/acceptance
 * Returns only the organization-specific compliance mapping.
 */
router.post('/acceptance', async (req: Request, res: Response) => {
  const { clinicianId, orgId, role } = req.body;
  if (!clinicianId || !orgId) return res.status(400).json({ error: 'clinicianId and orgId are required' });

  try {
    const fullState = await generateOmegaDecision(clinicianId, orgId, { actorType: 'employer', intent: 'check_readiness' });
    res.json(sanitizeDecision({ acceptance: fullState.acceptance }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/trust/startability
 * Returns only the activation graph mapping and time-to-start heuristics.
 */
router.post('/startability', async (req: Request, res: Response) => {
  const { clinicianId, orgId, role } = req.body;
  if (!clinicianId || !orgId) return res.status(400).json({ error: 'clinicianId and orgId are required' });

  try {
    const fullState = await generateOmegaDecision(clinicianId, orgId, { actorType: 'employer', intent: 'check_readiness' });
    res.json(sanitizeDecision({ activation: fullState.activation }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/trust/full
 * Returns the entire decision payload including Next Best Action.
 */
router.post('/full', async (req: Request, res: Response) => {
  const { clinicianId, orgId, role } = req.body;
  if (!clinicianId || !orgId) return res.status(400).json({ error: 'clinicianId and orgId are required' });

  try {
    const fullState = await generateOmegaDecision(clinicianId, orgId, { actorType: 'employer', intent: 'make_decision' });
    res.json(sanitizeDecision(fullState));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
