/**
 * Chain Credential Endpoints
 * Tasks 201.27, 201.28
 */

import { Router } from 'express';
import { CredentialChainService } from '../chain/CredentialChainService';
import { TrustRegistryService } from '../chain/TrustRegistryService';

const router = Router();

let chainService: CredentialChainService | null = null;
let trustRegistry: TrustRegistryService | null = null;

export function initChainCredentialRoutes(
  chain: CredentialChainService,
  trust: TrustRegistryService
): void {
  chainService = chain;
  trustRegistry = trust;
}

/**
 * Task 201.27 - GET /api/chain/credential/:id/status
 * Returns chain-only view of credential status
 */
router.get('/api/chain/credential/:id/status', async (req, res) => {
  try {
    if (!chainService) {
      return res.status(503).json({
        ok: false,
        error: 'Chain service not initialized',
      });
    }

    const { id } = req.params;
    const status = await chainService.getCredentialStatus(id);

    if (!status) {
      return res.status(404).json({
        ok: false,
        error: 'Credential not found on-chain',
      });
    }

    res.json({
      ok: true,
      status,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to query credential status',
    });
  }
});

/**
 * Task 201.28 - GET /api/chain/credential/:id/debug
 * Returns full on-chain data structure for debugging
 */
router.get('/api/chain/credential/:id/debug', async (req, res) => {
  try {
    if (!chainService) {
      return res.status(503).json({
        ok: false,
        error: 'Chain service not initialized',
      });
    }

    const { id } = req.params;
    const record = await chainService.getOnChainRecord(id);

    if (!record) {
      return res.status(404).json({
        ok: false,
        error: 'Credential record not found on-chain',
      });
    }

    res.json({
      ok: true,
      record,
      debug: {
        signerAddress: chainService.getSignerAddress(),
        canSign: chainService.canSign(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to query credential record',
    });
  }
});

/**
 * POST /api/chain/credential/:id/anchor
 * Manual anchoring endpoint for testing
 */
router.post('/api/chain/credential/:id/anchor', async (req, res) => {
  try {
    if (!chainService || !trustRegistry) {
      return res.status(503).json({
        ok: false,
        error: 'Chain service not initialized',
      });
    }

    const { id } = req.params;
    const { hash, issuerDid } = req.body;

    if (!hash || !issuerDid) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: hash, issuerDid',
      });
    }

    // Task 201.35 - Check if issuer is permitted
    const isPermitted = await trustRegistry.isIssuerPermitted(issuerDid, 'issueCredential');

    if (!isPermitted) {
      return res.status(403).json({
        ok: false,
        error: 'Issuer not permitted to anchor credentials',
      });
    }

    const result = await chainService.anchorCredential({
      credentialId: id,
      hash,
      issuerDid,
    });

    if (!result.success) {
      return res.status(500).json({
        ok: false,
        error: result.error,
      });
    }

    res.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to anchor credential',
    });
  }
});

/**
 * POST /api/chain/credential/:id/revoke
 * Revoke credential on-chain
 */
router.post('/api/chain/credential/:id/revoke', async (req, res) => {
  try {
    if (!chainService) {
      return res.status(503).json({
        ok: false,
        error: 'Chain service not initialized',
      });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const result = await chainService.revokeCredential(id, reason);

    if (!result.success) {
      return res.status(500).json({
        ok: false,
        error: result.error,
      });
    }

    res.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to revoke credential',
    });
  }
});

export default router;

