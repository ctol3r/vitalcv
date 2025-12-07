import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Import NPPES service from backend if available
// For MVP, we'll use a simple implementation
const LookupSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
});

/**
 * GET /api/npi/lookup?npi=...
 * Lookup NPI in NPPES registry
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { npi } = LookupSchema.parse(req.query);

    // Try to import from backend if available
    try {
      const { nppesService } = await import('../../../../backend/src/services/nppes');
      const provider = await nppesService.lookup(npi);

      if (!provider) {
        return res.status(404).json({ error: 'NPI not found', code: 'NPI_NOT_FOUND' });
      }

      const name = nppesService.getProviderName(provider);
      const roles = nppesService.inferRole(provider);

      res.json({
        npi: provider.number,
        type: provider.enumeration_type,
        name,
        roles,
        basic: provider.basic,
        taxonomies: provider.taxonomies || [],
        addresses: provider.addresses || [],
      });
    } catch (importError) {
      // Fallback if backend service not available
      console.warn('Backend NPPES service not available, using fallback');
      res.status(501).json({ error: 'NPI lookup service not configured' });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup NPI' });
  }
});

export default router;

