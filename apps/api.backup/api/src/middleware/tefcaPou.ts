/**
 * B136A-TEFCA-008: TEFCA Purpose of Use (PoU) Enforcement Middleware
 *
 * Enforces PoU on TEFCA facade routes and logs all PoU in audit trail.
 * Rejects requests missing PoU or with disallowed PoU values.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { TefcaPurposeOfUse, isPurposeAllowed } from '../../../../services/tefca/models/QhinConfig.js';

const prisma = new PrismaClient();

/**
 * Extended Express Request with TEFCA context
 */
export interface TefcaRequest extends Request {
  tefca?: {
    orgId: string;
    purposeOfUse: TefcaPurposeOfUse;
    qhinConfig: any;
  };
}

/**
 * TEFCA PoU Enforcement Middleware
 *
 * Usage: app.use('/tefca/fhir/*', enforceTefcaPou);
 */
export async function enforceTefcaPou(
  req: TefcaRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract orgId from auth context (assumes JWT middleware runs first)
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId;
    if (!orgId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Organization ID is required',
      });
      return;
    }

    // Extract Purpose of Use from headers or query params
    const purposeOfUse = (req.headers['x-purpose-of-use'] as string) || req.query.purposeOfUse as string;
    if (!purposeOfUse) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Purpose of Use (X-Purpose-Of-Use header or purposeOfUse query param) is required for TEFCA requests',
      });
      return;
    }

    // Validate PoU is a valid TEFCA purpose
    if (!Object.values(TefcaPurposeOfUse).includes(purposeOfUse as TefcaPurposeOfUse)) {
      res.status(400).json({
        error: 'BadRequest',
        message: `Invalid Purpose of Use: ${purposeOfUse}. Must be one of: ${Object.values(TefcaPurposeOfUse).join(', ')}`,
      });
      return;
    }

    // Fetch QHIN config for organization
    const qhinConfig = await prisma.qhinConfig.findUnique({
      where: { orgId },
    });

    if (!qhinConfig || !qhinConfig.isActive) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'TEFCA access not configured for this organization',
      });
      return;
    }

    // Check if PoU is allowed for this organization
    if (!qhinConfig.allowedPurposes.includes(purposeOfUse)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Purpose of Use '${purposeOfUse}' is not allowed for this organization. Allowed: ${qhinConfig.allowedPurposes.join(', ')}`,
      });
      return;
    }

    // Attach TEFCA context to request
    req.tefca = {
      orgId,
      purposeOfUse: purposeOfUse as TefcaPurposeOfUse,
      qhinConfig,
    };

    // Log PoU in audit (non-blocking)
    logTefcaPou(orgId, purposeOfUse, req.path).catch(err => {
      console.error('Failed to log TEFCA PoU:', err);
    });

    next();
  } catch (error) {
    console.error('TEFCA PoU enforcement error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to enforce TEFCA PoU',
    });
  }
}

/**
 * Log TEFCA Purpose of Use for audit trail
 */
async function logTefcaPou(orgId: string, purposeOfUse: string, path: string): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'TEFCA_POU_ENFORCED',
      data: {
        orgId,
        purposeOfUse,
        path,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

/**
 * Get PoU from request (helper)
 */
export function getPurposeOfUse(req: TefcaRequest): TefcaPurposeOfUse | null {
  return req.tefca?.purposeOfUse || null;
}

