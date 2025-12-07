/**
 * AlertRuleAPI
 * B245B-OBS-016: Provides endpoints to create, update, list, delete alert rules
 * Validates input and ensures RBAC controls
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient, AlertComparator } from '@prisma/client';
import { AlertRuleModel } from '../models/AlertRule';
import { NotificationChannelModel } from '../models/NotificationChannel';
import { AuthenticatedRequest } from '../../../../backend/src/middleware/accessGuards';

const router = Router();

// Validation schemas
const AlertRuleCreateSchema = z.object({
  name: z.string().min(1).max(255),
  metricName: z.string().min(1).max(255),
  comparator: z.nativeEnum(AlertComparator),
  threshold: z.number(),
  duration: z.number().int().min(1), // Duration in minutes
  channelId: z.string().cuid(),
  isEnabled: z.boolean().optional(),
  description: z.string().optional(),
});

const AlertRuleUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metricName: z.string().min(1).max(255).optional(),
  comparator: z.nativeEnum(AlertComparator).optional(),
  threshold: z.number().optional(),
  duration: z.number().int().min(1).optional(),
  channelId: z.string().cuid().optional(),
  isEnabled: z.boolean().optional(),
  description: z.string().optional(),
});

/**
 * Helper to check if user has admin or observability role
 */
function requireObservabilityAccess(req: Request, res: Response, next: () => void) {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasAccess =
    authReq.user.roles.includes('admin') || authReq.user.roles.includes('observability');

  if (!hasAccess) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: ['admin', 'observability'],
      current: authReq.user.roles,
    });
  }

  next();
}

/**
 * POST /api/observability/alert-rules
 * Create a new alert rule
 */
router.post('/', requireObservabilityAccess, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const data = AlertRuleCreateSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;

    // Verify channel exists
    const channelModel = new NotificationChannelModel(prisma);
    const channel = await channelModel.findById(data.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }

    // Create alert rule
    const alertRuleModel = new AlertRuleModel(prisma);
    const rule = await alertRuleModel.create(data);

    res.status(201).json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[AlertRuleAPI] Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/observability/alert-rules
 * List all alert rules (optionally filtered)
 */
router.get('/', requireObservabilityAccess, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const filters: {
      isEnabled?: boolean;
      metricName?: string;
      channelId?: string;
    } = {};

    if (req.query.isEnabled !== undefined) {
      filters.isEnabled = req.query.isEnabled === 'true';
    }
    if (req.query.metricName) {
      filters.metricName = req.query.metricName as string;
    }
    if (req.query.channelId) {
      filters.channelId = req.query.channelId as string;
    }

    const alertRuleModel = new AlertRuleModel(prisma);
    const rules = await alertRuleModel.list(filters);

    res.json(rules);
  } catch (error: any) {
    console.error('[AlertRuleAPI] Error listing alert rules:', error);
    res.status(500).json({ error: 'Failed to list alert rules' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/observability/alert-rules/:id
 * Get a specific alert rule
 */
router.get('/:id', requireObservabilityAccess, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const { id } = req.params;

    const alertRuleModel = new AlertRuleModel(prisma);
    const rule = await alertRuleModel.findById(id);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    res.json(rule);
  } catch (error: any) {
    console.error('[AlertRuleAPI] Error getting alert rule:', error);
    res.status(500).json({ error: 'Failed to get alert rule' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * PATCH /api/observability/alert-rules/:id
 * Update an alert rule
 */
router.patch('/:id', requireObservabilityAccess, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const { id } = req.params;
    const data = AlertRuleUpdateSchema.parse(req.body);

    // If channelId is being updated, verify it exists
    if (data.channelId) {
      const channelModel = new NotificationChannelModel(prisma);
      const channel = await channelModel.findById(data.channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Notification channel not found' });
      }
    }

    const alertRuleModel = new AlertRuleModel(prisma);
    const rule = await alertRuleModel.update(id, data);

    res.json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[AlertRuleAPI] Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * DELETE /api/observability/alert-rules/:id
 * Delete an alert rule
 */
router.delete('/:id', requireObservabilityAccess, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const { id } = req.params;

    const alertRuleModel = new AlertRuleModel(prisma);
    const rule = await alertRuleModel.findById(id);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    await alertRuleModel.delete(id);

    res.status(204).send();
  } catch (error: any) {
    console.error('[AlertRuleAPI] Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;

