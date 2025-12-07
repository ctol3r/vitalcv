/**
 * B149A-FF-003: API: list & update feature flags (admin only)
 *
 * GET /admin/flags returns all flags & values
 * PATCH /admin/flags/{key} updates default or scoped override
 * Protected by admin permission
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAllFlags, getFlag, clearCache } from '../../../../services/flags/featureFlagService';
import { recordFlagChange, getLatestFlagChange } from '../../../../services/audit/flagEvents';

const router = Router();
const prisma = new PrismaClient();

/**
 * Extended request with user info
 */
interface AdminRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

/**
 * Middleware to require admin role
 */
function requireAdmin(req: Request, res: Response, next: any) {
  const adminReq = req as AdminRequest;

  if (!adminReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has admin role
  const hasAdminRole = adminReq.user.roles.includes('admin') || adminReq.user.roles.includes('ADMIN');

  if (!hasAdminRole) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin access required',
    });
  }

  next();
}

/**
 * GET /admin/flags
 * Returns all feature flags with their current values
 * Query params:
 *   - orgId: Optional org ID to get org-scoped values
 *   - userId: Optional user ID to get user-scoped values
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const userId = req.query.userId as string | undefined;

    const flags = await getAllFlags(prisma, { orgId, userId });

    // Also get full flag definitions
    const flagDefinitions = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      include: {
        orgOverrides: orgId
          ? {
              where: { orgId },
              select: { orgId: true, value: true },
            }
          : false,
        userOverrides: userId
          ? {
              where: { userId },
              select: { userId: true, value: true },
            }
          : false,
      },
    });

    const response = flagDefinitions.map((flag) => {
      const resolved = flags.find((f) => f.flagKey === flag.key);
      return {
        key: flag.key,
        description: flag.description,
        defaultValue: flag.defaultValue,
        allowedValues: flag.allowedValues,
        scope: flag.scope,
        currentValue: resolved?.value ?? flag.defaultValue,
        valueSource: resolved?.source ?? 'global',
        orgOverrides: flag.orgOverrides || [],
        userOverrides: flag.userOverrides || [],
      };
    });

    return res.json({ flags: response });
  } catch (error) {
    console.error('[Admin Flags] Error listing flags:', error);
    return res.status(500).json({
      error: 'Failed to list feature flags',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /admin/flags/:key
 * Updates a feature flag's default value or creates/updates a scoped override
 *
 * Body:
 *   - value: The new value (required)
 *   - scope: 'global' | 'org' | 'user' (optional, defaults to 'global')
 *   - orgId: Required if scope is 'org'
 *   - userId: Required if scope is 'user'
 */
router.patch('/:key', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, scope = 'global', orgId, userId } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Validate scope
    if (!['global', 'org', 'user'].includes(scope)) {
      return res.status(400).json({
        error: 'Invalid scope',
        message: "Scope must be 'global', 'org', or 'user'",
      });
    }

    // Check if flag exists
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      return res.status(404).json({ error: `Feature flag '${key}' not found` });
    }

    // Validate value against allowedValues if defined
    if (flag.allowedValues) {
      const allowed = flag.allowedValues as any[];
      if (Array.isArray(allowed) && !allowed.includes(value)) {
        return res.status(400).json({
          error: 'Invalid value',
          message: `Value must be one of: ${allowed.join(', ')}`,
          allowedValues: allowed,
        });
      }
    }

    // Get actor info
    const adminReq = req as AdminRequest;
    const actorId = adminReq.user?.id || 'system';
    const actorName = adminReq.user?.email || 'System';

    // Get old value for audit
    let oldValue: any = null;
    if (scope === 'global') {
      oldValue = flag.defaultValue;
    } else if (scope === 'org') {
      if (!orgId) {
        return res.status(400).json({ error: 'orgId is required for org-scoped updates' });
      }
      const existing = await prisma.orgFeatureFlag.findUnique({
        where: {
          orgId_flagKey: {
            orgId,
            flagKey: key,
          },
        },
      });
      oldValue = existing?.value ?? null;
    } else if (scope === 'user') {
      if (!userId) {
        return res.status(400).json({ error: 'userId is required for user-scoped updates' });
      }
      const existing = await prisma.userFeatureFlag.findUnique({
        where: {
          userId_flagKey: {
            userId,
            flagKey: key,
          },
        },
      });
      oldValue = existing?.value ?? null;
    }

    let result;

    if (scope === 'global') {
      // Update default value
      result = await prisma.featureFlag.update({
        where: { key },
        data: { defaultValue: value },
      });

      // Clear cache for this flag
      clearCache(key);
    } else if (scope === 'org') {
      // Upsert org override
      result = await prisma.orgFeatureFlag.upsert({
        where: {
          orgId_flagKey: {
            orgId: orgId!,
            flagKey: key,
          },
        },
        create: {
          orgId: orgId!,
          flagKey: key,
          value,
        },
        update: {
          value,
        },
      });

      // Clear cache for this flag and org
      clearCache(key);
    } else if (scope === 'user') {
      // Upsert user override
      result = await prisma.userFeatureFlag.upsert({
        where: {
          userId_flagKey: {
            userId: userId!,
            flagKey: key,
          },
        },
        create: {
          userId: userId!,
          flagKey: key,
          value,
        },
        update: {
          value,
        },
      });

      // Clear cache for this flag and user
      clearCache(key);
    }

    // B141D-FF-003: Record audit event for flag change
    await recordFlagChange({
      flagKey: key,
      scope: scope.toUpperCase() as 'GLOBAL' | 'ORG' | 'USER',
      orgId: scope === 'org' ? orgId : undefined,
      userId: scope === 'user' ? userId : undefined,
      oldValue,
      newValue: value,
      actorId,
      actorName,
    });

    return res.json({
      success: true,
      flag: {
        key,
        scope,
        value,
        updatedAt: result?.updatedAt || new Date(),
      },
    });
  } catch (error) {
    console.error(`[Admin Flags] Error updating flag ${req.params.key}:`, error);
    return res.status(500).json({
      error: 'Failed to update feature flag',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /admin/flags/:key
 * Get a specific feature flag with its current value
 */
router.get('/:key', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const orgId = req.query.orgId as string | undefined;
    const userId = req.query.userId as string | undefined;

    const flag = await prisma.featureFlag.findUnique({
      where: { key },
      include: {
        orgOverrides: orgId
          ? {
              where: { orgId },
            }
          : false,
        userOverrides: userId
          ? {
              where: { userId },
            }
          : false,
      },
    });

    if (!flag) {
      return res.status(404).json({ error: `Feature flag '${key}' not found` });
    }

    // Get resolved value
    const resolved = await getFlag(prisma, key, { orgId, userId });

    // Get last changed information from audit events
    const latestChange = await getLatestFlagChange(
      key,
      resolved.source === 'org' ? 'ORG' : resolved.source === 'user' ? 'USER' : 'GLOBAL',
      orgId,
      userId
    );

    let lastChanged: { by: string; at: string; scope: 'GLOBAL' | 'ORG' | 'USER' } | undefined;
    if (latestChange) {
      const changeData = latestChange.data as any;
      lastChanged = {
        by: changeData.actorName || changeData.actorId || 'Unknown',
        at: latestChange.createdAt.toISOString(),
        scope: changeData.scope || 'GLOBAL',
      };
    }

    return res.json({
      key: flag.key,
      description: flag.description,
      defaultValue: flag.defaultValue,
      allowedValues: flag.allowedValues,
      scope: flag.scope,
      currentValue: resolved.value,
      valueSource: resolved.source,
      orgOverrides: flag.orgOverrides || [],
      userOverrides: flag.userOverrides || [],
      lastChanged,
    });
  } catch (error) {
    console.error(`[Admin Flags] Error getting flag ${req.params.key}:`, error);
    return res.status(500).json({
      error: 'Failed to get feature flag',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

