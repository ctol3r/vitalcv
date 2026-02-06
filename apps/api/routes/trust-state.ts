import { Router, type Request, type Response } from 'express';
import { resolveTrustState } from '../trust-state';
import type { TrustStateApiDependencies } from '../trust-state';

function parseClinicianId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  return value.trim();
}

export function createTrustStateRouter(deps: TrustStateApiDependencies): Router {
  const router = Router();

  router.get('/trust-state/:clinician_id', async (req: Request, res: Response) => {
    try {
      const clinician_id = parseClinicianId(req.params.clinician_id);
      const trustState = await resolveTrustState(clinician_id, deps);
      return res.status(200).json(trustState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute trust-state';
      return res.status(400).json({ error: message });
    }
  });

  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const purpose = (req.body as { purpose?: unknown } | undefined)?.purpose;
      if (purpose !== 'employment') {
        return res.status(400).json({ error: 'purpose must be employment' });
      }

      const clinician_id = parseClinicianId(
        (req.body as { clinician_id?: unknown } | undefined)?.clinician_id,
      );
      const trustState = await resolveTrustState(clinician_id, deps);

      return res.status(200).json(trustState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify trust-state';
      return res.status(400).json({ error: message });
    }
  });

  return router;
}
