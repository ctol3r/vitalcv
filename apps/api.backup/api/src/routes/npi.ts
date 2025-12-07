import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { nppesService } from '../services/nppes';
import { OtpService } from '../services/otp';
import { generateDID } from '../utils/did';

const router = Router();
const prisma = new PrismaClient();
const otpService = new OtpService(prisma);

// Request schemas
const LookupSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
});

const BasicClaimSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
  email: z.string().email(),
});

const VerifyPinSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
  pin: z.string().regex(/^\d{6}$/),
});

/**
 * GET /api/npi/lookup?npi=...
 * Lookup NPI in NPPES registry
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { npi } = LookupSchema.parse(req.query);

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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup NPI' });
  }
});

/**
 * POST /api/claim/basic
 * Start Level 1 claim process - request OTP
 */
router.post('/basic', async (req: Request, res: Response) => {
  try {
    const { npi, email } = BasicClaimSchema.parse(req.body);

    // Verify NPI exists
    const provider = await nppesService.lookup(npi);
    if (!provider) {
      return res.status(404).json({ error: 'NPI not found' });
    }

    // Check if OTP is locked
    const isLocked = await otpService.isLocked(npi);
    if (isLocked) {
      return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    }

    // Issue OTP
    const code = await otpService.issueOTP(npi, email, 'email');

    res.json({
      success: true,
      message: 'OTP sent to email',
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Basic claim error:', error);
    res.status(500).json({ error: 'Failed to process claim request' });
  }
});

/**
 * POST /api/claim/verify-pin
 * Verify OTP and create Level 1 claim
 */
router.post('/verify-pin', async (req: Request, res: Response) => {
  try {
    const { npi, pin } = VerifyPinSchema.parse(req.body);

    // Verify OTP
    const result = await otpService.verifyOTP(npi, pin);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        remainingAttempts: result.remainingAttempts,
      });
    }

    // Lookup provider
    const provider = await nppesService.lookup(npi);
    if (!provider) {
      return res.status(404).json({ error: 'NPI not found' });
    }

    const name = nppesService.getProviderName(provider);
    const roles = nppesService.inferRole(provider);

    // Check if claim already exists
    let claim = await prisma.npiClaim.findUnique({ where: { npi } });
    let user;

    if (claim) {
      user = await prisma.user.findUnique({ where: { id: claim.userId } });

      // Update claim level if it was lower
      if (claim.level < 1) {
        claim = await prisma.npiClaim.update({
          where: { id: claim.id },
          data: { level: 1, lastVerifiedAt: new Date() },
        });
      }
    } else {
      // Create new user
      const did = generateDID();
      user = await prisma.user.create({
        data: {
          email: provider.addresses?.[0]?.telephone_number || `${npi}@npi.local`,
          name,
          did,
          roles,
        },
      });

      // Create Level 1 claim
      claim = await prisma.npiClaim.create({
        data: {
          npi,
          userId: user.id,
          level: 1,
          evidence: {
            verified: true,
            method: 'email_otp',
            timestamp: new Date().toISOString(),
          },
          lastVerifiedAt: new Date(),
        },
      });

      // Audit event
      await prisma.auditEvent.create({
        data: {
          type: 'CLAIM_L1_OK',
          subjectNpi: npi,
          userId: user.id,
          data: {
            level: 1,
            did: user.did,
          },
        },
      });
    }

    res.json({
      success: true,
      level: claim.level,
      userId: user.id,
      did: user.did,
      roles: user.roles,
      claim: {
        id: claim.id,
        npi: claim.npi,
        level: claim.level,
        verifiedAt: claim.lastVerifiedAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Verify pin error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

/**
 * GET /api/claim/:npi
 * Get claim status
 */
router.get('/:npi', async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;

    const claim = await prisma.npiClaim.findUnique({
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
      did: claim.user.did,
      roles: claim.user.roles,
      emailVerified: claim.level >= 1,
      phoneVerified: false, // Not implemented yet
      identityConfidence: (claim.evidence as any)?.identityConfidence || null,
      evidence: claim.evidence,
      issuerAttestationTx: claim.issuerAttestationTx,
      lastVerifiedAt: claim.lastVerifiedAt,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    });
  } catch (error: any) {
    console.error('Get claim error:', error);
    res.status(500).json({ error: 'Failed to get claim' });
  }
});

export default router;
