import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const BasicClaimSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
  email: z.string().email(),
});

/**
 * POST /api/claim/basic
 * Start Level 1 claim process - request OTP
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { npi, email } = BasicClaimSchema.parse(req.body);

    // Try to import from backend if available
    try {
      const { nppesService } = await import('../../../../backend/src/services/nppes');
      const { OtpService } = await import('../../../../backend/src/services/otp');

      // Verify NPI exists
      const provider = await nppesService.lookup(npi);
      if (!provider) {
        return res.status(404).json({ error: 'NPI not found' });
      }

      const otpService = new OtpService(prisma);

      // Check if OTP is locked
      const isLocked = await otpService.isLocked(npi);
      if (isLocked) {
        return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
      }

      // Issue OTP
      await otpService.issueOTP(npi, email, 'email');

      res.json({
        success: true,
        message: 'OTP sent to email',
        expiresIn: 600, // 10 minutes in seconds
      });
    } catch (importError) {
      console.warn('Backend services not available, using fallback');
      res.status(501).json({ error: 'Claim service not configured' });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Basic claim error:', error);
    res.status(500).json({ error: 'Failed to process claim request' });
  }
});

export default router;

