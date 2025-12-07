/**
 * S72-POST-3A-002: API: GET /demo/pilot/org for current pilot org context
 *
 * Returns PilotOrg info for demo tenant (pilot name, sponsor, contact)
 * 200 with simple JSON; no auth in DEMO
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /demo/pilot/org
 *
 * Returns PilotOrg info for demo tenant
 */
router.get('/org', async (req: Request, res: Response) => {
  try {
    // Get the demo pilot org (assuming there's one demo org)
    // In a real implementation, this might be determined by tenant context
    const pilotOrg = await prisma.pilotOrg.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!pilotOrg) {
      return res.status(200).json({
        pilotName: null,
        sponsorName: null,
        sponsorEmail: null,
        ehrType: null,
        notes: null,
        message: 'No pilot organization found. Run seed to create demo pilot.',
      });
    }

    return res.status(200).json({
      pilotName: pilotOrg.pilotName,
      sponsorName: pilotOrg.sponsorName,
      sponsorEmail: pilotOrg.sponsorEmail,
      ehrType: pilotOrg.ehrType,
      notes: pilotOrg.notes,
    });

  } catch (error: any) {
    console.error('❌ [Pilot Org] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: `Error fetching pilot org: ${error.message}`,
    });
  }
});

export default router;

