/**
 * VC Verification Route
 * CRYPTO-003: /vc/verify endpoint for credential verification
 */

import { Router, Request, Response } from 'express';
import { verifyCredential, VerificationRequest } from '../services/vc-verification-service';
import { VerifiableCredential } from '../crypto/vc-signer';

const router = Router();

/**
 * POST /vc/verify
 * Verify a verifiable credential
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { credential, options } = req.body as { credential: VerifiableCredential; options?: any };

    if (!credential) {
      return res.status(400).json({
        error: 'Missing credential',
        message: 'credential field is required',
      });
    }

    // Validate credential structure
    if (!credential['@context'] || !credential.type || !credential.issuer) {
      return res.status(400).json({
        error: 'Invalid credential',
        message: 'Credential must have @context, type, and issuer fields',
      });
    }

    const request: VerificationRequest = {
      credential,
      options,
    };

    const result = await verifyCredential(request);

    const statusCode = result.verified ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error) {
    console.error('VC verification error:', error);
    return res.status(500).json({
      verified: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;

