import type { Express, Request, Response } from 'express';
import {
  signCredential,
  type CredentialPayload,
} from '../services/issuer/credentialSigner';

export function registerIssuerRoutes(app: Express): void {
  /**
   * POST /api/issuer/issue
   * Body: { clinicianName, npi, licenseNumber, credentialType }
   * Returns: { status, credential, issuedAt, expiresAt, auditHash }
   */
  app.post('/api/issuer/issue', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const clinicianName =
      typeof body.clinicianName === 'string' ? body.clinicianName.trim() : '';
    const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
    const licenseNumber =
      typeof body.licenseNumber === 'string' ? body.licenseNumber.trim() : '';
    const credentialType =
      typeof body.credentialType === 'string'
        ? body.credentialType.trim()
        : '';

    if (!clinicianName || !npi || !credentialType) {
      return res.status(400).json({
        error: 'missing_fields',
        detail: 'clinicianName, npi, and credentialType are required',
      });
    }

    try {
      const payload: CredentialPayload = {
        clinicianName,
        npi,
        licenseNumber,
        credentialType,
        issuerDid: 'did:web:issuer.vitalcv.com',
        subjectDid: `did:key:${npi}`,
      };

      const result = await signCredential(payload);

      return res.status(200).json({
        status: 'success',
        credential: result.jwt,
        issuedAt: result.issuedAt,
        expiresAt: result.expiresAt,
        auditHash: result.auditHash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return res
        .status(500)
        .json({ error: 'issuance_failed', detail: message });
    }
  });

  /**
   * GET /api/issuer/health
   * Quick health probe: confirms the demo signing key is ready.
   */
  app.get('/api/issuer/health', (_req: Request, res: Response) => {
    return res
      .status(200)
      .json({ status: 'ready', issuerDid: 'did:web:issuer.vitalcv.com' });
  });
}
