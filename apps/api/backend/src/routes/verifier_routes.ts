import { Router, Request, Response } from 'express';
import { getCredentialStatus } from '../controllers/verifier_controller';
import { log } from '../obs/logger';

export const router: Router = Router();

router.get('/verifier/credential/:credentialId/status', async (req: Request, res: Response) => {
  try {
    const status = await getCredentialStatus(req.params.credentialId);
    res.json({ credentialId: req.params.credentialId, status });
  } catch (err) {
    log('error', 'Unable to fetch credential status', {
      event: 'verifier_credential_status_error',
      credentialId: req.params.credentialId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    res.status(500).json({ error: 'Unable to fetch credential status' });
  }
});
