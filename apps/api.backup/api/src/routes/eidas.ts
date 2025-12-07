import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifySDJWT } from '../services/credentials/sdjwt-verifier';

export const eidasRouter = Router();

const PresentationSchema = z.object({
  sd_jwt: z.string().optional(),
  vp_token: z.string().optional(),
  disclosures: z.array(z.string()).optional(),
});

eidasRouter.post('/present', async (req: Request, res: Response) => {
  try {
    const result = PresentationSchema.safeParse(req.body);
    if (!result.success) {
       return res.status(400).json({ error: 'Invalid request body', details: result.error });
    }

    const { sd_jwt, vp_token, disclosures } = result.data;
    const token = vp_token || sd_jwt;

    if (!token) {
       return res.status(400).json({ error: 'Missing vp_token or sd_jwt' });
    }

    // Verify SD-JWT
    const verification = await verifySDJWT(token, disclosures);

    if (!verification.valid) {
      return res.status(401).json({
        error: 'Verification failed',
        details: verification.errors
      });
    }

    // In a real implementation, we would check against the Trust Framework here
    // e.g. verifying the issuer is in the Trusted List (Task 68.4)

    return res.json({
      success: true,
      verified: true,
      claims: verification.revealedClaims
    });

  } catch (error: any) {
    console.error('eIDAS presentation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});














