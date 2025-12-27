/**
 * S72-D1-A-008: Simple Credential Verification Endpoint
 *
 * Accepts a VC JWS and verifies its signature against known issuer keys.
 * Returns {valid: true/false, reason}.
 * No complex status or expiry logic yet - just signature verification.
 */

import express, { Request, Response } from 'express';
import { verifySignature } from '../services/verifySignature';
import { logVerificationEvent } from '../services/audit';

const router = express.Router();

/**
 * POST /verify/credential
 *
 * Verifies a verifiable credential JWS signature
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        valid: false,
        reason: 'Missing credential parameter. Expected a JWS string or VC object.'
      });
    }

    const verification = await verifySignature(credential);

    await logVerificationEvent({
      credentialId: verification.credentialId || 'unknown',
      verifierId: req.headers['x-verifier-id']?.toString() || 'verifier-api',
      valid: verification.valid,
      vc: credential,
      issuer: verification.issuer,
      subject: verification.subject,
    });

    if (!verification.valid) {
      return res.json({
        valid: false,
        reason: verification.reason || 'Signature verification failed.',
        issuer: verification.issuer,
        subject: verification.subject,
      });
    }

    return res.json({
      valid: true,
      reason: 'Signature verified successfully',
      issuer: verification.issuer,
      subject: verification.subject,
      claims: verification.claims,
      credentialId: verification.credentialId,
    });
  } catch (error) {
    console.error('[VerifyCredential] Error:', error);
    return res.status(500).json({
      valid: false,
      reason: `Server error: ${error instanceof Error ? error.message : 'unknown error'}`
    });
  }
});

/**
 * GET /verify/credential/health
 *
 * Health check for verification service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'credential-verifier',
    timestamp: new Date().toISOString(),
  });
});

export default router;
