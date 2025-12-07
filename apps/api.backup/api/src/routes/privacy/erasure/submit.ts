/**
 * B150A-DSAR-002: API: submit DSAR erasure request for current user
 *
 * POST /privacy/erasure
 * - Creates PENDING DataErasureRequest for current user
 * - Rate-limited to prevent abuse
 * - Returns requestId & expected SLA date
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { rateLimitSandbox } from '../../../middleware/rateLimitSandbox';
import { loadUserSession, requireAuth, AuthenticatedRequest } from '../../../../../backend/src/middleware/accessGuards';

const router = Router();
const prisma = new PrismaClient();

// DSAR SLA: 30 days (GDPR requirement)
const DSAR_SLA_DAYS = 30;

/**
 * Extract current user ID from authenticated request
 */
function getCurrentUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user || !authReq.user.id) {
    throw new Error('User authentication required');
  }

  // Convert to string if needed (handles both string and number IDs)
  return String(authReq.user.id);
}

/**
 * POST /privacy/erasure
 * Submit DSAR erasure request for current user
 *
 * Request body:
 * {
 *   scope: "ACCOUNT" | "IDENTIFIERS" | "ALL" (required)
 *   requestedBy?: string (optional, defaults to current user)
 * }
 *
 * Response:
 * {
 *   requestId: string
 *   status: "PENDING"
 *   scope: string
 *   submittedAt: string (ISO date)
 *   expectedCompletionDate: string (ISO date, SLA date)
 * }
 */
router.post('/erasure', loadUserSession, requireAuth, rateLimitSandbox, async (req: Request, res: Response) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { scope, requestedBy } = req.body;

    // Validate scope
    if (!scope || !['ACCOUNT', 'IDENTIFIERS', 'ALL'].includes(scope)) {
      return res.status(400).json({
        error: 'invalid_scope',
        message: 'Scope must be one of: ACCOUNT, IDENTIFIERS, ALL',
      });
    }

    // Check if user already has a pending request
    const existingRequest = await prisma.dataErasureRequest.findFirst({
      where: {
        subjectId: currentUserId,
        status: {
          in: ['PENDING', 'IN_REVIEW'],
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'pending_request_exists',
        message: 'A pending erasure request already exists for this user',
        requestId: existingRequest.id,
        submittedAt: existingRequest.submittedAt,
        status: existingRequest.status,
      });
    }

    // Calculate SLA date (30 days from now)
    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + DSAR_SLA_DAYS);

    // Create erasure request
    const erasureRequest = await prisma.dataErasureRequest.create({
      data: {
        subjectId: currentUserId,
        scope: scope as 'ACCOUNT' | 'IDENTIFIERS' | 'ALL',
        status: 'PENDING',
        requestedBy: requestedBy || currentUserId,
        slaDate,
      },
    });

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        type: 'DSAR_ERASURE_REQUESTED',
        userId: currentUserId,
        data: {
          requestId: erasureRequest.id,
          scope: erasureRequest.scope,
          submittedAt: erasureRequest.submittedAt,
          slaDate: erasureRequest.slaDate,
        },
      },
    });

    return res.status(201).json({
      requestId: erasureRequest.id,
      status: erasureRequest.status,
      scope: erasureRequest.scope,
      submittedAt: erasureRequest.submittedAt.toISOString(),
      expectedCompletionDate: erasureRequest.slaDate?.toISOString(),
      message: 'Erasure request submitted successfully. You will be notified when processing begins.',
    });
  } catch (error: any) {
    console.error('DSAR erasure request error:', error);

    if (error.message === 'User authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User authentication required',
      });
    }

    return res.status(500).json({
      error: 'request_failed',
      message: 'Failed to submit erasure request',
      details: error.message,
    });
  }
});

/**
 * GET /privacy/erasure/:requestId
 * Get status of erasure request
 */
router.get('/erasure/:requestId', loadUserSession, requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { requestId } = req.params;

    const erasureRequest = await prisma.dataErasureRequest.findUnique({
      where: { id: requestId },
    });

    if (!erasureRequest) {
      return res.status(404).json({
        error: 'request_not_found',
        message: 'Erasure request not found',
      });
    }

    // Verify user owns this request
    if (erasureRequest.subjectId !== currentUserId) {
      return res.status(403).json({
        error: 'access_denied',
        message: 'You do not have access to this request',
      });
    }

    return res.json({
      requestId: erasureRequest.id,
      status: erasureRequest.status,
      scope: erasureRequest.scope,
      submittedAt: erasureRequest.submittedAt.toISOString(),
      completedAt: erasureRequest.completedAt?.toISOString(),
      expectedCompletionDate: erasureRequest.slaDate?.toISOString(),
      reviewNotes: erasureRequest.reviewNotes,
    });
  } catch (error: any) {
    console.error('Get erasure request error:', error);

    if (error.message === 'User authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User authentication required',
      });
    }

    return res.status(500).json({
      error: 'query_failed',
      message: 'Failed to retrieve erasure request',
      details: error.message,
    });
  }
});

export default router;

