import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/claim/status?npi=...
 * Get claim status by NPI
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { npi, statusId } = req.query;

    if (statusId) {
      // Legacy statusId-based lookup (for backward compatibility)
      // This would require access to the statuses store
      return res.status(404).json({ error: 'Status ID lookup not available in MVP' });
    }

    if (!npi || typeof npi !== 'string') {
      return res.status(400).json({ error: 'NPI parameter is required' });
    }

    // Try to get claim from database
    try {
      const claim = await (prisma as any).npiClaim.findUnique({
        where: { npi },
        include: { user: true },
      });

      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      // Build comprehensive status response
      res.json({
        npi: claim.npi,
        level: claim.level,
        userId: claim.userId,
        did: claim.user?.did || null,
        roles: claim.user?.roles || [],
        emailVerified: claim.level >= 1,
        phoneVerified: false, // Not implemented yet
        identityConfidence: (claim.evidence as any)?.identityConfidence || null,
        evidence: claim.evidence,
        issuerAttestationTx: claim.issuerAttestationTx,
        lastVerifiedAt: claim.lastVerifiedAt,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({ error: 'Failed to get claim status' });
    }
  } catch (error: any) {
    console.error('Get claim status error:', error);
    res.status(500).json({ error: 'Failed to get claim status', details: error.message });
  }
});

export default router;

