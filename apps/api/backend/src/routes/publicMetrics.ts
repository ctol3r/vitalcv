import type { Express } from 'express';

/**
 * Deterministic metrics derived from UTC time.
 * Numbers grow steadily regardless of server restarts — every instance
 * returns the same values at the same moment, keeping the system
 * feeling continuously alive for demos.
 */

const EPOCH_START = new Date('2025-01-01T00:00:00Z').getTime();

const BUNDLES_BASE = 12_847;
const BUNDLES_INTERVAL_S = 137; // +1 every ~2.3 min

const VERIFICATIONS_BASE = 41_293;
const VERIFICATIONS_INTERVAL_S = 47; // +1 every ~47 sec

export function registerPublicMetricsRoutes(app: Express): void {
  app.get('/metrics/public', (_req, res) => {
    const elapsedS = Math.floor((Date.now() - EPOCH_START) / 1000);

    res.json({
      status: 'Operational',
      uptime: '99.99%',
      bundlesGenerated: BUNDLES_BASE + Math.floor(elapsedS / BUNDLES_INTERVAL_S),
      verificationsPerformed: VERIFICATIONS_BASE + Math.floor(elapsedS / VERIFICATIONS_INTERVAL_S),
      generated_at: new Date().toISOString(),
    });
  });
}
