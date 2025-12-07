/**
 * B150A-DSAR-003: Admin API: list & update DSAR requests
 *
 * GET /admin/privacy/erasure - Lists open/completed DSARs
 * PATCH /admin/privacy/erasure/:id - Updates status to APPROVED/REJECTED/COMPLETED
 * - Emits audit events on status changes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ErasureEngine } from '../../../../services/privacy/erasureEngine';
import { loadUserSession, requireAuth, requireRole, AuthenticatedRequest } from '../../../../../backend/src/middleware/accessGuards';

const router = Router();
const prisma = new PrismaClient();
const erasureEngine = new ErasureEngine(prisma);

/**
 * Extract admin user ID from authenticated request
 */
function getAdminUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user || !authReq.user.id) {
    throw new Error('Admin authentication required');
  }

  // Convert to string if needed (handles both string and number IDs)
  return String(authReq.user.id);
}

/**
 * GET /admin/privacy/erasure
 * List DSAR requests (filtered by status if provided)
 *
 * Query params:
 * - status?: PENDING | IN_REVIEW | APPROVED | REJECTED | COMPLETED
 * - scope?: ACCOUNT | IDENTIFIERS | ALL
 * - limit?: number (default: 50)
 * - offset?: number (default: 0)
 */
router.get('/admin/privacy/erasure', loadUserSession, requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const adminUserId = getAdminUserId(req);
    const {
      status,
      scope,
      limit = '50',
      offset = '0',
    } = req.query;

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    if (scope) {
      where.scope = scope as string;
    }

    // Parse pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Fetch requests
    const [requests, total] = await Promise.all([
      prisma.dataErasureRequest.findMany({
        where,
        orderBy: {
          submittedAt: 'desc',
        },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.dataErasureRequest.count({ where }),
    ]);

    return res.json({
      requests: requests.map(req => ({
        requestId: req.id,
        subjectId: req.subjectId,
        scope: req.scope,
        status: req.status,
        submittedAt: req.submittedAt.toISOString(),
        completedAt: req.completedAt?.toISOString(),
        slaDate: req.slaDate?.toISOString(),
        reviewedBy: req.reviewedBy,
        reviewNotes: req.reviewNotes,
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error: any) {
    console.error('List DSAR requests error:', error);

    if (error.message === 'Admin authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Admin authentication required',
      });
    }

    return res.status(500).json({
      error: 'query_failed',
      message: 'Failed to list DSAR requests',
      details: error.message,
    });
  }
});

/**
 * GET /admin/privacy/erasure/:id
 * Get details of a specific DSAR request
 */
router.get('/admin/privacy/erasure/:id', loadUserSession, requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const adminUserId = getAdminUserId(req);
    const { id } = req.params;

    const erasureRequest = await prisma.dataErasureRequest.findUnique({
      where: { id },
    });

    if (!erasureRequest) {
      return res.status(404).json({
        error: 'request_not_found',
        message: 'Erasure request not found',
      });
    }

    return res.json({
      requestId: erasureRequest.id,
      subjectId: erasureRequest.subjectId,
      scope: erasureRequest.scope,
      status: erasureRequest.status,
      submittedAt: erasureRequest.submittedAt.toISOString(),
      completedAt: erasureRequest.completedAt?.toISOString(),
      slaDate: erasureRequest.slaDate?.toISOString(),
      requestedBy: erasureRequest.requestedBy,
      reviewedBy: erasureRequest.reviewedBy,
      reviewNotes: erasureRequest.reviewNotes,
      metadata: erasureRequest.metadata,
      createdAt: erasureRequest.createdAt.toISOString(),
      updatedAt: erasureRequest.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get DSAR request error:', error);

    if (error.message === 'Admin authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Admin authentication required',
      });
    }

    return res.status(500).json({
      error: 'query_failed',
      message: 'Failed to get DSAR request',
      details: error.message,
    });
  }
});

/**
 * PATCH /admin/privacy/erasure/:id
 * Update DSAR request status
 *
 * Request body:
 * {
 *   status: "IN_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED" (required)
 *   reviewNotes?: string (optional)
 * }
 *
 * Status transitions:
 * - PENDING -> IN_REVIEW (admin starts review)
 * - IN_REVIEW -> APPROVED (admin approves, triggers erasure)
 * - IN_REVIEW -> REJECTED (admin rejects)
 * - APPROVED -> COMPLETED (erasure engine completes)
 */
router.patch('/admin/privacy/erasure/:id', loadUserSession, requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const adminUserId = getAdminUserId(req);
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    // Validate status
    if (!status || !['IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Status must be one of: IN_REVIEW, APPROVED, REJECTED, COMPLETED',
      });
    }

    // Fetch current request
    const erasureRequest = await prisma.dataErasureRequest.findUnique({
      where: { id },
    });

    if (!erasureRequest) {
      return res.status(404).json({
        error: 'request_not_found',
        message: 'Erasure request not found',
      });
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ['IN_REVIEW', 'REJECTED'],
      IN_REVIEW: ['APPROVED', 'REJECTED'],
      APPROVED: ['COMPLETED'],
      REJECTED: [], // Cannot transition from REJECTED
      COMPLETED: [], // Cannot transition from COMPLETED
    };

    const allowedStatuses = validTransitions[erasureRequest.status] || [];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'invalid_transition',
        message: `Cannot transition from ${erasureRequest.status} to ${status}. Allowed: ${allowedStatuses.join(', ')}`,
      });
    }

    // Update request
    const updateData: any = {
      status,
      reviewedBy: adminUserId,
      reviewNotes: reviewNotes || erasureRequest.reviewNotes,
      updatedAt: new Date(),
    };

    // Set completedAt if status is COMPLETED
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updatedRequest = await prisma.dataErasureRequest.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        type: 'DSAR_ERASURE_STATUS_CHANGED',
        userId: adminUserId,
        data: {
          requestId: id,
          oldStatus: erasureRequest.status,
          newStatus: status,
          reviewedBy: adminUserId,
          reviewNotes,
        },
      },
    });

    // If status is APPROVED, trigger erasure engine
    if (status === 'APPROVED') {
      try {
        // Execute erasure in background (in production, use a job queue)
        const erasureResult = await erasureEngine.executeErasure(
          erasureRequest.subjectId,
          erasureRequest.scope as 'ACCOUNT' | 'IDENTIFIERS' | 'ALL'
        );

        // Update request to COMPLETED after erasure
        await prisma.dataErasureRequest.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            metadata: {
              erasureResult: {
                tablesProcessed: erasureResult.tablesProcessed,
                recordsAnonymized: erasureResult.recordsAnonymized,
                recordsDecoupled: erasureResult.recordsDecoupled,
                errors: erasureResult.errors,
                completedAt: erasureResult.completedAt.toISOString(),
              },
            },
          },
        });

        // Log completion
        await prisma.auditEvent.create({
          data: {
            type: 'DSAR_ERASURE_COMPLETED',
            userId: erasureRequest.subjectId,
            data: {
              requestId: id,
              erasureResult,
            },
          },
        });
      } catch (erasureError: any) {
        console.error('Erasure execution error:', erasureError);

        // Update request with error
        await prisma.dataErasureRequest.update({
          where: { id },
          data: {
            metadata: {
              erasureError: erasureError.message,
            },
          },
        });

        // Log error
        await prisma.auditEvent.create({
          data: {
            type: 'DSAR_ERASURE_FAILED',
            userId: adminUserId,
            data: {
              requestId: id,
              error: erasureError.message,
            },
          },
        });

        return res.status(500).json({
          error: 'erasure_failed',
          message: 'Erasure was approved but execution failed',
          details: erasureError.message,
        });
      }
    }

    return res.json({
      requestId: updatedRequest.id,
      status: updatedRequest.status,
      reviewedBy: updatedRequest.reviewedBy,
      reviewNotes: updatedRequest.reviewNotes,
      completedAt: updatedRequest.completedAt?.toISOString(),
      message: status === 'APPROVED'
        ? 'Request approved and erasure completed'
        : 'Request status updated',
    });
  } catch (error: any) {
    console.error('Update DSAR request error:', error);

    if (error.message === 'Admin authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Admin authentication required',
      });
    }

    return res.status(500).json({
      error: 'update_failed',
      message: 'Failed to update DSAR request',
      details: error.message,
    });
  }
});

export { router as default };

