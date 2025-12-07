/**
 * Chain Issuers Endpoint
 * Task 201.37
 */

import { Router } from 'express';
import { TrustRegistryService } from '../chain/TrustRegistryService';

const router = Router();

let trustRegistry: TrustRegistryService | null = null;

export function initChainIssuersRoute(trust: TrustRegistryService): void {
  trustRegistry = trust;
}

/**
 * Task 201.37 - GET /api/chain/issuers
 * Returns all registered issuers and their capabilities
 */
router.get('/api/chain/issuers', async (req, res) => {
  try {
    if (!trustRegistry) {
      return res.status(503).json({
        ok: false,
        error: 'Trust registry not initialized',
      });
    }

    const issuers = await trustRegistry.getAllowedIssuers();

    res.json({
      ok: true,
      issuers,
      count: issuers.length,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch issuers',
    });
  }
});

/**
 * GET /api/chain/issuers/:did
 * Get specific issuer details
 */
router.get('/api/chain/issuers/:did', async (req, res) => {
  try {
    if (!trustRegistry) {
      return res.status(503).json({
        ok: false,
        error: 'Trust registry not initialized',
      });
    }

    const { did } = req.params;
    const issuer = await trustRegistry.getIssuerDetails(did);

    if (!issuer) {
      return res.status(404).json({
        ok: false,
        error: 'Issuer not found',
      });
    }

    res.json({
      ok: true,
      issuer,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch issuer details',
    });
  }
});

/**
 * GET /api/chain/issuers/:did/check
 * Check if issuer is permitted
 */
router.get('/api/chain/issuers/:did/check', async (req, res) => {
  try {
    if (!trustRegistry) {
      return res.status(503).json({
        ok: false,
        error: 'Trust registry not initialized',
      });
    }

    const { did } = req.params;
    const { capability } = req.query;

    const isPermitted = await trustRegistry.isIssuerPermitted(
      did,
      capability as string | undefined
    );

    res.json({
      ok: true,
      permitted: isPermitted,
      did,
      capability: capability || null,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to check issuer permissions',
    });
  }
});

export default router;

