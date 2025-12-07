import { Router, Request, Response } from 'express';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/claim/doc
 * Upload license document and selfie for Level 2 verification.
 */
router.post(
  '/',
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { npi, userId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!npi || !userId) {
        return res.status(400).json({ error: 'NPI and userId are required' });
      }

      if (!files.license || !files.selfie) {
        return res.status(400).json({ error: 'Both license and selfie images are required' });
      }

      // Try to import from backend if available
      try {
        const { level2ClaimService } = await import('../../../../backend/src/services/level2_claim_service');
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        const licenseImage = files.license[0];
        const selfieImage = files.selfie[0];

        // Process Level 2 claim
        const result = await level2ClaimService.processLevel2Claim({
          npi,
          userId: parseInt(userId),
          licenseImageBuffer: licenseImage.buffer,
          selfieImageBuffer: selfieImage.buffer,
        });

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            reasons: result.reasons,
          });
        }

        // Fetch updated claim to get confidence from evidence
        const updatedClaim = await (prisma as any).npiClaim.findUnique({ where: { npi } });
        const evidence = (updatedClaim?.evidence as any) || {};
        const confidence = evidence.faceMatchScore ? Math.round(evidence.faceMatchScore * 100) : null;

        return res.json({
          success: true,
          level: result.level,
          vcHash: result.vcHash,
          identityConfidence: confidence,
        });
      } catch (importError) {
        console.warn('Backend services not available, using fallback');
        res.status(501).json({ error: 'Document verification service not configured' });
      }
    } catch (error: any) {
      console.error('Level 2 claim error:', error);
      return res.status(500).json({ error: 'Failed to process document verification', details: error.message });
    }
  },
);

export default router;

