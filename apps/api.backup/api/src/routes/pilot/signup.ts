/**
 * Public Pilot Signup Endpoint
 * B162B-PILOT-002
 */

import { PilotSignupStatus, PrismaClient } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { onPilotSignup } from 'services/pilot/hooks/onPilotSignup';
import { normalizePilotSignupInput } from 'services/pilot/models/PilotSignup';

const router = Router();
const prisma = new PrismaClient();

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const normalized = normalizePilotSignupInput(req.body || {});

    const signup = await prisma.pilotSignup.create({
      data: {
        ...normalized,
        status: PilotSignupStatus.NEW,
        statusChangedAt: new Date(),
      },
    });

    onPilotSignup(signup).catch((error) => {
      console.error('[POST /pilot/signup] onPilotSignup hook failed', error);
    });

    return res.status(202).json({
      message: 'Thanks! Our team will follow up shortly.',
      signupId: signup.id,
      status: signup.status,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: error.flatten(),
      });
    }

    console.error('[POST /pilot/signup] Unexpected error', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to submit pilot signup',
    });
  }
});

export default router;

