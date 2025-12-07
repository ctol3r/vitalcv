import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import multer from 'multer';
import { emitEvent } from '../agents/bus';
import { level2ClaimService } from '../services/level2_claim_service';
import { level3ClaimService } from '../services/level3_claim_service';

const router = Router();
const prisma = new PrismaClient();

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
  '/doc',
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

      // Emit event for agent processing
      emitEvent({ type: 'CLAIM_DOC_UPLOAD', npi });

      return res.json({
        success: true,
        level: result.level,
        vcHash: result.vcHash,
        identityConfidence: confidence,
      });
    } catch (error: any) {
      console.error('Level 2 claim error:', error);
      return res
        .status(500)
        .json({ error: 'Failed to process document verification', details: error.message });
    }
  },
);

/**
 * POST /api/issuer/attest-request
 * Request attestation from an issuer (Level 3).
 */
router.post('/issuer/attest-request', async (req: Request, res: Response) => {
  try {
    const { npi, userId, requestedBy } = req.body;

    if (!npi || !userId) {
      return res.status(400).json({ error: 'NPI and userId are required' });
    }

    const result = await level3ClaimService.requestAttestation({
      npi,
      userId: parseInt(userId),
      requestedBy: requestedBy || 'user',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Emit event for agent processing
    emitEvent({ type: 'ATTEST_REQUESTED', npi });

    return res.json({
      success: true,
      requestId: result.requestId,
      message:
        'Attestation request submitted. You will be notified when an issuer signs your credential.',
    });
  } catch (error: any) {
    console.error('Level 3 attestation request error:', error);
    return res.status(500).json({ error: 'Failed to request attestation', details: error.message });
  }
});

/**
 * POST /api/issuer/attest-receipt
 * Process attestation receipt from issuer (webhook/callback).
 */
router.post('/issuer/attest-receipt', async (req: Request, res: Response) => {
  try {
    const { npi, issuerDid, credentialHash, holderDid } = req.body;

    if (!npi || !issuerDid || !credentialHash || !holderDid) {
      return res
        .status(400)
        .json({ error: 'All fields (npi, issuerDid, credentialHash, holderDid) are required' });
    }

    const result = await level3ClaimService.processAttestationReceipt({
      npi,
      issuerDid,
      credentialHash,
      holderDid,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Emit event for agent processing
    emitEvent({ type: 'ATTEST_APPROVE', npi });

    return res.json({
      success: true,
      txHash: result.txHash,
      message: 'Attestation processed successfully',
    });
  } catch (error: any) {
    console.error('Level 3 attestation receipt error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to process attestation receipt', details: error.message });
  }
});

/**
 * GET /api/issuer/attestation-status/:npi
 * Get attestation status for a claim.
 */
router.get('/issuer/attestation-status/:npi', async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;

    const status = await level3ClaimService.getAttestationStatus(npi);

    if (!status) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    return res.json(status);
  } catch (error: any) {
    console.error('Get attestation status error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to get attestation status', details: error.message });
  }
});

export default router;
