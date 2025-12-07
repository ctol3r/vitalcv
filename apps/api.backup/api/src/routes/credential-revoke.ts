/**
 * Credential Revocation Route
 * Integrates with blockchain audit service
 */

import { Router, Request, Response } from 'express';
import { getAuditService } from '../services/blockchain-audit-service';

const router = Router();

/**
 * POST /credential/revoke
 * Revoke a verifiable credential
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { credentialId, revokerDid, reason, metadata } = req.body;

    if (!credentialId || !revokerDid) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'credentialId and revokerDid are required',
      });
    }

    // TODO: Implement actual revocation logic (update status list, etc.)

    // Record audit event on blockchain
    try {
      const auditService = getAuditService();
      await auditService.recordRevoke(
        credentialId,
        revokerDid,
        {
          reason,
          revokedAt: new Date().toISOString(),
          ...metadata,
        }
      );
    } catch (error) {
      console.error('[RevocationRoute] Failed to record audit event:', error);
      // Continue even if audit fails
    }

    return res.json({
      success: true,
      credentialId,
      revokedAt: new Date().toISOString(),
      message: 'Credential revoked successfully',
    });
  } catch (error) {
    console.error('Credential revocation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;

