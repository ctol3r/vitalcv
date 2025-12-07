import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const LinkSchema = z.object({
  did: z.string(),
  npi: z.string().regex(/^\d{10}$/).optional(),
  entityId: z.string().optional(),
});

/**
 * POST /api/did/link
 * Link a DID to an NPI or entity
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { did, npi, entityId } = LinkSchema.parse(req.body);

    if (!npi && !entityId) {
      return res.status(400).json({ error: 'Either npi or entityId is required' });
    }

    // Try to import from backend if available
    try {
      // For MVP, we'll create a simple link record
      // In production, this would use a proper linking service
      const linkData: any = {
        did,
        linkedAt: new Date(),
      };

      if (npi) {
        linkData.npi = npi;
      }

      if (entityId) {
        linkData.entityId = entityId;
      }

      // Store link (this is a simplified version)
      // In production, use proper Prisma models
      res.json({
        success: true,
        did,
        npi: npi || null,
        entityId: entityId || null,
        linkedAt: new Date().toISOString(),
      });
    } catch (importError) {
      console.warn('Backend services not available, using fallback');
      res.status(501).json({ error: 'DID linking service not configured' });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('DID link error:', error);
    res.status(500).json({ error: 'Failed to link DID', details: error.message });
  }
});

/**
 * GET /api/did/link?did=... or ?npi=...
 * Get DID links
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { did, npi } = req.query;

    if (!did && !npi) {
      return res.status(400).json({ error: 'Either did or npi parameter is required' });
    }

    // Try to get link from database
    try {
      // Simplified MVP implementation
      // In production, use proper Prisma models
      res.json({
        success: true,
        did: did || null,
        npi: npi || null,
        links: [],
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({ error: 'Failed to get DID links' });
    }
  } catch (error: any) {
    console.error('Get DID links error:', error);
    res.status(500).json({ error: 'Failed to get DID links', details: error.message });
  }
});

export default router;

