/**
 * S72-D1-A-001: OIDC4VCI Credential Endpoint
 *
 * Minimal credential issuance route that accepts signed requests
 * and returns ClinicianIdentityVC credentials.
 */

import express, { Request, Response } from 'express';
import { oidc4vciGuard } from '../../middleware/guard';
import { dpopGuard } from '../../middleware/dpopGuard';
import { issueClinicianIdentityVC, ClinicianProfile } from '../../services/clinicianIdentityIssuer';

const router = express.Router();

/**
 * POST /credential
 *
 * Issues a ClinicianIdentityCredential based on the credential request.
 * Protected by DPoP and requires sender-constrained access token.
 */
router.post('/', oidc4vciGuard, dpopGuard, async (req: Request, res: Response) => {
  try {
    const { format, credential_definition, proof } = req.body;

    // Validate format
    if (format && format !== 'jwt_vc_json') {
      return res.status(400).json({
        error: 'unsupported_credential_format',
        error_description: `Format '${format}' not supported. Use 'jwt_vc_json'.`
      });
    }

    // Validate credential type
    const requestedTypes = credential_definition?.types || credential_definition?.type || [];
    if (!requestedTypes.includes('ClinicianIdentityCredential')) {
      return res.status(400).json({
        error: 'unsupported_credential_type',
        error_description: 'Only ClinicianIdentityCredential type is supported'
      });
    }

    // Extract clinician profile from proof or request body
    // In a real implementation, this would be extracted from authenticated session
    // or from the proof's DID/claims
    const profile: ClinicianProfile = {
      did: proof?.jwt ? extractDidFromProof(proof.jwt) : undefined,
      name: req.body.credential_subject?.name || 'Dr. Test Clinician',
      npi: req.body.credential_subject?.npi || '1234567890',
      specialty: req.body.credential_subject?.specialty || 'General Medicine',
    };

    // Issue the credential
    const vcJws = await issueClinicianIdentityVC(profile);

    // Return credential in OIDC4VCI format
    return res.json({
      format: 'jwt_vc_json',
      credential: vcJws,
    });
  } catch (error) {
    console.error('[OIDC4VCI] Credential issuance error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Failed to issue credential'
    });
  }
});

/**
 * Extract DID from proof JWT (placeholder)
 */
function extractDidFromProof(proofJwt: string): string | undefined {
  try {
    const { decodeJwt } = require('jose');
    const decoded = decodeJwt(proofJwt);
    return decoded.iss as string || decoded.sub as string;
  } catch {
    return undefined;
  }
}

export default router;

