/**
 * Admin Pilot Signup Management
 * B162B-PILOT-004
 */

import { PilotSignupStatus, Prisma, PrismaClient } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  convertApprovedSignup,
  PilotSignupConversionResult,
} from 'services/pilot/convertApprovedSignup';
import {
  PilotSignupStatusSchema,
  PilotSignupUpdateSchema,
} from 'services/pilot/models/PilotSignup';

const router = Router();
const prisma = new PrismaClient();

interface AdminRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const adminReq = req as AdminRequest;
  if (!adminReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const hasAdminRole =
    adminReq.user.roles?.includes('admin') ||
    adminReq.user.roles?.includes('ADMIN') ||
    adminReq.user.roles?.includes('internal_admin');

  if (!hasAdminRole) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Admin privileges required',
    });
  }

  return next();
}

router.get('/signups', requireAdmin, async (req: Request, res: Response) => {
  try {
    const statusParam = req.query.status as string | undefined;
    let statusFilter: PilotSignupStatus | undefined;

    if (statusParam) {
      statusFilter = PilotSignupStatusSchema.parse(statusParam);
    }

    const signups = await prisma.pilotSignup.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      total: signups.length,
      signups,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'invalid_query',
        details: error.flatten(),
      });
    }
    console.error('[GET /admin/pilot/signups] Failed to list signups', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list pilot signups',
    });
  }
});

router.patch(
  '/signups/:id',
  requireAdmin,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      const parsed = PilotSignupUpdateSchema.parse(req.body || {});

      if (!parsed.status && parsed.notes === undefined) {
        return res.status(400).json({
          error: 'invalid_payload',
          message: 'Provide at least status or notes',
        });
      }

      const existing = await prisma.pilotSignup.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'not_found' });
      }

      const data: Prisma.PilotSignupUpdateInput = {};

      if (parsed.notes !== undefined) {
        data.notes = parsed.notes;
      }

      if (parsed.status && parsed.status !== existing.status) {
        data.status = parsed.status;
        data.statusChangedAt = new Date();
      }

      const updated = await prisma.pilotSignup.update({
        where: { id },
        data,
      });

      let conversion: PilotSignupConversionResult | null = null;
      if (
        parsed.status === PilotSignupStatus.APPROVED &&
        existing.status !== PilotSignupStatus.APPROVED
      ) {
        conversion = await convertApprovedSignup(updated, {
          actorId: (req as AdminRequest).user?.id,
        });
      }

      return res.json({
        signup: updated,
        conversion,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'invalid_payload',
          details: error.flatten(),
        });
      }
      console.error('[PATCH /admin/pilot/signups/:id] Failed to update signup', error);
      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to update pilot signup',
      });
    }
  }
);

export default router;

