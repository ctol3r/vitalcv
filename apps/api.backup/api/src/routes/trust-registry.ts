/**
 * Trust Registry Admin API
 * Tagged: cursor-batch-1105 (Task 0013)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * CRUD endpoints for managing trusted issuers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

/**
 * Middleware: Check if user has admin role
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // TODO: Implement proper role checking from JWT/session
  const userRoles = (req as any).user?.roles || [];

  if (!userRoles.includes('admin') && !userRoles.includes('trust-admin')) {
    return res.status(403).json({
      code: 'E_FORBIDDEN',
      title: 'Forbidden',
      detail: 'Admin role required',
      status: 403,
    });
  }

  next();
}

/**
 * GET /api/trust-registry/issuers
 * List all trusted issuers
 */
router.get(
  '/issuers',
  [
    query('schemaType').optional().isString(),
    query('active').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { schemaType, active } = req.query;

      const where: any = {};

      if (active !== undefined) {
        where.isActive = active === 'true';
      }

      const issuers = await prisma.trustedIssuer.findMany({
        where,
        orderBy: { addedAt: 'desc' },
      });

      // Filter by schemaType if provided
      let filtered = issuers;
      if (schemaType) {
        filtered = issuers.filter((issuer) =>
          issuer.schemaTypes.includes(schemaType as string),
        );
      }

      res.json({
        issuers: filtered,
        total: filtered.length,
      });
    } catch (error) {
      console.error('Error listing issuers:', error);
      res.status(500).json({ error: 'Failed to list issuers' });
    }
  },
);

/**
 * GET /api/trust-registry/issuers/:did
 * Get a specific issuer
 */
router.get('/issuers/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;

    const issuer = await prisma.trustedIssuer.findUnique({
      where: { did },
    });

    if (!issuer) {
      return res.status(404).json({
        code: 'E_NOT_FOUND',
        title: 'Issuer Not Found',
        detail: `Issuer with DID ${did} not found`,
        status: 404,
      });
    }

    res.json(issuer);
  } catch (error) {
    console.error('Error getting issuer:', error);
    res.status(500).json({ error: 'Failed to get issuer' });
  }
});

/**
 * POST /api/trust-registry/issuers
 * Add a new trusted issuer (admin only)
 */
router.post(
  '/issuers',
  requireAdmin,
  [
    body('did').isString().notEmpty(),
    body('name').isString().notEmpty(),
    body('schemaTypes').isArray().notEmpty(),
    body('metadata').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { did, name, schemaTypes, metadata } = req.body;
      const addedBy = (req as any).user?.id || 'system';

      // Check if already exists
      const existing = await prisma.trustedIssuer.findUnique({
        where: { did },
      });

      if (existing) {
        return res.status(409).json({
          code: 'E_ALREADY_EXISTS',
          title: 'Issuer Already Exists',
          detail: `Issuer with DID ${did} already exists`,
          status: 409,
        });
      }

      // Create new trusted issuer
      const issuer = await prisma.trustedIssuer.create({
        data: {
          did,
          name,
          schemaTypes,
          metadata: metadata || {},
          addedBy,
          isActive: true,
        },
      });

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'TRUST_REGISTRY_ISSUER_ADDED',
          data: {
            did,
            name,
            schemaTypes,
            addedBy,
          },
        },
      });

      res.status(201).json(issuer);
    } catch (error) {
      console.error('Error adding issuer:', error);
      res.status(500).json({ error: 'Failed to add issuer' });
    }
  },
);

/**
 * PATCH /api/trust-registry/issuers/:did
 * Update a trusted issuer (admin only)
 */
router.patch(
  '/issuers/:did',
  requireAdmin,
  [
    param('did').isString(),
    body('name').optional().isString(),
    body('schemaTypes').optional().isArray(),
    body('metadata').optional().isObject(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { did } = req.params;
      const updates = req.body;

      // Check if exists
      const existing = await prisma.trustedIssuer.findUnique({
        where: { did },
      });

      if (!existing) {
        return res.status(404).json({
          code: 'E_NOT_FOUND',
          title: 'Issuer Not Found',
          detail: `Issuer with DID ${did} not found`,
          status: 404,
        });
      }

      // Update issuer
      const updated = await prisma.trustedIssuer.update({
        where: { did },
        data: updates,
      });

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'TRUST_REGISTRY_ISSUER_UPDATED',
          data: {
            did,
            updates,
            updatedBy: (req as any).user?.id || 'system',
          },
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating issuer:', error);
      res.status(500).json({ error: 'Failed to update issuer' });
    }
  },
);

/**
 * DELETE /api/trust-registry/issuers/:did
 * Remove a trusted issuer (admin only)
 */
router.delete(
  '/issuers/:did',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { did } = req.params;

      // Check if exists
      const existing = await prisma.trustedIssuer.findUnique({
        where: { did },
      });

      if (!existing) {
        return res.status(404).json({
          code: 'E_NOT_FOUND',
          title: 'Issuer Not Found',
          detail: `Issuer with DID ${did} not found`,
          status: 404,
        });
      }

      // Soft delete by setting isActive to false
      await prisma.trustedIssuer.update({
        where: { did },
        data: { isActive: false },
      });

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'TRUST_REGISTRY_ISSUER_REMOVED',
          data: {
            did,
            removedBy: (req as any).user?.id || 'system',
          },
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error removing issuer:', error);
      res.status(500).json({ error: 'Failed to remove issuer' });
    }
  },
);

/**
 * GET /api/trust-registry/schemas
 * List all schema types with their trusted issuers
 */
router.get('/schemas', async (req: Request, res: Response) => {
  try {
    const issuers = await prisma.trustedIssuer.findMany({
      where: { isActive: true },
    });

    // Group by schema type
    const schemaMap = new Map<string, any[]>();

    for (const issuer of issuers) {
      for (const schemaType of issuer.schemaTypes) {
        if (!schemaMap.has(schemaType)) {
          schemaMap.set(schemaType, []);
        }
        schemaMap.get(schemaType)!.push({
          did: issuer.did,
          name: issuer.name,
        });
      }
    }

    const schemas = Array.from(schemaMap.entries()).map(([schemaType, issuers]) => ({
      schemaType,
      trustedIssuers: issuers,
      count: issuers.length,
    }));

    res.json({ schemas });
  } catch (error) {
    console.error('Error listing schemas:', error);
    res.status(500).json({ error: 'Failed to list schemas' });
  }
});

export default router;

