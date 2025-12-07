/**
 * Chain Health Endpoint
 * Task 201.11 - Expose GET /api/chain/health
 */

import { Router } from 'express';
import { PolkadotService } from '../chain/PolkadotService';
import { ChainHealthMonitor } from '../chain/healthMonitor';

const router = Router();

let polkadotService: PolkadotService | null = null;
let healthMonitor: ChainHealthMonitor | null = null;

export function initChainHealthRoute(
  polkadot: PolkadotService,
  monitor: ChainHealthMonitor
): void {
  polkadotService = polkadot;
  healthMonitor = monitor;
}

/**
 * Task 201.11 - GET /api/chain/health
 * Returns connection status + metadata
 */
router.get('/api/chain/health', async (req, res) => {
  try {
    if (!polkadotService || !healthMonitor) {
      return res.status(503).json({
        ok: false,
        error: 'Chain service not initialized',
      });
    }

    const isConnected = polkadotService.isConnected();
    const metadata = polkadotService.getMetadata();
    const health = await healthMonitor.checkHealth();

    res.json({
      ok: true,
      connected: isConnected,
      health,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to check chain health',
    });
  }
});

export default router;

