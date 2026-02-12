import { Router, type Request, type Response } from 'express';
import { resolveTrustState } from '../trust-state';
import type { TrustStateApiDependencies } from '../trust-state';
import { TrustStateResolver, type TrustStateScope } from '../../../packages/trust-state';

function parseClinicianId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  return value.trim();
}

function parseScopeInput(
  source: Record<string, unknown> | undefined,
): Partial<TrustStateScope> | undefined {
  const employer_id =
    typeof source?.employer_id === 'string' && source.employer_id.trim().length > 0
      ? source.employer_id.trim()
      : undefined;
  const facility_id =
    typeof source?.facility_id === 'string' && source.facility_id.trim().length > 0
      ? source.facility_id.trim()
      : undefined;
  const role =
    typeof source?.role === 'string' && source.role.trim().length > 0
      ? source.role.trim()
      : undefined;

  const provided = [employer_id, facility_id, role].filter(Boolean).length;
  if (provided === 0) return undefined;
  if (provided !== 3) {
    throw new Error('employer_id, facility_id, and role must be provided together');
  }

  return { employer_id, facility_id, role } as TrustStateScope;
}

export function createTrustStateRouter(deps: TrustStateApiDependencies): Router {
  const router = Router();
  const resolver = new TrustStateResolver(deps);

  router.get('/trust-state/:clinician_id', async (req: Request, res: Response) => {
    try {
      const clinician_id = parseClinicianId(req.params.clinician_id);
      const scope = parseScopeInput(req.query as Record<string, unknown>);
      const trustState = scope
        ? await resolver.resolve(clinician_id, scope)
        : await resolveTrustState(clinician_id, deps);
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
      const scope = parseScopeInput(req.body as Record<string, unknown> | undefined);
      const trustState = scope
        ? await resolver.resolve(clinician_id, scope)
        : await resolveTrustState(clinician_id, deps);

      return res.status(200).json(trustState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute trust-state.';
      return res.status(400).json({ error: message });
    }
  });

  return router;
}
