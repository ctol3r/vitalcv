/**
 * Blockchain Audit Status Route
 * Exposes queue status and monitoring information
 */

import { Router, Request, Response } from 'express';
import { getAuditService } from '../services/blockchain-audit-service';

const router = Router();

/**
 * GET /blockchain/audit/status
 * Get blockchain audit service status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const auditService = getAuditService();
    const status = auditService.getQueueStatus();

    return res.json({
      status: 'operational',
      queue: {
        length: status.queueLength,
        processing: status.processing,
      },
      blockchain: {
        connected: status.connected,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

