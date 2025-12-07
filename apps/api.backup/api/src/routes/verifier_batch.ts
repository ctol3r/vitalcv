/**
 * Batch Verifier Routes
 * Tagged: cursor-batch-1107 (Task 0002)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * POST /api/verifier/present - Batch verification endpoint
 */

import { Router, Request, Response } from 'express';
import { verifyBatch, BatchVerificationRequest, calculateBatchMetrics } from '../services/verification/batch-verifier';
import { log, createRequestLogger } from '../lib/logging';
import { HttpProblemError, createProblemDetail } from '../lib/http/errors';

export const router = Router();

/**
 * POST /api/verifier/present
 *
 * Accept array of presentations and verify in batch
 * Returns per-item results with status codes
 *
 * Request body:
 * {
 *   "presentations": [
 *     { "id": "pres-1", "credential": "eyJ...", "disclosures": ["WyJ..."] },
 *     { "id": "pres-2", "credential": "eyJ..." }
 *   ],
 *   "options": {
 *     "continueOnError": true,
 *     "parallelism": 5
 *   }
 * }
 *
 * Response:
 * {
 *   "totalCount": 2,
 *   "successCount": 1,
 *   "failureCount": 1,
 *   "results": [
 *     { "id": "pres-1", "status": "success", "result": {...}, "duration": 45 },
 *     { "id": "pres-2", "status": "error", "code": "E_SIGNATURE_INVALID", "message": "...", "duration": 32 }
 *   ],
 *   "totalDuration": 89,
 *   "metrics": {
 *     "avgDuration": 38.5,
 *     "p95Duration": 45,
 *     "throughput": 22.47
 *   }
 * }
 */
router.post('/api/verifier/present', async (req: Request, res: Response) => {
  const requestId = req.id || `req_${Date.now()}`;
  const reqLog = createRequestLogger(requestId, { endpoint: '/api/verifier/present' });

  try {
    const requestBody: BatchVerificationRequest = req.body;

    // Validate request
    if (!requestBody.presentations || !Array.isArray(requestBody.presentations)) {
      return res.status(400).json(
        createProblemDetail(
          400,
          'E_BATCH_INVALID_FORMAT',
          'Invalid Request Format',
          'Request body must include "presentations" array',
          { requestId },
        ),
      );
    }

    // Validate each presentation has required fields
    for (const [index, presentation] of requestBody.presentations.entries()) {
      if (!presentation.id) {
        return res.status(400).json(
          createProblemDetail(
            400,
            'E_BATCH_INVALID_FORMAT',
            'Invalid Presentation Format',
            `Presentation at index ${index} missing required field: id`,
            { requestId, index },
          ),
        );
      }

      if (!presentation.credential) {
        return res.status(400).json(
          createProblemDetail(
            400,
            'E_BATCH_INVALID_FORMAT',
            'Invalid Presentation Format',
            `Presentation at index ${index} missing required field: credential`,
            { requestId, index, presentationId: presentation.id },
          ),
        );
      }
    }

    reqLog.info('Starting batch verification', {
      count: requestBody.presentations.length,
      options: requestBody.options,
    });

    // Perform batch verification
    const result = await verifyBatch(requestBody);

    // Calculate metrics
    const metrics = calculateBatchMetrics(result);

    reqLog.info('Batch verification complete', {
      totalCount: result.totalCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalDuration: result.totalDuration,
      p95Duration: metrics.p95Duration,
    });

    // Return results with metrics
    res.status(200).json({
      ...result,
      metrics,
      requestId,
    });
  } catch (error: any) {
    reqLog.error('Batch verification failed', {
      error: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error instanceof HttpProblemError) {
      return res.status(error.status).json(error.toProblemDetail(requestId));
    }

    // Handle specific error codes
    if (error.message.includes('E_BATCH_EMPTY')) {
      return res.status(400).json(
        createProblemDetail(
          400,
          'E_BATCH_EMPTY',
          'Empty Batch',
          'Batch must contain at least one presentation',
          { requestId },
        ),
      );
    }

    if (error.message.includes('E_BATCH_TOO_LARGE')) {
      return res.status(400).json(
        createProblemDetail(
          400,
          'E_BATCH_TOO_LARGE',
          'Batch Too Large',
          error.message,
          { requestId },
        ),
      );
    }

    // Generic error
    return res.status(500).json(
      createProblemDetail(
        500,
        'E_INTERNAL_SERVER_ERROR',
        'Internal Server Error',
        'Batch verification failed',
        { requestId },
      ),
    );
  }
});

export default router;

