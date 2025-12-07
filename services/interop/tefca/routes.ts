const log = getServiceLogger('interop/tefca/routes');
/**
 * TEFCA Harness Service
 * B108B-TEFCA-027: TEFCA harness integration
 */

import express, { Request, Response } from 'express';
import {
  maskSensitiveData,
  testMaskingPatterns,
  rotateLogs,
  applyRetentionPolicy,
  writeMaskedLog,
  scheduleDailyRotation,
  DEFAULT_ROTATION_CONFIG,
  DEFAULT_RETENTION_POLICY,
} from './harness';
import { exportTEFCAMetrics, getTEFCAMetricsSummary, recordTEFCAMetrics } from './metrics-exporter';
import { tefcaPouEnforcement, getPouAuditSummary } from './pou-enforcement';
import { getServiceLogger } from '../../logging/serviceLogger';

const router = express.Router();

// B121B-TEFCA-014: Record metrics for all TEFCA routes
router.use(recordTEFCAMetrics);

// B121C-POU-023: Apply PoU view enforcement to all TEFCA routes
router.use(tefcaPouEnforcement);

/**
 * POST /tefca/mask
 * Mask sensitive data in request body
 */
router.post('/mask', (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        error: 'missing_data',
        message: 'Data field is required',
      });
    }

    const masked = typeof data === 'string'
      ? maskSensitiveData(data)
      : maskSensitiveData(JSON.stringify(data));

    res.json({
      masked,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA mask error:', error);
    res.status(500).json({
      error: 'masking_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /tefca/test-patterns
 * Test all masking regex patterns
 */
router.get('/test-patterns', (_req: Request, res: Response) => {
  try {
    const results = testMaskingPatterns();

    res.json({
      passed: results.passed,
      failed: results.failed,
      total: results.passed + results.failed,
      results: results.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA pattern test error:', error);
    res.status(500).json({
      error: 'test_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /tefca/log
 * Write masked log entry
 */
router.post('/log', (req: Request, res: Response) => {
  try {
    const logEntry = req.body;

    writeMaskedLog(logEntry);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA log write error:', error);
    res.status(500).json({
      error: 'log_write_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /tefca/rotate
 * Manually trigger log rotation
 */
router.post('/rotate', async (_req: Request, res: Response) => {
  try {
    await rotateLogs();

    res.json({
      success: true,
      message: 'Log rotation completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA rotation error:', error);
    res.status(500).json({
      error: 'rotation_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /tefca/retention
 * Apply retention policy
 */
router.post('/retention', async (req: Request, res: Response) => {
  try {
    const policy = req.body.policy || DEFAULT_RETENTION_POLICY;
    const logDirectory = req.body.logDirectory || DEFAULT_ROTATION_CONFIG.logDirectory;

    const results = await applyRetentionPolicy(policy, logDirectory);

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('TEFCA retention error:', error);
    res.status(500).json({
      error: 'retention_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * B121B-TEFCA-014: TEFCA compliance metrics exporter endpoints
 * GET /tefca/metrics/export - Full metrics export with uptime + latency histograms
 * GET /tefca/metrics/summary - Quick summary of metrics
 */
router.get('/metrics/export', exportTEFCAMetrics);
router.get('/metrics/summary', getTEFCAMetricsSummary);

/**
 * B121C-POU-023: PoU audit summary endpoint
 * GET /tefca/pou/audit - Get PoU usage audit summary
 */
router.get('/pou/audit', getPouAuditSummary);

/**
 * Initialize daily rotation schedule
 */
if (process.env.NODE_ENV !== 'test') {
  scheduleDailyRotation();
}

export default router;

