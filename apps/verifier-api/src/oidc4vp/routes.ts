import express, { Request, Response } from 'express';
import path from 'path';

type EmploymentGuards = {
  assertCanonicalPathValid: (path: unknown) => void;
  CanonicalPathViolation: new (...args: any[]) => Error;
};

const employmentGuardsPath = path.resolve(
  __dirname,
  '../../../../packages/domain-common/employmentGuards',
);

function loadEmploymentGuards(): EmploymentGuards {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(employmentGuardsPath) as EmploymentGuards;
}

const router: express.Router = express.Router();

/**
 * Canonical path enforcement endpoint.
 * POST /oidc4vp/presentation
 */
router.post('/presentation', (req: Request, res: Response) => {
  const { vp_token, canonicalPath } = req.body ?? {};

  if (!canonicalPath || typeof canonicalPath !== 'object') {
    return res.status(400).json({
      error: 'canonical_path_required',
      error_description: 'canonicalPath is required (Recognition → Acceptance → Start).',
    });
  }

  const { assertCanonicalPathValid, CanonicalPathViolation } = loadEmploymentGuards();
  try {
    assertCanonicalPathValid(canonicalPath);
  } catch (error) {
    const message =
      error instanceof CanonicalPathViolation ? error.message : 'Canonical path validation failed.';
    return res.status(400).json({
      error: 'canonical_path_violation',
      error_description: message,
    });
  }

  if (!vp_token || typeof vp_token !== 'string') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing vp_token',
    });
  }

  return res.json({
    verified: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
