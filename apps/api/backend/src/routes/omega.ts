/**
 * Omega — READ ONLY.
 *
 * `POST /api/omega/:npi` was retired (VCD-01a). It chose the organization on
 * whose behalf it recorded a decision from `employerId` / `orgId` in the
 * REQUEST BODY, then wrote an `EmployerAcceptance` and, when the activation
 * graph allowed, a `StartActivation` — two decision-grade rows created by a
 * caller-named employer, behind a global tenant guard whose org binding
 * defaults to a no-op and whose org context is itself caller-supplied.
 *
 * It had no callers: the only `/api/omega` reference in web, marketing or
 * mobile is an archived page calling the GET below.
 *
 * `apps/api/backend/src/routes/__tests__/omegaDecisionWritesRetired.test.ts`
 * asserts the POST answers 404 — not 400 or 401 — because anything else would
 * pass while the handler was mounted and merely rejecting one request.
 *
 * Do not re-add a write path here. An omega decision route needs org context
 * derived from the caller's verified membership, not from its body; see the
 * consolidation direction in
 * `docs/product/evidence-network/canonical-transaction-baseline.md` §5.
 */
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

export default router;
