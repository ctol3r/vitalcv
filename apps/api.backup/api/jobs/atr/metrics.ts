/**
 * B123A-ATR-014: ATR reconcile metrics endpoint
 *
 * Exposes metrics for ATR reconciliation:
 * - Processed/skipped counts
 * - Retry statistics
 * - Rate limit handling
 * - Duplicate detection
 */

import express, { Request, Response } from 'express';
import { getATRReconcileService, ATRReconcileService } from './reconcile';
import { Pool } from 'pg';

const router = express.Router();

/**
 * GET /atr/metrics
 * B123A-ATR-014: Metrics endpoint showing processed/skipped/retries
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Get pool from environment or request context
    const pool = (req as any).dbPool as Pool | undefined;

    if (!pool) {
      return res.status(500).json({
        error: 'database_pool_not_available',
        error_description: 'Database pool not available for metrics',
      });
    }

    const reconcileService = getATRReconcileService(pool);
    const metricsEndpoint = await reconcileService.getMetricsEndpoint();

    const accept = req.headers.accept || '';

    if (accept.includes('application/json') || !accept.includes('text/plain')) {
      // JSON format
      res.json({
        metrics: metricsEndpoint.metrics,
        result: metricsEndpoint.result,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Prometheus format
      const { metrics, result } = metricsEndpoint;
      const prometheusFormat = `# HELP atr_reconcile_processed Total ATR records processed
# TYPE atr_reconcile_processed counter
atr_reconcile_processed ${metrics.processed}

# HELP atr_reconcile_skipped Total ATR records skipped
# TYPE atr_reconcile_skipped counter
atr_reconcile_skipped ${metrics.skipped}

# HELP atr_reconcile_dropped Total ATR records dropped (max retries exceeded)
# TYPE atr_reconcile_dropped counter
atr_reconcile_dropped ${metrics.dropped}

# HELP atr_reconcile_rate_limited Total rate limit events
# TYPE atr_reconcile_rate_limited counter
atr_reconcile_rate_limited ${metrics.rateLimited}

# HELP atr_reconcile_duplicates Total duplicate events detected
# TYPE atr_reconcile_duplicates counter
atr_reconcile_duplicates ${metrics.duplicates}

# HELP atr_reconcile_retries Total retry attempts
# TYPE atr_reconcile_retries counter
atr_reconcile_retries ${metrics.retries}

# HELP atr_reconcile_failed Total failed reconciliations
# TYPE atr_reconcile_failed counter
atr_reconcile_failed ${result.failed}
`;

      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(prometheusFormat);
    }
  } catch (error) {
    console.error('[ATR Metrics] Error:', error);
    res.status(500).json({
      error: 'metrics_error',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

