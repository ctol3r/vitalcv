/**
 * Credential Revocation Endpoint
 *
 * Provides POST /revoke endpoint for revoking issued credentials.
 * Emits CREDENTIAL_REVOKED audit receipts and ensures idempotent revocation.
 */

import { createReceipt } from '@vitalcv/audit-receipts';
import type { Router } from 'express';
import express, { Request, Response } from 'express';
import { importJWK } from 'jose';
import { getActiveSigningKey } from '../services/signingKeyProvider';
import { revokeCredential } from '../services/statusList';

const router: Router = express.Router();

const ISSUER_DID = process.env.ISSUER_DID || 'did:web:issuer.vitalcv.com';
const DEFAULT_SIGNING_ALG = process.env.ISSUER_SIGNING_ALG || 'EdDSA';

/**
 * POST /revoke
 *
 * Revokes a credential by marking it as revoked in the status list.
 * Idempotent: calling multiple times with the same credential_id is safe.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { credential_id, reason, list_id } = req.body;

    // Validate input
    if (!credential_id || typeof credential_id !== 'string') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'credential_id is required and must be a string',
      });
    }

    // Revoke the credential
    const result = await revokeCredential(credential_id, list_id || 'default', reason);

    // Generate CREDENTIAL_REVOKED audit receipt
    try {
      const { jwk } = await getActiveSigningKey();
      const algorithm = (jwk.alg as string) || DEFAULT_SIGNING_ALG;
      const privateKey = (await importJWK(jwk, algorithm)) as Parameters<typeof createReceipt>[5];

      await createReceipt(
        'CREDENTIAL_REVOKED',
        { type: 'issuer', id: ISSUER_DID },
        {
          credential_id,
          issuer_did: ISSUER_DID,
        },
        'REVOKED',
        {
          reason: reason || 'No reason provided',
          list_id: list_id || 'default',
          already_revoked: result.already_revoked,
        },
        privateKey,
      );
    } catch (error) {
      // Log but don't fail revocation if receipt generation fails
      console.error('[AUDIT] Failed to generate CREDENTIAL_REVOKED receipt:', error);
    }

    // Return success
    return res.json({
      success: true,
      credential_id,
      revoked: !result.already_revoked,
      already_revoked: result.already_revoked || false,
    });
  } catch (error) {
    console.error('[REVOKE] Revocation error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'credential_not_found',
          error_description: error.message,
        });
      }
    }

    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Failed to revoke credential',
    });
  }
});

export default router;
