import { Router, Request, Response } from 'express';
import { verificationStore } from '../../services/oidc4vp/verificationStore';
import type { VerificationExportPayload } from '../../services/oidc4vp/types';

const router = Router();

router.get('/export/:presentationId', (req: Request, res: Response) => {
  const { presentationId } = req.params;
  if (!presentationId) {
    return res.status(400).json({ error: 'missing_presentation_id' });
  }

  const record = verificationStore.get(presentationId);
  if (!record) {
    return res.status(404).json({ error: 'presentation_not_found' });
  }

  const payload: VerificationExportPayload = {
    presentationId,
    generatedAt: new Date().toISOString(),
    verificationSummary: {
      status: record.status,
      valid: record.valid,
      credentialType: record.credentialType,
      holder: record.holder,
    },
    issuerMetadata: record.issuer,
    timestamps: record.timestamps,
    auditAnchors: record.chain,
    revocation: record.revocation,
    raw: record.raw,
  };

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="verification-${presentationId}.json"`,
  );
  return res.json(payload);
});

export default router;

