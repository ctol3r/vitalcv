/**
 * S72-D3-A-004: Get platform policy endpoint
 * GET /demo/policy
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /demo/policy
 * Returns the current active platform policy
 *
 * Response:
 * {
 *   id: string,
 *   name: string,
 *   version: string,
 *   content: string,
 *   summary: string,
 *   effectiveAt: string
 * }
 */
router.get('/demo/policy', async (req: Request, res: Response) => {
  try {
    // Get the current active policy (version 1.0, Pilot Terms)
    const policy = await prisma.platformPolicyVersion.findFirst({
      where: {
        isActive: true,
        name: 'Pilot Terms',
      },
      orderBy: {
        effectiveAt: 'desc',
      },
    });

    if (!policy) {
      return res.status(404).json({ error: 'No active policy found' });
    }

    res.status(200).json({
      id: policy.id,
      name: policy.name,
      version: policy.version,
      content: policy.content,
      summary: policy.summary,
      effectiveAt: policy.effectiveAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /demo/policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

export default router;

