/**
 * Evidence-Before-200 Middleware
 * B105B-AUD-038: Evidence-before-200 for verifier/privileges APIs
 *
 * Ensures that evidence is anchored to the blockchain before returning 200 OK.
 * If evidence is not anchored, returns 202 Accepted and records receipt in DLQ.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface EvidenceStatus {
  anchored: boolean;
  txHash?: string;
  anchoredAt?: Date;
}

/**
 * Check if evidence is anchored for a request
 */
async function checkEvidenceAnchored(
  pool: Pool,
  evidenceId: string
): Promise<EvidenceStatus> {
  try {
    const result = await pool.query(
      `SELECT chain_tx_hash, anchored_at FROM "AuditEvent"
       WHERE id = $1 AND chain_tx_hash IS NOT NULL
       LIMIT 1`,
      [evidenceId]
    );

    if (result.rows.length > 0) {
      return {
        anchored: true,
        txHash: result.rows[0].chain_tx_hash,
        anchoredAt: result.rows[0].anchored_at,
      };
    }

    return { anchored: false };
  } catch (error) {
    console.error('[Evidence] Error checking anchor status:', error);
    return { anchored: false };
  }
}

/**
 * Record receipt in DLQ (Dead Letter Queue)
 */
async function recordDLQReceipt(
  pool: Pool,
  evidenceId: string,
  endpoint: string,
  reason: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "DLQReceipt" (evidence_id, endpoint, reason, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (evidence_id, endpoint) DO UPDATE
       SET reason = $3, created_at = NOW()`,
      [evidenceId, endpoint, reason]
    );
  } catch (error) {
    console.error('[Evidence] Error recording DLQ receipt:', error);
  }
}

/**
 * Evidence-before-200 middleware
 *
 * Usage:
 *   router.post('/verifier/presentation', evidenceBefore200, handler);
 *   router.post('/privileges/approve', evidenceBefore200, handler);
 */
export function evidenceBefore200(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract evidence ID from request
    // This could be in body, headers, or query params depending on API design
    const evidenceId =
      req.body?.evidenceId ||
      req.body?.auditRef ||
      req.headers['x-evidence-id'] ||
      req.query.evidenceId;

    if (!evidenceId) {
      // No evidence ID provided - allow request to proceed
      // (some endpoints may not require evidence anchoring)
      return next();
    }

    // Check if evidence is anchored
    const status = await checkEvidenceAnchored(pool, evidenceId);

    if (!status.anchored) {
      // Evidence not anchored - return 202 Accepted and record DLQ receipt
      const endpoint = req.path;
      const reason = 'Evidence not anchored before 200 response';

      await recordDLQReceipt(pool, evidenceId, endpoint, reason);

      // Store original response handler
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        // Override to return 202 instead of 200
        res.status(202);
        return originalJson({
          ...body,
          status: 'accepted',
          message: 'Request accepted but evidence not yet anchored. Check status later.',
          evidenceId,
          dlqReceipt: true,
        });
      };

      console.log(`[Evidence] Evidence ${evidenceId} not anchored, returning 202 for ${endpoint}`);
    }

    // Evidence is anchored (or no evidence ID) - proceed normally
    next();
  };
}

/**
 * Create evidence-before-200 middleware with pool
 */
export function createEvidenceBefore200Middleware(pool: Pool) {
  return evidenceBefore200(pool);
}

