/**
 * AAL Policy Management Routes
 *
 * Handles AAL policy configuration and user assignments
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  upsertAalPolicy,
  assignAalPolicyToUser,
  getUserAalPolicy,
  checkUserAalCompliance,
} from './aal-policy';
import { requireAal } from './middleware/aal-guard';
import { AuthenticatedRequest } from './middleware/types';

const router: Router = Router();
const prisma = new PrismaClient();

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * GET /api/auth/policy
 * List all AAL policies
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const policies = await prisma.aalPolicy.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ policies });
  } catch (error) {
    console.error('List policies error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to list policies') });
  }
});

/**
 * GET /api/auth/policy/:name
 * Get specific AAL policy
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const policy = await prisma.aalPolicy.findUnique({
      where: { name },
    });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({ policy });
  } catch (error) {
    console.error('Get policy error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to get policy') });
  }
});

/**
 * POST /api/auth/policy
 * Create or update AAL policy
 * Requires AAL3 (admin access)
 */
router.post('/', requireAal(3), async (req: Request, res: Response) => {
  try {
    const { name, description, aalLevel, requiresPhishingResistant, allowedAuthenticatorTypes, config } = req.body;

    if (!name || !aalLevel || !allowedAuthenticatorTypes) {
      return res.status(400).json({
        error: 'name, aalLevel, and allowedAuthenticatorTypes required',
      });
    }

    if (aalLevel < 1 || aalLevel > 3) {
      return res.status(400).json({ error: 'aalLevel must be 1, 2, or 3' });
    }

    // AAL3 requires phishing-resistant authenticators
    if (aalLevel === 3 && !requiresPhishingResistant) {
      return res.status(400).json({
        error: 'AAL3 requires phishing-resistant authenticators',
      });
    }

    const policyId = await upsertAalPolicy(
      name,
      {
        aalLevel: aalLevel as 1 | 2 | 3,
        requiresPhishingResistant: requiresPhishingResistant || false,
        allowedAuthenticatorTypes,
        config,
      },
      description
    );

    res.json({ success: true, policyId });
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to create policy') });
  }
});

/**
 * GET /api/auth/policy/user/:userId
 * Get user's AAL policy and compliance status
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const policy = await getUserAalPolicy(userId, user.roles || []);
    const status = await checkUserAalCompliance(userId, user.roles || []);

    res.json({ policy, status });
  } catch (error) {
    console.error('Get user policy error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to get user policy') });
  }
});

/**
 * POST /api/auth/policy/user/:userId/assign
 * Assign AAL policy to user
 * Requires AAL3 (admin access)
 */
router.post('/user/:userId/assign', requireAal(3), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { policyId, expiresAt } = req.body;
    const authReq = req as AuthenticatedRequest;

    if (!policyId) {
      return res.status(400).json({ error: 'policyId required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const policy = await prisma.aalPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    await assignAalPolicyToUser(
      userId,
      policyId,
      authReq.user?.id.toString(),
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Assign policy error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to assign policy') });
  }
});

/**
 * GET /api/auth/policy/export/json
 * Export policy configuration as JSON
 */
router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const { getPolicyJson } = await import('./policy-config');
    const json = getPolicyJson();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="aal-policies.json"');
    res.send(json);
  } catch (error) {
    console.error('Export policy error:', error);
    res.status(500).json({ error: resolveErrorMessage(error, 'Failed to export policies') });
  }
});

export { router as policyRouter };
