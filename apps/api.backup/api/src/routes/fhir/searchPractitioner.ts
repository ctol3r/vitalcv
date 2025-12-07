import express, { Response } from 'express';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth.js';
import { pouEnforce, PouRequest } from '../../middleware/pouEnforce.js';
import { searchTrustedDirectory } from '../../../../services/tefca/trustedParticipants.js';
import { logTefcaAudit } from '../../../../services/tefca/auditLogger.js';

const router = express.Router();

router.use(jwtAuthMiddleware);
router.use(pouEnforce);

router.get('/fhir/R6/Practitioner', async (req: PouRequest, res: Response) => {
  const identifier = req.query.identifier as string | undefined;
  const name = req.query.name as string | undefined;

  if (!identifier && !name) {
    res.status(400).json({
      error: 'missing_search_param',
      message: 'Provide identifier or name query parameter',
    });
    return;
  }

  const practitioners = searchTrustedDirectory({ identifier, name });
  const pou = req.tefcaPou || (req as any).auth?.pou || 'DIRECTORY';

  await logTefcaAudit({
    resourceType: 'Practitioner',
    subject: identifier || name || 'search',
    pou,
    requester: (req as any).auth?.sub || 'unknown',
  });

  res.status(200).json(practitioners);
});

export default router;
