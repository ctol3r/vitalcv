import { Router, type Request, type Response } from 'express';
import { evaluateCredentialCheck } from '../../services/fhir/cds/credential-check';
import { evaluatePrivilegeCheck } from '../../services/fhir/cds/privilege-check';

const router = Router();

router.post('/fhir/cds/credential-check', async (req: Request, res: Response) => {
  try {
    const payload = await evaluateCredentialCheck({
      context: req.body?.context ?? {},
      fhirServer: typeof req.body?.fhirServer === 'string' ? req.body.fhirServer : undefined,
    });
    return res.json({
      cards: [payload.card],
      status: payload.status,
    });
  } catch (error) {
    console.error('[FHIR/CDS] credential-check failed', error);
    return res.status(500).json({
      error: 'credential_check_failed',
      message: error instanceof Error ? error.message : 'Unable to evaluate credential check hook',
    });
  }
});

router.post('/fhir/cds/privilege-check', async (req: Request, res: Response) => {
  try {
    const payload = await evaluatePrivilegeCheck({
      context: req.body?.context ?? {},
    });
    return res.json({
      cards: [payload.card],
      missingPrivileges: payload.missingPrivileges,
    });
  } catch (error) {
    console.error('[FHIR/CDS] privilege-check failed', error);
    return res.status(500).json({
      error: 'privilege_check_failed',
      message: error instanceof Error ? error.message : 'Unable to evaluate privilege check hook',
    });
  }
});

export default router;











