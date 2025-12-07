/**
 * S72-STRETCH-E-005: API: List marketplace offerings for purchase (public catalog)
 *
 * GET /marketplace/list returns active listings with pricing; supports filter by type
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { listActiveListings } from '../../../../services/marketplace/models/Listing';

const router = Router();
const prisma = new PrismaClient();

// Query schema for filtering
const ListingsQuerySchema = z.object({
  type: z.string().optional(), // productType filter
  orgId: z.string().optional(), // Optional org filter
});

/**
 * GET /marketplace/list
 * List active marketplace listings (public catalog)
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const query = ListingsQuerySchema.parse(req.query);

    const listings = await listActiveListings(prisma, {
      productType: query.type,
      orgId: query.orgId,
    });

    return res.json({
      listings: listings.map((listing) => ({
        id: listing.id,
        orgId: listing.orgId,
        productType: listing.productType,
        fiatPrice: listing.fiatPrice,
        vitaPrice: listing.vitaPrice,
        metadata: listing.metadata,
        createdAt: listing.createdAt,
      })),
      count: listings.length,
      filters: {
        type: query.type,
        orgId: query.orgId,
      },
    });
  } catch (error: any) {
    console.error('[marketplace/list] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list marketplace offerings',
    });
  }
});

export default router;

